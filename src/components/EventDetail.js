import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { firestore } from '../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import './EventDetail.css';

const EventDetail = () => {
  const { eventId } = useParams();
  const location = useLocation();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const eventRef = doc(firestore, 'events', eventId);
        const eventDoc = await getDoc(eventRef);
        if (eventDoc.exists()) {
          setEvent({ id: eventDoc.id, ...eventDoc.data() });
        } else {
          setError('Event not found.');
        }
        setLoading(false);
      } catch (err) {
        console.error('Error fetching event:', err);
        setError('Failed to load event: ' + err.message);
        setLoading(false);
      }
    };

    fetchEvent();

    // Check payment status from query parameters
    const query = new URLSearchParams(location.search);
    if (query.get('success')) {
      setPaymentStatus('Payment successful! Your ticket has been purchased.');
    } else if (query.get('cancelled')) {
      setPaymentStatus('Payment cancelled. Please try again.');
    }
  }, [eventId, location.search]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;
  if (!event) return <div>Event not found.</div>;

  return (
    <div className="event-detail">
      {paymentStatus && <div className="payment-status">{paymentStatus}</div>}
      <h2>{event.name || 'Untitled Event'}</h2>
      <img
        src={event.mediaUrl || 'https://via.placeholder.com/300'}
        alt="Event"
        className="event-detail-picture"
      />
      <p>Date: {event.date?.seconds ? new Date(event.date.seconds * 1000).toLocaleDateString() : 'Date unavailable'}</p>
      <p>Location: {event.location || 'Location unavailable'}</p>
      <p>{event.description || 'No description available'}</p>
      <p>Price: ${event.price || 20}</p>
    </div>
  );
};

export default EventDetail;