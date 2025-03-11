import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { firestore, storage } from '../firebaseConfig';
import { doc, getDoc, updateDoc, deleteDoc, query, collection, where, getDocs } from 'firebase/firestore'; // Added missing imports
import { ref, deleteObject } from 'firebase/storage';
import { toast } from 'react-toastify';
import './EventDetail.css';

const EventDetail = () => {
  const { eventId } = useParams();
  const { currentUser } = useContext(AuthContext);
  const [event, setEvent] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [ticketPrice, setTicketPrice] = useState(0);
  const [ticketQuantity, setTicketQuantity] = useState(0);
  const [capacity, setCapacity] = useState(0);
  const [mediaUrl, setMediaUrl] = useState('');
  const [allowDjRequests, setAllowDjRequests] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        console.log('Fetching event with ID:', eventId);
        const eventRef = doc(firestore, 'events', eventId);
        const eventDoc = await getDoc(eventRef);
        if (eventDoc.exists()) {
          const eventData = eventDoc.data();
          console.log('Event data fetched:', eventData);
          setName(eventData.name);
          const eventDate = eventData.date && typeof eventData.date.toDate === 'function'
            ? eventData.date.toDate()
            : eventData.date instanceof Date
              ? eventData.date
              : eventData.date ? new Date(eventData.date) : null;
          setDate(eventDate ? eventDate.toISOString().slice(0, 16) : '');
          setLocation(eventData.location);
          setDescription(eventData.description);
          setTicketPrice(eventData.ticketPrice || 0);
          setTicketQuantity(eventData.ticketQuantity || 0);
          setCapacity(eventData.capacity || 0);
          setMediaUrl(eventData.mediaUrl || '');
          setAllowDjRequests(eventData.allowDjRequests || false);
          setEvent(eventData);
        } else {
          setError('Event not found.');
        }
      } catch (err) {
        console.error('Error fetching event:', err);
        setError('Failed to load event: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [eventId]);

  const handleEdit = () => {
    setEditMode(true);
  };

  const handleSave = async () => {
    if (!currentUser || currentUser.uid !== event.organizerId) {
      setError('You do not have permission to edit this event.');
      return;
    }

    try {
      const eventRef = doc(firestore, 'events', eventId);
      await updateDoc(eventRef, {
        name,
        date: new Date(date),
        location,
        description,
        ticketPrice: Number(ticketPrice),
        ticketQuantity: Number(ticketQuantity),
        capacity: Number(capacity),
        allowDjRequests,
      });
      setEditMode(false);
      toast.success('Event updated successfully!');
      setEvent({
        ...event,
        name,
        date: new Date(date),
        location,
        description,
        ticketPrice,
        ticketQuantity,
        capacity,
        allowDjRequests,
      });
    } catch (err) {
      setError('Failed to update event: ' + err.message);
    }
  };

  const handleDeleteMedia = async () => {
    if (mediaUrl) {
      try {
        const storageRef = ref(storage, mediaUrl);
        await deleteObject(storageRef);
        await updateDoc(doc(firestore, 'events', eventId), { mediaUrl: '', mediaType: '' });
        setMediaUrl('');
        toast.success('Media deleted successfully!');
      } catch (err) {
        setError('Failed to delete media: ' + err.message);
      }
    }
  };

  const handleDeleteEvent = async () => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      try {
        if (mediaUrl) {
          const storageRef = ref(storage, mediaUrl);
          await deleteObject(storageRef);
        }
        await deleteDoc(doc(firestore, 'events', eventId));
        toast.success('Event deleted successfully!');
        navigate('/profile');
      } catch (err) {
        setError('Failed to delete event: ' + err.message);
      }
    }
  };

  const handleApproveDj = async (djId) => {
    try {
      const eventRef = doc(firestore, 'events', eventId);
      await updateDoc(eventRef, {
        djsBooked: [...(event.djsBooked || []), djId],
        pendingDjs: (event.pendingDjs || []).filter((id) => id !== djId),
      });
      const bookingQuery = query(
        collection(firestore, 'bookings'),
        where('eventId', '==', eventId),
        where('djId', '==', djId),
        where('status', '==', 'pending')
      );
      const bookingSnapshot = await getDocs(bookingQuery);
      bookingSnapshot.forEach(async (doc) => {
        await updateDoc(doc.ref, { status: 'accepted' });
      });

      setEvent({
        ...event,
        djsBooked: [...(event.djsBooked || []), djId],
        pendingDjs: (event.pendingDjs || []).filter((id) => id !== djId),
      });
      toast.success('DJ approved!');
    } catch (err) {
      toast.error('Failed to approve DJ: ' + err.message);
    }
  };

  const handleRejectDj = async (djId) => {
    try {
      const eventRef = doc(firestore, 'events', eventId);
      await updateDoc(eventRef, {
        pendingDjs: (event.pendingDjs || []).filter((id) => id !== djId),
      });
      const bookingQuery = query(
        collection(firestore, 'bookings'),
        where('eventId', '==', eventId),
        where('djId', '==', djId),
        where('status', '==', 'pending')
      );
      const bookingSnapshot = await getDocs(bookingQuery);
      bookingSnapshot.forEach(async (doc) => {
        await deleteDoc(doc.ref);
      });

      setEvent({
        ...event,
        pendingDjs: (event.pendingDjs || []).filter((id) => id !== djId),
      });
      toast.success('DJ rejected!');
    } catch (err) {
      toast.error('Failed to reject DJ: ' + err.message);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;
  if (!event) return <div>Event not found.</div>;

  const isOrganizer = currentUser && currentUser.uid === event.organizerId;

  return (
    <div className="event-detail">
      <h2>{name}</h2>
      {isOrganizer && !editMode && (
        <button className="btn edit-btn" onClick={handleEdit}>Edit</button>
      )}
      {isOrganizer && editMode && (
        <>
          <button className="btn save-btn" onClick={handleSave}>Save</button>
          <button className="btn cancel-btn" onClick={() => setEditMode(false)}>Cancel</button>
        </>
      )}
      {isOrganizer && (
        <button className="btn delete-btn" onClick={handleDeleteEvent}>Delete Event</button>
      )}
      {mediaUrl && (
        <div className="media-preview">
          {mediaUrl.endsWith('.jpg') || mediaUrl.endsWith('.png') || mediaUrl.endsWith('.jpeg') ? (
            <img src={mediaUrl} alt="Event Media" className="event-media" />
          ) : (
            <video src={mediaUrl} controls className="event-media" />
          )}
          {isOrganizer && <button className="btn delete-media-btn" onClick={handleDeleteMedia}>Delete Media</button>}
        </div>
      )}
      {!editMode ? (
        <>
          <p><strong>Date:</strong> {event.date && typeof event.date.toDate === 'function'
            ? event.date.toDate().toLocaleDateString()
            : event.date instanceof Date
              ? event.date.toLocaleDateString()
              : event.date ? new Date(event.date).toLocaleDateString() : 'Date unavailable'}</p>
          <p><strong>Location:</strong> {event.location}</p>
          <p><strong>Description:</strong> {event.description}</p>
          <p><strong>Ticket Price:</strong> R{event.ticketPrice}</p>
          <p><strong>Tickets Available:</strong> {event.ticketQuantity - (event.ticketsSold || 0)}</p>
          <p><strong>Capacity:</strong> {event.capacity}</p>
          <p><strong>Allow DJ Requests:</strong> {event.allowDjRequests ? 'Yes' : 'No'}</p>
          <h3>Booked DJs</h3>
          {event.djsBooked && event.djsBooked.length > 0 ? (
            <ul>
              {event.djsBooked.map((djId, index) => (
                <li key={index}>{djId}</li>
              ))}
            </ul>
          ) : (
            <p>No DJs booked yet.</p>
          )}
          <h3>Pending DJ Requests</h3>
          {event.pendingDjs && event.pendingDjs.length > 0 ? (
            <ul>
              {event.pendingDjs.map((djId, index) => (
                <li key={index}>
                  {djId}
                  <button className="btn approve-btn" onClick={() => handleApproveDj(djId)}>Approve</button>
                  <button className="btn reject-btn" onClick={() => handleRejectDj(djId)}>Reject</button>
                </li>
              ))}
            </ul>
          ) : (
            <p>No pending DJ requests.</p>
          )}
        </>
      ) : (
        <div className="edit-form">
          <label htmlFor="name">Event Name:</label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <label htmlFor="date">Date & Time:</label>
          <input
            type="datetime-local"
            id="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
          <label htmlFor="location">Location:</label>
          <input
            type="text"
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
          />
          <label htmlFor="description">Description:</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows="4"
          />
          <label htmlFor="ticketPrice">Ticket Price (R):</label>
          <input
            type="number"
            id="ticketPrice"
            value={ticketPrice}
            onChange={(e) => setTicketPrice(Number(e.target.value))}
            min="0"
            step="0.01"
            required
          />
          <label htmlFor="ticketQuantity">Number of Tickets:</label>
          <input
            type="number"
            id="ticketQuantity"
            value={ticketQuantity}
            onChange={(e) => setTicketQuantity(Number(e.target.value))}
            min="0"
            required
          />
          <label htmlFor="capacity">Maximum Capacity:</label>
          <input
            type="number"
            id="capacity"
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
            min="1"
            required
          />
          <label>
            Allow DJs to Request Booking:
            <input
              type="checkbox"
              checked={allowDjRequests}
              onChange={(e) => setAllowDjRequests(e.target.checked)}
            />
          </label>
        </div>
      )}
    </div>
  );
};

export default EventDetail;