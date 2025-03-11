import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const AuthNavigation = () => {
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [initialCheckDone, setInitialCheckDone] = useState(false);

  useEffect(() => {
    if (!initialCheckDone) {
      if (currentUser) {
        const destination = currentUser.username ? '/profile' : '/edit_profile';
        navigate(destination);
      }
      setInitialCheckDone(true);
    }
  }, [currentUser, navigate, initialCheckDone]);

  return null;
};

export default AuthNavigation;