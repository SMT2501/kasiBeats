import React, { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { AuthContext } from '../context/AuthContext';
import { toast } from 'react-toastify';
import './EventCard.css';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

const EventCard = ({ event, onClick }) => {
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const isOrganizer = currentUser && currentUser.uid === event.organizerId;

  const handleBuyTicket = async () => {
    if (!currentUser) {
      toast.error('Please log in to buy a ticket on KasiBeats.');
      navigate('/login');
      return;
    }
  
    if (!stripePromise) {
      toast.error('Payment system unavailable. Please contact support.');
      return;
    }
  
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event.id,
          eventName: event.name,
          price: event.ticketPrice || 20,
          userId: currentUser.uid,
        }),
      });
  
      // Log raw response for debugging
      const text = await response.text();
      console.log('Raw response:', text);
  
      // Check if response is OK before parsing
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}, Body: ${text}`);
      }
  
      // Parse as JSON
      const session = JSON.parse(text);
      if (session.error) throw new Error(session.error);
  
      const stripe = await stripePromise;
      const { error } = await stripe.redirectToCheckout({ sessionId: session.id });
      if (error) throw new Error(error.message);
    } catch (error) {
      toast.error('Failed to buy ticket: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const formattedDate = event.date && typeof event.date.toDate === 'function'
    ? event.date.toDate().toLocaleDateString()
    : event.date ? new Date(event.date).toLocaleDateString() : 'Date unavailable';

  return (
    <div className="event-card" onClick={onClick}>
      <img
        src={event.mediaUrl || 'https://via.placeholder.com/150'}
        alt={event.name || 'Event'}
        className="event-card-media"
      />
      <h3>{event.name || 'Untitled Event on KasiBeats'}</h3>
      <p>{formattedDate}</p>
      <p>{event.location || 'Location unavailable'}</p>
      <p>Booked DJs: {event.djs?.length || 0}</p>
      {currentUser && isOrganizer && (
        <>
          <p>Tickets Sold: {event.ticketsSold || 0}</p>
          <p>Revenue Generated: R{event.revenue || 0}</p>
        </>
      )}
      {currentUser && (
        <button
          onClick={(e) => { e.stopPropagation(); handleBuyTicket(); }}
          className="btn buy-btn"
          disabled={loading || (event.ticketQuantity - (event.ticketsSold || 0)) <= 0}
        >
          {loading ? 'Processing...' : `Buy Ticket (R${event.ticketPrice || 20})`}
        </button>
      )}
      {isOrganizer && (
        <div className="event-card-actions">
          <button className="btn edit-btn" onClick={(e) => { e.stopPropagation(); navigate(`/events/${event.id}/edit`); }}>
            Edit
          </button>
          <span>Booked DJs: {event.djsBooked?.length || 0}</span>
          <span>Pending: {event.pendingDjs?.length || 0}</span>
        </div>
      )}
    </div>
  );
};

export default EventCard;