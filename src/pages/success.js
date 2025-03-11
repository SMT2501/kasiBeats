import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { db } from '../firebase'; // Assuming Firebase
import { doc, updateDoc, increment } from 'firebase/firestore';

const SuccessPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const eventId = searchParams.get('eventId');

  useEffect(() => {
    const updateTicketSale = async () => {
      if (eventId) {
        try {
          const eventRef = doc(db, 'events', eventId);
          await updateDoc(eventRef, {
            ticketsSold: increment(1),
            revenue: increment(20), // Adjust based on ticket price
          });
          toast.success('Ticket purchased successfully!');
        } catch (error) {
          toast.error('Error updating ticket sale: ' + error.message);
        }
      }
      navigate(`/events/${eventId}`);
    };
    updateTicketSale();
  }, [eventId, navigate]);

  return <div>Processing your purchase...</div>;
};

export default SuccessPage;