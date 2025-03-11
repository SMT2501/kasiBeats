import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { firestore, storage } from '../firebaseConfig';
import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from 'react-toastify';
import './CreateEvent.css';

const CreateEvent = () => {
  const { currentUser } = useContext(AuthContext);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [media, setMedia] = useState(null);
  const [ticketPrice, setTicketPrice] = useState(0);
  const [ticketQuantity, setTicketQuantity] = useState(0);
  const [capacity, setCapacity] = useState(0);
  const [allowDjRequests, setAllowDjRequests] = useState(false); // New toggle state
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    console.log('CreateEvent component mounted for user:', currentUser?.uid);
    return () => console.log('CreateEvent component unmounted');
  }, [currentUser]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      console.log('Selected media file:', file.name, file.type, file.size);
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        setError('Please upload an image or video file.');
        toast.error('Please upload an image or video file.');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB.');
        toast.error('File size must be less than 10MB.');
        return;
      }
      setMedia(file);
      setError(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!currentUser) {
      setError('Please log in to create an event.');
      toast.error('Please log in to create an event.');
      return;
    }

    if (!name || !date || !location || ticketPrice < 0 || ticketQuantity <= 0 || capacity <= 0) {
      setError('All fields (name, date, location, ticket price, quantity, and capacity) are required and must be positive.');
      toast.error('All fields (name, date, location, ticket price, quantity, and capacity) are required and must be positive.');
      return;
    }

    try {
      setLoading(true);
      let mediaUrl = '';
      let mediaType = '';

      if (media) {
        console.log('Uploading media for event by user:', currentUser.uid);
        const storageRef = ref(storage, `events/${currentUser.uid}/${Date.now()}_${media.name}`);
        const snapshot = await uploadBytes(storageRef, media);
        console.log('Upload snapshot:', snapshot);
        mediaUrl = await getDownloadURL(storageRef);
        mediaType = media.type;
        console.log('Media URL fetched:', mediaUrl);
      }

      const eventData = {
        organizerId: currentUser.uid,
        name,
        date: new Date(date),
        location,
        description,
        mediaUrl,
        mediaType,
        ticketPrice,
        ticketQuantity,
        capacity,
        ticketsSold: 0,
        djsBooked: [],
        createdAt: new Date(),
        pendingDjs: [],
        allowDjRequests, // Store the toggle state
      };

      console.log('Creating event with data:', eventData);
      await addDoc(collection(firestore, 'events'), eventData);

      toast.success('Event created successfully on KasiBeats!');
      navigate('/profile');
    } catch (error) {
      console.error('Error creating event:', error);
      setError('Failed to create event: ' + (error.message || 'Unknown error'));
      toast.error('Failed to create event: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    console.error('Render error in CreateEvent:', error);
    return (
      <div className="create-event">
        <h2>Create an Event on KasiBeats</h2>
        <div className="error-message">Error: {error.message}</div>
      </div>
    );
  }

  return (
    <div className="create-event">
      <h2>Create an Event on KasiBeats</h2>
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-section">
          <h3>Basic Information</h3>
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
            placeholder="Describe the event..."
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
        <div className="form-section">
          <h3>Media</h3>
          <label htmlFor="media">Media (Image or Video):</label>
          <input
            type="file"
            id="media"
            accept="image/*,video/*"
            onChange={handleFileChange}
          />
        </div>
        <div className="form-section">
          <h3>Ticket Information</h3>
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
            min="1"
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
        </div>
        <button type="submit" className="btn" disabled={loading}>
          {loading ? 'Creating...' : 'Create Event'}
        </button>
      </form>
    </div>
  );
};

export default CreateEvent;