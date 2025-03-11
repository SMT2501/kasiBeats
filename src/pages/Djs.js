import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { firestore } from '../firebaseConfig';
import { AuthContext } from '../context/AuthContext';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, arrayUnion, orderBy, limit } from 'firebase/firestore';
import { toast } from 'react-toastify';
import defaultProfilePicture from '../assets/images/profile.jpg';
import './Djs.css';

const Djs = () => {
  const { currentUser } = useContext(AuthContext);
  const [djs, setDjs] = useState([]);
  const [events, setEvents] = useState([]); // Store organizer's events
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('username');
  const [selectedDj, setSelectedDj] = useState(null);
  const [djBookings, setDjBookings] = useState([]);
  const [djPosts, setDjPosts] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(''); // Selected event for booking
  const [agreeToConditions, setAgreeToConditions] = useState(false); // Conditions agreement

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch DJs
        const djQuery = query(
          collection(firestore, 'users'),
          where('role', '==', 'dj'),
          orderBy(sortBy)
        );
        const djSnapshot = await getDocs(djQuery);
        const djData = djSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setDjs(djData);

        // Fetch events for organizer (if logged in)
        if (currentUser && currentUser.role === 'organizer') {
          const eventsQuery = query(
            collection(firestore, 'events'),
            where('organizerId', '==', currentUser.uid)
          );
          const eventsSnapshot = await getDocs(eventsQuery);
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
        }

        setLoading(false);
      } catch (err) {
        setError('Failed to load data: ' + err.message);
        toast.error('Failed to load data: ' + err.message);
        setLoading(false);
      }
    };

    fetchData();
  }, [sortBy, currentUser]);

  const handleBookDj = async (djId, djDetails) => {
    if (!currentUser || currentUser.role !== 'organizer') {
      toast.error('Please log in as an organizer to book a DJ.');
      return;
    }

    if (!selectedEventId) {
      toast.error('Please select an event.');
      return;
    }

    if (!agreeToConditions) {
      toast.error('You must agree to the DJ’s conditions before booking.');
      return;
    }

    try {
      const event = events.find((e) => e.id === selectedEventId);
      if (!event) throw new Error('Event not found.');

      const bookingRef = await addDoc(collection(firestore, 'bookings'), {
        eventId: selectedEventId,
        djId,
        organizerId: currentUser.uid,
        eventName: event.name || 'Untitled Event',
        date: event.date,
        price: djDetails.price || 0, // Use DJ's price
        conditions: djDetails.conditions || '', // Use DJ's conditions
        status: 'pending',
        createdAt: new Date(),
        paid: false,
      });

      const eventRef = doc(firestore, 'events', selectedEventId);
      await updateDoc(eventRef, {
        pendingDjs: arrayUnion(djId),
      });

      // Notify the DJ
      await addDoc(collection(firestore, 'notifications'), {
        userId: djId,
        message: `You have a new booking request for "${event.name}" from ${currentUser.displayName || 'an organizer'} with a rate of R${djDetails.price || 0} and conditions: ${djDetails.conditions || 'Not specified'}.`,
        createdAt: new Date(),
        read: false,
      });

      toast.success('DJ booking request sent!');
      setSelectedEventId('');
      setAgreeToConditions(false);
      closeDjModal();
    } catch (err) {
      toast.error('Failed to book DJ: ' + err.message);
    }
  };

  const filteredDjs = djs.filter((dj) =>
    dj.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openDjModal = async (dj) => {
    setSelectedDj(dj);
    setSelectedEventId(''); // Reset event selection
    setAgreeToConditions(false); // Reset conditions agreement

    try {
      let bookingsQuery;
      if (currentUser && (currentUser.uid === dj.id || currentUser.role === 'organizer')) {
        bookingsQuery = query(
          collection(firestore, 'bookings'),
          where('djId', '==', dj.id)
        );

        if (currentUser.role === 'organizer') {
          bookingsQuery = query(
            collection(firestore, 'bookings'),
            where('djId', '==', dj.id),
            where('organizerId', '==', currentUser.uid)
          );
        }

        const bookingsSnapshot = await getDocs(bookingsQuery);
        const bookingsData = bookingsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setDjBookings(bookingsData);
      } else {
        setDjBookings([]);
      }

      const postsQuery = query(
        collection(firestore, 'posts'),
        where('userId', '==', dj.id),
        orderBy('createdAt', 'desc'),
        limit(3)
      );
      const postsSnapshot = await getDocs(postsQuery);
      const postsData = postsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setDjPosts(postsData);
    } catch (err) {
      toast.error('Failed to load DJ details: ' + err.message);
    }
  };

  const closeDjModal = () => {
    setSelectedDj(null);
    setDjBookings([]);
    setDjPosts([]);
  };

  const clearSearch = () => {
    setSearchTerm('');
  };

  if (loading) return <div className="loading-screen"><div className="spinner"></div><p>Loading...</p></div>;
  if (error) return <div>{error}</div>;

  return (
    <div className="djs-container">
      <h2>Browse DJs on KasiBeats</h2>
      <div className="search-container">
        <input
          type="text"
          placeholder="Search DJs by name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-bar"
        />
        <span className="search-icon">🔍</span>
        {searchTerm && (
          <button onClick={clearSearch} className="clear-search-btn">
            Clear
          </button>
        )}
      </div>
      <div className="sort-container">
        <label htmlFor="sortBy">Sort by:</label>
        <select id="sortBy" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="username">Username</option>
          <option value="email">Email</option>
        </select>
      </div>
      <div className="dj-grid">
        {filteredDjs.length > 0 ? (
          filteredDjs.map((dj) => (
            <div
              key={dj.id}
              className="dj-card"
              onClick={() => openDjModal(dj)}
              style={{ cursor: 'pointer' }}
            >
              <img
                src={dj.profilePicture || defaultProfilePicture}
                alt="DJ"
                className="dj-picture"
              />
              <h3>{dj.username || 'Unknown DJ'}</h3>
              <p>{dj.bio || 'No bio available'}</p>
              {currentUser?.role === 'organizer' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBookDj(dj.id, dj);
                  }}
                >
                  Book DJ
                </button>
              )}
            </div>
          ))
        ) : (
          <p>No DJs found.</p>
        )}
      </div>

      {selectedDj && (
        <div className="dj-modal-overlay">
          <div className="dj-modal-content">
            <button className="close-modal-btn" onClick={closeDjModal}>✖</button>
            <div className="dj-header">
              <img
                src={selectedDj.profilePicture || defaultProfilePicture}
                alt="DJ"
                className="dj-profile-picture-large"
              />
              <div>
                <Link to={`/profile/${selectedDj.id}`}>
                  <h3>{selectedDj.username || 'Unknown DJ'}</h3>
                </Link>
                <p className="dj-bio">{selectedDj.bio || 'No bio available'}</p>
              </div>
            </div>
            {(currentUser?.uid === selectedDj.id || (currentUser?.role === 'organizer' && djBookings.length > 0)) && (
              <div className="dj-bookings-section">
                <h4>Bookings</h4>
                {djBookings.length > 0 ? (
                  <ul className="booking-list">
                    {djBookings.map((booking) => (
                      <li key={booking.id} className="booking-item">
                        <strong>{booking.eventName || 'Untitled Event'}</strong>
                        <p>
                          Date:{' '}
                          {booking.date?.seconds
                            ? new Date(booking.date.seconds * 1000).toLocaleDateString()
                            : 'Date unavailable'}
                        </p>
                        <p>Status: {booking.status || 'Pending'}</p>
                        <p>Rate: R{booking.price || 0}</p>
                        <p>Conditions: {booking.conditions || 'Not specified'}</p>
                        <p>Payment Status: {booking.paid ? 'Paid' : 'Not Paid'}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No bookings available.</p>
                )}
              </div>
            )}
            {currentUser?.role === 'organizer' && (
              <div className="dj-booking-form">
                <h4>Book This DJ</h4>
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  required
                >
                  <option value="">Select Event</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name} - {event.date?.toLocaleDateString() || 'Date unavailable'}
                    </option>
                  ))}
                </select>
                <div className="dj-details">
                  <p>Rate: R{selectedDj.price || 0}</p>
                  <p>Conditions: {selectedDj.conditions || 'Not specified'}</p>
                  <label>
                    <input
                      type="checkbox"
                      checked={agreeToConditions}
                      onChange={(e) => setAgreeToConditions(e.target.checked)}
                    />
                    I agree to the DJ’s conditions
                  </label>
                </div>
                <button
                  onClick={() => handleBookDj(selectedDj.id, selectedDj)}
                  className="btn"
                >
                  Confirm Booking
                </button>
              </div>
            )}
            <div className="dj-posts-section">
              <h4>Recent Posts</h4>
              {djPosts.length > 0 ? (
                <ul className="post-list">
                  {djPosts.map((post) => (
                    <li key={post.id} className="post-item">
                      <p>{post.content || 'No content'}</p>
                      {post.mediaUrl && (
                        post.mediaType?.startsWith('image/') ? (
                          <img src={post.mediaUrl} alt="Post Media" className="post-media-small" />
                        ) : (
                          <video src={post.mediaUrl} controls className="post-media-small" />
                        )
                      )}
                      <span className="post-timestamp">
                        {post.createdAt?.seconds
                          ? new Date(post.createdAt.seconds * 1000).toLocaleString()
                          : 'Unknown date'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No recent posts.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Djs;