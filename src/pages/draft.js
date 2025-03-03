import React, { useState, useEffect, useContext } from 'react';
import { firestore } from '../firebaseConfig';
import { AuthContext } from '../context/AuthContext';
import { collection, query, where, getDocs, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import { toast } from 'react-toastify'; // Import toast for feedback
import defaultProfilePicture from '../assets/images/profile.jpg';

import './Djs.css';

const Djs = () => {
  const { currentUser } = useContext(AuthContext);
  const [djs, setDjs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchDjs = async () => {
      try {
        console.log('Fetching DJs...');
        const djQuery = query(
          collection(firestore, 'users'),
          where('role', '==', 'dj')
        );
        const djSnapshot = await getDocs(djQuery);
        const djData = djSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        console.log('Fetched DJs:', djData);
        setDjs(djData);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching DJs:', err);
        setError('Failed to load DJs: ' + err.message);
        toast.error('Failed to load DJs: ' + err.message);
        setLoading(false);
      }
    };

    fetchDjs();
  }, []);

  const handleBookDj = async (djId) => {
    if (!currentUser || currentUser.role !== 'organizer') {
      toast.error('Please log in as an organizer to book a DJ.');
      return;
    }

    try {
      // Placeholder logic; replace with actual event selection (handled by modal in DJCard)
      const eventRef = doc(firestore, 'events', 'some-event-id'); // Replace with actual event ID
      await updateDoc(eventRef, {
        djsBooked: arrayUnion(djId),
      });
      toast.success('DJ booked successfully!');
    } catch (err) {
      console.error('Error booking DJ:', err);
      toast.error('Failed to book DJ: ' + err.message);
    }
  };

  const filteredDjs = djs.filter((dj) =>
    dj.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const clearSearch = () => {
    setSearchTerm('');
  };

  if (loading) return <div className="loading-screen"><div className="spinner"></div><p>Loading...</p></div>;
  if (error) return <div>{error}</div>;

  return (
    <div className="djs-container">
      <h2>Browse DJs</h2>
      <div className="search-container">
        <input
          type="text"
          placeholder="Search DJs by name..."
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
      <div className="dj-list">
        {filteredDjs.length > 0 ? (
          filteredDjs.map((dj) => (
            <div key={dj.id} className="dj-card">
              <img
                src={dj.profilePicture || defaultProfilePicture}
                alt="DJ"
                className="dj-picture"
              />
              <h3>{dj.username || 'Unknown DJ'}</h3>
              <p>{dj.bio || 'No bio available'}</p>
              {currentUser?.role === 'organizer' && (
                <button onClick={() => handleBookDj(dj.id)}>Book DJ</button>
              )}
            </div>
          ))
        ) : (
          <p>No DJs found.</p>
        )}
      </div>
    </div>
  );
};

export default Djs;