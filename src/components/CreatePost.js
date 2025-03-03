import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { firestore, storage } from '../firebaseConfig';
import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from 'react-toastify'; // Import toast
import './CreatePost.css';

const CreatePost = () => {
  const { currentUser } = useContext(AuthContext);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [media, setMedia] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        setError('Please upload an image or video file.');
        toast.error('Please upload an image or video file.');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB.');
        toast.error('File size must be less than 10MB.');
        return;
      }
      setMedia(file);
      setError(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!currentUser) {
      setError('Please log in to create a post.');
      toast.error('Please log in to create a post.');
      return;
    }

    if (!title || !content) {
      setError('Title and content are required.');
      toast.error('Title and content are required.');
      return;
    }

    try {
      setLoading(true);
      let mediaUrl = '';
      let mediaType = '';

      if (media) {
        const storageRef = ref(storage, `posts/${currentUser.uid}/${media.name}`);
        await uploadBytes(storageRef, media);
        mediaUrl = await getDownloadURL(storageRef);
        mediaType = media.type;
      }

      await addDoc(collection(firestore, 'posts'), {
        userId: currentUser.uid,
        title,
        content,
        mediaUrl,
        mediaType,
        createdAt: new Date(),
      });

      toast.success('Post created successfully!');
      navigate('/profile');
    } catch (error) {
      console.error('Error creating post:', error);
      setError('Failed to create post: ' + error.message);
      toast.error('Failed to create post: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-post">
      <h2>Create a Post</h2>
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit}>
        <label htmlFor="title">Title:</label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <label htmlFor="content">Content:</label>
        <textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows="4"
          required
        />
        <label htmlFor="media">Media (Image or Video):</label>
        <input
          type="file"
          id="media"
          accept="image/*,video/*"
          onChange={handleFileChange}
        />
        <button type="submit" className="btn" disabled={loading}>
          {loading ? 'Creating...' : 'Create Post'}
        </button>
      </form>
    </div>
  );
};

export default CreatePost;