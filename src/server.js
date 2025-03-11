require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.REACT_APP_STRIPE_SECRET_KEY);
const app = express();
const cors = require('cors')

app.use(cors({ origin: 'http://localhost:3000' })); // Allow requests from React dev server
app.use(express.json());

// Endpoint to create a Stripe Checkout Session
app.post('/api/create-checkout-session', async (req, res) => {
  const { eventId, eventName, price, userId, successUrl, cancelUrl } = req.body;

  try {
    // Create a Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'zar', // South African Rand (adjust as needed)
            product_data: {
              name: eventName,
              metadata: { eventId, userId },
            },
            unit_amount: price * 100, // Stripe expects amounts in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl || `${req.headers.origin}/success`,
      cancel_url: cancelUrl || `${req.headers.origin}/cancel`,
      metadata: { eventId, userId },
    });

    res.json({ id: session.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));