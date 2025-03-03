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

// Export functions
exports.createCheckoutSession = createCheckoutSession(firestore);
exports.sendBookingNotification = sendBookingNotification(firestore, messaging);
exports.stripeWebhook = stripeWebhook(firestore);