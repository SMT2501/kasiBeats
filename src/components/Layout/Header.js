import React, { useContext, useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { auth, firestore } from '../../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import './Header.css';
import logo from '../../assets/images/GNB.png';
import defaultProfilePicture from '../../assets/images/profile.jpg';

const Header = () => {
  const { currentUser } = useContext(AuthContext);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profilePicture, setProfilePicture] = useState(defaultProfilePicture);
  const [role, setRole] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserData = async () => {
      if (currentUser) {
        console.log('Fetching user data for:', currentUser.uid); // Debug
        try {
          const userRef = doc(firestore, 'users', currentUser.uid);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            const data = userDoc.data();
            console.log('User data fetched:', data); // Debug
            if (data.profilePicture && isValidUrl(data.profilePicture)) {
              setProfilePicture(data.profilePicture);
            } else {
              setProfilePicture(defaultProfilePicture);
            }
            setRole(data.role);
          } else {
            console.log('User document not found for UID:', currentUser.uid); // Debug
            toast.error('User profile not found.');
          }
        } catch (error) {
          console.error('Error fetching user data:', error); // Debug
          toast.error('Failed to load user data: ' + error.message);
        }
      } else {
        console.log('No current user detected.'); // Debug
      }
    };

    fetchUserData();
  }, [currentUser]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (menuOpen && !event.target.closest('.nav-menu') && !event.target.closest('.menu-button')) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [menuOpen]);

  const toggleMenu = useCallback(() => {
    setMenuOpen((prevMenuOpen) => !prevMenuOpen);
  }, []);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      console.log('Attempting to log out...'); // Debug
      await auth.signOut();
      navigate('/');
      closeMenu();
      toast.success('Logged out successfully!');
    } catch (error) {
      console.error('Error logging out:', error); // Debug
      toast.error('Failed to log out: ' + error.message);
    }
  }, [navigate, closeMenu]);

  const isValidUrl = (url) => {
    try {
      new URL(url);
      return true;
    } catch (_) {
      return false;
    }
  };

  return (
    <header>
      <Link to="/">
        <img src={logo} alt="KasiBeats Logo" className="logo" />
      </Link>

      <nav className={`nav-menu ${menuOpen ? 'active' : ''}`}>
        <ul>
          <li><Link to="/djs" onClick={closeMenu}>Browse DJs</Link></li>
          <li><Link to="/events" onClick={closeMenu}>Events</Link></li>
          {currentUser && (
            <>
              {role === 'dj' && (
                <li><Link to="/my-bookings" onClick={closeMenu}>My Bookings</Link></li>
              )}
              {role === 'organizer' && (
                <li><Link to="/my-events" onClick={closeMenu}>My Events</Link></li>
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