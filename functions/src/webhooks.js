const { onRequest } = require('firebase-functions/v2/https');

exports.stripeWebhook = (firestore) => onRequest(async (req, res) => {
  res.status(200).send('Stripe webhook placeholder');
});