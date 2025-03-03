import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { firestore, storage } from '../firebaseConfig';
import { AuthContext } from '../context/AuthContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from 'react-toastify'; // Import toast
import './EditProfile.css';

const EditProfile = () => {
  const { currentUser } = useContext(AuthContext);
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [profilePicture, setProfilePicture] = useState(null);
  const [profilePictureURL, setProfilePictureURL] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfile = async () => {
      if (!currentUser) {
        setError('Please log in to edit your profile.');
        toast.error('Please log in to edit your profile.');
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(firestore, 'users', currentUser.uid);
        const profileDoc = await getDoc(userRef);
        if (profileDoc.exists()) {
          const profileData = profileDoc.data();
          setUsername(profileData.username || '');
          setBio(profileData.bio || '');
          setProfilePictureURL(profileData.profilePicture || '');
          setRole(profileData.role || '');
        } else {
          setError('Profile not found. Please try again.');
          toast.error('Profile not found. Please try again.');
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching profile:', error);
        setError('Failed to load profile: ' + error.message);
        toast.error('Failed to load profile: ' + error.message);
        setLoading(false);
      }
    };

    fetchProfile();
  }, [currentUser]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file.');
        toast.error('Please upload an image file.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB.');
        toast.error('File size must be less than 5MB.');
        return;
      }
      setProfilePicture(file);
      setError(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!currentUser) {
      setError('No user logged in.');
      toast.error('No user logged in.');
      return;
    }

    try {
      setUploading(true);
      let newProfilePictureURL = profilePictureURL;

      if (profilePicture) {
        console.log('Uploading new profile picture...');
        const storageRef = ref(storage, `profile_pictures/${currentUser.uid}`);
        await uploadBytes(storageRef, profilePicture);
        newProfilePictureURL = await getDownloadURL(storageRef);
        console.log('New profile picture uploaded:', newProfilePictureURL);
      }

      const userRef = doc(firestore, 'users', currentUser.uid);
      await setDoc(
        userRef,
        {
          username,
          bio,
          profilePicture: newProfilePictureURL,
          role,
        },
        { merge: true }
      );

      toast.success('Profile updated successfully!');
      navigate('/profile');
    } catch (error) {
      console.error('Error updating profile:', error);
      setError('Error updating profile: ' + error.message);
      toast.error('Error updating profile: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div className="edit-profile-container">
      <h2>Edit Profile</h2>
      <form onSubmit={handleSubmit}>
        <label htmlFor="username">Username:</label>
        <input
          type="text"
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <label htmlFor="bio">Bio:</label>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows="4"
        />
        <label htmlFor="role">Role:</label>
        <select
          id="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          required
          disabled
        >
          <option value="">Select Role</option>
          <option value="viewer">Viewer</option>
          <option value="dj">DJ</option>
          <option value="organizer">Organizer</option>
        </select>
        <label htmlFor="profilePicture">Profile Picture:</label>
        <input
          type="file"
          id="profilePicture"
          accept="image/*"
          onChange={handleFileChange}
        />
        {profilePictureURL && <img src={profilePictureURL} alt="Profile" className="profile-picture-preview" />}
        {error && <div className="error-message">{error}</div>}
        <button type="submit" className="btn" disabled={uploading}>
          {uploading ? 'Saving...' : 'Save'}
        </button>
      </form>
    </div>
  );
};

export default EditProfile;