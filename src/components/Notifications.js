import React, { useState, useEffect, useContext } from 'react';
import { firestore } from '../firebaseConfig';
import { AuthContext } from '../context/AuthContext';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import './Notifications.css';

const Notifications = () => {
  const { currentUser } = useContext(AuthContext);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        if (!currentUser) {
          setError('Please log in to view notifications.');
          setLoading(false);
          return;
        }

        console.log('Fetching notifications for user:', currentUser.uid);
        const notificationsQuery = query(
          collection(firestore, 'notifications'),
          where('userId', '==', currentUser.uid),
          orderBy('timestamp', 'desc')
        );
        const notificationsSnapshot = await getDocs(notificationsQuery);
        const notificationsData = notificationsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        console.log('Fetched notifications:', notificationsData);
        setNotifications(notificationsData);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching notifications:', err);
        setError('Failed to load notifications: ' + err.message);
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [currentUser]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div className="notifications">
      <h2>Notifications</h2>
      {notifications.length > 0 ? (
        notifications.map((notification) => (
          <div key={notification.id} className="notification-card">
            <p>{notification.message || 'No message'}</p>
            <p>
              {notification.timestamp?.seconds
                ? new Date(notification.timestamp.seconds * 1000).toLocaleString()
                : 'Unknown date'}
            </p>
          </div>
        ))
      ) : (
        <p>No notifications found.</p>
      )}
    </div>
  );
};

export default Notifications;