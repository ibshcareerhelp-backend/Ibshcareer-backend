const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const User    = require('../models/User');

const PROSPEO_KEY = process.env.PROSPEO_API_KEY;

// Common email patterns to try
const EMAIL_PATTERNS = [
  (f, l, d) => `${f}.${l}@${d}`,
  (f, l, d) => `${f}${l}@${d}`,
  (f, l, d) => `${f}@${d}`,
  (f, l, d) => `${f[0]}${l}@${d}`,
  (f, l, d) => `${f}.${l[0]}@${d}`,
];

function guessEmails(fullName, domain) {
  if (!fullName || !domain) return [];
  const parts = fullName.toLowerCase().replace(/[^a-z\s]/g, '').trim().split(/\s+/);
  const first = parts[0] || '';
  const last  = parts[parts.length - 1] || '';
  if (!first) return [];
  return EMAIL_PATTERNS.map(fn => ({
    email: fn(first, last, domain),
    type: 'work',
    verified: false,
    confidence: 40
  })).filter(e => e.email.includes('@') && e.email.split('@')[0].length > 0);
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

// Reset daily credits if new day
async function checkDailyReset(user) {
  const now = new Date();
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

    // Check if already seen today (no double count)
    const profileKey = linkedinUrl || `${name}|${company}`;
    const today      = new Date().toISOString().slice(0, 10);
    const cacheKey   = `${profileKey}|${today}`;
    const alreadySeen = user.viewedProfiles && user.viewedProfiles.includes(cacheKey);

    // Check daily limit (only for unseen profiles)
    if (!alreadySeen && user.plan === 'free' && user.credits <= 0) {
      return res.status(402).json({
        message: 'daily_limit_reached',
        creditsLeft: 0,
        plan: user.plan
      });
    }

    let emails = [];

    // ── Try Prospeo LinkedIn Email Finder first ──
    if (linkedinUrl && PROSPEO_KEY) {
      try {
        const prospeoRes = await fetch('https://api.prospeo.io/linkedin-email-finder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-KEY': PROSPEO_KEY },
          body: JSON.stringify({ url: linkedinUrl })
        });
        const pd = await prospeoRes.json();
        if (pd?.response?.email) {
          emails.push({
            email: pd.response.email,
            type: 'work',
            verified: pd.response.verification?.status === 'VALID',
            confidence: pd.response.verification?.rate || 85
          });
        }
      } catch (e) { console.log('Prospeo LinkedIn error:', e.message); }
    }

    // ── Try Prospeo domain email finder ──
    if (emails.length === 0 && name && company && PROSPEO_KEY) {
      try {
        const domain = extractDomain(company);
        const domRes = await fetch('https://api.prospeo.io/email-finder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-KEY': PROSPEO_KEY },
          body: JSON.stringify({ full_name: name, domain })
        });
        const dd = await domRes.json();
        if (dd?.response?.email) {
          emails.push({
            email: dd.response.email,
            type: 'work',
            verified: dd.response.verification?.status === 'VALID',
            confidence: dd.response.verification?.rate || 75
          });
        }
      } catch (e) { console.log('Prospeo domain error:', e.message); }
    }

    // ── Fallback: generate pattern-based emails ──
    if (emails.length === 0 && name && company) {
      const domain = extractDomain(company);
      if (domain) {
        const guessed = guessEmails(name, domain);
        emails = guessed.slice(0, 3); // show top 3 guesses
      }
    }

    // ── Only deduct credit if emails were found ──
    if (!alreadySeen && emails.length > 0) {
      if (user.plan === 'free') {
        user.credits = Math.max(0, user.credits - 1);
      }
      if (!user.viewedProfiles) user.viewedProfiles = [];
      user.viewedProfiles = [cacheKey, ...user.viewedProfiles].slice(0, 500);
      await user.save();
    }

    return res.json({
      emails,
      credits: user.credits,
      plan: user.plan,
      alreadySeen,
      found: emails.length > 0
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
