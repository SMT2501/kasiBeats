import React, { useState, useEffect, useContext } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { firestore } from '../firebaseConfig';
import { AuthContext } from '../context/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import './BookingCalendar.css';

const localizer = momentLocalizer(moment);

const BookingCalendar = () => {
  const { currentUser } = useContext(AuthContext);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCalendarData = async () => {
      try {
        if (!currentUser) {
          setError('Please log in to view your calendar.');
          setLoading(false);
          return;
        }

        let calendarEvents = [];
        if (currentUser.role === 'dj') {
          const bookingsQuery = query(
            collection(firestore, 'bookings'),
            where('djId', '==', currentUser.uid),
            where('status', '==', 'accepted')
          );
          const bookingsSnapshot = await getDocs(bookingsQuery);
          calendarEvents = bookingsSnapshot.docs
            .map((bookingDoc) => {
              const booking = bookingDoc.data();
              let eventDate;
              if (booking.date && typeof booking.date === 'object' && 'seconds' in booking.date) {
                eventDate = new Date(booking.date.seconds * 1000);
              } else if (booking.date instanceof Date) {
                eventDate = booking.date;
              } else if (typeof booking.date === 'string') {
                eventDate = new Date(booking.date);
              } else {
                console.warn(`Invalid date format for booking ${bookingDoc.id}:`, booking.date);
                eventDate = new Date();
              }

              if (isNaN(eventDate.getTime())) {
                console.warn(`Invalid date for booking ${bookingDoc.id}:`, eventDate);
                eventDate = new Date();
              }

              return {
                title: booking.eventName || 'Untitled Event',
                start: eventDate,
                end: eventDate,
                allDay: true,
              };
            })
            .filter((event) => event.start && event.end);
        } else if (currentUser.role === 'organizer') {
          const eventsQuery = query(
            collection(firestore, 'events'),
            where('organizerId', '==', currentUser.uid)
          );
          const eventsSnapshot = await getDocs(eventsQuery);
          calendarEvents = eventsSnapshot.docs
            .map((eventDoc) => {
              const event = eventDoc.data();
              let eventDate;
              if (event.date && typeof event.date === 'object' && 'seconds' in event.date) {
                eventDate = new Date(event.date.seconds * 1000);
              } else if (event.date instanceof Date) {
                eventDate = event.date;
              } else if (typeof event.date === 'string') {
                eventDate = new Date(event.date);
              } else {
                console.warn(`Invalid date format for event ${eventDoc.id}:`, event.date);
                eventDate = new Date();
              }

              if (isNaN(eventDate.getTime())) {
                console.warn(`Invalid date for event ${eventDoc.id}:`, eventDate);
                eventDate = new Date();
              }

              return {
                title: event.name || 'Untitled Event',
                start: eventDate,
                end: eventDate,
                allDay: true,
              };
            })
            .filter((event) => event.start && event.end);
        }

        setEvents(calendarEvents);
        setLoading(false);
      } catch (err) {
        console.error('Detailed error fetching calendar data:', err);
        console.error('Error stack:', err.stack);
        setError(`Failed to load calendar data: ${err.message}. Please try again.`);
        setLoading(false);
      }
    };

    fetchCalendarData();
  }, [currentUser]);

  if (loading) return <div className="loading-screen"><div className="spinner"></div><p>Loading...</p></div>;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="booking-calendar">
      <h2 className="calendar-heading">Your Calendar</h2>
      {events.length > 0 ? (
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          className="custom-calendar"
        />
      ) : (
        <p className="no-events-message">No events or bookings to display.</p>
      )}
    </div>
  );
};

export default BookingCalendar;