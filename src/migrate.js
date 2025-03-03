const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyAGggkP5ijYSBkoCqVRxTKCdsPuli-5TYA",
  authDomain: "ghost-nation-8192f.firebaseapp.com",
  projectId: "ghost-nation-8192f",
  storageBucket: "ghost-nation-8192f.firebasestorage.app",
  messagingSenderId: "677300270430",
  appId: "1:677300270430:web:3c131978ab02fd30048bcf",
  measurementId: "G-KZG8NL5W5Z",
};

const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);

async function migrateProfilePictureField() {
  try {
    const usersRef = collection(firestore, 'users');
    const snapshot = await getDocs(usersRef);

    for (const userDoc of snapshot.docs) {
      const userData = userDoc.data();
      if (userData.profile_picture && !userData.profilePicture) {
        console.log(`Migrating profile_picture for user ${userDoc.id}...`);
        const userRef = doc(firestore, 'users', userDoc.id);
        await updateDoc(userRef, {
          profilePicture: userData.profile_picture,
          profile_picture: null, // Optionally remove the old field
        });
        console.log(`Updated user ${userDoc.id}`);
      }
    }
    console.log('Migration complete.');
  } catch (error) {
    console.error('Error during migration:', error);
  }
}

migrateProfilePictureField();