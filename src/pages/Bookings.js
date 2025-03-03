import React, { useState, useEffect, useContext } from 'react';
import { firestore } from '../firebaseConfig';
import { AuthContext } from '../context/AuthContext';
import { collection, query, where, getDocs, getDoc, updateDoc, doc, addDoc, arrayUnion } from 'firebase/firestore';
import { toast } from 'react-toastify';
import './Bookings.css';

const Bookings = () => {
  const { currentUser } = useContext(AuthContext);
  const [djBookings, setDjBookings] = useState([]);
  const [events, setEvents] = useState([]);
  const [djs, setDjs] = useState([]);
  const [eventId, setEventId] = useState('');
  const [djId, setDjId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!currentUser) {
          setError('Please log in to view bookings.');
          setLoading(false);
          return;
        }

        if (currentUser.role === 'dj') {
          const bookingsQuery = query(
            collection(firestore, 'bookings'),
            where('djId', '==', currentUser.uid)
          );
          const bookingsSnapshot = await getDocs(bookingsQuery);
          const bookingsData = bookingsSnapshot.docs.map((bookingDoc) => ({
            id: bookingDoc.id,
            ...bookingDoc.data(),
          }));
          setDjBookings(bookingsData);
        }

        if (currentUser.role === 'organizer') {
          const eventsQuery = query(
            collection(firestore, 'events'),
            where('organizerId', '==', currentUser.uid)
          );
          const eventsSnapshot = await getDocs(eventsQuery);
          const eventsData = eventsSnapshot.docs.map((eventDoc) => ({
            id: eventDoc.id,
            ...eventDoc.data(),
          }));
          setEvents(eventsData);

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
        }

        setLoading(false);
      } catch (err) {
        console.error('Error fetching bookings:', err);
        setError('Failed to load bookings: ' + err.message);
        toast.error('Failed to load bookings: ' + err.message);
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser]);

  const handleBookDj = async (e) => {
    e.preventDefault();
  
    if (!eventId || !djId) {
      toast.error('Please select an event and a DJ.');
      return;
    }
  
    try {
      await addDoc(collection(firestore, 'bookings'), {
        eventId,
        djId,
        organizerId: currentUser.uid,
        eventName: events.find((event) => event.id === eventId)?.name || 'Untitled Event',
        date: events.find((event) => event.id === eventId)?.date,
        status: 'pending',
        createdAt: new Date(),
      });
  
      const eventRef = doc(firestore, 'events', eventId);
      await updateDoc(eventRef, {
        djsBooked: arrayUnion(djId),
      });
  
      toast.success('DJ booking request sent!');
      setEventId('');
      setDjId('');
  
      const eventsQuery = query(
        collection(firestore, 'events'),
        where('organizerId', '==', currentUser.uid)
      );
      const eventsSnapshot = await getDocs(eventsQuery);
      const updatedEvents = eventsSnapshot.docs.map((eventDoc) => ({
        id: eventDoc.id,
        ...eventDoc.data(),
      }));
      setEvents(updatedEvents);
    } catch (err) {
      console.error('Error booking DJ:', err);
      toast.error('Failed to book DJ: ' + err.message);
    }
  };

  const handleAcceptBooking = async (bookingId, eventId, djId) => {
    try {
      const bookingRef = doc(firestore, 'bookings', bookingId);
      await updateDoc(bookingRef, {
        status: 'accepted',
      });

      // Ensure the DJ's ID is in the event's djsBooked array
      const eventRef = doc(firestore, 'events', eventId);
      await updateDoc(eventRef, {
        djsBooked: arrayUnion(djId), // Add DJ to djsBooked if not already present
      });

      toast.success('Booking accepted!');

      // Refresh bookings to reflect the updated status
      const bookingsQuery = query(
        collection(firestore, 'bookings'),
        where('djId', '==', currentUser.uid)
      );
      const bookingsSnapshot = await getDocs(bookingsQuery);
      const updatedBookings = bookingsSnapshot.docs.map((bookingDoc) => ({
        id: bookingDoc.id,
        ...bookingDoc.data(),
      }));
      setDjBookings(updatedBookings);

      // Refresh events in the organizer view if needed
      if (currentUser.role === 'organizer') {
        const eventsQuery = query(
          collection(firestore, 'events'),
          where('organizerId', '==', currentUser.uid)
        );
        const eventsSnapshot = await getDocs(eventsQuery);
        const updatedEvents = eventsSnapshot.docs.map((eventDoc) => ({
          id: eventDoc.id,
          ...eventDoc.data(),
        }));
        setEvents(updatedEvents);
      }
    } catch (err) {
      console.error('Error accepting booking:', err);
      toast.error('Failed to accept booking: ' + err.message);
    }
  };

  const handleRejectBooking = async (bookingId, eventId, djId) => {
    try {
      const bookingRef = doc(firestore, 'bookings', bookingId);
      await updateDoc(bookingRef, {
        status: 'rejected',
      });

      // Remove the DJ from the event's djsBooked array if they reject
      const eventRef = doc(firestore, 'events', eventId);
      const eventDoc = await getDoc(eventRef);
      if (eventDoc.exists()) {
        const eventData = eventDoc.data();
        const updatedDjsBooked = (eventData.djsBooked || []).filter((id) => id !== djId);
        await updateDoc(eventRef, {
          djsBooked: updatedDjsBooked,
        });
      }

      toast.success('Booking rejected.');

      // Refresh bookings to reflect the updated status
      const bookingsQuery = query(
        collection(firestore, 'bookings'),
        where('djId', '==', currentUser.uid)
      );
      const bookingsSnapshot = await getDocs(bookingsQuery);
      const updatedBookings = bookingsSnapshot.docs.map((bookingDoc) => ({
        id: bookingDoc.id,
        ...bookingDoc.data(),
      }));
      setDjBookings(updatedBookings);

      // Refresh events in the organizer view if needed
      if (currentUser.role === 'organizer') {
        const eventsQuery = query(
          collection(firestore, 'events'),
          where('organizerId', '==', currentUser.uid)
        );
        const eventsSnapshot = await getDocs(eventsQuery);
        const updatedEvents = eventsSnapshot.docs.map((eventDoc) => ({
          id: eventDoc.id,
          ...eventDoc.data(),
        }));
        setEvents(updatedEvents);
      }
    } catch (err) {
      console.error('Error rejecting booking:', err);
      toast.error('Failed to reject booking: ' + err.message);
    }
  };

  if (loading) return <div className="loading-screen"><div className="spinner"></div><p>Loading...</p></div>;
  if (error) return <div>{error}</div>;

  return (
    <div className="bookings">
      {currentUser?.role === 'dj' && (
        <div className="dj-bookings">
          <h2>Booking Requests</h2>
          {djBookings.length > 0 ? (
            djBookings.map((booking) => (
              <div key={booking.id} className="booking-card">
                <h3>{booking.eventName || 'Untitled Event'}</h3>
                <p>
                  Date:{' '}
                  {booking.date?.seconds
                    ? new Date(booking.date.seconds * 1000).toLocaleDateString()
                    : 'Date unavailable'}
                </p>
                <p>Status: {booking.status || 'Pending'}</p>
                {booking.status === 'pending' && (
                  <div className="booking-actions">
                    <button
                      onClick={() => handleAcceptBooking(booking.id, booking.eventId, currentUser.uid)}
                      className="btn accept"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleRejectBooking(booking.id, booking.eventId, currentUser.uid)}
                      className="btn reject"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p>No booking requests.</p>
          )}
        </div>
      )}

      {currentUser?.role === 'organizer' && (
        <div className="organizer-bookings">
          <h2>Events with Booked DJs</h2>
          {events.length > 0 ? (
            events.map((event) => (
              <div key={event.id} className="event-card">
                <h3>{event.name || 'Untitled Event'}</h3>
                <p>
                  Date:{' '}
                  {event.date?.seconds
                    ? new Date(event.date.seconds * 1000).toLocaleDateString()
                    : 'Date unavailable'}
                </p>
                <p>DJs Booked: {event.djsBooked?.length || 0}</p>
              </div>
            ))
          ) : (
            <p>No events found.</p>
          )}

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

            <button type="submit" className="btn">Book DJ</button>
          </form>
        </div>
      )}
    </div>
  );
};

export default Bookings;