const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.sendBookingNotification = functions.firestore
  .document('bookings/{bookingId}')
  .onCreate(async (snap, context) => {
    const booking = snap.data();
    const djDoc = await admin
      .firestore()
      .collection('users')
      .doc(booking.djId)
      .get();
    const dj = djDoc.data();

    const payload = {
      notification: {
        title: 'New Booking Request',
        body: `You have been booked for ${booking.eventName} on R{new Date(
          booking.date.seconds * 1000
        ).toLocaleDateString()}`,
      },
    };

    // Store notification in Firestore
    await admin.firestore().collection('notifications').add({
      userId: booking.djId,
      message: payload.notification.body,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Send push notification
    if (dj.fcmToken) {
      await admin.messaging().sendToDevice(dj.fcmToken, payload);
    }
  });