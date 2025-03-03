import React, { createContext, useState, useEffect } from 'react';
import { auth, firestore } from '../firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userRef = doc(firestore, 'users', user.uid);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            setCurrentUser({ ...user, role: userDoc.data().role, username: userDoc.data().username });
          } else {
            setCurrentUser(user); // Fallback to basic user data if no Firestore doc
          }
        } catch (error) {
          toast.error('Failed to fetch user data: ' + error.message);
          setCurrentUser(user); // Proceed with basic user data despite error
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      await auth.signOut();
      setCurrentUser(null);
    } catch (error) {
      toast.error('Failed to sign out: ' + error.message);
    }
  };

  const value = {
    currentUser,
    loading,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};