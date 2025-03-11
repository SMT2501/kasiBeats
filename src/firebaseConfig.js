import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging } from 'firebase/messaging';
import { getPerformance } from 'firebase/performance';

const firebaseConfig = {
  apiKey: "AIzaSyAGggkP5ijYSBkoCqVRxTKCdsPuli-5TYA",
  authDomain: "ghost-nation-8192f.firebaseapp.com",
  projectId: "ghost-nation-8192f",
  storageBucket: "ghost-nation-8192f.firebasestorage.app",
  messagingSenderId: "677300270430",
  appId: "1:677300270430:web:3c131978ab02fd30048bcf",
  measurementId: "G-KZG8NL5W5Z"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const firestore = getFirestore(app);
export const storage = getStorage(app);
export const messaging = getMessaging(app);
export const performance = getPerformance(app);