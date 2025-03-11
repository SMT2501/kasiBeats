import React, { useState, useEffect, useContext } from 'react';
import { firestore } from '../firebaseConfig';
import { AuthContext } from '../context/AuthContext';
import { collection, query, where, getDocs, getDoc, addDoc, doc, updateDoc, arrayUnion, arrayRemove, deleteDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import './MyEvents.css';

const MyEvents = () => {
  const { currentUser } = useContext(AuthContext);
  const [events, setEvents] = useState([]);
  const [djs, setDjs] = useState([]);
  const [eventId, setEventId] = useState('');
  const [djId, setDjId] = useState('');
  const [selectedDjDetails, setSelectedDjDetails] = useState(null); // To display DJ price and conditions
  const [agreeToConditions, setAgreeToConditions] = useState(false); // For conditions checkbox
  const [selectedEvent, setSelectedEvent] = useState(null); // For booking modal
  const [bookings, setBookings] = useState([]); // Store all bookings for the organizer's events
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('Fetching events for organizer, currentUser:', currentUser);
        if (!currentUser) {
          setError('Please log in to view events.');
          setLoading(false);
          return;
        }

        setLoading(true);

        // Fetch events
        const eventsQuery = query(
          collection(firestore, 'events'),
          where('organizerId', '==', currentUser.uid)
        );
        const eventsSnapshot = await getDocs(eventsQuery);
        console.log('Events snapshot size:', eventsSnapshot.size);
        const eventsData = await Promise.all(
          eventsSnapshot.docs.map(async (eventDoc) => {
            const eventData = eventDoc.data();
            return {
              id: eventDoc.id,
              ...eventData,
              date: eventData.date && typeof eventData.date.toDate === 'function'
                ? eventData.date.toDate()
                : eventData.date ? new Date(eventData.date) : null,
            };
          })
        );
        setEvents(eventsData);
        console.log('Events data for grid:', eventsData); // Debug log

        // Fetch DJs
        const djsQuery = query(
          collection(firestore, 'users'),
          where('role', '==', 'dj')
        );
        const djsSnapshot = await getDocs(djsQuery);
        const djsData = djsSnapshot.docs.map((djDoc) => ({
          id: djDoc.id,
          ...djDoc.data(),
        }));
        setDjs(djsData);

        // Fetch bookings for all events
        const bookingsQuery = query(
          collection(firestore, 'bookings'),
          where('organizerId', '==', currentUser.uid)
        );
        const bookingsSnapshot = await getDocs(bookingsQuery);
        const bookingsData = await Promise.all(
          bookingsSnapshot.docs.map(async (bookingDoc) => {
            const booking = { id: bookingDoc.id, ...bookingDoc.data() };
            const djRef = doc(firestore, 'users', booking.djId);
            const djDoc = await getDoc(djRef);
            return {
              ...booking,
              djDetails: djDoc.exists() ? djDoc.data() : { username: 'Unknown DJ' },
            };
          })
        );
        setBookings(bookingsData);

        setLoading(false);
      } catch (err) {
        console.error('Fetch events error:', err);
        setError('Failed to load events: ' + err.message);
        toast.error('Failed to load events: ' + err.message);
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser]);

  // Fetch DJ details when a DJ is selected
  useEffect(() => {
    const fetchDjDetails = async () => {
      if (!djId) {
        setSelectedDjDetails(null);
        return;
      }

      try {
        const djRef = doc(firestore, 'users', djId);
        const djDoc = await getDoc(djRef);
        if (djDoc.exists()) {
          setSelectedDjDetails(djDoc.data());
        } else {
          setSelectedDjDetails(null);
          toast.error('DJ not found.');
        }
      } catch (err) {
        console.error('Error fetching DJ details:', err);
        toast.error('Failed to fetch DJ details: ' + err.message);
      }
    };

    fetchDjDetails();
  }, [djId]);

  const handleBookDj = async (e) => {
    e.preventDefault();

    if (!eventId || !djId) {
      toast.error('Please select an event and a DJ.');
      return;
    }

    if (!agreeToConditions) {
      toast.error('You must agree to the DJ’s conditions before booking.');
      return;
    }

    try {
      const event = events.find((e) => e.id === eventId);
      if (!event) throw new Error('Event not found.');

      const bookingRef = await addDoc(collection(firestore, 'bookings'), {
        eventId,
        djId,
        organizerId: currentUser.uid,
        eventName: event.name || 'Untitled Event',
        date: event.date,
        price: selectedDjDetails?.price || 0, // Use DJ's price
        conditions: selectedDjDetails?.conditions || '', // Use DJ's conditions
        status: 'pending',
        createdAt: new Date(),
        paid: false, // Track payment status
      });

      const eventRef = doc(firestore, 'events', eventId);
      await updateDoc(eventRef, {
        pendingDjs: arrayUnion(djId),
      });

      // Notify the DJ
      await addDoc(collection(firestore, 'notifications'), {
        userId: djId,
        message: `You have a new booking request for "${event.name}" from ${currentUser.displayName || 'an organizer'} with a rate of R${selectedDjDetails?.price || 0} and conditions: ${selectedDjDetails?.conditions || 'Not specified'}.`,
        createdAt: new Date(),
        read: false,
      });

      toast.success('DJ booking request sent!');
      setEventId('');
      setDjId('');
      setAgreeToConditions(false);

      // Refresh events and bookings
      const eventsQuery = query(
        collection(firestore, 'events'),
        where('organizerId', '==', currentUser.uid)
      );
      const eventsSnapshot = await getDocs(eventsQuery);
      const updatedEvents = await Promise.all(
        eventsSnapshot.docs.map(async (eventDoc) => {
          const eventData = eventDoc.data();
          return {
            id: eventDoc.id,
            ...eventData,
            date: eventData.date && typeof eventData.date.toDate === 'function'
              ? eventData.date.toDate()
              : eventData.date ? new Date(eventData.date) : null,
          };
        })
      );
      setEvents(updatedEvents);

      const bookingsQuery = query(
        collection(firestore, 'bookings'),
        where('organizerId', '==', currentUser.uid)
      );
      const bookingsSnapshot = await getDocs(bookingsQuery);
      const updatedBookings = await Promise.all(
        bookingsSnapshot.docs.map(async (bookingDoc) => {
          const booking = { id: bookingDoc.id, ...bookingDoc.data() };
          const djRef = doc(firestore, 'users', booking.djId);
          const djDoc = await getDoc(djRef);
          return {
            ...booking,
            djDetails: djDoc.exists() ? djDoc.data() : { username: 'Unknown DJ' },
          };
        })
      );
      setBookings(updatedBookings);
    } catch (err) {
      toast.error('Failed to book DJ: ' + err.message);
    }
  };

  const openBookingModal = (event) => {
    setSelectedEvent(event);
  };

  const closeBookingModal = () => {
    setSelectedEvent(null);
  };

  const handlePayDj = async (booking) => {
    if (booking.status !== 'accepted') {
      toast.error('DJ must accept the booking before payment can be made.');
      return;
    }

    if (booking.paid) {
      toast.error('This DJ has already been paid.');
      return;
    }

    try {
      const bookingRef = doc(firestore, 'bookings', booking.id);
      await updateDoc(bookingRef, {
        paid: true,
      });

      // Update bookings state
      setBookings((prev) =>
        prev.map((b) => (b.id === booking.id ? { ...b, paid: true } : b))
      );

      // Notify the DJ
      await addDoc(collection(firestore, 'notifications'), {
        userId: booking.djId,
        message: `You have been paid R${booking.price} for your booking at "${booking.eventName}" by ${currentUser.displayName || 'the organizer'}.`,
        createdAt: new Date(),
        read: false,
      });

      toast.success(`Payment of R${booking.price} sent to ${booking.djDetails.username}!`);
    } catch (err) {
      console.error('Error processing payment:', err);
      toast.error('Failed to process payment: ' + err.message);
    }
  };

  const handleCancelBooking = async (booking) => {
    if (booking.status !== 'pending') {
      toast.error('Can only cancel pending bookings.');
      return;
    }

    if (window.confirm('Are you sure you want to cancel this booking?')) {
      try {
        const bookingRef = doc(firestore, 'bookings', booking.id);
        await deleteDoc(bookingRef);

        const eventRef = doc(firestore, 'events', booking.eventId);
        await updateDoc(eventRef, {
          pendingDjs: arrayRemove(booking.djId),
        });

        // Notify the DJ
        await addDoc(collection(firestore, 'notifications'), {
          userId: booking.djId,
          message: `Your booking for "${booking.eventName}" has been canceled by ${currentUser.displayName || 'the organizer'}.`,
          createdAt: new Date(),
          read: false,
        });

        // Refresh events and bookings
        const eventsQuery = query(
          collection(firestore, 'events'),
          where('organizerId', '==', currentUser.uid)
        );
        const eventsSnapshot = await getDocs(eventsQuery);
        const updatedEvents = await Promise.all(
          eventsSnapshot.docs.map(async (eventDoc) => {
            const eventData = eventDoc.data();
            return {
              id: eventDoc.id,
              ...eventData,
              date: eventData.date && typeof eventData.date.toDate === 'function'
                ? eventData.date.toDate()
                : eventData.date ? new Date(eventData.date) : null,
            };
          })
        );
        setEvents(updatedEvents);

        setBookings((prev) => prev.filter((b) => b.id !== booking.id));
        toast.success('Booking canceled successfully!');
      } catch (err) {
        console.error('Error canceling booking:', err);
        toast.error('Failed to cancel booking: ' + err.message);
      }
    }
  };

  if (loading) return <div className="loading-screen"><div className="spinner"></div><p>Loading...</p></div>;
  if (error) return <div>{error}</div>;

  return (
    <div className="my-events">
      <h2>My Events</h2>
      <div className="events-grid">
        {events.length > 0 ? (
          events.map((event) => (
            <div key={event.id} className="event-card" onClick={() => openBookingModal(event)}>
              <h3>{event.name || 'Untitled Event'}</h3>
              <p>Date: {event.date ? event.date.toLocaleDateString() : 'Date unavailable'}</p>
              <p>Location: {event.location || 'N/A'}</p>
              <p>DJs Booked: {event.djsBooked?.length || 0}</p>
              <p>Pending DJs: {event.pendingDjs?.length || 0}</p>
            </div>
          ))
        ) : (
          <p>No events found.</p>
        )}
      </div>

      <h2>Book a DJ</h2>
      <form onSubmit={handleBookDj}>
        <label htmlFor="eventId">Select Event:</label>
        <select
          id="eventId"
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          required
        >
          <option value="">Select Event</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name}
            </option>
          ))}
        </select>

        <label htmlFor="djId">Select DJ:</label>
        <select
          id="djId"
          value={djId}
          onChange={(e) => setDjId(e.target.value)}
          required
        >
          <option value="">Select DJ</option>
          {djs.map((dj) => (
            <option key={dj.id} value={dj.id}>
              {dj.username}
            </option>
          ))}
        </select>

        {selectedDjDetails && (
          <div className="dj-details">
            <p>Rate: R{selectedDjDetails.price || 0}</p>
            <p>Conditions: {selectedDjDetails.conditions || 'Not specified'}</p>
            <label>
              <input
                type="checkbox"
                checked={agreeToConditions}
                onChange={(e) => setAgreeToConditions(e.target.checked)}
              />
              I agree to the DJ’s conditions
            </label>
          </div>
        )}

        <button type="submit" className="btn">Book DJ</button>
      </form>

      {selectedEvent && (
        <div className="booking-modal-overlay">
          <div className="booking-modal-content">
            <button className="close-modal-btn" onClick={closeBookingModal}>✖</button>
            <h2>{selectedEvent.name || 'Untitled Event'}</h2>
            <p>Date: {selectedEvent.date ? selectedEvent.date.toLocaleDateString() : 'Date unavailable'}</p>
            <p>Location: {selectedEvent.location || 'N/A'}</p>
            <h3>Bookings</h3>
            <div className="bookings-grid">
              {bookings.filter((b) => b.eventId === selectedEvent.id).length > 0 ? (
                bookings
                  .filter((b) => b.eventId === selectedEvent.id)
                  .map((booking) => (
                    <div key={booking.id} className="booking-card">
                      <p>DJ: {booking.djDetails.username}</p>
                      <p>Status: {booking.status}</p>
                      <p>Rate: R{booking.price || 0}</p>
                      <p>Conditions: {booking.conditions || 'Not specified'}</p>
                      <p>Payment Status: {booking.paid ? 'Paid' : 'Not Paid'}</p>
                      <div className="booking-actions">
                        {booking.status === 'accepted' && !booking.paid && (
                          <button className="btn pay-btn" onClick={() => handlePayDj(booking)}>
                            Pay DJ
                          </button>
                        )}
                        {booking.status === 'pending' && (
                          <button className="btn cancel-btn" onClick={() => handleCancelBooking(booking)}>
                            Cancel Booking
                          </button>
                        )}
                      </div>
                    </div>
                  ))
              ) : (
                <p>No bookings for this event.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyEvents;