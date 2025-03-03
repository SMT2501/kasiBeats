import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../firebaseConfig';

const VerifyEmail = () => {
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { email } = location.state || {};

  useEffect(() => {
    const checkEmailVerification = setInterval(async () => {
      try {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified) {
          clearInterval(checkEmailVerification);
          setVerifying(false);
          navigate('/edit_profile');
        }
      } catch (err) {
        setError('Error checking email verification. Please try again.');
        setVerifying(false);
      }
    }, 2000);

    return () => clearInterval(checkEmailVerification);
  }, [navigate]);

  const handleResendEmail = async () => {
    try {
      await auth.currentUser.sendEmailVerification();
      alert('Verification email resent. Please check your inbox.');
    } catch (err) {
      setError('Failed to resend verification email. Please try again.');
    }
  };

  return (
    <div className="verify-email-container">
      <h2>Verify Your Email</h2>
      {verifying ? (
        <>
          <p>
            A verification email has been sent to <strong>{email}</strong>.
            Please verify your email to continue.
          </p>
          <p>
            Didn’t receive the email?{' '}
            <button onClick={handleResendEmail}>Resend Email</button>
          </p>
        </>
      ) : error ? (
        <p>{error}</p>
      ) : (
        <p>Email verified! Redirecting...</p>
      )}
    </div>
  );
};

export default VerifyEmail;