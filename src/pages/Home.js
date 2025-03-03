import React, { useEffect, useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { firestore } from '../firebaseConfig';
import { AuthContext } from '../context/AuthContext';
import { collection, query, orderBy, getDocs, limit, startAfter, doc, getDoc, setDoc, increment, addDoc, deleteDoc } from 'firebase/firestore';
import EventCard from './EventCard';
import { toast } from 'react-toastify';
import defaultProfilePicture from '../assets/images/profile.jpg';
import './Home.css';

const Home = () => {
  const { currentUser } = useContext(AuthContext);
  const [feedItems, setFeedItems] = useState([]);
  const [lastPostDoc, setLastPostDoc] = useState(null);
  const [lastEventDoc, setLastEventDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [commentInputs, setCommentInputs] = useState({});
  const [selectedPost, setSelectedPost] = useState(null);
  const [loadingComments, setLoadingComments] = useState(false);
  const commentsPageSize = 3; // Number of comments to fetch per load
  const pageSize = 5; 
  const fetchFeedItems = async (loadMore = false) => {
    try {
      setLoadingMore(loadMore);
      if (!loadMore) setLoading(true);

      console.log('Fetching posts...');
      let postsQuery = query(
        collection(firestore, 'posts'),
        orderBy('createdAt', 'desc'),
        limit(pageSize)
      );
      if (loadMore && lastPostDoc) {
        postsQuery = query(
          collection(firestore, 'posts'),
          orderBy('createdAt', 'desc'),
          startAfter(lastPostDoc),
          limit(pageSize)
        );
      }
      const postsSnapshot = await getDocs(postsQuery);
      const newLastPostDoc = postsSnapshot.docs[postsSnapshot.docs.length - 1];
      const postsData = await Promise.all(
        postsSnapshot.docs.map(async (docSnapshot) => {
          const post = { id: docSnapshot.id, type: 'post', ...docSnapshot.data() };
          const djRef = doc(firestore, 'users', post.userId);
          const djDoc = await getDoc(djRef);

          let hasLiked = false;
          if (currentUser) {
            const likeRef = doc(firestore, `posts/${post.id}/likes`, currentUser.uid);
            const likeDoc = await getDoc(likeRef);
            hasLiked = likeDoc.exists();
          }

          const commentsQuery = query(
            collection(firestore, `posts/${post.id}/comments`),
            orderBy('createdAt', 'desc'),
            limit(commentsPageSize)
          );
          const commentsSnapshot = await getDocs(commentsQuery);
          const commentsData = await Promise.all(
            commentsSnapshot.docs.map(async (commentDoc) => {
              const comment = { id: commentDoc.id, ...commentDoc.data() };
              const commenterRef = doc(firestore, 'users', comment.userId);
              const commenterDoc = await getDoc(commenterRef);
              return {
                ...comment,
                username: commenterDoc.exists() ? commenterDoc.data().username : 'Unknown User',
              };
            })
          );

          return {
            ...post,
            dj: djDoc.exists() ? { id: djDoc.id, ...djDoc.data() } : null,
            hasLiked,
            comments: commentsData,
            lastCommentDoc: commentsSnapshot.docs[commentsSnapshot.docs.length - 1], // Track the last comment for pagination
            hasMoreComments: commentsSnapshot.docs.length === commentsPageSize, // Determine if there are more comments
          };
        })
      );
      console.log('Fetched posts:', postsData);

      console.log('Fetching events...');
      let eventsQuery = query(
        collection(firestore, 'events'),
        orderBy('createdAt', 'desc'),
        limit(pageSize)
      );
      if (loadMore && lastEventDoc) {
        eventsQuery = query(
          collection(firestore, 'events'),
          orderBy('createdAt', 'desc'),
          startAfter(lastEventDoc),
          limit(pageSize)
        );
      }
      const eventsSnapshot = await getDocs(eventsQuery);
      const newLastEventDoc = eventsSnapshot.docs[eventsSnapshot.docs.length - 1];
      const eventsData = await Promise.all(
        eventsSnapshot.docs.map(async (docSnapshot) => {
          const event = { id: docSnapshot.id, type: 'event', ...docSnapshot.data() };
          const organizerRef = doc(firestore, 'users', event.organizerId);
          const organizerDoc = await getDoc(organizerRef);
          return {
            ...event,
            organizer: organizerDoc.exists() ? { id: organizerDoc.id, ...organizerDoc.data() } : null,
          };
        })
      );
      console.log('Fetched events:', eventsData);

      const newFeedItems = [...postsData, ...eventsData].sort((a, b) => {
        const dateA = a.createdAt?.seconds || 0;
        const dateB = b.createdAt?.seconds || 0;
        return dateB - dateA;
      });

      setFeedItems((prevItems) => loadMore ? [...prevItems, ...newFeedItems] : newFeedItems);
      setLastPostDoc(newLastPostDoc);
      setLastEventDoc(newLastEventDoc);
      setHasMore(postsSnapshot.docs.length === pageSize || eventsSnapshot.docs.length === pageSize);
      setLoading(false);
      setLoadingMore(false);
    } catch (err) {
      console.error('Error fetching feed items:', err);
      setError('Failed to load feed: ' + err.message);
      toast.error('Failed to load feed: ' + err.message);
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchFeedItems();
  }, []);

  const handleLike = async (postId, hasLiked) => {
    if (!currentUser) {
      toast.error('Please log in to like posts.');
      return;
    }

    try {
      const likeRef = doc(firestore, `posts/${postId}/likes`, currentUser.uid);
      const postRef = doc(firestore, 'posts', postId);

      if (hasLiked) {
        await deleteDoc(likeRef);
        await setDoc(postRef, { likeCount: increment(-1) }, { merge: true });
        toast.success('Post unliked.');
      } else {
        await setDoc(likeRef, { userId: currentUser.uid, createdAt: new Date() });
        await setDoc(postRef, { likeCount: increment(1) }, { merge: true });
        toast.success('Post liked!');
      }

      setFeedItems((prevItems) =>
        prevItems.map((item) =>
          item.id === postId && item.type === 'post'
            ? {
                ...item,
                hasLiked: !hasLiked,
                likeCount: (item.likeCount || 0) + (hasLiked ? -1 : 1),
              }
            : item
        )
      );

      if (selectedPost && selectedPost.id === postId) {
        setSelectedPost((prev) => ({
          ...prev,
          hasLiked: !hasLiked,
          likeCount: (prev.likeCount || 0) + (hasLiked ? -1 : 1),
        }));
      }
    } catch (error) {
      console.error('Error liking post:', error);
      toast.error('Failed to like post: ' + error.message);
    }
  };

  const handleCommentSubmit = async (e, postId) => {
    e.preventDefault();

    if (!currentUser) {
      toast.error('Please log in to comment on posts.');
      return;
    }

    const commentContent = commentInputs[postId];
    if (!commentContent || commentContent.trim() === '') {
      toast.error('Comment cannot be empty.');
      return;
    }

    try {
      const commentsRef = collection(firestore, `posts/${postId}/comments`);
      const postRef = doc(firestore, 'posts', postId);

      const newComment = {
        userId: currentUser.uid,
        username: currentUser.displayName || 'Anonymous',
        content: commentContent,
        createdAt: new Date(),
      };
      await addDoc(commentsRef, newComment);

      await setDoc(postRef, { commentCount: increment(1) }, { merge: true });

      setFeedItems((prevItems) =>
        prevItems.map((item) =>
          item.id === postId && item.type === 'post'
            ? {
                ...item,
                comments: [
                  { ...newComment, username: currentUser.displayName || 'Anonymous' },
                  ...(item.comments || []),
                ],
                commentCount: (item.commentCount || 0) + 1,
              }
            : item
        )
      );

      if (selectedPost && selectedPost.id === postId) {
        setSelectedPost((prev) => ({
          ...prev,
          comments: [
            { ...newComment, username: currentUser.displayName || 'Anonymous' },
            ...(prev.comments || []),
          ],
          commentCount: (prev.commentCount || 0) + 1,
        }));
      }

      setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
      toast.success('Comment added successfully!');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment: ' + error.message);
    }
  };

  const handleCommentChange = (postId, value) => {
    setCommentInputs((prev) => ({ ...prev, [postId]: value }));
  };

  const loadMoreComments = async (postId) => {
    if (!selectedPost || selectedPost.id !== postId || !selectedPost.hasMoreComments) return;

    try {
      setLoadingComments(true);
      const commentsQuery = query(
        collection(firestore, `posts/${postId}/comments`),
        orderBy('createdAt', 'desc'),
        startAfter(selectedPost.lastCommentDoc),
        limit(commentsPageSize)
      );
      const commentsSnapshot = await getDocs(commentsQuery);
      const newComments = await Promise.all(
        commentsSnapshot.docs.map(async (commentDoc) => {
          const comment = { id: commentDoc.id, ...commentDoc.data() };
          const commenterRef = doc(firestore, 'users', comment.userId);
          const commenterDoc = await getDoc(commenterRef);
          return {
            ...comment,
            username: commenterDoc.exists() ? commenterDoc.data().username : 'Unknown User',
          };
        })
      );

      setSelectedPost((prev) => ({
        ...prev,
        comments: [...prev.comments, ...newComments],
        lastCommentDoc: commentsSnapshot.docs[commentsSnapshot.docs.length - 1],
        hasMoreComments: commentsSnapshot.docs.length === commentsPageSize,
      }));

      // Update the feed item as well
      setFeedItems((prevItems) =>
        prevItems.map((item) =>
          item.id === postId && item.type === 'post'
            ? {
                ...item,
                comments: [...item.comments, ...newComments],
                lastCommentDoc: commentsSnapshot.docs[commentsSnapshot.docs.length - 1],
                hasMoreComments: commentsSnapshot.docs.length === commentsPageSize,
              }
            : item
        )
      );
    } catch (error) {
      console.error('Error loading more comments:', error);
      toast.error('Failed to load more comments: ' + error.message);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleLoadMore = () => {
    fetchFeedItems(true);
  };

  const openPostModal = (post) => {
    setSelectedPost(post);
  };

  const closePostModal = () => {
    setSelectedPost(null);
  };

  if (loading && !loadingMore) return <div className="loading-screen"><div className="spinner"></div><p>Loading...</p></div>;
  if (error) return <div>{error}</div>;

  return (
    <div className="home">
      {/* Hero Section */}
      <div className="hero-section">
        <div className="hero-overlay">
          <h1>Welcome to GhostNation Hub</h1>
          <p>Where DJs, Event Organizers, and Music Lovers Unite</p>
          <div className="cta-buttons">
            {currentUser ? (
              <>
                {currentUser.role === 'dj' && (
                  <Link to="/create_post" className="btn btn-primary">
                    Share a Post
                  </Link>
                )}
                {currentUser.role === 'organizer' && (
                  <Link to="/create_event" className="btn btn-primary">
                    Create an Event
                  </Link>
                )}
                {currentUser.role === 'viewer' && (
                  <Link to="/events" className="btn btn-primary">
                    Discover Events
                  </Link>
                )}
              </>
            ) : (
              <>
                <Link to="/signup" className="btn btn-primary">Join the Community</Link>
                <Link to="/events" className="btn btn-secondary">Explore Events</Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Feed Section */}
      <section className="feed-section">
        <h2>Community Feed</h2>
        {feedItems.length > 0 ? (
          <>
            <div className="feed-container">
              {feedItems.map((item) => (
                <div key={`${item.type}-${item.id}`} className="feed-item">
                  {item.type === 'post' ? (
                    <div
                      className="post-card"
                      onClick={() => openPostModal(item)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="post-header">
                        <img
                          src={item.dj?.profilePicture || defaultProfilePicture}
                          alt="DJ"
                          className="dj-avatar"
                        />
                        <div>
                          <Link to={`/profile/${item.dj?.id}`} onClick={(e) => e.stopPropagation()}>
                            <h3>{item.dj?.username || 'Unknown DJ'}</h3>
                          </Link>
                          <p className="timestamp">
                            {item.createdAt?.seconds
                              ? new Date(item.createdAt.seconds * 1000).toLocaleString()
                              : 'Unknown date'}
                          </p>
                        </div>
                      </div>
                      <p>{item.content || 'No content'}</p>
                      {item.mediaUrl && (
                        item.mediaType?.startsWith('image/') ? (
                          <img src={item.mediaUrl} alt="Post Media" className="post-media" />
                        ) : (
                          <video src={item.mediaUrl} controls className="post-media" />
                        )
                      )}
                      <div className="post-actions">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLike(item.id, item.hasLiked);
                          }}
                          className={`like-button ${item.hasLiked ? 'liked' : ''}`}
                        >
                          {item.hasLiked ? 'Unlike' : 'Like'} ({item.likeCount || 0})
                        </button>
                        <span className="comment-count">
                          Comments ({item.commentCount || 0})
                        </span>
                      </div>
                    </div>
                  ) : (
                    <EventCard event={item} />
                  )}
                </div>
              ))}
            </div>
            {hasMore && (
              <div className="load-more-container">
                <button onClick={handleLoadMore} className="btn btn-primary" disabled={loadingMore}>
                  {loadingMore ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </>
        ) : (
          <p>No posts or events to display. Start sharing or exploring!</p>
        )}
      </section>

      {/* Post Modal */}
      {selectedPost && (
        <div className="post-modal-overlay">
          <div className="post-modal-content">
            <button className="close-modal-btn" onClick={closePostModal}>✖</button>
            <div className="post-header">
              <img
                src={selectedPost.dj?.profilePicture || defaultProfilePicture}
                alt="DJ"
                className="dj-avatar"
              />
              <div>
                <Link to={`/profile/${selectedPost.dj?.id}`}>
                  <h3>{selectedPost.dj?.username || 'Unknown DJ'}</h3>
                </Link>
                <p className="timestamp">
                  {selectedPost.createdAt?.seconds
                    ? new Date(selectedPost.createdAt.seconds * 1000).toLocaleString()
                    : 'Unknown date'}
                </p>
              </div>
            </div>
            <p>{selectedPost.content || 'No content'}</p>
            {selectedPost.mediaUrl && (
              selectedPost.mediaType?.startsWith('image/') ? (
                <img src={selectedPost.mediaUrl} alt="Post Media" className="post-media-large" />
              ) : (
                <video src={selectedPost.mediaUrl} controls className="post-media-large" />
              )
            )}
            <div className="post-actions">
              <button
                onClick={() => handleLike(selectedPost.id, selectedPost.hasLiked)}
                className={`like-button ${selectedPost.hasLiked ? 'liked' : ''}`}
              >
                {selectedPost.hasLiked ? 'Unlike' : 'Like'} ({selectedPost.likeCount || 0})
              </button>
            </div>
            {/* Comments Section */}
            <div className="comments-section">
              <h4>Comments ({selectedPost.commentCount || 0})</h4>
              {selectedPost.comments && selectedPost.comments.length > 0 ? (
                <>
                  <ul className="comment-list">
                    {selectedPost.comments.map((comment) => (
                      <li key={comment.id} className="comment">
                        <strong>{comment.username}</strong>: {comment.content}
                        <span className="comment-timestamp">
                          {comment.createdAt?.seconds
                            ? new Date(comment.createdAt.seconds * 1000).toLocaleString()
                            : 'Unknown date'}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {selectedPost.hasMoreComments && (
                    <button
                      onClick={() => loadMoreComments(selectedPost.id)}
                      className="load-more-comments-btn"
                      disabled={loadingComments}
                    >
                      {loadingComments ? 'Loading...' : 'Load More Comments'}
                    </button>
                  )}
                </>
              ) : (
                <p>No comments yet.</p>
              )}
              {currentUser && (
                <form
                  onSubmit={(e) => handleCommentSubmit(e, selectedPost.id)}
                  className="comment-form"
                >
                  <input
                    type="text"
                    value={commentInputs[selectedPost.id] || ''}
                    onChange={(e) => handleCommentChange(selectedPost.id, e.target.value)}
                    placeholder="Add a comment..."
                    className="comment-input"
                  />
                  <button type="submit" className="btn comment-submit">
                    Comment
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;