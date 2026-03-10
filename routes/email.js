const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const User    = require('../models/User');

const PROSPEO_KEY = process.env.PROSPEO_API_KEY;

// ── Helper: reset daily credits if new day ──
async function checkDailyReset(user) {
  const now      = new Date();
  const lastReset = user.lastCreditReset ? new Date(user.lastCreditReset) : null;
  const isNewDay  = !lastReset ||
    lastReset.getUTCFullYear() !== now.getUTCFullYear() ||
    lastReset.getUTCMonth()    !== now.getUTCMonth()    ||
    lastReset.getUTCDate()     !== now.getUTCDate();

  if (isNewDay && user.plan === 'free') {
    user.credits       = 200;
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

    // Check if this profile was already looked up today (no double count)
    const profileKey = linkedinUrl || `${name}|${company}`;
    const today      = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const cacheKey   = `${profileKey}|${today}`;

    const alreadySeen = user.viewedProfiles && user.viewedProfiles.includes(cacheKey);

    if (!alreadySeen) {
      // Check credits
      if (user.plan === 'free' && user.credits <= 0) {
        return res.status(402).json({
          message: 'daily_limit_reached',
          creditsLeft: 0,
          plan: user.plan
        });
      }
    }

    // ── Call Prospeo API ──
    let emails = [];
    let prospeoData = null;

    if (linkedinUrl) {
      // Best method: LinkedIn URL lookup
      const prospeoRes = await fetch('https://api.prospeo.io/linkedin-email-finder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-KEY': PROSPEO_KEY
        },
        body: JSON.stringify({ url: linkedinUrl })
      });
      prospeoData = await prospeoRes.json();

      if (prospeoData?.response?.email) {
        emails.push({
          email:    prospeoData.response.email,
          type:     'work',
          verified: prospeoData.response.verification?.status === 'VALID' || true,
          confidence: prospeoData.response.verification?.rate || 90
        });
      }
    }

    // Fallback: domain search if no LinkedIn URL
    if (emails.length === 0 && name && company) {
      const domain = company
        .toLowerCase()
        .replace(/\s+(inc|llc|ltd|corp|co|group|the)\.?$/i, '')
        .trim()
        .replace(/\s+/g, '') + '.com';

      const domainRes = await fetch('https://api.prospeo.io/email-finder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-KEY': PROSPEO_KEY
        },
        body: JSON.stringify({
          full_name: name,
          domain:    domain
        })
      });
      const domainData = await domainRes.json();

      if (domainData?.response?.email) {
        emails.push({
          email:    domainData.response.email,
          type:     'work',
          verified: domainData.response.verification?.status === 'VALID' || true,
          confidence: domainData.response.verification?.rate || 80
        });
      }
    }

    // ── Deduct credit and mark profile as seen ──
    if (!alreadySeen) {
      if (user.plan === 'free') {
        user.credits = Math.max(0, user.credits - 1);
      }
      if (!user.viewedProfiles) user.viewedProfiles = [];
      // Keep last 500 viewed profiles to avoid unbounded growth
      user.viewedProfiles = [cacheKey, ...user.viewedProfiles].slice(0, 500);
      await user.save();
    }

    return res.json({
      emails,
      credits:    user.credits,
      plan:       user.plan,
      alreadySeen,
      cached:     alreadySeen
    });

  } catch (err) {
    console.error('find-email error:', err);
    res.status(500).json({ message: 'Server error' });
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
