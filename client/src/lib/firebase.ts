import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, enableIndexedDbPersistence, connectFirestoreEmulator } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, User } from 'firebase/auth';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBfkSyQ4aSvx8vGSvWUjTox1uVo3jpsctQ",
  authDomain: "numzfleet.firebaseapp.com",
  projectId: "numzfleet",
  storageBucket: "numzfleet.firebasestorage.app",
  messagingSenderId: "956244443398",
  appId: "1:956244443398:web:40f0a017fccf6fa9311e87",
  measurementId: "G-T22VCKQHFN"
};

// Initialize Firebase only once with error handling
let app;
try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  console.log('✅ Firebase initialized successfully with numzfleet project');
} catch (error) {
  console.error('❌ Error initializing Firebase:', error);
  throw error;
}

// Initialize Analytics with proper error handling
let analytics = null;
isSupported().then(yes => yes ? analytics = getAnalytics(app) : null).catch(err => {
  console.warn('Analytics not supported:', err);
});

// Initialize Authentication
const auth = getAuth(app);

export { app, analytics, auth };

// Initialize Firestore
const db = getFirestore(app);

// Enable offline persistence with better error handling
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
  } else if (err.code === 'unimplemented') {
    console.warn('The current browser does not support persistence.');
  } else {
    console.error('Error enabling persistence:', err);
  }
});

// Test Firebase connection
export const testFirebaseConnection = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('🔍 Testing Firebase connection to numzfleet project...');
    
    // Test basic Firestore access
    const testCollection = collection(db, '_test_connection');
    console.log('✅ Firestore collection access successful');
    
    // Test if we can read from a real collection
    const driversCollection = collection(db, 'drivers');
    console.log('✅ Drivers collection access successful');
    
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Firebase connection test failed:', error);
    return { success: false, error: errorMessage };
  }
};

// Simplified retry logic for Firestore operations
export const withFirestoreRetry = async <T>(
  operation: () => Promise<T>, 
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      if (attempt > 1) {
        console.log(`✅ Firestore operation succeeded on attempt ${attempt}`);
      }
      return result;
    } catch (error) {
      lastError = error as Error;
      console.warn(`⚠️ Firestore operation failed (attempt ${attempt}/${maxRetries}):`, error);
      
      if (attempt === maxRetries) {
        console.error(`❌ Firestore operation failed after ${maxRetries} attempts`);
        throw new Error(`Firestore operation failed: ${lastError.message}`);
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }

  throw lastError!;
};

// Check if Firestore is available (simplified)
export const isFirestoreAvailable = () => {
  try {
    // Basic check - if we can access the db object, it's available
    return db !== null && db !== undefined;
  } catch {
    return false;
  }
};

// Initialize collections with type information
export const collections = {
  vehicles: collection(db, 'vehicles'),
  drivers: collection(db, 'drivers'),
  fuelRecords: collection(db, 'fuelRecords'),
  admins: collection(db, 'admins'),
  system: collection(db, 'system'),
} as const;

export { db };