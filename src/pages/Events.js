import React, { useState, useEffect, useContext } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { firestore } from '../firebaseConfig';
import { AuthContext } from '../context/AuthContext';
import { collection, query, getDocs, where, doc, getDoc, addDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { toast } from 'react-toastify';
import moment from 'moment';
import './Events.css';

// Initialize Stripe with your publishable key
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

const Events = () => {
  const { currentUser } = useContext(AuthContext);
  const [events, setEvents] = useState([]);
  const [djBookings, setDjBookings] = useState({}); // State for DJ booking statuses
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventDjs, setEventDjs] = useState([]);
  const [locationFilter, setLocationFilter] = useState('');
  const [dateRange, setDateRange] = useState([null, null]);
  const [startDate, endDate] = dateRange;
  const [priceRange, setPriceRange] = useState([0, 1000]); // Min and max ticketPrice filter

  useEffect(() => {
    const fetchEventsAndBookings = async () => {
      try {
        console.log('Fetching events...');
        const eventsSnapshot = await getDocs(collection(firestore, 'events'));
        const eventsData = await Promise.all(
          eventsSnapshot.docs.map(async (eventDoc) => {
            const eventData = eventDoc.data();
            return {
              id: eventDoc.id,
              ...eventData,
              date: eventData.date && typeof eventData.date.toDate === 'function'
                ? eventData.date.toDate()
                : eventData.date ? new Date(eventData.date) : null,
            };
          })
        );
        console.log('Events data fetched:', eventsData);
        setEvents(eventsData);

        // Fetch DJ bookings if the user is a DJ
        if (currentUser && currentUser.role === 'dj') {
          const bookingsQuery = query(
            collection(firestore, 'bookings'),
            where('djId', '==', currentUser.uid)
          );
          const bookingsSnapshot = await getDocs(bookingsQuery);
          const bookingsData = bookingsSnapshot.docs.reduce((acc, bookingDoc) => {
            const booking = bookingDoc.data();
            acc[booking.eventId] = booking.status || 'pending';
            return acc;
          }, {});
          console.log('DJ bookings fetched:', bookingsData);
          setDjBookings(bookingsData);
        }

        setLoading(false);
      } catch (err) {
        console.error('Error fetching events:', err);
        setError('Failed to load events: ' + err.message);
        toast.error('Failed to load events: ' + err.message);
        setLoading(false);
      }
    };

    fetchEventsAndBookings();
  }, [currentUser]);

  const filteredEvents = events.filter((event) => {
    const hasSearchTerm = searchTerm && event.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const hasLocationFilter = locationFilter && event.location?.toLowerCase().includes(locationFilter.toLowerCase());
    const eventDate = event.date instanceof Date ? event.date : null;
    const hasDateRange = (startDate || endDate) && eventDate && 
      (!startDate || eventDate >= startDate) && (!endDate || eventDate <= endDate);
    const hasPriceRange = (priceRange[0] > 0 || priceRange[1] < 1000) && event.ticketPrice &&
      event.ticketPrice >= priceRange[0] && event.ticketPrice <= priceRange[1];

    // Only filter if at least one filter is actively applied
    if (hasSearchTerm || hasLocationFilter || hasDateRange || hasPriceRange) {
      return hasSearchTerm || hasLocationFilter || hasDateRange || hasPriceRange;
    }
    return true; // Return all events if no filters are applied
  });

  const clearSearch = () => {
    setSearchTerm('');
    setLocationFilter('');
    setDateRange([null, null]);
    setPriceRange([0, 1000]);
  };

  const openEventModal = async (event) => {
    setSelectedEvent(event);

    try {
      console.log('Opening modal for event:', event.id);
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
      console.log('Event DJs fetched:', djsData);
    } catch (err) {
      console.error('Error loading event DJs:', err);
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

    if (!stripePromise) {
      toast.error('Payment system unavailable. Please contact support.');
      return;
    }

    try {
      console.log('Sending request to backend:', { eventId, eventName, price, userId: currentUser.uid });
      const response = await fetch('http://localhost:5000/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          eventName,
          price: price || 20,
          userId: currentUser.uid,
        }),
      });

      const text = await response.text();
      console.log('Backend response:', text);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}, Body: ${text}`);
      }

      const session = JSON.parse(text);
      if (session.error) throw new Error(session.error);

      const stripe = await stripePromise;
      const { error } = await stripe.redirectToCheckout({ sessionId: session.id });
      if (error) throw new Error(error.message);
    } catch (error) {
      console.error('Buy ticket error:', error);
      toast.error('Failed to buy ticket: ' + error.message);
    }
  };

  const checkDjAvailability = async (eventDate) => {
    if (!currentUser || currentUser.role !== 'dj') return { available: true };

    try {
      const bookingsQuery = query(
        collection(firestore, 'bookings'),
        where('djId', '==', currentUser.uid),
        where('status', '==', 'accepted')
      );
      const bookingsSnapshot = await getDocs(bookingsQuery);
      const bookings = await Promise.all(
        bookingsSnapshot.docs.map(async (bookingDoc) => {
          const booking = bookingDoc.data();
          const eventRef = doc(firestore, 'events', booking.eventId);
          const eventDoc = await getDoc(eventRef);
          const eventData = eventDoc.exists() ? eventDoc.data() : {};
          const bookingDate = normalizeEventDate(booking.date);
          return {
            eventId: booking.eventId,
            title: booking.eventName || 'Untitled Event',
            date: bookingDate,
          };
        })
      );

      const eventDateStart = new Date(eventDate);
      eventDateStart.setHours(0, 0, 0, 0); // Start of the day
      const eventDateEnd = new Date(eventDate);
      eventDateEnd.setHours(23, 59, 59, 999); // End of the day

      const conflictingBooking = bookings.find((booking) => {
        const bookingDate = booking.date;
        bookingDate.setHours(0, 0, 0, 0); // Normalize to start of the day
        return bookingDate >= eventDateStart && bookingDate <= eventDateEnd;
      });

      return {
        available: !conflictingBooking,
        conflictingEvent: conflictingBooking || null,
      };
    } catch (err) {
      console.error('Error checking DJ availability:', err);
      toast.error('Failed to check availability: ' + err.message);
      return { available: false };
    }
  };

  const handleRequestBooking = async (event) => {
    if (!currentUser || currentUser.role !== 'dj') {
      toast.error('Only DJs can request bookings.');
      return;
    }

    // Check if the DJ has already requested a booking for this event
    if (djBookings[event.id]) {
      toast.error(`You have already requested this booking (Status: ${djBookings[event.id]}).`);
      return;
    }

    // Check for existing bookings on the same day
    const isConflict = await checkDjAvailability(event.date);
    if (!isConflict.available) {
      const confirmBooking = window.confirm(
        `You have another booking on ${moment(event.date).format('MMMM D, YYYY')}: ${isConflict.conflictingEvent.title}. Are you sure you want to proceed?`
      );
      if (!confirmBooking) return;
    }

    try {
      // Create a booking request
      const bookingData = {
        eventId: event.id,
        djId: currentUser.uid,
        organizerId: event.organizerId,
        eventName: event.name || 'Untitled Event',
        date: event.date,
        price: currentUser.price || 0,
        conditions: currentUser.conditions || '',
        status: 'pending',
        createdAt: new Date(),
        paid: false,
      };

      const bookingRef = await addDoc(collection(firestore, 'bookings'), bookingData);

      // Update the event's pendingDjs array
      const eventRef = doc(firestore, 'events', event.id);
      await updateDoc(eventRef, {
        pendingDjs: arrayUnion(currentUser.uid),
      });

      // Notify the organizer
      await addDoc(collection(firestore, 'notifications'), {
        userId: event.organizerId,
        message: `${currentUser.displayName || 'A DJ'} has requested to perform at your event "${event.name}".`,
        createdAt: new Date(),
        read: false,
      });

      // Update local state to reflect the booking status
      setDjBookings((prev) => ({
        ...prev,
        [event.id]: 'pending',
      }));

      toast.success('Booking request sent successfully!');
    } catch (err) {
      console.error('Error requesting booking:', err);
      toast.error('Failed to request booking: ' + err.message);
    }
  };

  const generateTicket = async (eventId) => {
    if (!currentUser || currentUser.role !== 'organizer') {
      toast.error('Only event organizers can generate tickets.');
      return;
    }

    try {
      const event = events.find((e) => e.id === eventId);
      if (!event) throw new Error('Event not found.');

      if (event.organizerId !== currentUser.uid) {
        toast.error('You can only generate tickets for your own events.');
        return;
      }

      const ticketData = {
        eventName: event.name || 'Untitled Event',
        date: event.date instanceof Date ? event.date.toLocaleDateString() : 'Date unavailable',
        location: event.location || 'Location unavailable',
        organizer: currentUser.displayName || 'Organizer',
        ticketId: `TICKET-${eventId}-${Date.now()}`,
      };

      const ticketHtml = `
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
            <h1>KasiBeats Event Ticket</h1>
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
      toast.error('Failed to generate ticket: ' + err.message);
    }
  };

  const handleShareEvent = (eventId, eventName) => {
    const eventUrl = `${window.location.origin}/events/${eventId}`;
    const shareData = {
      title: `Check out ${eventName} on KasiBeats!`,
      text: `Join me at ${eventName} on KasiBeats!`,
      url: eventUrl,
    };

    if (navigator.share) {
      navigator.share(shareData)
        .then(() => toast.success('Event shared successfully!'))
        .catch((err) => {
          console.error('Error sharing event:', err);
          navigator.clipboard.writeText(eventUrl)
            .then(() => toast.success('Event URL copied to clipboard!'))
            .catch(() => toast.error('Failed to share event. Please copy the URL manually.'));
        });
    } else {
      navigator.clipboard.writeText(eventUrl)
        .then(() => toast.success('Event URL copied to clipboard!'))
        .catch(() => toast.error('Failed to share event. Please copy the URL manually.'));
    }
  };

  const calculateEarnings = async () => {
    if (currentUser?.role !== 'organizer') return 0;
    try {
      const ticketsQuery = query(
        collection(firestore, 'tickets'),
        where('organizerId', '==', currentUser.uid),
        where('status', '==', 'completed')
      );
      const ticketsSnapshot = await getDocs(ticketsQuery);
      const earnings = ticketsSnapshot.docs.reduce((sum, doc) => {
        const price = events.find((e) => e.id === doc.data().eventId)?.ticketPrice || 0;
        return sum + price;
      }, 0);
      console.log('Calculated earnings:', earnings);
      return earnings;
    } catch (err) {
      console.error('Error calculating earnings:', err);
      toast.error('Failed to calculate earnings: ' + err.message);
      return 0;
    }
  };

  // Helper function to normalize event date
  const normalizeEventDate = (date) => {
    if (date && typeof date.toDate === 'function') {
      return date.toDate();
    } else if (date instanceof Date) {
      return date;
    } else if (date && typeof date === 'object' && 'seconds' in date) {
      return new Date(date.seconds * 1000);
    }
    return new Date(); // Fallback to current date if invalid
  };

  if (loading) return <div className="loading-screen"><div className="spinner"></div><p>Loading...</p></div>;
  if (error) return <div>{error}</div>;

  return (
    <div className="events-container">
      <h2>Events on KasiBeats</h2>
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
        <div className="filter-item">
          <label>Filter by Price Range (R):</label>
          <input
            type="number"
            value={priceRange[0]}
            onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
            min="0"
            className="filter-input"
          />
          <input
            type="number"
            value={priceRange[1]}
            onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
            min={priceRange[0]}
            className="filter-input"
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
              <p>{event.date instanceof Date ? event.date.toLocaleDateString() : 'Date unavailable'}</p>
              <p>{event.location || 'Location unavailable'}</p>
              <p>Price: R{event.ticketPrice || 20}</p>
              <div className="event-actions">
                {currentUser && currentUser.role === 'organizer' && currentUser.uid === event.organizerId ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      generateTicket(event.id);
                    }}
                    className="btn generate-ticket-btn"
                  >
                    Generate Ticket
                  </button>
                ) : (
                  currentUser && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBuyTicket(event.id, event.name, event.ticketPrice);
                      }}
                      className="btn buy-ticket-btn"
                    >
                      Buy Ticket
                    </button>
                  )
                )}
                {currentUser && currentUser.role === 'dj' && event.allowDjRequests && (
                  <div>
                    {djBookings[event.id] ? (
                      <span className="booking-status">Status: {djBookings[event.id]}</span>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRequestBooking(event);
                        }}
                        className="btn request-booking-btn"
                      >
                        Request Booking
                      </button>
                    )}
                  </div>
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
      {currentUser?.role === 'organizer' && (
        <div className="earnings-summary">
          <h3>Total Earnings from Tickets: R{calculateEarnings()}</h3>
        </div>
      )}

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
              {selectedEvent.date instanceof Date ? selectedEvent.date.toLocaleDateString() : 'Date unavailable'}
            </p>
            <p>
              <strong>Location:</strong> {selectedEvent.location || 'Location unavailable'}
            </p>
            <p>
              <strong>Price:</strong> R{selectedEvent.ticketPrice || 20}
            </p>
            <p>
              <strong>Description:</strong> {selectedEvent.description || 'No description available'}
            </p>
            <p>
              <strong>Allow DJ Requests:</strong> {selectedEvent.allowDjRequests ? 'Yes' : 'No'}
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
                  className="btn generate-ticket-btn"
                >
                  Generate Ticket
                </button>
              ) : (
                currentUser && (
                  <button
                    onClick={() => handleBuyTicket(selectedEvent.id, selectedEvent.name, selectedEvent.ticketPrice)}
                    className="btn buy-ticket-btn"
                  >
                    Buy Ticket
                  </button>
                )
              )}
              {currentUser && currentUser.role === 'dj' && selectedEvent.allowDjRequests && (
                <div>
                  {djBookings[selectedEvent.id] ? (
                    <span className="booking-status">Status: {djBookings[selectedEvent.id]}</span>
                  ) : (
                    <button
                      onClick={() => handleRequestBooking(selectedEvent)}
                      className="btn request-booking-btn"
                    >
                      Request Booking
                    </button>
                  )}
                </div>
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