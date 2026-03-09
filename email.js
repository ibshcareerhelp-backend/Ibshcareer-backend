// routes/email.js
const express = require('express');
const dns     = require('dns').promises;
const auth    = require('../middleware/auth');
const User    = require('../models/User');
const router  = express.Router();

// ── FIND EMAIL ──────────────────────────────────────────
router.post('/find-email', auth, async (req, res) => {
  try {
    const user = req.user;

    // Check credits (free plan)
    if (user.plan === 'free' && user.credits <= 0) {
      return res.status(402).json({
        message: 'No credits remaining. Upgrade to Pro for unlimited lookups.',
        upgradeUrl: '/upgrade'
      });
    }

    const { name, company, username } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });

    // Generate email candidates
    const emails = await generateEmails(name, company, username);

    // Deduct credit for free users
    if (user.plan === 'free') {
      await User.findByIdAndUpdate(user._id, { $inc: { credits: -1 } });
    }

    res.json({ emails, creditsRemaining: user.plan === 'free' ? user.credits - 1 : null });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET CREDITS ─────────────────────────────────────────
router.get('/credits', auth, async (req, res) => {
  const user = await User.findById(req.user._id).select('credits plan');
  res.json({ credits: user.credits, plan: user.plan });
});

// ── SAVE CONTACT ────────────────────────────────────────
router.post('/save-contact', auth, async (req, res) => {
  try {
    const { name, title, company, emails } = req.body;
    await User.findByIdAndUpdate(req.user._id, {
      $push: {
        savedContacts: { $each: [{ name, title, company, emails }], $position: 0, $slice: 500 }
      }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── EMAIL GENERATION LOGIC ──────────────────────────────
async function generateEmails(fullName, company, username) {
  const results = [];

  // Parse name
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.toLowerCase() || '';
  const last  = parts[parts.length - 1]?.toLowerCase() || '';
  const fi    = first[0] || '';

  // Try to get domain from company name
  const domain = await guessDomain(company);

  if (domain) {
    const patterns = [
      { email: `${first}.${last}@${domain}`,   type: 'work', verified: false },
      { email: `${fi}${last}@${domain}`,        type: 'work', verified: false },
      { email: `${first}@${domain}`,            type: 'work', verified: false },
      { email: `${first}${last}@${domain}`,     type: 'work', verified: false },
    ];

    for (const p of patterns) {
      const verified = await verifyEmailDomain(p.email);
      if (verified || results.length === 0) {
        results.push({ ...p, verified });
        if (results.length >= 3) break;
      }
    }
  }

  // Add personal email guess (shown but locked for free users)
  if (first && last) {
    results.push({
      email: `${first}.${last}@gmail.com`,
      type: 'personal',
      verified: false
    });
  }

  return results;
}

// Guess company domain from name
async function guessDomain(company) {
  if (!company) return null;

  // Clean company name → domain guess
  const cleaned = company
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|co|group|the|&|and)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();

  if (!cleaned) return null;

  const candidates = [
    `${cleaned}.com`,
    `${cleaned}.io`,
    `${cleaned}.co`,
  ];

  for (const domain of candidates) {
    try {
      await dns.resolveMx(domain);
      return domain; // Found a domain with MX records = real email domain
    } catch {
      continue;
    }
  }

  return cleaned + '.com'; // Best guess fallback
}

// Verify email domain has MX records
async function verifyEmailDomain(email) {
  try {
    const domain = email.split('@')[1];
    const mx = await dns.resolveMx(domain);
    return mx && mx.length > 0;
  } catch {
    return false;
  }
}

module.exports = router;
