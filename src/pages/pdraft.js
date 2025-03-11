import React, { useContext, useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { firestore } from '../firebaseConfig';
import { AuthContext } from '../context/AuthContext';
import { collection, doc, getDoc, getDocs, query, where, orderBy, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
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
  const [selectedEvent, setSelectedEvent] = useState(null); // For modal
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
                  return {
                    ...booking,
                    eventDetails: eventDoc.exists() ? eventDoc.data() : {},
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
        { bio, price: profile.role === 'dj' ? price : undefined, conditions: profile.role === 'dj' ? conditions : undefined },
        { merge: true }
      );
      setEditMode(false);
      toast.success('Profile updated successfully on KasiBeats!');
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
        <img src={profile.profilePicture || defaultProfilePicture} alt="Profile" className="profile-picture" />
        <h2>{profile.username || 'No username set'}</h2>
        <p>Bio: {profile.bio || 'No bio available'}</p>
        <p>Role: {profile.role}</p>
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
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows="4" />
            {profile.role === 'dj' && (
              <>
                <label>Rate (R):</label>
                <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} min="0" />
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
                  <div key={booking.id} className="booking-card">
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
                  <div key={post.id} className="post-card">
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
            <h3>Your Events on KasiBeats</h3>
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
                  onChange={(e) => setEditedEvent({ ...editedEvent, date: { seconds: Math.floor(new Date(e.target.value).getTime() / 1000) } })}
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