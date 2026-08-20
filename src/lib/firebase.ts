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
  User
} from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly'
];

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const databaseId = (firebaseConfig as any).firestoreDatabaseId;
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, databaseId);

export const googleAuthProvider = new GoogleAuthProvider();
SCOPES.forEach((scope) => {
  googleAuthProvider.addScope(scope);
});

// Flag to indicate if we are in the middle of a sign-in flow
let isSigningIn = false;
let cachedAccessToken: string | null = null;

type AuthSuccessCallback = (user: User, token: string) => void;
type AuthFailureCallback = () => void;
const authSuccessListeners: AuthSuccessCallback[] = [];
const authFailureListeners: AuthFailureCallback[] = [];

// Initialize auth state listener. Call this on app load or component mount.
export const initAuth = (
  onAuthSuccess?: AuthSuccessCallback,
  onAuthFailure?: AuthFailureCallback
) => {
  if (onAuthSuccess) authSuccessListeners.push(onAuthSuccess);
  if (onAuthFailure) authFailureListeners.push(onAuthFailure);

  const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      try {
        const idToken = await user.getIdToken();
        cachedAccessToken = idToken;
        authSuccessListeners.forEach((cb) => cb(user, idToken));
      } catch (e) {
        if (!isSigningIn) {
          authFailureListeners.forEach((cb) => cb());
        }
      }
    } else {
      cachedAccessToken = null;
      if (!isSigningIn) {
        authFailureListeners.forEach((cb) => cb());
      }
    }
  });

  return () => {
    unsubscribe();
    if (onAuthSuccess) {
      const idx = authSuccessListeners.indexOf(onAuthSuccess);
      if (idx !== -1) authSuccessListeners.splice(idx, 1);
    }
    if (onAuthFailure) {
      const idx = authFailureListeners.indexOf(onAuthFailure);
      if (idx !== -1) authFailureListeners.splice(idx, 1);
    }
  };
};

// Real Google Sign-in with Firebase Auth
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleAuthProvider);
    const token = await result.user.getIdToken();
    cachedAccessToken = token;
    authSuccessListeners.forEach((cb) => cb(result.user, token));
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
    authSuccessListeners.forEach((cb) => cb(cred.user, token));
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
    authSuccessListeners.forEach((cb) => cb(cred.user, token));
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
  authFailureListeners.forEach((cb) => cb());
};

