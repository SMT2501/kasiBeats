import React, { useContext, useEffect, useState } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { firestore } from '../firebaseConfig';
import { AuthContext } from '../context/AuthContext';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { toast } from 'react-toastify'; // Added missing import
import './BookingCalendar.css';

const localizer = momentLocalizer(moment);

const BookingCalendar = () => {
  const { currentUser } = useContext(AuthContext);
  const [events, setEvents] = useState([]);
  const [conflicts, setConflicts] = useState([]);
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
        let conflictEvents = [];

        if (currentUser.role === 'dj') {
          const bookingsQuery = query(
            collection(firestore, 'bookings'),
            where('djId', '==', currentUser.uid),
            where('status', '==', 'accepted')
          );
          const bookingsSnapshot = await getDocs(bookingsQuery);
          calendarEvents = await Promise.all(
            bookingsSnapshot.docs.map(async (bookingDoc) => {
              const booking = bookingDoc.data();
              const eventRef = doc(firestore, 'events', booking.eventId);
              const eventDoc = await getDoc(eventRef);
              const eventData = eventDoc.exists() ? eventDoc.data() : {};
              const eventDate = normalizeEventDate(booking.date);
              return {
                id: booking.eventId,
                title: booking.eventName || 'Untitled Event',
                start: eventDate,
                end: eventDate,
                allDay: true,
                location: eventData.location || 'Location unavailable',
                description: eventData.description || 'No description',
              };
            })
          ).filter((event) => event.start && event.end);

          // Detect conflicts (multiple bookings on the same day)
          const eventsByDate = calendarEvents.reduce((acc, event) => {
            const dateKey = event.start.toISOString().split('T')[0]; // Group by date (YYYY-MM-DD)
            acc[dateKey] = acc[dateKey] || [];
            acc[dateKey].push(event);
            return acc;
          }, {});
          conflictEvents = Object.values(eventsByDate)
            .filter((eventsOnDay) => eventsOnDay.length > 1)
            .flat()
            .map((event) => ({
              ...event,
              conflict: true,
            }));
        } else if (currentUser.role === 'organizer') {
          const eventsQuery = query(
            collection(firestore, 'events'),
            where('organizerId', '==', currentUser.uid)
          );
          const eventsSnapshot = await getDocs(eventsQuery);
          calendarEvents = eventsSnapshot.docs
            .map((eventDoc) => {
              const event = eventDoc.data();
              const eventDate = normalizeEventDate(event.date);
              return {
                id: eventDoc.id,
                title: event.name || 'Untitled Event',
                start: eventDate,
                end: eventDate,
                allDay: true,
                location: event.location || 'Location unavailable',
                description: event.description || 'No description',
              };
            })
            .filter((event) => event.start && event.end);
        }

        setEvents(calendarEvents);
        setConflicts(conflictEvents);
        setLoading(false);
      } catch (err) {
        setError(`Failed to load calendar data: ${err.message}. Please try again.`);
        setLoading(false);
      }
    };

    fetchCalendarData();
  }, [currentUser]);

  // Helper function to normalize event date from Firestore
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
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="booking-calendar">
      <h2 className="calendar-heading">Your KasiBeats Calendar</h2>
      {events.length > 0 ? (
        <Calendar
          localizer={localizer}
          events={[...events, ...conflicts]}
          startAccessor="start"
          endAccessor="end"
          eventPropGetter={(event, start, end, isSelected) => ({
            style: {
              backgroundColor: event.conflict ? '#ff5555' : '#3174ad',
              color: 'white',
              border: '1px solid #fff',
              borderRadius: '4px',
            },
          })}
          tooltipAccessor={(event) => `${event.title}\nLocation: ${event.location}\n${event.description}${event.conflict ? '\n⚠ Conflict with another event!' : ''}`}
          className="custom-calendar"
          onSelectEvent={(event) => {
            if (event.conflict) {
              toast.warning(`Conflict detected on ${moment(event.start).format('MMMM D, YYYY')}! You have multiple bookings on this day.`);
            }
          }}
        />
      ) : (
        <p className="no-events-message">No events or bookings to display.</p>
      )}
    </div>
  );
};

export default BookingCalendar;