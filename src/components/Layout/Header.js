import React, { useState, useContext, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { auth, firestore } from '../../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import './Header.css';
import logo from '../../assets/images/GNB.png';
import defaultProfilePicture from '../../assets/images/profile.jpg';

const Header = () => {
  const { currentUser } = useContext(AuthContext);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profilePicture, setProfilePicture] = useState(defaultProfilePicture);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfilePicture = async () => {
      if (currentUser) {
        try {
          const userRef = doc(firestore, 'users', currentUser.uid);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            const data = userDoc.data();
            setProfilePicture(data.profilePicture || defaultProfilePicture);
          }
        } catch (error) {
          console.error('Error fetching profile picture:', error);
        }
      }
    };

    fetchProfilePicture();

    const handleOutsideClick = (event) => {
      if (menuOpen && !event.target.closest('.nav-menu') && !event.target.closest('.menu-button')) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [menuOpen, currentUser]);

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const closeMenu = () => {
    setMenuOpen(false);
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/');
      closeMenu();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <header>
      <Link to="/">
        <img src={logo} alt="Ghost Nation" className="logo" />
      </Link>

      <nav className={`nav-menu ${menuOpen ? 'active' : ''}`}>
        <ul>
          <li><Link to="/djs" onClick={closeMenu}>Browse DJs</Link></li>
          <li><Link to="/events" onClick={closeMenu}>Events</Link></li>
          {currentUser && (
            <>
              {currentUser.role === 'dj' && (
                <li><Link to="/bookings" onClick={closeMenu}>Bookings</Link></li>
              )}
              {currentUser.role === 'organizer' && (
                <li><Link to="/bookings" onClick={closeMenu}>Events with DJs</Link></li>
              )}
              <li><Link to="/notifications" onClick={closeMenu}>Notifications</Link></li>
              <li>
                <Link to="/profile" onClick={closeMenu}>
                  <img src={profilePicture} alt="Profile" className="profile-picture-link" />
                </Link>
              </li>
              <li>
                <button className="btn" onClick={handleLogout}>Logout</button>
              </li>
            </>
          )}
          {!currentUser && (
            <>
              <li><Link to="/login" className="btn" onClick={closeMenu}>Login</Link></li>
              <li><Link to="/signup" className="btn" onClick={closeMenu}>Signup</Link></li>
            </>
          )}
        </ul>
      </nav>

      <button className="menu-button" onClick={toggleMenu}>
        ☰
      </button>
    </header>
  );
};

export default Header;