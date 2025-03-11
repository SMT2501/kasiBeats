import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { firestore, storage } from '../firebaseConfig';
import { Timestamp } from 'firebase/firestore'; // Explicitly import Timestamp
import { toast } from 'react-toastify';
import './EditEvent.css';

const EditEvent = () => {
  const { eventId } = useParams();
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [ticketPrice, setTicketPrice] = useState(0);
  const [ticketQuantity, setTicketQuantity] = useState(0);
  const [capacity, setCapacity] = useState(0);
  const [media, setMedia] = useState(null);
  const [mediaUrl, setMediaUrl] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        console.log('Fetching event with ID:', eventId); // Debug
        const eventRef = doc(firestore, 'events', eventId);
        const eventDoc = await getDoc(eventRef);
        if (eventDoc.exists()) {
          const eventData = eventDoc.data();
          console.log('Event data fetched:', eventData); // Debug
          setName(eventData.name);
          // Safely convert Firestore Timestamp to Date
          const eventDate = eventData.date && typeof eventData.date.toDate === 'function'
            ? eventData.date.toDate()
            : eventData.date;
          setDate(eventDate ? eventDate.toISOString().slice(0, 16) : '');
          setLocation(eventData.location);
          setDescription(eventData.description);
          setTicketPrice(eventData.ticketPrice || 0);
          setTicketQuantity(eventData.ticketQuantity || 0);
          setCapacity(eventData.capacity || 0);
          setMediaUrl(eventData.mediaUrl || '');
        } else {
          setError('Event not found.');
        }
      } catch (err) {
        console.error('Error fetching event:', err); // Debug
        setError('Failed to load event: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [eventId]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        setError('Please upload an image or video file.');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB.');
        return;
      }
      setMedia(file);
      setError(null);
    }
  };

  const handleSave = async () => {
    try {
      const eventRef = doc(firestore, 'events', eventId);
      let newMediaUrl = mediaUrl;

      if (media) {
        const storageRef = ref(storage, `events/${eventId}/${Date.now()}_${media.name}`);
        await uploadBytes(storageRef, media);
        newMediaUrl = await getDownloadURL(storageRef);
        if (mediaUrl) {
          const oldStorageRef = ref(storage, mediaUrl);
          await deleteObject(oldStorageRef);
        }
      }

      await updateDoc(eventRef, {
        name,
        date: new Date(date),
        location,
        description,
        ticketPrice: Number(ticketPrice),
        ticketQuantity: Number(ticketQuantity),
        capacity: Number(capacity),
        mediaUrl: newMediaUrl,
      });
      toast.success('Event updated successfully!');
      navigate(`/events/${eventId}`);
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

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div className="edit-event">
      <h2>Edit Event</h2>
      <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
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
        <label htmlFor="media">New Media (Image or Video):</label>
        <input
          type="file"
          id="media"
          accept="image/*,video/*"
          onChange={handleFileChange}
        />
        {mediaUrl && (
          <div>
            <p>Current Media: <a href={mediaUrl} target="_blank" rel="noopener noreferrer">View</a></p>
            <button type="button" className="btn delete-media-btn" onClick={handleDeleteMedia}>Delete Media</button>
          </div>
        )}
        <button type="submit" className="btn save-btn">Save Changes</button>
      </form>
    </div>
  );
};

export default EditEvent;