import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { AuthContext } from '../context/AuthContext';
import './EventCard.css';

// Initialize Stripe with your publishable key (replace with your key)
const stripePromise = loadStripe('pk_test_51LKy7kAlB2qwPZQ39DZ9bnVntBotA7OY7Y1OBLQeA3HjJFJ8jXtXpdhufY9eqOPmUlJaWwIkUOWmHo9FNMmPVVFu00b0qThNvt');

const EventCard = ({ event }) => {
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleBuyTicket = async () => {
    if (!currentUser) {
      alert('Please log in to buy a ticket.');
      navigate('/login');
      return;
    }

    try {
      // Call your backend to create a Stripe Checkout session
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId: event.id,
          eventName: event.name,
          price: event.price || 20, // In cents (e.g., $20 = 2000 cents)
          userId: currentUser.uid,
        }),
      });

      const session = await response.json();

      if (session.error) {
        throw new Error(session.error);
      }

      // Redirect to Stripe Checkout
      const stripe = await stripePromise;
      const { error } = await stripe.redirectToCheckout({ sessionId: session.id });

      if (error) {
        throw new Error(error.message);
      }

      // After successful payment, Stripe redirects to /events/:eventId/checkout
    } catch (error) {
      console.error('Error initiating checkout:', error);
      alert('Failed to buy ticket: ' + error.message);
    }
  };

  const formattedDate = event.date?.seconds
    ? new Date(event.date.seconds * 1000).toLocaleDateString()
    : 'Date unavailable';

  return (
    <div className="event-card">
      <Link to={`/events/${event.id}`}>
        <img
          src={event.mediaUrl || 'https://via.placeholder.com/150'}
          alt="Event"
          className="event-picture"
        />
      </Link>
      <h3>{event.name || 'Untitled Event'}</h3>
      <p>{formattedDate}</p>
      <p>{event.location || 'Location unavailable'}</p>
      <p>Price: R{event.price || 20}</p>
      {currentUser && (
        <button onClick={handleBuyTicket} className="btn">
          Buy Ticket
        </button>
      )}
    </div>
  );
};

export default EventCard;