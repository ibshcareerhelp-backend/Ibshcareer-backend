const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const User    = require('../models/User');

const PROSPEO_KEY = process.env.PROSPEO_API_KEY;

// Common email patterns fallback
function guessEmails(fullName, domain) {
  if (!fullName || !domain) return [];
  const parts = fullName.toLowerCase().replace(/[^a-z\s]/g, '').trim().split(/\s+/);
  const first = parts[0] || '';
  const last  = parts[parts.length - 1] || '';
  if (!first || !domain) return [];
  const patterns = [
    `${first}.${last}@${domain}`,
    `${first}${last}@${domain}`,
    `${first}@${domain}`,
    `${first[0]}${last}@${domain}`,
    `${first}.${last[0]}@${domain}`,
  ];
  return [...new Set(patterns)].map(email => ({
    email, type: 'work', verified: false, confidence: 40
  }));
}

function extractDomain(company) {
  if (!company) return null;
  return company
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+(inc|llc|ltd|corp|co|group|the|consulting|services|solutions|technologies|tech)\s*$/i, '')
    .trim()
    .replace(/\s+/g, '') + '.com';
}

async function checkDailyReset(user) {
  const now  = new Date();
  const last = user.lastCreditReset ? new Date(user.lastCreditReset) : null;
  const isNewDay = !last ||
    last.getUTCFullYear() !== now.getUTCFullYear() ||
    last.getUTCMonth()    !== now.getUTCMonth()    ||
    last.getUTCDate()     !== now.getUTCDate();
  if (isNewDay && user.plan === 'free') {
    user.credits = 200;
    user.lastCreditReset = now;
    await user.save();
  }
  return user;
}

// ── POST /api/find-email ──
router.post('/find-email', auth, async (req, res) => {
  try {
    const { linkedinUrl, name, company } = req.body;
    const user = await checkDailyReset(req.user);

    // Cache key for dedup
    const profileKey  = linkedinUrl || `${name}|${company}`;
    const today       = new Date().toISOString().slice(0, 10);
    const cacheKey    = `${profileKey}|${today}`;
    const alreadySeen = user.viewedProfiles && user.viewedProfiles.includes(cacheKey);

    // Daily limit check
    if (!alreadySeen && user.plan === 'free' && user.credits <= 0) {
      return res.status(402).json({ message: 'daily_limit_reached', creditsLeft: 0, plan: user.plan });
    }

    let emails = [];

    // ── NEW Prospeo API: enrich-person ──
    if (name && PROSPEO_KEY) {
      try {
        const domain = company ? extractDomain(company) : null;
        const body = { only_verified_email: false, data: { full_name: name } };
        if (linkedinUrl) body.data.linkedin_url = linkedinUrl;
        if (domain) body.data.company_website = domain;

        const pRes  = await fetch('https://api.prospeo.io/enrich-person', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-KEY': PROSPEO_KEY },
          body: JSON.stringify(body)
        });
        const pData = await pRes.json();
        console.log('Prospeo enrich-person:', JSON.stringify(pData));

        if (!pData.error && pData.response?.email) {
          emails.push({
            email:      pData.response.email,
            type:       'work',
            verified:   pData.response.email_verification?.status === 'VALID',
            confidence: 90
          });
        }
      } catch (e) {
        console.log('Prospeo error:', e.message);
      }
    }

    // ── Fallback: pattern-based emails ──
    if (emails.length === 0 && name && company) {
      const domain = extractDomain(company);
      if (domain) {
        emails = guessEmails(name, domain).slice(0, 3);
      }
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
      credits:    user.credits,
      plan:       user.plan,
      alreadySeen,
      found:      emails.length > 0
    });

  } catch (err) {
    console.error('find-email error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── GET /api/credits ──
router.get('/credits', auth, async (req, res) => {
  try {
    const user = await checkDailyReset(req.user);
    res.json({ credits: user.credits, plan: user.plan });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── POST /api/save-contact ──
router.post('/save-contact', auth, async (req, res) => {
  try {
    const { name, title, company, emails } = req.body;
    req.user.savedContacts.unshift({ name, title, company, emails });
    if (req.user.savedContacts.length > 1000) req.user.savedContacts.pop();
    await req.user.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
