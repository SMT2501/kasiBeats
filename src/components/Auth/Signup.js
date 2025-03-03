import React, { useState, useEffect } from 'react';
import { auth, firestore } from '../../firebaseConfig';
import { GoogleAuthProvider, FacebookAuthProvider, signInWithRedirect, createUserWithEmailAndPassword, sendEmailVerification, getRedirectResult } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import './Auth.css';
import { Link, useNavigate } from 'react-router-dom';

const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleEmailSignup = async (e) => {
    e.preventDefault();
    if (!role) {
      setError('Please select a role.');
      toast.error('Please select a role.');
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await sendEmailVerification(user);

      await setDoc(doc(firestore, 'users', user.uid), {
        email,
        role,
        profilePicture: '',
        username: '',
        bio: '',
      });
      toast.success('Signup successful! Please verify your email.');
      navigate('/profile');
    } catch (error) {
      setError(error.message);
      toast.error('Signup failed: ' + error.message);
    }
  };

  const handleGoogleSignup = async () => {
    if (!role) {
      setError('Please select a role.');
      toast.error('Please select a role.');
      return;
    }

    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      console.log('Initiating Google redirect to:', window.location.origin); // Debug
      await signInWithRedirect(auth, provider);
    } catch (error) {
      setError(error.message);
      toast.error('Google signup failed: ' + error.message);
      console.error('Google redirect error:', error); // Debug
    }
  };

  const handleFacebookSignup = async () => {
    if (!role) {
      setError('Please select a role.');
      toast.error('Please select a role.');
      return;
    }

    try {
      const provider = new FacebookAuthProvider();
      provider.addScope('public_profile');
      provider.addScope('email');
      console.log('Initiating Facebook redirect to:', window.location.origin); // Debug
      await signInWithRedirect(auth, provider);
    } catch (error) {
      setError(error.message);
      toast.error('Facebook signup failed: ' + error.message);
      console.error('Facebook redirect error:', error); // Debug
    }
  };

  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result && result.user) {
          console.log('Redirect result user:', result.user.uid, 'Email:', result.user.email); // Enhanced debug
          const user = result.user;
          const userRef = doc(firestore, 'users', user.uid);
          const userDoc = await getDoc(userRef);
          if (!userDoc.exists()) {
            await setDoc(userRef, {
              email: user.email,
              role,
              profilePicture: user.photoURL || '',
              username: user.displayName || '',
              bio: '',
            });
          }
          toast.success('Signup successful!');
          navigate('/profile');
        } else if (window.location.search.includes('error')) {
          const params = new URLSearchParams(window.location.search);
          const errorDesc = params.get('error_description') || 'Authentication failed';
          setError(errorDesc);
          toast.error('Authentication failed: ' + errorDesc);
          console.error('Redirect error params:', params.toString()); // Debug
        } else {
          console.log('No redirect result or error in URL:', window.location.href); // Debug
        }
      } catch (error) {
        setError(error.message);
        toast.error('Redirect login failed: ' + error.message);
        console.error('Redirect error:', error); // Debug
      }
    };
    handleRedirectResult();
  }, [role, navigate]);

  return (
    <div className="auth-container">
      <h2>Signup for KasiBeats</h2>
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleEmailSignup}>
        <label htmlFor="email">Email:</label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <label htmlFor="password">Password:</label>
        <input
          type="password"
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <label htmlFor="role">I am a:</label>
        <select
          id="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          required
        >
          <option value="">Select Role</option>
          <option value="dj">DJ</option>
          <option value="organizer">Event Organizer</option>
          <option value="viewer">Viewer (Attendee)</option>
        </select>
        <button type="submit" className="btn">Signup with Email</button>
      </form>
      <button className="btn google-btn" onClick={handleGoogleSignup}>
        Signup with Google
      </button>
      <button className="btn facebook-btn" onClick={handleFacebookSignup}>
        Login with Facebook
      </button>
      <p>
        Already have an account? <Link to="/login">Login here</Link>
      </p>
    </div>
  );
};

export default Signup;