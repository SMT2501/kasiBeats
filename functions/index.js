const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

// Initialize Firebase Admin once
const app = initializeApp();
const firestore = getFirestore();
const messaging = getMessaging();

// Import functions directly
const { createCheckoutSession } = require('./src/checkout');
const { sendBookingNotification } = require('./src/notifications');
const { stripeWebhook } = require('./src/webhooks');

const functions = require('firebase-functions');
const stripe = require('stripe')(process.env.REACT_APP_STRIPE_SECRET_KEY);

exports.processBookingPayment = functions.firestore
  .document('bookings/{bookingId}')
  .onUpdate(async (change, context) => {
    if (change.after.data().status === 'completed') {
      const booking = change.after.data();
      const djAccount = await stripe.accounts.create({ type: 'express' }); // Onboard DJ
      await stripe.transfers.create({
        amount: booking.price * 100 * (booking.paymentTerms === '50' ? 0.5 : 1),
        currency: 'zar',
        destination: djAccount.id,
      });
    }
  });

// Export functions
exports.createCheckoutSession = createCheckoutSession(firestore);
exports.sendBookingNotification = sendBookingNotification(firestore, messaging);
exports.stripeWebhook = stripeWebhook(firestore);