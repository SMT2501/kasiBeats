import React, { useState, useEffect, useContext, useRef } from 'react';
import { firestore } from '../firebaseConfig';
import { AuthContext } from '../context/AuthContext';
import { collection, query, where, getDocs, getDoc, updateDoc, doc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { toast } from 'react-toastify';
import './MyBookings.css';

const MyBookings = () => {
  const { currentUser } = useContext(AuthContext);
  const [djBookings, setDjBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [earnings, setEarnings] = useState(0);
  const [earningsLoading, setEarningsLoading] = useState(true);
  const hasFetched = useRef(false);

  const fetchData = async () => {
    try {
      console.log('Fetching bookings for DJ, currentUser:', currentUser);
      if (!currentUser) {
        setError('Please log in to view bookings.');
        setLoading(false);
        return;
      }

      setLoading(true);
      const bookingsQuery = query(
        collection(firestore, 'bookings'),
        where('djId', '==', currentUser.uid)
      );
      const bookingsSnapshot = await getDocs(bookingsQuery);
      console.log('Bookings snapshot size:', bookingsSnapshot.size);
      const bookingsData = await Promise.all(
        bookingsSnapshot.docs.map(async (bookingDoc, index) => {
          try {
            const eventRef = doc(firestore, 'events', bookingDoc.data().eventId);
            const eventDoc = await getDoc(eventRef);
            const eventData = eventDoc.exists() ? eventDoc.data() : {};
            console.log(`Booking data for ${bookingDoc.id} (index ${index}):`, { ...bookingDoc.data(), eventName: eventData.name || 'Untitled Event' });
            return {
              id: bookingDoc.id,
              ...bookingDoc.data(),
              eventName: eventData.name || 'Untitled Event',
              eventDate: eventData.date && typeof eventData.date.toDate === 'function'
                ? eventData.date.toDate()
                : eventData.date ? new Date(eventData.date) : null,
            };
          } catch (err) {
            console.error(`Error fetching event for booking ${bookingDoc.id} (index ${index}):`, err);
            return { id: bookingDoc.id, ...bookingDoc.data(), eventName: 'Untitled Event', eventDate: null };
          }
        })
      );
      setDjBookings(bookingsData.sort((a, b) => (b.eventDate || 0) - (a.eventDate || 0)));
      console.log('DJ bookings loaded:', bookingsData.length);
    } catch (err) {
      console.error('Fetch bookings error:', err);
      setError('Failed to load bookings: ' + err.message);
      toast.error('Failed to load bookings: ' + err.message);
    } finally {
      setLoading(false);
      hasFetched.current = true;
    }
  };

  useEffect(() => {
    console.log('useEffect triggered, currentUser.uid:', currentUser?.uid, 'hasFetched:', hasFetched.current);
    if (!hasFetched.current && currentUser?.uid) {
      fetchData();
    }

    const computeEarnings = async () => {
      setEarningsLoading(true);
      const totalEarnings = await calculateEarnings();
      setEarnings(totalEarnings);
      setEarningsLoading(false);
    };

    if (hasFetched.current && currentUser?.role === 'dj') {
      computeEarnings();
    }
  }, [currentUser?.uid, hasFetched.current]);

  const handleAcceptBooking = async (bookingId, eventId, djId) => {
    try {
      const bookingRef = doc(firestore, 'bookings', bookingId);
      await updateDoc(bookingRef, { status: 'accepted' });

      const eventRef = doc(firestore, 'events', eventId);
      await updateDoc(eventRef, {
        djsBooked: arrayUnion(djId),
        pendingDjs: arrayRemove(djId),
      });

      toast.success('Booking accepted!');
      await fetchData();
    } catch (err) {
      toast.error('Failed to accept booking: ' + err.message);
    }
  };

  const handleRejectBooking = async (bookingId, eventId, djId) => {
    try {
      const bookingRef = doc(firestore, 'bookings', bookingId);
      await updateDoc(bookingRef, { status: 'rejected' });

      const eventRef = doc(firestore, 'events', eventId);
      const eventDoc = await getDoc(eventRef);
      if (eventDoc.exists()) {
        const eventData = eventDoc.data();
        const updatedPendingDjs = (eventData.pendingDjs || []).filter((id) => id !== djId);
        await updateDoc(eventRef, { pendingDjs: updatedPendingDjs });
      }

      toast.success('Booking rejected.');
      await fetchData();
    } catch (err) {
      toast.error('Failed to reject booking: ' + err.message);
    }
  };

  const calculateEarnings = async () => {
    if (!currentUser || currentUser.role !== 'dj') return 0;
    try {
      const bookingsQuery = query(
        collection(firestore, 'bookings'),
        where('djId', '==', currentUser.uid),
        where('status', '==', 'accepted')
      );
      const bookingsSnapshot = await getDocs(bookingsQuery);
      const earnings = bookingsSnapshot.docs.reduce((sum, doc) => sum + (doc.data().price || 0), 0);
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
    <div className="my-bookings">
      <h2>My Bookings</h2>
      {djBookings.length > 0 ? (
        djBookings.map((booking) => (
          <div key={booking.id} className="booking-card">
            <h3>{booking.eventName}</h3>
            <p>Date: {booking.eventDate ? booking.eventDate.toLocaleDateString() : 'Date unavailable'}</p>
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
        {earningsLoading ? (
          <p>Calculating earnings...</p>
        ) : (
          <h3>Earnings from Accepted Bookings: R{earnings}</h3>
        )}
      </div>
    </div>
  );
};

export default MyBookings;