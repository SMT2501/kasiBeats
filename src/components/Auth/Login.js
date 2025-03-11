import React, { useState } from 'react';
import { auth } from '../../firebaseConfig';
import { GoogleAuthProvider, FacebookAuthProvider, signInWithPopup, signInWithEmailAndPassword } from 'firebase/auth';
import { toast } from 'react-toastify';
import './Auth.css';
import { Link, useNavigate } from 'react-router-dom';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      if (!user.emailVerified) {
        setError('Please verify your email before logging in.');
        await auth.signOut();
        toast.error('Please verify your email.');
      } else {
        toast.success('Login successful!');
        navigate('/profile');
      }
    } catch (error) {
      setError(error.message);
      toast.error('Login failed: ' + error.message);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      toast.success('Login successful!');
      navigate('/profile');
    } catch (error) {
      setError(error.message);
      toast.error('Google login failed: ' + error.message);
      console.error('Google login error:', error); // Debug
    }
  };

  const handleFacebookLogin = async () => {
    try {
      const provider = new FacebookAuthProvider();
      provider.addScope('public_profile');
      provider.addScope('email');
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      toast.success('Login successful!');
      navigate('/profile');
    } catch (error) {
      setError(error.message);
      toast.error('Facebook login failed: ' + error.message);
      console.error('Facebook login error:', error); // Debug
    }
  };

  return (
    <div className="auth-container">
      <h2>Login to KasiBeats</h2>
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleEmailLogin}>
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
        <button type="submit" className="btn">Login with Email</button>
      </form>
      <button className="btn google-btn" onClick={handleGoogleLogin}>
        Login with Google
      </button>
      <button className="btn facebook-btn" onClick={handleFacebookLogin}>
        Login with Facebook
      </button>
      <p>
        Don’t have an account? <Link to="/signup">Signup here</Link>
      </p>
    </div>
  );
};

export default Login;