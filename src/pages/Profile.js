import React, { useContext, useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { firestore } from '../firebaseConfig';
import { AuthContext } from '../context/AuthContext';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
} from 'firebase/firestore';
import { toast } from 'react-toastify';
import './Profile.css';
import defaultProfilePicture from '../assets/images/profile.jpg';

const Profile = () => {
  const { currentUser, loading: authLoading } = useContext(AuthContext);
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [price, setPrice] = useState(0);
  const [conditions, setConditions] = useState('');
  const [bio, setBio] = useState('');
  const [dataLoaded, setDataLoaded] = useState(false);
  const [earnings, setEarnings] = useState(0);
  const [selectedBooking, setSelectedBooking] = useState(null); // For booking modal
  const [selectedPost, setSelectedPost] = useState(null); // For post actions
  const [editPostMode, setEditPostMode] = useState(false); // Edit post state
  const [editedPostContent, setEditedPostContent] = useState(''); // Edited post content
  const [selectedEvent, setSelectedEvent] = useState(null); // For event modal
  const [eventTicketsSold, setEventTicketsSold] = useState(0); // Tickets sold
  const [eventDjs, setEventDjs] = useState([]); // Booked DJs
  const [editEventMode, setEditEventMode] = useState(false); // Edit event state
  const [editedEvent, setEditedEvent] = useState({}); // Edited event data
  const navigate = useNavigate();
  const { userId } = useParams();

  const fetchEarnings = useCallback(async () => {
    if (!profile?.role || profile.role !== 'dj') return;
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
      setEarnings(earnings);
    } catch (err) {
      console.error('Earnings calculation error:', err);
      toast.error('Failed to calculate earnings: ' + (err?.message || 'Unknown error'));
    }
  }, [profile?.role, currentUser?.uid]);

  useEffect(() => {
    if (authLoading) return;

    let isMounted = true;

    const fetchProfileData = async () => {
      try {
        const profileId = userId || currentUser?.uid;
        if (!profileId) {
          if (isMounted) {
            setError('No user ID provided.');
            setLoading(false);
          }
          return;
        }

        const profileRef = doc(firestore, 'users', profileId);
        const profileDoc = await getDoc(profileRef);
        if (!profileDoc.exists()) {
          if (isMounted) {
            setError('User not found.');
            setLoading(false);
          }
          return;
        }
        const profileData = profileDoc.data();
        if (isMounted) {
          setProfile(profileData);
          setBio(profileData.bio || '');
          setPrice(profileData.price || 0);
          setConditions(profileData.conditions || '');
        }

        if (profileData.role === 'dj') {
          const postsQuery = query(
            collection(firestore, 'posts'),
            where('userId', '==', profileId),
            orderBy('createdAt', 'desc')
          );
          const postSnapshot = await getDocs(postsQuery);
          if (isMounted) setPosts(postSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));

          const bookingsQuery = query(
            collection(firestore, 'bookings'),
            where('djId', '==', profileId)
          );
          const bookingsSnapshot = await getDocs(bookingsQuery);
          if (bookingsSnapshot.empty) {
            console.log('No bookings found for DJ:', profileId);
          } else if (isMounted) {
            try {
              const bookingData = await Promise.all(
                bookingsSnapshot.docs.map(async (bookingDoc) => {
                  const booking = { id: bookingDoc.id, ...bookingDoc.data() };
                  const eventRef = doc(firestore, 'events', booking.eventId);
                  const eventDoc = await getDoc(eventRef);
                  const organizerRef = doc(firestore, 'users', eventDoc.exists() ? eventDoc.data().organizerId : 'unknown');
                  const organizerDoc = await getDoc(organizerRef);
                  return {
                    ...booking,
                    eventDetails: eventDoc.exists() ? eventDoc.data() : {},
                    organizer: organizerDoc.exists() ? organizerDoc.data() : { username: 'Unknown Organizer' },
                  };
                })
              );
              setBookings(bookingData);
            } catch (err) {
              console.error('Error processing bookings:', err);
              if (isMounted) setBookings([]);
            }
          }
        }

        if (profileData.role === 'organizer') {
          const eventsQuery = query(
            collection(firestore, 'events'),
            where('organizerId', '==', profileId),
            orderBy('date', 'asc')
          );
          const eventsSnapshot = await getDocs(eventsQuery);
          if (isMounted) setEvents(eventsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        }

        if (isMounted) {
          setLoading(false);
          setDataLoaded(true);
        }
      } catch (err) {
        console.error('Fetch error:', err);
        if (isMounted) {
          setError('Failed to load profile data: ' + (err?.message || 'Unknown error'));
          toast.error('Failed to load profile data: ' + (err?.message || 'Unknown error'));
          setLoading(false);
        }
      }
    };

    fetchProfileData();
    fetchEarnings();

    return () => {
      isMounted = false;
    };
  }, [authLoading, userId, fetchEarnings]);

  // Booking Modal Functions
  const openBookingModal = (booking) => {
    setSelectedBooking(booking);
  };

  const closeBookingModal = () => {
    setSelectedBooking(null);
  };

  const handleBookingStatus = async (status) => {
    if (!currentUser || currentUser.uid !== selectedBooking.djId) {
      toast.error('Only the booked DJ can update this status.');
      return;
    }

    try {
      const bookingRef = doc(firestore, 'bookings', selectedBooking.id);
      await updateDoc(bookingRef, { status });
      setBookings((prev) =>
        prev.map((b) => (b.id === selectedBooking.id ? { ...b, status } : b))
      );
      setSelectedBooking((prev) => ({ ...prev, status }));

      // Notify organizer
      await addDoc(collection(firestore, 'notifications'), {
        userId: selectedBooking.eventDetails.organizerId,
        message: `DJ ${profile.username} has ${status} your booking for "${selectedBooking.eventDetails.name}".`,
        createdAt: new Date(),
        read: false,
      });

      toast.success(`Booking ${status} successfully!`);
    } catch (err) {
      console.error('Error updating booking status:', err);
      toast.error('Failed to update booking status: ' + (err?.message || 'Unknown error'));
    }
  };

  const viewOnMap = () => {
    const location = encodeURIComponent(selectedBooking.eventDetails.location || '');
    window.open(`https://www.google.com/maps/search/?api=1&query=${location}`, '_blank');
  };

  // Post Functions
  const openPostActions = (post) => {
    setSelectedPost(post);
    setEditedPostContent(post.content || '');
  };

  const closePostActions = () => {
    setSelectedPost(null);
    setEditPostMode(false);
  };

  const handleEditPost = async () => {
    if (!currentUser || currentUser.uid !== selectedPost.userId) {
      toast.error('Only the post creator can edit this post.');
      return;
    }

    try {
      const postRef = doc(firestore, 'posts', selectedPost.id);
      await updateDoc(postRef, { content: editedPostContent });
      setPosts((prev) =>
        prev.map((p) => (p.id === selectedPost.id ? { ...p, content: editedPostContent } : p))
      );
      setSelectedPost((prev) => ({ ...prev, content: editedPostContent }));
      setEditPostMode(false);
      toast.success('Post updated successfully!');
    } catch (err) {
      console.error('Error editing post:', err);
      toast.error('Failed to edit post: ' + (err?.message || 'Unknown error'));
    }
  };

  const handleDeletePost = async () => {
    if (!currentUser || currentUser.uid !== selectedPost.userId) {
      toast.error('Only the post creator can delete this post.');
      return;
    }

    if (window.confirm('Are you sure you want to delete this post?')) {
      try {
        const postRef = doc(firestore, 'posts', selectedPost.id);
        await deleteDoc(postRef);
        setPosts((prev) => prev.filter((p) => p.id !== selectedPost.id));
        closePostActions();
        toast.success('Post deleted successfully!');
      } catch (err) {
        console.error('Error deleting post:', err);
        toast.error('Failed to delete post: ' + (err?.message || 'Unknown error'));
      }
    }
  };

  const handleSharePost = () => {
    const postUrl = `${window.location.origin}/post/${selectedPost.id}`;
    navigator.clipboard.writeText(postUrl)
      .then(() => toast.success('Post URL copied to clipboard!'))
      .catch(() => toast.error('Failed to copy post URL.'));
  };

  // Event Modal Functions
  const openEventModal = async (event) => {
    setSelectedEvent(event);
    setEditedEvent({ ...event }); // Initialize editable event data

    // Fetch tickets sold
    try {
      const ticketsQuery = query(
        collection(firestore, 'tickets'),
        where('eventId', '==', event.id)
      );
      const ticketsSnapshot = await getDocs(ticketsQuery);
      setEventTicketsSold(ticketsSnapshot.size);

      // Fetch booked DJs
      const bookingsQuery = query(
        collection(firestore, 'bookings'),
        where('eventId', '==', event.id)
      );
      const bookingsSnapshot = await getDocs(bookingsQuery);
      const djsData = await Promise.all(
        bookingsSnapshot.docs.map(async (bookingDoc) => {
          const booking = bookingDoc.data();
          const djRef = doc(firestore, 'users', booking.djId);
          const djDoc = await getDoc(djRef);
          return {
            id: booking.djId,
            status: booking.status || 'pending',
            ...(djDoc.exists() ? djDoc.data() : { username: 'Unknown DJ' }),
          };
        })
      );
      setEventDjs(djsData);
    } catch (err) {
      console.error('Error fetching event details:', err);
      toast.error('Failed to load event details: ' + (err?.message || 'Unknown error'));
    }
  };

  const closeEventModal = () => {
    setSelectedEvent(null);
    setEventTicketsSold(0);
    setEventDjs([]);
    setEditEventMode(false);
  };

  const handleSaveEvent = async () => {
    if (!currentUser || currentUser.uid !== selectedEvent.organizerId) {
      toast.error('Only the event organizer can edit this event.');
      return;
    }

    try {
      const eventRef = doc(firestore, 'events', selectedEvent.id);
      await updateDoc(eventRef, editedEvent);

      // Update events state
      setEvents((prev) =>
        prev.map((e) => (e.id === selectedEvent.id ? { ...e, ...editedEvent } : e))
      );
      setSelectedEvent((prev) => ({ ...prev, ...editedEvent }));

      // Notify users and DJs if date changed
      if (editedEvent.date !== selectedEvent.date) {
        const ticketsQuery = query(
          collection(firestore, 'tickets'),
          where('eventId', '==', selectedEvent.id)
        );
        const ticketsSnapshot = await getDocs(ticketsQuery);
        const userIds = ticketsSnapshot.docs.map((doc) => doc.data().userId);

        const bookingsQuery = query(
          collection(firestore, 'bookings'),
          where('eventId', '==', selectedEvent.id)
        );
        const bookingsSnapshot = await getDocs(bookingsQuery);
        const djIds = bookingsSnapshot.docs.map((doc) => doc.data().djId);

        const notificationPromises = [...new Set([...userIds, ...djIds])].map((uid) =>
          addDoc(collection(firestore, 'notifications'), {
            userId: uid,
            message: `Event "${selectedEvent.name}" date changed to ${new Date(editedEvent.date.seconds * 1000).toLocaleDateString()}.`,
            createdAt: new Date(),
            read: false,
          })
        );
        await Promise.all(notificationPromises);
        toast.success('Event updated and users/DJs notified!');
      } else {
        toast.success('Event updated successfully!');
      }

      setEditEventMode(false);
    } catch (err) {
      console.error('Error updating event:', err);
      toast.error('Failed to update event: ' + (err?.message || 'Unknown error'));
    }
  };

  const handleCancelEvent = async () => {
    if (!currentUser || currentUser.uid !== selectedEvent.organizerId) {
      toast.error('Only the event organizer can cancel this event.');
      return;
    }

    if (window.confirm('Are you sure you want to cancel this event? This action cannot be undone.')) {
      try {
        const eventRef = doc(firestore, 'events', selectedEvent.id);
        await deleteDoc(eventRef);

        // Notify ticket holders and DJs
        const ticketsQuery = query(
          collection(firestore, 'tickets'),
          where('eventId', '==', selectedEvent.id)
        );
        const ticketsSnapshot = await getDocs(ticketsQuery);
        const userIds = ticketsSnapshot.docs.map((doc) => doc.data().userId);

        const bookingsQuery = query(
          collection(firestore, 'bookings'),
          where('eventId', '==', selectedEvent.id)
        );
        const bookingsSnapshot = await getDocs(bookingsQuery);
        const djIds = bookingsSnapshot.docs.map((doc) => doc.data().djId);

        const notificationPromises = [...new Set([...userIds, ...djIds])].map((uid) =>
          addDoc(collection(firestore, 'notifications'), {
            userId: uid,
            message: `Event "${selectedEvent.name}" has been canceled.`,
            createdAt: new Date(),
            read: false,
          })
        );
        await Promise.all(notificationPromises);

        setEvents((prev) => prev.filter((e) => e.id !== selectedEvent.id));
        closeEventModal();
        toast.success('Event canceled and users/DJs notified!');
      } catch (err) {
        console.error('Error canceling event:', err);
        toast.error('Failed to cancel event: ' + (err?.message || 'Unknown error'));
      }
    }
  };

  const handleShareEvent = () => {
    const eventUrl = `${window.location.origin}/events/${selectedEvent.id}`;
    navigator.clipboard.writeText(eventUrl)
      .then(() => toast.success('Event URL copied to clipboard!'))
      .catch(() => toast.error('Failed to copy event URL.'));
  };

  const handleEditProfile = () => {
    navigate('/edit_profile');
  };

  const handleSaveProfile = async () => {
    try {
      const userRef = doc(firestore, 'users', currentUser.uid);
      await setDoc(
        userRef,
        {
          bio,
          price: profile.role === 'dj' ? price : undefined,
          conditions: profile.role === 'dj' ? conditions : undefined,
        },
        { merge: true }
      );
      setEditMode(false);
      toast.success('Profile updated successfully on KasiBeats!');
      // Refresh profile data after save
      const profileDoc = await getDoc(userRef);
      if (profileDoc.exists()) {
        setProfile(profileDoc.data());
      }
    } catch (error) {
      toast.error('Failed to update profile: ' + (error?.message || 'Unknown error'));
    }
  };

  const handleShareProfile = () => {
    const profileURL = `${window.location.origin}/profile/${userId || currentUser.uid}`;
    navigator.clipboard.writeText(profileURL)
      .then(() => toast.success('Profile URL copied to clipboard!'))
      .catch(() => toast.error('Failed to copy profile URL.'));
  };

  const handleCreatePost = () => {
    navigate('/create_post');
  };

  const handleCreateEvent = () => {
    navigate('/create_event');
  };

  const handleViewCalendar = () => {
    navigate('/booking-calendar');
  };

  if (authLoading || loading || !dataLoaded) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;
  if (!profile) return <div>Profile not found.</div>;

  const isOwnProfile = currentUser && currentUser.uid === (userId || currentUser.uid);

  return (
    <div className="profile">
      <div className="profile-header">
        <img
          src={profile.profilePicture || defaultProfilePicture}
          alt="Profile"
          className="profile-picture"
        />
        <h2>{profile.username || 'No username set'}</h2>
        <p>Bio: {profile.bio || 'No bio available'}</p>
        <p>Role: {profile.role}</p>
        {profile.role === 'dj' && (
          <>
            <p>Rate: R{price}</p>
            <p>Conditions: {conditions || 'Not specified'}</p>
          </>
        )}
        {isOwnProfile && (
          <>
            <button className="btn" onClick={handleEditProfile}>
              {editMode ? 'Save Profile' : 'Edit Profile'}
            </button>
            <button className="btn" onClick={handleShareProfile}>
              Share Profile
            </button>
            {(profile.role === 'dj' || profile.role === 'organizer') && (
              <button className="btn" onClick={handleViewCalendar}>
                View Calendar
              </button>
            )}
          </>
        )}
        {editMode && isOwnProfile && (
          <div className="edit-fields">
            <label>Bio:</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows="4"
            />
            {profile.role === 'dj' && (
              <>
                <label>Rate (R):</label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  min="0"
                />
                <label>Conditions:</label>
                <input
                  type="text"
                  value={conditions}
                  onChange={(e) => setConditions(e.target.value)}
                  placeholder="e.g., 50% upfront"
                />
              </>
            )}
            <button className="btn save-btn" onClick={handleSaveProfile}>
              Save Changes
            </button>
          </div>
        )}
        {profile.role === 'dj' && (
          <div className="earnings-section">
            <h3>Earnings on KasiBeats: R{earnings}</h3>
          </div>
        )}
      </div>

      {profile.role === 'dj' && (
        <>
          <div className="dj-bookings">
            <h3>Upcoming Bookings on KasiBeats</h3>
            <div className="grid-container">
              {bookings.length > 0 ? (
                bookings.map((booking) => (
                  <div key={booking.id} className="booking-card" onClick={() => openBookingModal(booking)}>
                    <h4>{booking.eventName || 'Unnamed Event'}</h4>
                    <p>
                      Date:{' '}
                      {booking.date?.seconds
                        ? new Date(booking.date.seconds * 1000).toLocaleDateString()
                        : 'Date unavailable'}
                    </p>
                    <p>Location: {booking.eventDetails?.location || 'N/A'}</p>
                    <p>Status: {booking.status || 'Pending'}</p>
                  </div>
                ))
              ) : (
                <p>No upcoming bookings.</p>
              )}
            </div>
          </div>

          <div className="user-posts">
            <div className="posts-header">
              <h3>Content</h3>
              {isOwnProfile && (
                <button className="fab" onClick={handleCreatePost}>
                  +
                </button>
              )}
            </div>
            <div className="grid-container">
              {posts.length > 0 ? (
                posts.map((post) => (
                  <div key={post.id} className="post-card" onClick={() => openPostActions(post)}>
                    <h4>{post.title || 'No Title'}</h4>
                    <p>{post.content || 'No content'}</p>
                    {post.createdAt && (
                      <p>Posted on: {new Date(post.createdAt.seconds * 1000).toLocaleString()}</p>
                    )}
                    {post.mediaUrl && (
                      post.mediaType?.startsWith('image/') ? (
                        <img src={post.mediaUrl} alt="Post Media" className="post-media" />
                      ) : (
                        <video src={post.mediaUrl} controls className="post-media" />
                      )
                    )}
                  </div>
                ))
              ) : (
                <p>No posts yet.</p>
              )}
            </div>
          </div>
        </>
      )}

      {profile.role === 'organizer' && (
        <div className="organizer-events">
          <div className="events-header">
            <h3>Events on KasiBeats</h3>
            {isOwnProfile && (
              <button className="fab" onClick={handleCreateEvent}>
                +
              </button>
            )}
          </div>
          <div className="grid-container">
            {events.length > 0 ? (
              events.map((event) => (
                <div key={event.id} className="event-card" onClick={() => openEventModal(event)}>
                  <h4>{event.name || 'Unnamed Event'}</h4>
                  <p>
                    Date:{' '}
                    {event.date?.seconds
                      ? new Date(event.date.seconds * 1000).toLocaleDateString()
                      : 'Date unavailable'}
                  </p>
                  <p>Location: {event.location || 'N/A'}</p>
                  <p>{event.description || 'No description'}</p>
                  {event.mediaUrl && (
                    event.mediaType?.startsWith('image/') ? (
                      <img src={event.mediaUrl} alt="Event Media" className="event-media" />
                    ) : (
                      <video src={event.mediaUrl} controls className="event-media" />
                    )
                  )}
                </div>
              ))
            ) : (
              <p>No events created.</p>
            )}
          </div>
        </div>
      )}

      {selectedBooking && (
        <div className="booking-modal-overlay">
          <div className="booking-modal-content">
            <button className="close-modal-btn" onClick={closeBookingModal}>✖</button>
            <h2>{selectedBooking.eventName || 'Unnamed Event'}</h2>
            <p>
              Date:{' '}
              {selectedBooking.date?.seconds
                ? new Date(selectedBooking.date.seconds * 1000).toLocaleDateString()
                : 'Date unavailable'}
            </p>
            <p>Location: {selectedBooking.eventDetails?.location || 'N/A'}</p>
            <p>Status: {selectedBooking.status || 'Pending'}</p>
            <p>Organizer: {selectedBooking.organizer?.username || 'Unknown'}</p> {/* Updated line */}
            <p>Rate: R{profile.price || 0}</p>
            <p>Conditions: {profile.conditions || 'Not specified'}</p>
            <div className="booking-actions">
              <button className="btn map-btn" onClick={viewOnMap}>View on Map</button>
              {isOwnProfile && selectedBooking.status === 'pending' && (
                <>
                  <button className="btn accept-btn" onClick={() => handleBookingStatus('accepted')}>
                    Accept
                  </button>
                  <button className="btn reject-btn" onClick={() => handleBookingStatus('rejected')}>
                    Reject
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedPost && (
        <div className="post-modal-overlay">
          <div className="post-modal-content">
            <button className="close-modal-btn" onClick={closePostActions}>✖</button>
            {editPostMode ? (
              <div className="edit-post-form">
                <h2>Edit Post</h2>
                <label>Caption:</label>
                <textarea
                  value={editedPostContent}
                  onChange={(e) => setEditedPostContent(e.target.value)}
                  rows="4"
                />
                <button className="btn" onClick={handleEditPost}>Save Changes</button>
              </div>
            ) : (
              <>
                <h2>{selectedPost.title || 'No Title'}</h2>
                <p>{selectedPost.content || 'No content'}</p>
                {selectedPost.createdAt && (
                  <p>Posted on: {new Date(selectedPost.createdAt.seconds * 1000).toLocaleString()}</p>
                )}
                {selectedPost.mediaUrl && (
                  selectedPost.mediaType?.startsWith('image/') ? (
                    <img src={selectedPost.mediaUrl} alt="Post Media" className="post-media-large" />
                  ) : (
                    <video src={selectedPost.mediaUrl} controls className="post-media-large" />
                  )
                )}
                {isOwnProfile && (
                  <div className="post-actions">
                    <button className="btn" onClick={() => setEditPostMode(true)}>Edit Caption</button>
                    <button className="btn delete-btn" onClick={handleDeletePost}>Delete Post</button>
                    <button className="btn share-btn" onClick={handleSharePost}>Share Post</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {selectedEvent && (
        <div className="event-modal-overlay">
          <div className="event-modal-content">
            <button className="close-modal-btn" onClick={closeEventModal}>✖</button>
            {editEventMode ? (
              <div className="edit-event-form">
                <h2>Edit Event: {selectedEvent.name}</h2>
                <label>Name:</label>
                <input
                  type="text"
                  value={editedEvent.name || ''}
                  onChange={(e) => setEditedEvent({ ...editedEvent, name: e.target.value })}
                />
                <label>Date:</label>
                <input
                  type="date"
                  value={
                    editedEvent.date?.seconds
                      ? new Date(editedEvent.date.seconds * 1000).toISOString().split('T')[0]
                      : ''
                  }
                  onChange={(e) =>
                    setEditedEvent({
                      ...editedEvent,
                      date: { seconds: Math.floor(new Date(e.target.value).getTime() / 1000) },
                    })
                  }
                />
                <label>Location:</label>
                <input
                  type="text"
                  value={editedEvent.location || ''}
                  onChange={(e) => setEditedEvent({ ...editedEvent, location: e.target.value })}
                />
                <label>Description:</label>
                <textarea
                  value={editedEvent.description || ''}
                  onChange={(e) => setEditedEvent({ ...editedEvent, description: e.target.value })}
                  rows="4"
                />
                <label>Ticket Price (R):</label>
                <input
                  type="number"
                  value={editedEvent.ticketPrice || 20}
                  onChange={(e) => setEditedEvent({ ...editedEvent, ticketPrice: Number(e.target.value) })}
                  min="0"
                />
                <button className="btn" onClick={handleSaveEvent}>Save Changes</button>
              </div>
            ) : (
              <>
                <h2>{selectedEvent.name || 'Unnamed Event'}</h2>
                <p>
                  Date:{' '}
                  {selectedEvent.date?.seconds
                    ? new Date(selectedEvent.date.seconds * 1000).toLocaleDateString()
                    : 'Date unavailable'}
                </p>
                <p>Location: {selectedEvent.location || 'N/A'}</p>
                <p>Description: {selectedEvent.description || 'No description'}</p>
                <p>Tickets Sold: {eventTicketsSold}</p>
                <p>Ticket Price: R{selectedEvent.ticketPrice || 20}</p>
                {selectedEvent.mediaUrl && (
                  selectedEvent.mediaType?.startsWith('image/') ? (
                    <img src={selectedEvent.mediaUrl} alt="Event Media" className="event-media-large" />
                  ) : (
                    <video src={selectedEvent.mediaUrl} controls className="event-media-large" />
                  )
                )}
                <div className="event-actions">
                  {isOwnProfile && (
                    <>
                      <button className="btn" onClick={() => setEditEventMode(true)}>
                        Edit Event
                      </button>
                      <button className="btn cancel-btn" onClick={handleCancelEvent}>
                        Cancel Event
                      </button>
                    </>
                  )}
                  <button className="btn share-btn" onClick={handleShareEvent}>
                    Share Event
                  </button>
                </div>
                <div className="event-djs-section">
                  <h4>Booked DJs</h4>
                  {eventDjs.length > 0 ? (
                    <ul className="dj-list">
                      {eventDjs.map((dj) => (
                        <li key={dj.id} className="dj-item">
                          <strong>{dj.username || 'Unknown DJ'}</strong> -{' '}
                          <span className={`status-${dj.status}`}>{dj.status || 'Pending'}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No DJs booked for this event.</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;