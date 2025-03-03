import React, { useState, useEffect, useContext } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { firestore } from '../firebaseConfig';
import { AuthContext } from '../context/AuthContext';
import { collection, query, getDocs, where, doc, getDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import './Events.css';

// Initialize Stripe with your publishable key
const stripePromise = loadStripe('pk_test_your_publishable_key_here'); // Replace with your Stripe publishable key

const Events = () => {
  const { currentUser } = useContext(AuthContext);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventDjs, setEventDjs] = useState([]);
  const [locationFilter, setLocationFilter] = useState('');
  const [dateRange, setDateRange] = useState([null, null]);
  const [startDate, endDate] = dateRange;

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        console.log('Fetching events...');
        const eventsSnapshot = await getDocs(collection(firestore, 'events'));
        const eventsData = eventsSnapshot.docs.map((eventDoc) => ({
          id: eventDoc.id,
          ...eventDoc.data(),
        }));
        console.log('Fetched events:', eventsData);
        setEvents(eventsData);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching events:', err);
        setError('Failed to load events: ' + err.message);
        toast.error('Failed to load events: ' + err.message);
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const filteredEvents = events.filter((event) => {
    const matchesName = event.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLocation = locationFilter ? event.location?.toLowerCase().includes(locationFilter.toLowerCase()) : true;
    const eventDate = event.date?.seconds ? new Date(event.date.seconds * 1000) : null;
    const matchesDateRange =
      eventDate &&
      (!startDate || eventDate >= startDate) &&
      (!endDate || eventDate <= endDate);
    return matchesName && matchesLocation && matchesDateRange;
  });

  const clearSearch = () => {
    setSearchTerm('');
    setLocationFilter('');
    setDateRange([null, null]);
  };

  const openEventModal = async (event) => {
    setSelectedEvent(event);

    try {
      const bookingsQuery = query(
        collection(firestore, 'bookings'),
        where('eventId', '==', event.id)
      );
      const bookingsSnapshot = await getDocs(bookingsQuery);
      const bookingsData = bookingsSnapshot.docs.map((bookingDoc) => ({
        id: bookingDoc.id,
        ...bookingDoc.data(),
      }));

      const djsData = await Promise.all(
        bookingsData.map(async (booking) => {
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
      console.error('Error fetching event DJs:', err);
      toast.error('Failed to load event DJs: ' + err.message);
    }
  };

  const closeEventModal = () => {
    setSelectedEvent(null);
    setEventDjs([]);
  };

  const handleBuyTicket = async (eventId, eventName, price) => {
    if (!currentUser) {
      toast.error('Please log in to buy a ticket.');
      return;
    }

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId,
          eventName,
          price: price || 20,
          userId: currentUser.uid,
        }),
      });

      const session = await response.json();

      if (session.error) {
        throw new Error(session.error);
      }

      const stripe = await stripePromise;
      const { error } = await stripe.redirectToCheckout({ sessionId: session.id });

      if (error) {
        throw new Error(error.message);
      }
    } catch (error) {
      console.error('Error initiating checkout:', error);
      toast.error('Failed to buy ticket: ' + error.message);
    }
  };

  const generateTicket = async (eventId) => {
    if (!currentUser || currentUser.role !== 'organizer') {
      toast.error('Only event organizers can generate tickets.');
      return;
    }

    try {
      const event = events.find((e) => e.id === eventId);
      if (!event) {
        throw new Error('Event not found.');
      }

      if (event.organizerId !== currentUser.uid) {
        toast.error('You can only generate tickets for your own events.');
        return;
      }

      const ticketData = {
        eventName: event.name || 'Untitled Event',
        date: event.date?.seconds
          ? new Date(event.date.seconds * 1000).toLocaleDateString()
          : 'Date unavailable',
        location: event.location || 'Location unavailable',
        organizer: currentUser.displayName || 'Organizer',
        ticketId: `TICKET-${eventId}-${Date.now()}`,
      };

      const ticketHtml = `
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
            <h1>GhostNation Hub Event Ticket</h1>
            <h2>${ticketData.eventName}</h2>
            <p><strong>Date:</strong> ${ticketData.date}</p>
            <p><strong>Location:</strong> ${ticketData.location}</p>
            <p><strong>Organizer:</strong> ${ticketData.organizer}</p>
            <p><strong>Ticket ID:</strong> ${ticketData.ticketId}</p>
            <p>Thank you for attending!</p>
          </body>
        </html>
      `;

      const blob = new Blob([ticketHtml], { type: 'text/html' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ticket-${eventId}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Ticket generated and downloaded successfully!');
    } catch (err) {
      console.error('Error generating ticket:', err);
      toast.error('Failed to generate ticket: ' + err.message);
    }
  };

  const handleShareEvent = (eventId, eventName) => {
    const eventUrl = `${window.location.origin}/events/${eventId}`;
    const shareData = {
      title: `Check out ${eventName} on GhostNation Hub!`,
      text: `Join me at ${eventName} on GhostNation Hub!`,
      url: eventUrl,
    };

    // Use Web Share API if available
    if (navigator.share) {
      navigator.share(shareData)
        .then(() => {
          toast.success('Event shared successfully!');
        })
        .catch((err) => {
          console.error('Error sharing event:', err);
          // Fallback to clipboard if Web Share fails
          navigator.clipboard.writeText(eventUrl)
            .then(() => {
              toast.success('Event URL copied to clipboard!');
            })
            .catch((err) => {
              console.error('Failed to copy event URL:', err);
              toast.error('Failed to share event. Please copy the URL manually.');
            });
        });
    } else {
      // Fallback to clipboard if Web Share API is not supported
      navigator.clipboard.writeText(eventUrl)
        .then(() => {
          toast.success('Event URL copied to clipboard!');
        })
        .catch((err) => {
          console.error('Failed to copy event URL:', err);
          toast.error('Failed to share event. Please copy the URL manually.');
        });
    }
  };

  if (loading) return <div className="loading-screen"><div className="spinner"></div><p>Loading...</p></div>;
  if (error) return <div>{error}</div>;

  return (
    <div className="events-container">
      <h2>Events</h2>
      <div className="search-container">
        <input
          type="text"
          placeholder="Search events by name..."
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
      <div className="filter-container">
        <div className="filter-item">
          <label htmlFor="locationFilter">Filter by Location:</label>
          <input
            type="text"
            id="locationFilter"
            placeholder="Enter location..."
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="filter-input"
          />
        </div>
        <div className="filter-item">
          <label>Filter by Date Range:</label>
          <DatePicker
            selectsRange
            startDate={startDate}
            endDate={endDate}
            onChange={(update) => setDateRange(update)}
            isClearable={true}
            placeholderText="Select date range"
            className="date-picker"
          />
        </div>
      </div>
      <div className="event-list">
        {filteredEvents.length > 0 ? (
          filteredEvents.map((event) => (
            <div
              key={event.id}
              className="event-card"
              onClick={() => openEventModal(event)}
              style={{ cursor: 'pointer' }}
            >
              <img
                src={event.mediaUrl || 'https://via.placeholder.com/150'}
                alt="Event"
                className="event-picture"
              />
              <h3>{event.name || 'Untitled Event'}</h3>
              <p>{event.date?.seconds ? new Date(event.date.seconds * 1000).toLocaleDateString() : 'Date unavailable'}</p>
              <p>{event.location || 'Location unavailable'}</p>
              <p>Price: R{event.price || 20}</p>
              <div className="event-actions">
                {currentUser && currentUser.role === 'organizer' && currentUser.uid === event.organizerId ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      generateTicket(event.id);
                    }}
                    className="btn"
                  >
                    Generate Ticket
                  </button>
                ) : (
                  currentUser && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBuyTicket(event.id, event.name, event.price);
                      }}
                      className="btn"
                    >
                      Buy Ticket
                    </button>
                  )
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShareEvent(event.id, event.name);
                  }}
                  className="btn share-btn"
                >
                  Share
                </button>
              </div>
            </div>
          ))
        ) : (
          <p>No events found.</p>
        )}
      </div>

      {selectedEvent && (
        <div className="event-modal-overlay">
          <div className="event-modal-content">
            <button className="close-modal-btn" onClick={closeEventModal}>✖</button>
            <h2>{selectedEvent.name || 'Untitled Event'}</h2>
            <img
              src={selectedEvent.mediaUrl || 'https://via.placeholder.com/150'}
              alt="Event"
              className="event-picture-large"
            />
            <p>
              <strong>Date:</strong>{' '}
              {selectedEvent.date?.seconds
                ? new Date(selectedEvent.date.seconds * 1000).toLocaleDateString()
                : 'Date unavailable'}
            </p>
            <p>
              <strong>Location:</strong> {selectedEvent.location || 'Location unavailable'}
            </p>
            <p>
              <strong>Price:</strong> R{selectedEvent.price || 20}
            </p>
            <p>
              <strong>Description:</strong> {selectedEvent.description || 'No description available'}
            </p>
            <div className="event-djs-section">
              <h4>DJs</h4>
              {eventDjs.length > 0 ? (
                <ul className="dj-list">
                  {eventDjs.map((dj) => (
                    <li key={dj.id} className="dj-item">
                      <strong>{dj.username || 'Unknown DJ'}</strong> -{' '}
                      <span className={`status-${dj.status}`}>
                        {dj.status || 'Pending'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No DJs booked for this event.</p>
              )}
            </div>
            <div className="event-actions">
              {currentUser && currentUser.role === 'organizer' && currentUser.uid === selectedEvent.organizerId ? (
                <button
                  onClick={() => generateTicket(selectedEvent.id)}
                  className="btn"
                >
                  Generate Ticket
                </button>
              ) : (
                currentUser && (
                  <button
                    onClick={() => handleBuyTicket(selectedEvent.id, selectedEvent.name, selectedEvent.price)}
                    className="btn"
                  >
                    Buy Ticket
                  </button>
                )
              )}
              <button
                onClick={() => handleShareEvent(selectedEvent.id, selectedEvent.name)}
                className="btn share-btn"
              >
                Share
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Events;