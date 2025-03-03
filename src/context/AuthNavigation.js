import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from './AuthContext';

const AuthNavigation = () => {
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [initialCheckDone, setInitialCheckDone] = useState(false);

  useEffect(() => {
    if (currentUser && !initialCheckDone) {
      if (currentUser.username) {
        navigate('/profile');
      } else {
        navigate('/edit_profile');
      }
      setInitialCheckDone(true);
    } else if (currentUser === null && !initialCheckDone) {
      setInitialCheckDone(true);
    }
  }, [currentUser, navigate, initialCheckDone]);

  return null;
};

export default AuthNavigation;