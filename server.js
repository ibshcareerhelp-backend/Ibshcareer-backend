// server.js — ReachIn Backend API
require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const mongoose = require('mongoose');

const authRoutes    = require('./routes/auth');
const emailRoutes   = require('./routes/email');
const billingRoutes = require('./routes/billing');

const app = express();

// ── MIDDLEWARE ──────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());

// Stripe webhooks need raw body
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

// ── DATABASE ────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// ── ROUTES ──────────────────────────────────────────────
app.use('/api/auth',    authRoutes);
app.use('/api',         emailRoutes);
app.use('/api/billing', billingRoutes);

// ── UPGRADE PAGE ────────────────────────────────────────
app.get('/upgrade', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>ReachIn Pro – $5/month</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body { font-family: sans-serif; background: #0B1D35; color: #F7F4EE; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #142744; border: 1px solid rgba(212,168,71,0.3); border-radius: 16px; padding: 40px; max-width: 420px; text-align: center; }
    h1 { font-size: 28px; margin-bottom: 6px; }
    h1 span { color: #D4A847; }
    p { color: rgba(247,244,238,0.6); font-size: 14px; margin-bottom: 24px; }
    .price { font-size: 48px; font-weight: 800; color: #D4A847; }
    .price small { font-size: 16px; color: rgba(247,244,238,0.5); }
    ul { list-style: none; text-align: left; margin: 20px 0; padding: 0; }
    ul li { padding: 6px 0; font-size: 14px; color: rgba(247,244,238,0.8); }
    ul li::before { content: '✓ '; color: #3DD68C; font-weight: bold; }
    .btn { display: block; width: 100%; padding: 14px; background: linear-gradient(135deg,#D4A847,#F0C96B); color: #0B1D35; font-weight: 800; font-size: 16px; border: none; border-radius: 10px; cursor: pointer; margin-top: 24px; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Reach<span>In</span> Pro</h1>
    <p>Unlock unlimited email lookups for professionals</p>
    <div class="price">$5 <small>/month</small></div>
    <ul>
      <li>Unlimited email lookups</li>
      <li>Personal + work emails</li>
      <li>Phone numbers (where available)</li>
      <li>Export to CSV</li>
      <li>Priority support</li>
    </ul>
    <a href="/api/billing/create-checkout" class="btn">Upgrade Now →</a>
  </div>
</body>
</html>`);
});

// ── HEALTH CHECK ────────────────────────────────────────
app.get('/', (req, res) => res.json({ status: 'ReachIn API running ✅' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 ReachIn API running on port ${PORT}`));
