import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { firestore } from '../firebaseConfig';
import { AuthContext } from '../context/AuthContext';
import { collection, query, where, getDocs, updateDoc, doc, arrayUnion, orderBy, limit } from 'firebase/firestore';
import { toast } from 'react-toastify';
import defaultProfilePicture from '../assets/images/profile.jpg';
import './Djs.css';

const Djs = () => {
  const { currentUser } = useContext(AuthContext);
  const [djs, setDjs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDj, setSelectedDj] = useState(null); // Track the DJ to show in the modal
  const [djBookings, setDjBookings] = useState([]); // Store bookings for the selected DJ
  const [djPosts, setDjPosts] = useState([]); // Store posts for the selected DJ

  useEffect(() => {
    const fetchDjs = async () => {
      try {
        console.log('Fetching DJs...');
        const djQuery = query(
          collection(firestore, 'users'),
          where('role', '==', 'dj')
        );
        const djSnapshot = await getDocs(djQuery);
        const djData = djSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        console.log('Fetched DJs:', djData);
        setDjs(djData);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching DJs:', err);
        setError('Failed to load DJs: ' + err.message);
        toast.error('Failed to load DJs: ' + err.message);
        setLoading(false);
      }
    };

    fetchDjs();
  }, []);

  const handleBookDj = async (djId) => {
    if (!currentUser || currentUser.role !== 'organizer') {
      toast.error('Please log in as an organizer to book a DJ.');
      return;
    }

    try {
      // Placeholder logic; replace with actual event selection (handled by modal in DJCard)
      const eventRef = doc(firestore, 'events', 'some-event-id'); // Replace with actual event ID
      await updateDoc(eventRef, {
        djsBooked: arrayUnion(djId),
      });
      toast.success('DJ booked successfully!');
    } catch (err) {
      console.error('Error booking DJ:', err);
      toast.error('Failed to book DJ: ' + err.message);
    }
  };

  const filteredDjs = djs.filter((dj) =>
    dj.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openDjModal = async (dj) => {
    setSelectedDj(dj);

    // Fetch bookings for this DJ
    try {
      let bookingsQuery;
      if (currentUser && (currentUser.uid === dj.id || currentUser.role === 'organizer')) {
        bookingsQuery = query(
          collection(firestore, 'bookings'),
          where('djId', '==', dj.id)
        );

        if (currentUser.role === 'organizer') {
          // For organizers, only show bookings they made
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
        setDjBookings([]); // Clear bookings if user is not authorized to see them
      }

      // Fetch recent posts by this DJ
      const postsQuery = query(
        collection(firestore, 'posts'),
        where('userId', '==', dj.id),
        orderBy('createdAt', 'desc'),
        limit(3) // Limit to 3 recent posts
      );
      const postsSnapshot = await getDocs(postsQuery);
      const postsData = postsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setDjPosts(postsData);
    } catch (err) {
      console.error('Error fetching DJ details:', err);
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
      <h2>Browse DJs</h2>
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
      <div className="dj-list">
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
                    e.stopPropagation(); // Prevent modal from opening when clicking Book DJ
                    handleBookDj(dj.id);
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

      {/* DJ Modal */}
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
            {/* Bookings Section */}
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
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No bookings available.</p>
                )}
              </div>
            )}
            {/* Recent Posts Section */}
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