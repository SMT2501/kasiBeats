import React, { useEffect, useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { firestore } from '../firebaseConfig';
import { AuthContext } from '../context/AuthContext';
import { collection, query, orderBy, getDocs, limit, startAfter, doc, getDoc, setDoc, increment, addDoc, deleteDoc, where } from 'firebase/firestore';
import { loadStripe } from '@stripe/stripe-js';
import { toast } from 'react-toastify';
import defaultProfilePicture from '../assets/images/profile.jpg';
import './Home.css';

const stripeKey = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
console.log('Home.js - Stripe Key:', stripeKey);

const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

if (!stripeKey) {
  console.error('Stripe key is missing in Home.js. Check REACT_APP_STRIPE_PUBLISHABLE_KEY in .env');
}

const Home = () => {
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [feedItems, setFeedItems] = useState([]);
  const [lastPostDoc, setLastPostDoc] = useState(null);
  const [lastEventDoc, setLastEventDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [commentInputs, setCommentInputs] = useState({});
  const [selectedItem, setSelectedItem] = useState(null);
  const [eventDjs, setEventDjs] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const commentsPageSize = 3;
  const pageSize = 5;

  useEffect(() => {
    if (currentUser === undefined) return; // Wait for auth to initialize
    fetchFeedItems();
  }, [currentUser]);

  const fetchFeedItems = async (loadMore = false) => {
    try {
      console.log('Fetching feed items, currentUser:', currentUser);
      setLoadingMore(loadMore);
      if (!loadMore) setLoading(true);
  
      const postsQuery = query(
        collection(firestore, 'posts'),
        orderBy('createdAt', 'desc'),
        limit(pageSize),
        ...(loadMore && lastPostDoc ? [startAfter(lastPostDoc)] : [])
      );
      const eventsQuery = query(
        collection(firestore, 'events'),
        orderBy('createdAt', 'desc'),
        limit(pageSize),
        ...(loadMore && lastEventDoc ? [startAfter(lastEventDoc)] : [])
      );
  
      let postsSnapshot, eventsSnapshot;
      try {
        postsSnapshot = await getDocs(postsQuery);
        console.log('Posts fetched successfully:', postsSnapshot.size);
      } catch (err) {
        const errorMessage = err?.message || 'Unknown error fetching posts';
        console.error('Error fetching posts:', err);
        throw new Error('Failed to fetch posts: ' + errorMessage);
      }
  
      try {
        eventsSnapshot = await getDocs(eventsQuery);
        console.log('Events fetched successfully:', eventsSnapshot.size);
      } catch (err) {
        const errorMessage = err?.message || 'Unknown error fetching events';
        console.error('Error fetching events:', err);
        throw new Error('Failed to fetch events: ' + errorMessage);
      }
  
      const postsData = await Promise.all(
        postsSnapshot.docs.map(async (postDoc) => {
          const postData = { id: postDoc.id, type: 'post', ...postDoc.data() };
          console.log('Processing post:', postData.id, 'createdAt:', postData.createdAt);
  
          const djRef = doc(firestore, 'users', postData.djId || 'unknown');
          const djDoc = await getDoc(djRef);
          const likesQuery = query(collection(firestore, 'likes'), where('postId', '==', postDoc.id));
          const likesSnapshot = await getDocs(likesQuery);
          const likeCount = likesSnapshot.size;
          const hasLiked = currentUser ? likesSnapshot.docs.some((doc) => doc.data().userId === currentUser.uid) : false;
  
          const commentsQuery = query(
            collection(firestore, 'comments'),
            where('postId', '==', postDoc.id),
            orderBy('createdAt', 'desc'),
            limit(commentsPageSize)
          );
          const commentsSnapshot = await getDocs(commentsQuery);
          const comments = commentsSnapshot.docs.map((commentDoc) => ({
            id: commentDoc.id,
            ...commentDoc.data(),
          }));
  
          return {
            ...postData,
            dj: djDoc.exists() ? { id: djDoc.id, ...djDoc.data() } : { id: 'unknown', username: 'Unknown DJ' },
            likeCount,
            hasLiked,
            comments,
            commentCount: commentsSnapshot.size,
            hasMoreComments: commentsSnapshot.size >= commentsPageSize,
          };
        })
      );
  
      const eventsData = await Promise.all(
        eventsSnapshot.docs.map(async (eventDoc) => {
          const eventData = { id: eventDoc.id, type: 'event', ...eventDoc.data() };
          console.log('Processing event:', eventData.id, 'createdAt:', eventData.createdAt);
  
          const organizerRef = doc(firestore, 'users', eventData.organizerId || 'unknown');
          const organizerDoc = await getDoc(organizerRef);
          return {
            ...eventData,
            organizer: organizerDoc.exists() ? { id: organizerDoc.id, ...organizerDoc.data() } : { id: 'unknown', username: 'Unknown Organizer' },
          };
        })
      );
  
      console.log('Posts data before sort:', postsData);
      console.log('Events data before sort:', eventsData);
  
      const combinedData = [...postsData, ...eventsData].sort((a, b) => {
        const aDate = a.createdAt && typeof a.createdAt.toDate === 'function'
          ? a.createdAt.toDate()
          : a.createdAt ? new Date(a.createdAt) : new Date(0);
        const bDate = b.createdAt && typeof b.createdAt.toDate === 'function'
          ? b.createdAt.toDate()
          : b.createdAt ? new Date(b.createdAt) : new Date(0);
        return bDate - aDate;
      });
  
      console.log('Combined data after sort:', combinedData);
  
      if (loadMore) {
        setFeedItems((prev) => [...prev, ...combinedData]);
      } else {
        setFeedItems(combinedData);
      }
  
      setLastPostDoc(postsSnapshot.docs[postsSnapshot.docs.length - 1] || lastPostDoc);
      setLastEventDoc(eventsSnapshot.docs[eventsSnapshot.docs.length - 1] || lastEventDoc);
      setHasMore(postsSnapshot.docs.length === pageSize || eventsSnapshot.docs.length === pageSize);
    } catch (err) {
      const errorMessage = err?.message || 'Unknown error occurred';
      console.error('Error fetching feed items:', err);
      setError('Failed to load feed: ' + errorMessage);
      toast.error('Failed to load feed: ' + errorMessage);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchFeedItems(true);
    }
  };

  const handleLike = async (postId, hasLiked) => {
    if (!currentUser) {
      toast.error('Please log in to like posts.');
      return;
    }

    const likeRef = doc(firestore, 'likes', `${currentUser.uid}_${postId}`);
    try {
      if (hasLiked) {
        await deleteDoc(likeRef);
        setFeedItems((prev) =>
          prev.map((item) =>
            item.id === postId && item.type === 'post'
              ? { ...item, likeCount: item.likeCount - 1, hasLiked: false }
              : item
          )
        );
        if (selectedItem && selectedItem.id === postId && selectedItem.type === 'post') {
          setSelectedItem((prev) => ({ ...prev, likeCount: prev.likeCount - 1, hasLiked: false }));
        }
      } else {
        await setDoc(likeRef, {
          userId: currentUser.uid,
          postId,
          createdAt: new Date(),
        });
        setFeedItems((prev) =>
          prev.map((item) =>
            item.id === postId && item.type === 'post'
              ? { ...item, likeCount: item.likeCount + 1, hasLiked: true }
              : item
          )
        );
        if (selectedItem && selectedItem.id === postId && selectedItem.type === 'post') {
          setSelectedItem((prev) => ({ ...prev, likeCount: prev.likeCount + 1, hasLiked: true }));
        }
      }
    } catch (err) {
      console.error('Error liking/unliking post:', err);
      toast.error('Failed to update like: ' + err.message);
    }
  };

  const handleCommentChange = (postId, value) => {
    setCommentInputs((prev) => ({ ...prev, [postId]: value }));
  };

  const handleCommentSubmit = async (e, itemId, itemType) => {
    e.preventDefault();
    if (!currentUser) {
      toast.error('Please log in to comment.');
      return;
    }

    const content = commentInputs[itemId]?.trim();
    if (!content) {
      toast.error('Comment cannot be empty.');
      return;
    }

    try {
      const commentRef = await addDoc(collection(firestore, 'comments'), {
        postId: itemType === 'post' ? itemId : null,
        eventId: itemType === 'event' ? itemId : null,
        userId: currentUser.uid,
        username: currentUser.displayName || 'Anonymous',
        content,
        createdAt: new Date(),
      });

      const newComment = {
        id: commentRef.id,
        userId: currentUser.uid,
        username: currentUser.displayName || 'Anonymous',
        content,
        createdAt: new Date(),
      };

      setFeedItems((prev) =>
        prev.map((item) =>
          item.id === itemId && item.type === itemType
            ? {
                ...item,
                comments: [newComment, ...(item.comments || [])].slice(0, commentsPageSize),
                commentCount: (item.commentCount || 0) + 1,
              }
            : item
        )
      );

      if (selectedItem && selectedItem.id === itemId && selectedItem.type === itemType) {
        setSelectedItem((prev) => ({
          ...prev,
          comments: [newComment, ...(prev.comments || [])].slice(0, commentsPageSize),
          commentCount: (prev.commentCount || 0) + 1,
        }));
      }

      setCommentInputs((prev) => ({ ...prev, [itemId]: '' }));
      toast.success('Comment added successfully!');
    } catch (err) {
      console.error('Error adding comment:', err);
      toast.error('Failed to add comment: ' + err.message);
    }
  };

  const loadMoreComments = async (itemId, itemType) => {
    if (loadingComments) return;

    try {
      setLoadingComments(true);
      const lastComment = selectedItem.comments[selectedItem.comments.length - 1];
      const commentsQuery = query(
        collection(firestore, 'comments'),
        where(itemType === 'post' ? 'postId' : 'eventId', '==', itemId),
        orderBy('createdAt', 'desc'),
        startAfter(lastComment.createdAt),
        limit(commentsPageSize)
      );

      const commentsSnapshot = await getDocs(commentsQuery);
      const newComments = commentsSnapshot.docs.map((commentDoc) => ({
        id: commentDoc.id,
        ...commentDoc.data(),
      }));

      setSelectedItem((prev) => ({
        ...prev,
        comments: [...prev.comments, ...newComments],
        hasMoreComments: commentsSnapshot.size === commentsPageSize,
      }));
    } catch (err) {
      console.error('Error loading more comments:', err);
      toast.error('Failed to load more comments: ' + err.message);
    } finally {
      setLoadingComments(false);
    }
  };

  const openModal = async (item) => {
    setSelectedItem(item);
    if (item.type === 'event') {
      try {
        console.log('Fetching DJs for event:', item.id);
        const bookingsQuery = query(
          collection(firestore, 'bookings'),
          where('eventId', '==', item.id)
        );
        const bookingsSnapshot = await getDocs(bookingsQuery);
        const bookingsData = bookingsSnapshot.docs.map((bookingDoc) => ({
          id: bookingDoc.id,
          ...bookingDoc.data(),
        }));

        const djsData = await Promise.all(
          bookingsData.map(async (booking) => {
            const djRef = doc(firestore, 'users', booking.djId);
            const djDoc = await getDoc(djRef);
            return {
              id: booking.djId,
              status: booking.status || 'pending',
              ...(djDoc.exists() ? djDoc.data() : { username: 'Unknown DJ' }),
            };
          })
        );

        setEventDjs(djsData);
        console.log('Event DJs fetched:', djsData);
      } catch (err) {
        console.error('Error loading event DJs:', err);
        toast.error('Failed to load event DJs: ' + err.message);
        setEventDjs([]);
      }
    } else {
      setEventDjs([]);
    }
  };

  const closeModal = () => {
    setSelectedItem(null);
    setEventDjs([]);
  };

  const handleBuyTicket = async (eventId, eventName, price) => {
    if (!currentUser) {
      toast.error('Please log in to buy a ticket.');
      return;
    }

    if (!stripePromise) {
      toast.error('Payment system unavailable. Please contact support.');
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          eventName,
          price: price || 20,
          userId: currentUser.uid,
        }),
      });

      const text = await response.text();
      console.log('Raw response:', text);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}, Body: ${text}`);
      }

      const session = JSON.parse(text);
      if (session.error) throw new Error(session.error);

      const stripe = await stripePromise;
      const { error } = await stripe.redirectToCheckout({ sessionId: session.id });
      if (error) throw new Error(error.message);
    } catch (error) {
      toast.error('Failed to buy ticket: ' + error.message);
    }
  };

  const generateTicket = async (eventId) => {
    if (!currentUser || currentUser.role !== 'organizer') {
      toast.error('Only event organizers can generate tickets.');
      return;
    }

    try {
      const event = feedItems.find((e) => e.id === eventId && e.type === 'event');
      if (!event) throw new Error('Event not found.');

      if (event.organizerId !== currentUser.uid) {
        toast.error('You can only generate tickets for your own events.');
        return;
      }

      const ticketData = {
        eventName: event.name || 'Untitled Event',
        date: event.date && typeof event.date.toDate === 'function'
          ? event.date.toDate().toLocaleDateString()
          : event.date ? new Date(event.date).toLocaleDateString() : 'Date unavailable',
        location: event.location || 'Location unavailable',
        organizer: currentUser.displayName || 'Organizer',
        ticketId: `TICKET-${eventId}-${Date.now()}`,
      };

      const ticketHtml = `
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
            <h1>KasiBeats Event Ticket</h1>
            <h2>${ticketData.eventName}</h2>
            <p><strong>Date:</strong> ${ticketData.date}</p>
            <p><strong>Location:</strong> ${ticketData.location}</p>
            <p><strong>Organizer:</strong> ${ticketData.organizer}</p>
            <p><strong>Ticket ID:</strong> ${ticketData.ticketId}</p>
            <p>Thank you for attending!</p>
          </body>
        </html>
      `;

      const blob = new Blob([ticketHtml], { type: 'text/html' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ticket-${eventId}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Ticket generated and downloaded successfully!');
    } catch (err) {
      toast.error('Failed to generate ticket: ' + err.message);
    }
  };

  const handleShareEvent = (eventId, eventName) => {
    const eventUrl = `${window.location.origin}/events/${eventId}`;
    const shareData = {
      title: `Check out ${eventName} on KasiBeats!`,
      text: `Join me at ${eventName} on KasiBeats!`,
      url: eventUrl,
    };

    if (navigator.share) {
      navigator.share(shareData)
        .then(() => toast.success('Event shared successfully!'))
        .catch((err) => {
          console.error('Error sharing event:', err);
          navigator.clipboard.writeText(eventUrl)
            .then(() => toast.success('Event URL copied to clipboard!'))
            .catch(() => toast.error('Failed to share event. Please copy the URL manually.'));
        });
    } else {
      navigator.clipboard.writeText(eventUrl)
        .then(() => toast.success('Event URL copied to clipboard!'))
        .catch(() => toast.error('Failed to share event. Please copy the URL manually.'));
    }
  };

  if (loading && !loadingMore) return <div className="loading-screen"><div className="spinner"></div><p>Loading...</p></div>;
  if (error) return <div>{error}</div>;

  return (
    <div className="home">
      <div className="hero-section">
        <div className="hero-overlay">
          <h1>Welcome to KasiBeats</h1>
          <p>Where DJs, Event Organizers, and Music Lovers Unite</p>
          <div className="cta-buttons">
            {currentUser ? (
              <>
                {currentUser.role === 'dj' && (
                  <Link to="/create_post" className="btn btn-primary">Share a Post</Link>
                )}
                {currentUser.role === 'organizer' && (
                  <Link to="/create_event" className="btn btn-primary">Create an Event</Link>
                )}
                {currentUser.role === 'viewer' && (
                  <Link to="/events" className="btn btn-primary">Discover Events</Link>
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

      <section className="feed-section">
        <h2>KasiBeats Community Feed</h2>
        {feedItems.length > 0 ? (
          <>
            <div className="feed-container">
              {feedItems.map((item) => (
                <div key={`${item.type}-${item.id}`} className="feed-item">
                  <div className="post-card" onClick={() => openModal(item)} style={{ cursor: 'pointer' }}>
                    <div className="post-header">
                      <img
                        src={item.type === 'post' ? item.dj?.profilePicture || defaultProfilePicture : item.organizer?.profilePicture || defaultProfilePicture}
                        alt={item.type === 'post' ? 'DJ' : 'Organizer'}
                        className="dj-avatar"
                      />
                      <div>
                        <Link to={`/profile/${item.type === 'post' ? item.dj?.id : item.organizer?.id}`} onClick={(e) => e.stopPropagation()}>
                          <h3>{item.type === 'post' ? item.dj?.username || 'Unknown DJ' : item.organizer?.username || 'Unknown Organizer'}</h3>
                        </Link>
                        <p className="timestamp">
                          {item.createdAt && typeof item.createdAt.toDate === 'function'
                            ? item.createdAt.toDate().toLocaleString()
                            : item.createdAt?.seconds
                              ? new Date(item.createdAt.seconds * 1000).toLocaleString()
                              : 'Unknown date'}
                        </p>
                      </div>
                    </div>
                    {item.type === 'post' ? (
                      <>
                        <p className="post-content">{item.content || 'No content'}</p>
                        {item.mediaUrl && (
                          item.mediaType?.startsWith('image/') ? (
                            <img src={item.mediaUrl} alt="Post Media" className="post-media" />
                          ) : (
                            <video src={item.mediaUrl} controls className="post-media" />
                          )
                        )}
                      </>
                    ) : (
                      <div className="event-details">
                        <h4>{item.name || 'Untitled Event'}</h4>
                        <p><strong>Date:</strong> {item.date && typeof item.date.toDate === 'function'
                          ? item.date.toDate().toLocaleDateString()
                          : item.date ? new Date(item.date).toLocaleDateString() : 'Date unavailable'}</p>
                        <p><strong>Location:</strong> {item.location || 'Location unavailable'}</p>
                        <p><strong>Price:</strong> R{item.ticketPrice || 20}</p>
                        <p className="event-description"><strong>Description:</strong> {item.description || 'No description available'}</p>
                        {item.mediaUrl && (
                          item.mediaType?.startsWith('image/') ? (
                            <img src={item.mediaUrl} alt="Event Media" className="post-media" />
                          ) : (
                            <video src={item.mediaUrl} controls className="post-media" />
                          )
                        )}
                      </div>
                    )}
                    <div className="post-actions">
                      {item.type === 'post' ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleLike(item.id, item.hasLiked); }}
                          className={`like-button ${item.hasLiked ? 'liked' : ''}`}
                        >
                          {item.hasLiked ? 'Unlike' : 'Like'} ({item.likeCount || 0})
                        </button>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleBuyTicket(item.id, item.name, item.ticketPrice); }}
                          className="btn buy-btn"
                        >
                          Buy Ticket
                        </button>
                      )}
                      <span className="comment-count">Comments ({item.commentCount || 0})</span>
                    </div>
                  </div>
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
          <p>No posts or events to display. Start sharing or exploring on KasiBeats!</p>
        )}
      </section>

      {selectedItem && (
        <div className="post-modal-overlay">
          <div className="post-modal-content">
            <button className="close-modal-btn" onClick={closeModal}>✖</button>
            <div className="post-header">
              <img
                src={
                  selectedItem.type === 'post'
                    ? selectedItem.dj?.profilePicture || defaultProfilePicture
                    : selectedItem.organizer?.profilePicture || defaultProfilePicture
                }
                alt={selectedItem.type === 'post' ? 'DJ' : 'Organizer'}
                className="dj-avatar"
              />
              <div>
                <Link
                  to={`/profile/${selectedItem.type === 'post' ? selectedItem.dj?.id : selectedItem.organizer?.id}`}
                >
                  <h3>
                    {selectedItem.type === 'post'
                      ? selectedItem.dj?.username || 'Unknown DJ'
                      : selectedItem.organizer?.username || 'Unknown Organizer'}
                  </h3>
                </Link>
                <p className="timestamp">
                  {selectedItem.createdAt && typeof selectedItem.createdAt.toDate === 'function'
                    ? selectedItem.createdAt.toDate().toLocaleString()
                    : selectedItem.createdAt?.seconds
                      ? new Date(selectedItem.createdAt.seconds * 1000).toLocaleString()
                      : 'Unknown date'}
                </p>
              </div>
            </div>
            {selectedItem.type === 'post' ? (
              <p>{selectedItem.content || 'No content'}</p>
            ) : (
              <div className="event-details-modal">
                <h2>{selectedItem.name || 'Untitled Event'}</h2>
                <p><strong>Date:</strong>{' '}
                  {selectedItem.date && typeof selectedItem.date.toDate === 'function'
                    ? selectedItem.date.toDate().toLocaleDateString()
                    : selectedItem.date ? new Date(selectedItem.date).toLocaleDateString() : 'Date unavailable'}
                </p>
                <p><strong>Location:</strong> {selectedItem.location || 'Location unavailable'}</p>
                <p><strong>Price:</strong> R{selectedItem.ticketPrice || 20}</p>
                <p><strong>Description:</strong> {selectedItem.description || 'No description available'}</p>
              </div>
            )}
            {selectedItem.mediaUrl && (
              selectedItem.mediaType?.startsWith('image/') ? (
                <img src={selectedItem.mediaUrl} alt={`${selectedItem.type} Media`} className="post-media-large" />
              ) : (
                <video src={selectedItem.mediaUrl} controls className="post-media-large" />
              )
            )}
            <div className="post-actions">
              {selectedItem.type === 'post' ? (
                <button
                  onClick={() => handleLike(selectedItem.id, selectedItem.hasLiked)}
                  className={`like-button ${selectedItem.hasLiked ? 'liked' : ''}`}
                >
                  {selectedItem.hasLiked ? 'Unlike' : 'Like'} ({selectedItem.likeCount || 0})
                </button>
              ) : currentUser && currentUser.role === 'organizer' && currentUser.uid === selectedItem.organizerId ? (
                <button onClick={() => generateTicket(selectedItem.id)} className="btn">
                  Generate Ticket
                </button>
              ) : (
                currentUser && (
                  <button
                    onClick={() => handleBuyTicket(selectedItem.id, selectedItem.name, selectedItem.ticketPrice)}
                    className="btn"
                  >
                    Buy Ticket
                  </button>
                )
              )}
              {selectedItem.type === 'event' && (
                <button
                  onClick={() => handleShareEvent(selectedItem.id, selectedItem.name)}
                  className="btn share-btn"
                >
                  Share
                </button>
              )}
            </div>
            <div className="comments-section">
              <h4>Comments ({selectedItem.commentCount || 0})</h4>
              {selectedItem.comments && selectedItem.comments.length > 0 ? (
                <>
                  <ul className="comment-list">
                    {selectedItem.comments.map((comment) => (
                      <li key={comment.id} className="comment">
                        <strong>{comment.username}</strong>: {comment.content}
                        <span className="comment-timestamp">
                          {comment.createdAt && typeof comment.createdAt.toDate === 'function'
                            ? comment.createdAt.toDate().toLocaleString()
                            : comment.createdAt?.seconds
                              ? new Date(comment.createdAt.seconds * 1000).toLocaleString()
                              : 'Unknown date'}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {selectedItem.hasMoreComments && (
                    <button
                      onClick={() => loadMoreComments(selectedItem.id, selectedItem.type)}
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
                  onSubmit={(e) => handleCommentSubmit(e, selectedItem.id, selectedItem.type)}
                  className="comment-form"
                >
                  <input
                    type="text"
                    value={commentInputs[selectedItem.id] || ''}
                    onChange={(e) => handleCommentChange(selectedItem.id, e.target.value)}
                    placeholder="Add a comment..."
                    className="comment-input"
                  />
                  <button type="submit" className="btn comment-submit">
                    Comment
                  </button>
                </form>
              )}
            </div>
            {selectedItem.type === 'event' && (
              <div className="event-djs-section">
                <h4>DJs</h4>
                {eventDjs.length > 0 ? (
                  <ul className="dj-list">
                    {eventDjs.map((dj) => (
                      <li key={dj.id} className="dj-item">
                        <strong>{dj.username || 'Unknown DJ'}</strong> -{' '}
                        <span className={`status-${dj.status}`}>
                          {dj.status || 'Pending'}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No DJs booked for this event.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;