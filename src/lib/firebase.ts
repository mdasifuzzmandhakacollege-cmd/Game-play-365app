import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  setPersistence,
  browserLocalPersistence,
  User
} from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import baseAppletConfig from '../../firebase-applet-config.json';

// Custom configuration provided by user
export const customFirebaseConfig = {
  apiKey: "AIzaSyCrQWrE-ZK4rFeU71Dpi59iXz4SSMLDuuk",
  authDomain: "my-app-3d013.firebaseapp.com",
  databaseURL: "https://my-app-3d013-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "my-app-3d013",
  storageBucket: "my-app-3d013.firebasestorage.app",
  messagingSenderId: "476127189079",
  appId: "1:476127189079:web:7aabee5c1b7d1d851d6b12",
  measurementId: "G-0DDR8VF34M",
  firestoreDatabaseId: "ai-studio-remixigamingseam-f254c3d9-f0b0-442c-9107-66d13db9b3fe"
};

// Use custom project credentials merged with base applet config
export const firebaseConfig = {
  ...baseAppletConfig,
  ...customFirebaseConfig,
  firestoreDatabaseId: "ai-studio-remixigamingseam-f254c3d9-f0b0-442c-9107-66d13db9b3fe"
};

export const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly'
];

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Ensure local persistence for seamless cross-refresh session retention
try {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('Firebase setPersistence notice:', err);
  });
} catch (e) {
  console.warn('Firebase persistence initialization error:', e);
}

export const FIRESTORE_DATABASE_ID = "ai-studio-remixigamingseam-f254c3d9-f0b0-442c-9107-66d13db9b3fe";

export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
}, FIRESTORE_DATABASE_ID);

export const googleAuthProvider = new GoogleAuthProvider();
SCOPES.forEach((scope) => {
  googleAuthProvider.addScope(scope);
});

// Flag to indicate if we are in the middle of a sign-in flow
let isSigningIn = false;
let cachedAccessToken: string | null = null;

type AuthSuccessCallback = (user: User, token: string) => void;
type AuthFailureCallback = () => void;

// Initialize auth state listener. Call this on app load or component mount.
export const initAuth = (
  onAuthSuccess?: AuthSuccessCallback,
  onAuthFailure?: AuthFailureCallback
) => {
  const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      try {
        const idToken = await user.getIdToken();
        cachedAccessToken = idToken;
        if (onAuthSuccess) {
          onAuthSuccess(user, idToken);
        }
      } catch (e) {
        if (!isSigningIn && onAuthFailure) {
          onAuthFailure();
        }
      }
    } else {
      cachedAccessToken = null;
      if (!isSigningIn && onAuthFailure) {
        onAuthFailure();
      }
    }
  });

  return unsubscribe;
};

// Real Google Sign-in with Firebase Auth
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleAuthProvider);
    const token = await result.user.getIdToken();
    cachedAccessToken = token;
    return { user: result.user, accessToken: token };
  } catch (error: any) {
    console.error('Firebase Google Sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Real Email/Password Registration
export const registerWithEmail = async (
  email: string,
  pass: string,
  displayName: string
): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    if (displayName) {
      await updateProfile(cred.user, { displayName });
    }
    const token = await cred.user.getIdToken();
    cachedAccessToken = token;
    return { user: cred.user, accessToken: token };
  } catch (error: any) {
    console.error('Firebase Email Register error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Real Email/Password Login
export const loginWithEmail = async (
  email: string,
  pass: string
): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const token = await cred.user.getIdToken();
    cachedAccessToken = token;
    return { user: cred.user, accessToken: token };
  } catch (error: any) {
    console.error('Firebase Email Login error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (e) {
    console.warn('Sign out error:', e);
  }
  cachedAccessToken = null;
};

