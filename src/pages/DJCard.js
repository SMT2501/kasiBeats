import React, { useContext, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { firestore } from '../firebaseConfig';
import { doc, updateDoc, collection, addDoc, arrayUnion, query, where, getDocs } from 'firebase/firestore';
import defaultProfilePicture from '../assets/images/profile.jpg';
import './DJCard.css';

const DJCard = ({ dj }) => {
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch organizer's events when the modal opens
  useEffect(() => {
    if (showModal && currentUser?.role === 'organizer') {
      const fetchEvents = async () => {
        try {
          setLoading(true);
          const eventsQuery = query(
            collection(firestore, 'events'),
            where('organizerId', '==', currentUser.uid)
          );
          const eventsSnapshot = await getDocs(eventsQuery);
          const eventsData = eventsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setEvents(eventsData);
          if (eventsData.length > 0) {
            setSelectedEventId(eventsData[0].id); // Pre-select the first event
          }
          setLoading(false);
        } catch (err) {
          console.error('Error fetching events:', err);
          setError('Failed to load events: ' + err.message);
          setLoading(false);
        }
      };

      fetchEvents();
    }
  }, [showModal, currentUser]);

  const handleBookDj = async () => {
    if (!currentUser || currentUser.role !== 'organizer') {
      alert('Please log in as an organizer to book a DJ.');
      return;
    }

    setShowModal(true);
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();

    if (!selectedEventId) {
      setError('Please select an event.');
      return;
    }

    try {
      setLoading(true);
      const selectedEvent = events.find((event) => event.id === selectedEventId);

      // Create a new booking
      const bookingRef = collection(firestore, 'bookings');
      await addDoc(bookingRef, { // Removed unused bookingDoc variable
        djId: dj.id,
        organizerId: currentUser.uid,
        eventId: selectedEvent.id,
        eventName: selectedEvent.name,
        date: selectedEvent.date,
        status: 'pending',
        createdAt: new Date(),
      });

      // Optionally, update the event to include the DJ in the djsBooked array
      const eventRef = doc(firestore, 'events', selectedEvent.id);
      await updateDoc(eventRef, {
        djsBooked: arrayUnion(dj.id),
      });

      alert('Booking request sent! The DJ will be notified.');
      setShowModal(false);
      setError(null);
      navigate('/bookings');
    } catch (error) {
      console.error('Error booking DJ:', error);
      setError('Failed to book DJ: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setError(null);
    setSelectedEventId('');
  };

  return (
    <div className="dj-card">
      <Link to={`/profile/${dj.id}`}>
        <img
          src={dj.profilePicture || defaultProfilePicture}
          alt="Profile"
          className="profile-picture"
        />
      </Link>
      <h3>{dj.username || 'Unknown DJ'}</h3>
      <p>{dj.bio || 'No bio available'}</p>
      {currentUser?.role === 'organizer' && (
        <button onClick={handleBookDj} className="btn">
          Book Now
        </button>
      )}

      {/* Booking Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Book {dj.username} for an Event</h2>
            {error && <div className="error-message">{error}</div>}
            {loading ? (
              <div>Loading events...</div>
            ) : (
              <form onSubmit={handleModalSubmit}>
                <label htmlFor="event-select">Select Event:</label>
                <select
                  id="event-select"
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  required
                >
                  <option value="">Select an Event</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name} -{' '}
                      {event.date?.seconds
                        ? new Date(event.date.seconds * 1000).toLocaleDateString()
                        : 'Date unavailable'}
                    </option>
                  ))}
                </select>
                <div className="modal-actions">
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Booking...' : 'Confirm Booking'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={closeModal}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DJCard;