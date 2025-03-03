const { onRequest } = require('firebase-functions/v2/https');
const stripe = require('stripe')('sk_test_51LKy7kAlB2qwPZQ3NXfLWLz3SzEihOsNwcGhg2oPkzbmkzFcyyxyMasAc772AKCbjHh7pASCwZMK0BrEbPfBZPkj00vxDDd2dI');

exports.createCheckoutSession = (firestore) => onRequest(async (req, res) => {
  const { eventId, eventName, price, userId } = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Ticket for ${eventName}`,
              metadata: { eventId },
            },
            unit_amount: price * 100,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `http://localhost:3000/events/${eventId}?success=true`,
      cancel_url: `http://localhost:3000/events/${eventId}?cancelled=true`,
      metadata: { userId, eventId },
    });

    res.status(200).json({ id: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
});