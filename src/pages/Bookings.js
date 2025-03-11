import React, { useState, useEffect, useContext } from 'react';
import { firestore } from '../firebaseConfig';
import { AuthContext } from '../context/AuthContext';
import { collection, query, where, getDocs, getDoc, updateDoc, doc, addDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
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
        console.log('Fetching data, currentUser:', currentUser); // Debug
        if (!currentUser) {
          setError('Please log in to view bookings.');
          setLoading(false);
          return;
        }

        setLoading(true);
        if (currentUser) {
          const bookingsQuery = query(
            collection(firestore, 'bookings'),
            where('djId', '==', currentUser.uid)
          );
          const bookingsSnapshot = await getDocs(bookingsQuery);
          console.log('Bookings snapshot size:', bookingsSnapshot.size); // Debug
          const bookingsData = await Promise.all(
            bookingsSnapshot.docs.map(async (bookingDoc) => {
              try {
                const eventRef = doc(firestore, 'events', bookingDoc.data().eventId);
                const eventDoc = await getDoc(eventRef);
                const eventData = eventDoc.exists() ? eventDoc.data() : {};
                return {
                  id: bookingDoc.id,
                  ...bookingDoc.data(),
                  eventName: eventData.name || 'Untitled Event',
                  eventDate: eventData.date && typeof eventData.date.toDate === 'function'
                    ? eventData.date.toDate()
                    : eventData.date ? new Date(eventData.date) : null,
                };
              } catch (err) {
                console.error('Error fetching event for booking', bookingDoc.id, ':', err);
                return { id: bookingDoc.id, ...bookingDoc.data(), eventName: 'Untitled Event', eventDate: null };
              }
            })
          );
          setDjBookings(bookingsData);
          console.log('DJ bookings loaded:', bookingsData.length);
        }

        if (currentUser.role === 'organizer') {
          const eventsQuery = query(
            collection(firestore, 'events'),
            where('organizerId', '==', currentUser.uid)
          );
          const eventsSnapshot = await getDocs(eventsQuery);
          console.log('Events snapshot size:', eventsSnapshot.size); // Debug
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
        console.error('Fetch data error:', err);
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
      const event = events.find((e) => e.id === eventId);
      if (!event) throw new Error('Event not found.');

      await addDoc(collection(firestore, 'bookings'), {
        eventId,
        djId,
        organizerId: currentUser.uid,
        eventName: event.name || 'Untitled Event',
        date: event.date,
        price: event.ticketPrice || 0,
        status: 'pending',
        createdAt: new Date(),
      });

      const eventRef = doc(firestore, 'events', eventId);
      await updateDoc(eventRef, {
        pendingDjs: arrayUnion(djId),
      });

      toast.success('DJ booking request sent!');
      setEventId('');
      setDjId('');

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
    } catch (err) {
      toast.error('Failed to book DJ: ' + err.message);
    }
  };

  const handleAcceptBooking = async (bookingId, eventId, djId) => {
    try {
      const bookingRef = doc(firestore, 'bookings', bookingId);
      await updateDoc(bookingRef, {
        status: 'accepted',
      });

      const eventRef = doc(firestore, 'events', eventId);
      await updateDoc(eventRef, {
        djsBooked: arrayUnion(djId),
        pendingDjs: arrayRemove(djId),
      });

      toast.success('Booking accepted!');

      const bookingsQuery = query(
        collection(firestore, 'bookings'),
        where('djId', '==', currentUser.uid)
      );
      const bookingsSnapshot = await getDocs(bookingsQuery);
      const updatedBookings = await Promise.all(
        bookingsSnapshot.docs.map(async (bookingDoc) => {
          try {
            const eventRef = doc(firestore, 'events', bookingDoc.data().eventId);
            const eventDoc = await getDoc(eventRef);
            const eventData = eventDoc.exists() ? eventDoc.data() : {};
            return {
              id: bookingDoc.id,
              ...bookingDoc.data(),
              eventName: eventData.name || 'Untitled Event',
              eventDate: eventData.date && typeof eventData.date.toDate === 'function'
                ? eventData.date.toDate()
                : eventData.date ? new Date(eventData.date) : null,
            };
          } catch (err) {
            console.error('Error fetching event for booking', bookingDoc.id, ':', err);
            return { id: bookingDoc.id, ...bookingDoc.data(), eventName: 'Untitled Event', eventDate: null };
          }
        })
      );
      setDjBookings(updatedBookings);

      if (currentUser.role === 'organizer') {
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
      }
    } catch (err) {
      toast.error('Failed to accept booking: ' + err.message);
    }
  };

  const handleRejectBooking = async (bookingId, eventId, djId) => {
    try {
      const bookingRef = doc(firestore, 'bookings', bookingId);
      await updateDoc(bookingRef, {
        status: 'rejected',
      });

      const eventRef = doc(firestore, 'events', eventId);
      const eventDoc = await getDoc(eventRef);
      if (eventDoc.exists()) {
        const eventData = eventDoc.data();
        const updatedPendingDjs = (eventData.pendingDjs || []).filter((id) => id !== djId);
        await updateDoc(eventRef, {
          pendingDjs: updatedPendingDjs,
        });
      }

      toast.success('Booking rejected.');

      const bookingsQuery = query(
        collection(firestore, 'bookings'),
        where('djId', '==', currentUser.uid)
      );
      const bookingsSnapshot = await getDocs(bookingsQuery);
      const updatedBookings = await Promise.all(
        bookingsSnapshot.docs.map(async (bookingDoc) => {
          try {
            const eventRef = doc(firestore, 'events', bookingDoc.data().eventId);
            const eventDoc = await getDoc(eventRef);
            const eventData = eventDoc.exists() ? eventDoc.data() : {};
            return {
              id: bookingDoc.id,
              ...bookingDoc.data(),
              eventName: eventData.name || 'Untitled Event',
              eventDate: eventData.date && typeof eventData.date.toDate === 'function'
                ? eventData.date.toDate()
                : eventData.date ? new Date(eventData.date) : null,
            };
          } catch (err) {
            console.error('Error fetching event for booking', bookingDoc.id, ':', err);
            return { id: bookingDoc.id, ...bookingDoc.data(), eventName: 'Untitled Event', eventDate: null };
          }
        })
      );
      setDjBookings(updatedBookings);

      if (currentUser.role === 'organizer') {
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
      }
    } catch (err) {
      toast.error('Failed to reject booking: ' + err.message);
    }
  };

  // Earnings summary for DJs
  const calculateEarnings = async () => {
    if (currentUser.role !== 'dj') return 0;
    try {
      const bookingsQuery = query(
        collection(firestore, 'bookings'),
        where('djId', '==', currentUser.uid),
        where('status', '==', 'accepted')
      );
      const bookingsSnapshot = await getDocs(bookingsQuery);
      const earnings = bookingsSnapshot.docs.reduce((sum, doc) => {
        const price = doc.data().price || 0;
        return sum + price;
      }, 0);
      return earnings;
    } catch (err) {
      console.error('Earnings calculation error:', err);
      toast.error('Failed to calculate earnings: ' + err.message);
      return 0;
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
                <h3>{booking.eventName}</h3>
                <p>
                  Date:{' '}
                  {booking.eventDate
                    ? booking.eventDate.toLocaleDateString()
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
          <div className="earnings-summary">
            <h3>Earnings from Accepted Bookings: R{calculateEarnings()}</h3>
          </div>
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
                  {event.date
                    ? event.date.toLocaleDateString()
                    : 'Date unavailable'}
                </p>
                <p>DJs Booked: {event.djsBooked?.length || 0}</p>
                <p>Pending DJs: {event.pendingDjs?.length || 0}</p>
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