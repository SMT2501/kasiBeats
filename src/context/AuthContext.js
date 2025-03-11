import { createContext, useState, useEffect } from 'react';
import { auth, firestore } from '../firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('Auth state changed, user:', user); // Debug
      if (user) {
        const userRef = doc(firestore, 'users', user.uid);
        try {
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const updatedUser = { ...user, role: userData.role, profilePicture: userData.profilePicture }; // Merge role and profilePicture
            setCurrentUser(updatedUser);
            console.log('AuthContext - Set currentUser with role:', updatedUser.role, 'profilePicture:', updatedUser.profilePicture); // Debug
          } else {
            setCurrentUser(user); // Fallback without role or profilePicture
            console.log('AuthContext - No role or profile data found for user:', user.uid); // Debug
          }
        } catch (error) {
          console.error('AuthContext - Error fetching user data:', error); // Debug
          setCurrentUser(user); // Fallback with error
        }
      } else {
        setCurrentUser(null);
        console.log('AuthContext - No user logged in'); // Debug
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ currentUser, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};