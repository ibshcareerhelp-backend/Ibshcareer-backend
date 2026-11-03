const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const User    = require('../models/User');
const { findEmails, checkDailyReset } = require('../lib/emailFinder');


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

    const { emails, sources } = await findEmails({ name, company, linkedinUrl });

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
      sources
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
