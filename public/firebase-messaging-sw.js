importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAGggkP5ijYSBkoCqVRxTKCdsPuli-5TYA",
  authDomain: "ghost-nation-8192f.firebaseapp.com",
  projectId: "ghost-nation-8192f",
  storageBucket: "ghost-nation-8192f.firebasestorage.app",
  messagingSenderId: "677300270430",
  appId: "1:677300270430:web:3c131978ab02fd30048bcf",
  measurementId: "G-KZG8NL5W5Z",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.png', // Replace with your app's icon
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});