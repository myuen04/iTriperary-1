// Firebase configuration
const firebaseConfig = {
    // Replace these with your Firebase project configuration
    // To get your configuration:
    // 1. Go to Firebase Console (https://console.firebase.google.com/)
    // 2. Select your project
    // 3. Click the gear icon (Project Settings)
    // 4. Under "Your apps", click the web icon (</>)
    // 5. Register app and copy the config object
    apiKey: "AIzaSyBwOD8qgTe_4iDZ5KddKPEfS98qmvahI1o",
    authDomain: "itriperary-96237.firebaseapp.com",
    projectId: "itriperary-96237",
    storageBucket: "itriperary-96237.firebasestorage.app",
    messagingSenderId: "722774240779",
    appId: "1:722774240779:web:820eb4cf13d92f9293e10e",
    databaseURL: "https://itriperary-96237-default-rtdb.firebaseio.com"
};

// Initialize Firebase
try {
    firebase.initializeApp(firebaseConfig);
    console.log('Firebase initialized successfully');
} catch (error) {
    console.error('Error initializing Firebase:', error);
}

// Initialize Realtime Database
const database = firebase.database();

// Function to clean up temporary data
function cleanupTemporaryData(tripId) {
    // Remove data after 24 hours
    setTimeout(() => {
        const tripRef = database.ref(`trips/${tripId}`);
        tripRef.remove()
            .then(() => console.log(`Temporary trip ${tripId} removed after 24 hours`))
            .catch(error => console.error('Error removing temporary data:', error));
    }, 24 * 60 * 60 * 1000); // 24 hours in milliseconds
}

// Function to save temporary trip data
function saveTemporaryTrip(tripData) {
    console.log('Saving temporary trip:', tripData);
    const tripRef = database.ref('trips').push();
    const tripId = tripRef.key;
    
    return tripRef.set({
        ...tripData,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        isTemporary: true
    })
    .then(() => {
        console.log('Trip saved successfully');
        cleanupTemporaryData(tripId);
        return tripId;
    })
    .catch(error => {
        console.error('Error saving trip:', error);
        throw error;
    });
}

// Function to generate share link
function generateShareLink(tripId) {
    // Get the current URL without query parameters
    const baseUrl = window.location.href.split('?')[0];
    return `${baseUrl}?tripId=${tripId}`;
}

// Export the database and functions
window.database = database;
window.saveTemporaryTrip = saveTemporaryTrip;
window.generateShareLink = generateShareLink;

/* 
Firebase Realtime Database Rules:
Copy these rules into your Firebase Console > Realtime Database > Rules:

{
  "rules": {
    "trips": {
      ".read": true,
      ".write": true,
      "$tripId": {
        ".read": true,
        ".write": true,
        "expenses": {
          ".read": true,
          ".write": true
        }
      }
    }
  }
}

These rules allow:
1. Public read/write access to trips
2. Access to shared trips via URL
3. Real-time collaboration
4. No authentication required

Note: For a production environment, you should implement proper authentication
and more restrictive security rules.
*/ 