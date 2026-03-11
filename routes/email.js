const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const User    = require('../models/User');

const PROSPEO_KEY  = process.env.PROSPEO_API_KEY;
const SNOV_USER_ID = process.env.SNOV_USER_ID;
const SNOV_SECRET  = process.env.SNOV_SECRET;
const APOLLO_KEY   = process.env.APOLLO_API_KEY;

function extractDomain(company) {
  if (!company) return null;
  return company.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+(inc|llc|ltd|corp|co|group|the|consulting|services|solutions|technologies|tech)\s*$/i, '')
    .trim().replace(/\s+/g, '') + '.com';
}

function guessEmails(fullName, domain) {
  if (!fullName || !domain) return [];
  const parts = fullName.toLowerCase().replace(/[^a-z\s]/g, '').trim().split(/\s+/);
  const f = parts[0] || '', l = parts[parts.length - 1] || '';
  if (!f) return [];
  return [...new Set([
    `${f}.${l}@${domain}`, `${f}${l}@${domain}`, `${f}@${domain}`,
    `${f[0]}${l}@${domain}`, `${f}.${l[0]}@${domain}`
  ])].map(email => ({ email, type: 'work', verified: false, confidence: 35, source: 'pattern' }));
}

async function checkDailyReset(user) {
  const now = new Date(), last = user.lastCreditReset ? new Date(user.lastCreditReset) : null;
  const isNewDay = !last || last.getUTCFullYear() !== now.getUTCFullYear() ||
    last.getUTCMonth() !== now.getUTCMonth() || last.getUTCDate() !== now.getUTCDate();
  if (isNewDay && user.plan === 'free') {
    user.credits = 200; user.lastCreditReset = now; await user.save();
  }
  return user;
}

// ── Snov.io: get access token ──
async function getSnovToken() {
  try {
    const r = await fetch('https://api.snov.io/v1/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: SNOV_USER_ID,
        client_secret: SNOV_SECRET
      })
    });
    const d = await r.json();
    return d.access_token || null;
  } catch(e) { return null; }
}

// ── Snov.io: find email by name + domain ──
async function searchSnov(name, domain) {
  try {
    const token = await getSnovToken();
    if (!token) return [];
    const parts = name.trim().split(/\s+/);
    const firstName = parts[0], lastName = parts[parts.length - 1];
    const r = await fetch('https://api.snov.io/v1/get-emails-from-names', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: token,
        firstName, lastName, domain
      })
    });
    const d = await r.json();
    if (d.data && d.data.emails) {
      return d.data.emails.map(e => ({
        email: e.email,
        type: e.emailType === 'personal' ? 'personal' : 'work',
        verified: e.emailStatus === 'verified',
        confidence: e.confidence || 70,
        source: 'snov.io'
      }));
    }
    return [];
  } catch(e) { console.log('Snov error:', e.message); return []; }
}

// ── Apollo.io: find email by name + domain ──
async function searchApollo(name, domain, linkedinUrl) {
  try {
    const parts = name.trim().split(/\s+/);
    const body = {
      api_key: APOLLO_KEY,
      first_name: parts[0],
      last_name: parts[parts.length - 1],
      organization_domains: [domain]
    };
    if (linkedinUrl) body.linkedin_url = linkedinUrl;

    const r = await fetch('https://api.apollo.io/v1/people/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      body: JSON.stringify(body)
    });
    const d = await r.json();
    const emails = [];
    if (d.person?.email) {
      emails.push({
        email: d.person.email,
        type: 'work',
        verified: true,
        confidence: 85,
        source: 'apollo'
      });
    }
    // Apollo sometimes returns personal emails
    if (d.person?.personal_emails?.length) {
      d.person.personal_emails.forEach(e => {
        emails.push({ email: e, type: 'personal', verified: true, confidence: 80, source: 'apollo' });
      });
    }
    return emails;
  } catch(e) { console.log('Apollo error:', e.message); return []; }
}

// ── Prospeo: enrich person ──
async function searchProspeo(name, linkedinUrl, company) {
  try {
    if (!PROSPEO_KEY) return [];
    const body = { only_verified_email: false, data: { full_name: name } };
    if (linkedinUrl) body.data.linkedin_url = linkedinUrl;
    if (company) body.data.company_website = extractDomain(company);
    const r = await fetch('https://api.prospeo.io/enrich-person', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-KEY': PROSPEO_KEY },
      body: JSON.stringify(body)
    });
    const d = await r.json();
    if (!d.error && d.response?.email) {
      return [{ email: d.response.email, type: 'work', verified: true, confidence: 90, source: 'prospeo' }];
    }
    return [];
  } catch(e) { console.log('Prospeo error:', e.message); return []; }
}

// ── Deduplicate emails ──
function dedupeEmails(allEmails) {
  const seen = new Set();
  return allEmails.filter(e => {
    if (!e.email || seen.has(e.email.toLowerCase())) return false;
    seen.add(e.email.toLowerCase());
    return true;
  }).sort((a, b) => b.confidence - a.confidence);
}

// ── POST /api/find-email ──
router.post('/find-email', auth, async (req, res) => {
  try {
    const { linkedinUrl, name, company } = req.body;
    const user = await checkDailyReset(req.user);

    const profileKey  = linkedinUrl || `${name}|${company}`;
    const today       = new Date().toISOString().slice(0, 10);
    const cacheKey    = `${profileKey}|${today}`;
    const alreadySeen = user.viewedProfiles?.includes(cacheKey);

    if (!alreadySeen && user.plan === 'free' && user.credits <= 0) {
      return res.status(402).json({ message: 'daily_limit_reached', creditsLeft: 0, plan: user.plan });
    }

    const domain = company ? extractDomain(company) : null;

    // ── Run all sources in parallel ──
    const [prospeoEmails, snovEmails, apolloEmails] = await Promise.all([
      searchProspeo(name, linkedinUrl, company),
      domain ? searchSnov(name, domain) : Promise.resolve([]),
      domain ? searchApollo(name, domain, linkedinUrl) : Promise.resolve([])
    ]);

    let emails = dedupeEmails([...prospeoEmails, ...snovEmails, ...apolloEmails]);

    // ── Fallback pattern emails if nothing found ──
    if (emails.length === 0 && domain) {
      emails = guessEmails(name, domain).slice(0, 3);
    }

    // ── Only deduct credit if email found ──
    if (!alreadySeen && emails.length > 0) {
      if (user.plan === 'free') user.credits = Math.max(0, user.credits - 1);
      if (!user.viewedProfiles) user.viewedProfiles = [];
      user.viewedProfiles = [cacheKey, ...user.viewedProfiles].slice(0, 500);
      await user.save();
    }

    return res.json({
      emails,
      credits: user.credits,
      plan: user.plan,
      alreadySeen,
      found: emails.length > 0,
      sources: {
        prospeo: prospeoEmails.length,
        snov: snovEmails.length,
        apollo: apolloEmails.length
      }
    });

  } catch (err) {
    console.error('find-email error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/credits', auth, async (req, res) => {
  try {
    const user = await checkDailyReset(req.user);
    res.json({ credits: user.credits, plan: user.plan });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

router.post('/save-contact', auth, async (req, res) => {
  try {
    const { name, title, company, emails } = req.body;
    req.user.savedContacts.unshift({ name, title, company, emails });
    if (req.user.savedContacts.length > 1000) req.user.savedContacts.pop();
    await req.user.save();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
