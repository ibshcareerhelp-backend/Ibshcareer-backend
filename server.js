require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');
const emailRoutes = require('./routes/email');
const billingRoutes = require('./routes/billing');

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

app.use('/api/auth', authRoutes);
app.use('/api', emailRoutes);
app.use('/api/billing', billingRoutes);

app.get('/upgrade', (req, res) => {
  res.send('<html><body style="font-family:sans-serif;background:#0B1D35;color:#F7F4EE;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0"><div style="background:#142744;border:1px solid rgba(212,168,71,0.3);border-radius:16px;padding:40px;max-width:420px;text-align:center"><h1 style="color:#D4A847">IbshCareer Pro</h1><p style="color:rgba(247,244,238,0.6)">Unlock unlimited email lookups</p><div style="font-size:48px;font-weight:800;color:#D4A847">$5<small style="font-size:16px;color:rgba(247,244,238,0.5)">/month</small></div><ul style="list-style:none;text-align:left;margin:20px 0;padding:0"><li style="padding:6px 0">✓ Unlimited email lookups</li><li style="padding:6px 0">✓ Personal + work emails</li><li style="padding:6px 0">✓ Export to CSV</li><li style="padding:6px 0">✓ Priority support</li></ul><a href="/api/billing/create-checkout" style="display:block;padding:14px;background:linear-gradient(135deg,#D4A847,#F0C96B);color:#0B1D35;font-weight:800;font-size:16px;border-radius:10px;text-decoration:none;margin-top:24px">Upgrade Now</a></div></body></html>');
});

app.get('/', (req, res) => res.json({ status: 'IbshCareer API running' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`IbshCareer API running on port ${PORT}`));
