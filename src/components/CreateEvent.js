import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { firestore, storage } from '../firebaseConfig';
import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from 'react-toastify'; // Import toast
import './CreateEvent.css';

const CreateEvent = () => {
  const { currentUser } = useContext(AuthContext);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [media, setMedia] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
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

    if (!name || !date || !location) {
      setError('Name, date, and location are required.');
      toast.error('Name, date, and location are required.');
      return;
    }

    try {
      setLoading(true);
      let mediaUrl = '';
      let mediaType = '';

      if (media) {
        const storageRef = ref(storage, `events/${currentUser.uid}/${media.name}`);
        await uploadBytes(storageRef, media);
        mediaUrl = await getDownloadURL(storageRef);
        mediaType = media.type;
      }

      await addDoc(collection(firestore, 'events'), {
        organizerId: currentUser.uid,
        name,
        date: new Date(date),
        location,
        description,
        mediaUrl,
        mediaType,
        djsBooked: [],
        createdAt: new Date(),
      });

      toast.success('Event created successfully!');
      navigate('/profile');
    } catch (error) {
      console.error('Error creating event:', error);
      setError('Failed to create event: ' + error.message);
      toast.error('Failed to create event: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-event">
      <h2>Create an Event</h2>
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit}>
        <label htmlFor="name">Event Name:</label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <label htmlFor="date">Date:</label>
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
        <label htmlFor="media">Media (Image or Video):</label>
        <input
          type="file"
          id="media"
          accept="image/*,video/*"
          onChange={handleFileChange}
        />
        <button type="submit" className="btn" disabled={loading}>
          {loading ? 'Creating...' : 'Create Event'}
        </button>
      </form>
    </div>
  );
};

export default CreateEvent;