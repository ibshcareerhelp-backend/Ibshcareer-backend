const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const auth = require('../middleware/auth');
const User = require('../models/User');
const router = express.Router();

router.get('/create-checkout', auth, async (req, res) => {
  try {
    const user = req.user;
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, name: user.name, metadata: { userId: user._id.toString() } });
      customerId = customer.id;
      await User.findByIdAndUpdate(user._id, { stripeCustomerId: customerId });
    }
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${process.env.APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/upgrade`,
      metadata: { userId: user._id.toString() }
    });
    res.redirect(session.url);
  } catch (err) {
    res.status(500).json({ message: 'Could not create checkout session' });
  }
});

router.get('/success', async (req, res) => {
  res.send('<html><body style="font-family:sans-serif;background:#0B1D35;color:#F7F4EE;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center"><div><h1 style="color:#D4A847">You are now on IbshCareer Pro!</h1><p>Unlimited email lookups are now active.</p><p>Close this tab and reload the extension.</p></div></body></html>');
});

router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      if (userId) { await User.findByIdAndUpdate(userId, { plan: 'pro', stripeSubscriptionId: session.subscription }); }
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      const user = await User.findOne({ stripeSubscriptionId: sub.id });
      if (user) { await User.findByIdAndUpdate(user._id, { plan: 'free', credits: 50 }); }
      break;
    }
  }
  res.json({ received: true });
});

router.post('/cancel', auth, async (req, res) => {
  try {
    const user = req.user;
    if (!user.stripeSubscriptionId) return res.status(400).json({ message: 'No active subscription found' });
    await stripe.subscriptions.update(user.stripeSubscriptionId, { cancel_at_period_end: true });
    res.json({ message: 'Subscription will cancel at end of billing period' });
  } catch (err) {
    res.status(500).json({ message: 'Could not cancel subscription' });
  }
});

module.exports = router;
