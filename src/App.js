import React, { useContext, lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';
import Header from './components/Layout/Header';
import Footer from './components/Layout/Footer';
import { AuthProvider } from './context/AuthContext';
import AuthNavigation from './context/AuthNavigation';
import ErrorBoundary from './ErrorBoundary';
import { auth, messaging, firestore } from './firebaseConfig';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import MyBookings from './pages/MyBookings';
import MyEvents from './pages/MyEvents';
import './App.css';

// Lazy load components
const Home = lazy(() => import('./pages/Home'));
const Events = lazy(() => import('./pages/Events'));
const Bookings = lazy(() => import('./pages/Bookings'));
const BookingCalendar = lazy(() => import('./pages/BookingCalendar'));
const Profile = lazy(() => import('./pages/Profile'));
const Notifications = lazy(() => import('./components/Notifications'));
const Login = lazy(() => import('./components/Auth/Login'));
const Signup = lazy(() => import('./components/Auth/Signup'));
const EditProfile = lazy(() => import('./components/EditProfile'));
const CreatePost = lazy(() => import('./components/CreatePost'));
const CreateEvent = lazy(() => import('./components/CreateEvent'));
const VerifyEmail = lazy(() => import('./components/VerifyEmail'));
const EventDetail = lazy(() => import('./components/EventDetail'));
const EditEvent = lazy(() => import('./components/EditEvent'));
const Djs = lazy(() => import('./pages/Djs'));
const Checkout = lazy(() => import('./components/Checkout'));

const ProtectedRoute = ({ children, role }) => {
  const { currentUser, loading } = useContext(AuthContext);

  useEffect(() => {
    console.log('ProtectedRoute - currentUser:', currentUser, 'role:', role, 'loading:', loading); // Debug
  }, [currentUser, role, loading]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!currentUser) {
    console.log('Redirecting to login due to no user'); // Debug
    return <Navigate to="/login" />;
  }

  if (role && currentUser.role === undefined) {
    console.log('Role not yet loaded, waiting...'); // Debug
    return null; // Temporarily render nothing
  }

  if (role && currentUser.role !== role) {
    console.log('Redirecting to home due to role mismatch:', currentUser.role, '!=', role); // Debug
    return <Navigate to="/" />;
  }

  return children;
};

const App = () => {
  useEffect(() => {
    const registerForPushNotifications = async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          return;
        }

        const token = await getToken(messaging, {
          vapidKey: process.env.REACT_APP_FCM_VAPID_KEY, // From .env
        });

        if (token) {
          onAuthStateChanged(auth, async (user) => {
            if (user) {
              const userRef = doc(firestore, 'users', user.uid);
              await setDoc(userRef, { fcmToken: token }, { merge: true });
              const userDoc = await getDoc(userRef);
              if (userDoc.exists()) {
                const role = userDoc.data().role;
                console.log('User role from Firestore:', role);
              }
            }
          });
        }

        onMessage(messaging, (payload) => {
          const notificationTitle = payload.notification.title;
          const notificationOptions = {
            body: payload.notification.body,
            icon: '/favicon.png',
          };
          new Notification(notificationTitle, notificationOptions);
        });
      } catch (error) {
        console.error('Push notification registration error:', error);
      }
    };

    registerForPushNotifications();
  }, []);

  return (
    <div className="app-container">
      <ErrorBoundary>
        <AuthProvider>
          <Router>
            <AuthNavigation />
            <Header />
            <Suspense fallback={
              <div className="loading-screen">
                <div className="spinner"></div>
                <p>Loading...</p>
              </div>
            }>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/events" element={<Events />} />
                <Route path="/events/:eventId" element={<EventDetail />} />
                <Route path="/events/:eventId/edit" element={<ProtectedRoute><EditEvent /></ProtectedRoute>} />
                <Route path="/events/:eventId/checkout" element={<Checkout />} />
                <Route
                  path="/bookings"
                  element={
                    <ProtectedRoute>
                      <Bookings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/booking-calendar"
                  element={
                    <ProtectedRoute>
                      <BookingCalendar />
                    </ProtectedRoute>
                  }
                />
                <Route path="/my-bookings" element={<MyBookings />} />
                <Route path="/my-events" element={<MyEvents />} />
                <Route
                  path="/profile/:userId?"
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/notifications"
                  element={
                    <ProtectedRoute>
                      <Notifications />
                    </ProtectedRoute>
                  }
                />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route
                  path="/create_post"
                  element={
                    <ProtectedRoute>
                      <CreatePost />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/create_event"
                  element={
                    <ProtectedRoute>
                      <CreateEvent />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/edit_profile"
                  element={
                    <ProtectedRoute>
                      <EditProfile />
                    </ProtectedRoute>
                  }
                />
                <Route path="/djs" element={<Djs />} />
                <Route path="*" element={<div>Page Not Found</div>} />
                <Route
                  path="/error"
                  element={<div>Error occurred. Please try again or contact support.</div>}
                />
              </Routes>
            </Suspense>
            <Footer />
          </Router>
        </AuthProvider>
      </ErrorBoundary>
      <ToastContainer />
    </div>
  );
};

export default App;