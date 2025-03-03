import React, { useState, useEffect, useContext } from "react";
import { auth } from "../../firebaseConfig";
import {
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithRedirect,
  signInWithEmailAndPassword,
  getRedirectResult,
} from "firebase/auth";
import { toast } from "react-toastify";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import "./Auth.css";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { setCurrentUser } = useContext(AuthContext);

  // Handle Email & Password Login
  const handleEmailLogin = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      if (!user.emailVerified) {
        setError("Please verify your email before logging in.");
        await auth.signOut();
        toast.error("Please verify your email.");
      } else {
        toast.success("Login successful!");
        setCurrentUser(user);
        navigate("/profile");
      }
    } catch (error) {
      setError(error.message);
      toast.error("Login failed: " + error.message);
    }
  };

  // Google Login
  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope("profile");
      provider.addScope("email");
      console.log("Initiating Google redirect...");
      await signInWithRedirect(auth, provider);
    } catch (error) {
      setError(error.message);
      toast.error("Google login failed: " + error.message);
      console.error("Google redirect error:", error);
    }
  };

  // Facebook Login
  const handleFacebookLogin = async () => {
    try {
      const provider = new FacebookAuthProvider();
      provider.addScope("public_profile");
      provider.addScope("email");
      console.log("Initiating Facebook redirect...");
      await signInWithRedirect(auth, provider);
    } catch (error) {
      setError(error.message);
      toast.error("Facebook login failed: " + error.message);
      console.error("Facebook redirect error:", error);
    }
  };

  // Handle Redirect Login Result
  useEffect(() => {
    const checkRedirectLogin = async () => {
      try {
        console.log("Checking redirect login result...");
        const result = await getRedirectResult(auth);
        if (result && result.user) {
          console.log("Redirect successful:", result.user);
          setCurrentUser(result.user);
          toast.success("Login successful!");
          navigate("/profile");
        } else {
          console.log("No redirect result.");
        }
      } catch (error) {
        console.error("Redirect login error:", error);
        toast.error("Redirect login failed: " + error.message);
      }
    };

    checkRedirectLogin();
  }, [navigate, setCurrentUser]);

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
