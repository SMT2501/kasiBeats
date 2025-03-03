import React, { useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { firestore } from '../firebaseConfig';
import { AuthContext } from '../context/AuthContext';
import { collection, doc, getDoc, getDocs, query, where, orderBy } from 'firebase/firestore';
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
  const navigate = useNavigate();
  const { userId } = useParams();

  useEffect(() => {
    if (authLoading) return;

    const fetchProfileData = async () => {
      try {
        const profileId = userId || currentUser?.uid;
        if (!profileId) {
          setError('No user ID provided.');
          setLoading(false);
          return;
        }

        const profileRef = doc(firestore, 'users', profileId);
        const profileDoc = await getDoc(profileRef);
        if (!profileDoc.exists()) {
          setError('User not found.');
          setLoading(false);
          return;
        }
        setProfile(profileDoc.data());

        if (profileDoc.data().role === 'dj') {
          const postsQuery = query(
            collection(firestore, 'posts'),
            where('userId', '==', profileId),
            orderBy('createdAt', 'desc')
          );
          const postSnapshot = await getDocs(postsQuery);
          setPosts(postSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));

          const bookingsQuery = query(
            collection(firestore, 'bookings'),
            where('djId', '==', profileId),
            where('status', '==', 'accepted')
          );
          const bookingsSnapshot = await getDocs(bookingsQuery);
          const bookingData = await Promise.all(
            bookingsSnapshot.docs.map(async (bookingDoc) => { // Renamed 'doc' to 'bookingDoc'
              const booking = { id: bookingDoc.id, ...bookingDoc.data() };
              const eventRef = doc(firestore, 'events', booking.eventId); // Now 'doc' refers to the imported function
              const eventDoc = await getDoc(eventRef);
              return {
                ...booking,
                eventDetails: eventDoc.exists() ? eventDoc.data() : {},
              };
            })
          );
          setBookings(bookingData);
        }

        if (profileDoc.data().role === 'organizer') {
          const eventsQuery = query(
            collection(firestore, 'events'),
            where('organizerId', '==', profileId),
            orderBy('date', 'asc')
          );
          const eventsSnapshot = await getDocs(eventsQuery);
          setEvents(eventsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        }

        setLoading(false);
      } catch (err) {
        console.error('Error fetching profile data:', err);
        setError('Failed to load profile data: ' + err.message);
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [authLoading, currentUser, userId]);

  const handleEditProfile = () => {
    navigate('/edit_profile');
  };

  const handleShareProfile = () => {
    const profileURL = `${window.location.origin}/profile/${userId || currentUser.uid}`;
    navigator.clipboard.writeText(profileURL).then(() => {
      alert('Profile URL copied to clipboard!');
    }).catch((err) => {
      console.error('Failed to copy profile URL: ', err);
    });
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

  if (authLoading || loading) return <div>Loading...</div>;
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
        {isOwnProfile && (
          <>
            <button className="btn" onClick={handleEditProfile}>
              Edit Profile
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
      </div>

      {profile.role === 'dj' && (
        <>
          <div className="dj-bookings">
            <h3>Upcoming Bookings</h3>
            {bookings.length > 0 ? (
              bookings.map((booking) => (
                <div key={booking.id} className="booking-card">
                  <h4>{booking.eventName}</h4>
                  <p>
                    Date:{' '}
                    {new Date(booking.date.seconds * 1000).toLocaleDateString()}
                  </p>
                  <p>Location: {booking.eventDetails?.location || 'N/A'}</p>
                </div>
              ))
            ) : (
              <p>No upcoming bookings.</p>
            )}
          </div>

          <div className="user-posts">
            <div className="posts-header">
              <h3>Your Posts</h3>
              {isOwnProfile && (
                <button className="fab" onClick={handleCreatePost}>
                  +
                </button>
              )}
            </div>
            <div className="post-container">
              {posts.length > 0 ? (
                posts.map((post) => (
                  <div key={post.id} className="post-card">
                    <h4>{post.title}</h4>
                    <p>{post.content}</p>
                    {post.createdAt && (
                      <p>
                        Posted on:{' '}
                        {new Date(post.createdAt.seconds * 1000).toLocaleString()}
                      </p>
                    )}
                    {post.mediaUrl && (
                      post.mediaType.startsWith('image/') ? (
                        <img
                          src={post.mediaUrl}
                          alt="Post Media"
                          className="post-media"
                        />
                      ) : (
                        <video
                          src={post.mediaUrl}
                          controls
                          className="post-media"
                        />
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
        <>
          <div className="organizer-events">
            <div className="events-header">
              <h3>Your Events</h3>
              {isOwnProfile && (
                <button className="fab" onClick={handleCreateEvent}>
                  +
                </button>
              )}
            </div>
            {events.length > 0 ? (
              events.map((event) => (
                <div key={event.id} className="event-card">
                  <h4>{event.name}</h4>
                  <p>
                    Date:{' '}
                    {new Date(event.date.seconds * 1000).toLocaleDateString()}
                  </p>
                  <p>Location: {event.location}</p>
                  <p>{event.description}</p>
                  {event.mediaUrl && (
                    event.mediaType.startsWith('image/') ? (
                      <img
                        src={event.mediaUrl}
                        alt="Event Media"
                        className="event-media"
                      />
                    ) : (
                      <video
                        src={event.mediaUrl}
                        controls
                        className="event-media"
                      />
                    )
                  )}
                </div>
              ))
            ) : (
              <p>No events created.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Profile;