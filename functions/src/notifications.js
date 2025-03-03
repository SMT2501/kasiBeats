const { onDocumentCreated } = require('firebase-functions/v2/firestore');

exports.sendBookingNotification = (firestore, messaging) => onDocumentCreated('bookings/{bookingId}', async (event) => {
  try {
    const booking = event.data.data();
    const bookingId = event.params.bookingId;

    console.log(`New booking created: ${bookingId}`);

    const djRef = firestore.collection('users').doc(booking.djId);
    const djDoc = await djRef.get();

    if (!djDoc.exists) {
      console.error(`DJ with ID ${booking.djId} not found.`);
      return null;
    }

    const dj = djDoc.data();

    const payload = {
      notification: {
        title: 'New Booking Request',
        body: `You have been booked for ${booking.eventName} on ${new Date(
          booking.date.seconds * 1000
        ).toLocaleDateString()}`,
      },
    };

    await firestore.collection('notifications').add({
      userId: booking.djId,
      message: payload.notification.body,
      timestamp: firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Notification stored for DJ ${booking.djId}`);

    if (dj.fcmToken) {
      await messaging.send({
        token: dj.fcmToken,
        ...payload,
      });
      console.log(`Push notification sent to DJ ${booking.djId}`);
    } else {
      console.log(`No FCM token found for DJ ${booking.djId}`);
    }

    return null;
  } catch (error) {
    console.error('Error in sendBookingNotification:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send notification', error.message);
  }
});