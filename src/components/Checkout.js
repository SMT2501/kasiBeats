import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { firestore } from '../firebaseConfig';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore'; // Added limit
import './Checkout.css';

const Checkout = () => {
  const { eventId } = useParams();
  const location = useLocation();
  const [event, setEvent] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch the event details
        const eventRef = doc(firestore, 'events', eventId);
        const eventDoc = await getDoc(eventRef);
        if (!eventDoc.exists()) {
          throw new Error('Event not found.');
        }
        setEvent({ id: eventDoc.id, ...eventDoc.data() });

        // Check payment status from query parameters
        const queryParams = new URLSearchParams(location.search);
        const success = queryParams.get('success');
        if (success) {
          // Fetch the ticket purchase (assuming user is logged in)
          const ticketsQuery = query(
            collection(firestore, 'tickets'),
            where('eventId', '==', eventId),
            where('status', '==', 'completed'),
            limit(1)
          );
          const ticketsSnapshot = await getDocs(ticketsQuery);
          if (!ticketsSnapshot.empty) {
            const ticketDoc = ticketsSnapshot.docs[0];
            setTicket({ id: ticketDoc.id, ...ticketDoc.data() });
          }
        }

        setLoading(false);
      } catch (err) {
        console.error('Error fetching checkout data:', err);
        setError('Failed to load checkout details: ' + err.message);
        setLoading(false);
      }
    };

    fetchData();
  }, [eventId, location.search]);

  if (loading) return <div className="loading-screen"><div className="spinner"></div><p>Loading...</p></div>;
  if (error) return <div>{error}</div>;
  if (!event) return <div>Event not found.</div>;

  return (
    <div className="checkout">
      <h2>Checkout Confirmation</h2>
      {ticket ? (
        <div className="ticket-confirmation">
          <h3>Thank You for Your Purchase!</h3>
          <p>You’ve successfully purchased a ticket for:</p>
          <div className="event-details">
            <h4>{event.name || 'Untitled Event'}</h4>
            <p>
              Date:{' '}
              {event.date?.seconds
                ? new Date(event.date.seconds * 1000).toLocaleDateString()
                : 'Date unavailable'}
            </p>
            <p>Location: {event.location || 'Location unavailable'}</p>
          </div>
        </div>
      ) : (
        <div className="error-message">
          <p>No ticket purchase found. Did you complete the payment?</p>
        </div>
      )}
    </div>
  );
};

export default Checkout;