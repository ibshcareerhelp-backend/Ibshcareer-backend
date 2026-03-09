// routes/billing.js — Stripe $5/month subscription
const express = require('express');
const stripe  = require('stripe')(process.env.STRIPE_SECRET_KEY);
const auth    = require('../middleware/auth');
const User    = require('../models/User');
const router  = express.Router();

const PRICE_ID = process.env.STRIPE_PRICE_ID; // Your $5/month price ID from Stripe

// ── CREATE CHECKOUT SESSION ──────────────────
router.get('/create-checkout', auth, async (req, res) => {
  try {
    const user = req.user;

    // Create or reuse Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name:  user.name,
        metadata: { userId: user._id.toString() }
      });
      customerId = customer.id;
      await User.findByIdAndUpdate(user._id, { stripeCustomerId: customerId });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{
        price: PRICE_ID,
        quantity: 1
      }],
      success_url: `${process.env.APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.APP_URL}/upgrade`,
      metadata: { userId: user._id.toString() }
    });

    res.redirect(session.url);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not create checkout session' });
  }
});

// ── SUCCESS PAGE ─────────────────────────────
router.get('/success', async (req, res) => {
  res.send(`<!DOCTYPE html><html><head><title>Welcome to Pro!</title>
  <style>body{font-family:sans-serif;background:#0B1D35;color:#F7F4EE;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center}
  h1{color:#D4A847}p{color:rgba(247,244,238,0.6)}</style></head>
  <body><div><h1>✅ You're now on ReachIn Pro!</h1>
  <p>Unlimited email lookups are now active.</p>
  <p style="margin-top:20px;font-size:13px">Close this tab and reload the extension.</p></div></body></html>`);
});

// ── STRIPE WEBHOOK ────────────────────────────
// Handles subscription events from Stripe
router.post('/webhook', async (req, res) => {
  const sig    = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {

    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId  = session.metadata?.userId;
      if (userId) {
        await User.findByIdAndUpdate(userId, {
          plan: 'pro',
          stripeSubscriptionId: session.subscription
        });
        console.log(`✅ User ${userId} upgraded to Pro`);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub    = event.data.object;
      const user   = await User.findOne({ stripeSubscriptionId: sub.id });
      if (user) {
        await User.findByIdAndUpdate(user._id, { plan: 'free', credits: 50 });
        console.log(`⬇️  User ${user._id} downgraded to Free`);
      }
      break;
    }

    case 'invoice.payment_failed': {
      console.log('⚠️  Payment failed for subscription:', event.data.object.subscription);
      break;
    }
  }

  res.json({ received: true });
});

// ── CANCEL SUBSCRIPTION ───────────────────────
router.post('/cancel', auth, async (req, res) => {
  try {
    const user = req.user;
    if (!user.stripeSubscriptionId)
      return res.status(400).json({ message: 'No active subscription found' });

    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true
    });

    res.json({ message: 'Subscription will cancel at end of billing period' });
  } catch (err) {
    res.status(500).json({ message: 'Could not cancel subscription' });
  }
});

module.exports = router;
