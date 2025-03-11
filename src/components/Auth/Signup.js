import React, { useState } from 'react';
import { auth, firestore } from '../../firebaseConfig';
import { GoogleAuthProvider, FacebookAuthProvider, signInWithPopup, createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
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

      const userDocRef = doc(firestore, 'users', user.uid);
      await setDoc(userDocRef, {
        email: user.email,
        role: role,
        profilePicture: '',
        username: '',
        bio: '',
        fcmToken: ''
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
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const userDocRef = doc(firestore, 'users', user.uid);
      await setDoc(userDocRef, {
        email: user.email,
        role: role,
        profilePicture: user.photoURL || '',
        username: user.displayName || '',
        bio: '',
        fcmToken: ''
      });

      toast.success('Signup successful!');
      navigate('/profile');
    } catch (error) {
      setError(error.message);
      toast.error('Google signup failed: ' + error.message);
      console.error('Google signup error:', error); // Debug
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
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const userDocRef = doc(firestore, 'users', user.uid);
      await setDoc(userDocRef, {
        email: user.email,
        role: role,
        profilePicture: user.photoURL || '',
        username: user.displayName || '',
        bio: '',
        fcmToken: ''
      });

      toast.success('Signup successful!');
      navigate('/profile');
    } catch (error) {
      setError(error.message);
      toast.error('Facebook signup failed: ' + error.message);
      console.error('Facebook signup error:', error); // Debug
    }
  };

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
        Signup with Facebook
      </button>
      <p>
        Already have an account? <Link to="/login">Login here</Link>
      </p>
    </div>
  );
};

export default Signup;