import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  auth,
  googleSignIn as libGoogleSignIn,
  registerWithEmail as libRegisterWithEmail,
  loginWithEmail as libLoginWithEmail,
  logout as libLogout,
  initAuth
} from '../lib/firebase';
import { firebaseFirestore } from '../services/firebaseFirestoreService';
import { UserEntity } from '../server/types/seamless';

interface AuthContextType {
  user: User | null;
  firestoreUser: UserEntity | null;
  isAdmin: boolean;
  userRole: 'ADMIN' | 'PLAYER' | 'VIP';
  loading: boolean;
  token: string | null;
  signInWithGoogle: () => Promise<User | null>;
  registerWithEmail: (email: string, pass: string, displayName: string, preferredCurrency?: 'BDT' | 'USD') => Promise<User | null>;
  loginWithEmail: (email: string, pass: string) => Promise<User | null>;
  logout: () => Promise<void>;
  syncFirestoreProfile: (preferredCurrency?: 'BDT' | 'USD') => Promise<UserEntity | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  firestoreUser: null,
  isAdmin: false,
  userRole: 'PLAYER',
  loading: true,
  token: null,
  signInWithGoogle: async () => null,
  registerWithEmail: async () => null,
  loginWithEmail: async () => null,
  logout: async () => {},
  syncFirestoreProfile: async () => null,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [firestoreUser, setFirestoreUser] = useState<UserEntity | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Sync profile helper
  const syncFirestoreProfile = useCallback(async (preferredCurrency: 'BDT' | 'USD' = 'BDT'): Promise<UserEntity | null> => {
    const currentUser = auth.currentUser || user;
    if (!currentUser) return null;

    try {
      const profile = await firebaseFirestore.syncUserProfile({
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL,
        phoneNumber: currentUser.phoneNumber
      }, preferredCurrency);

      await firebaseFirestore.ensureUserWallet(currentUser.uid, preferredCurrency, 0);
      setFirestoreUser(profile);
      return profile;
    } catch (err) {
      console.warn('Firestore profile sync during auth notice:', err);
      return null;
    }
  }, [user]);

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = initAuth(
      async (authUser, authToken) => {
        if (!isMounted) return;
        setUser(authUser);
        setToken(authToken);

        try {
          localStorage.setItem('playall365_session_active', 'true');
          localStorage.setItem('playall365_user_id', authUser.uid);
        } catch {
          // Ignore localStorage errors
        }

        // Guarantee user doc & wallet exist in Firestore on session restoration or sign-up
        try {
          const profile = await firebaseFirestore.syncUserProfile({
            uid: authUser.uid,
            email: authUser.email,
            displayName: authUser.displayName,
            photoURL: authUser.photoURL,
            phoneNumber: authUser.phoneNumber
          }, 'BDT');
          await firebaseFirestore.ensureUserWallet(authUser.uid, 'BDT', 0);
          if (isMounted) {
            setFirestoreUser(profile);
          }
        } catch (syncErr) {
          console.warn('Background Firestore profile sync error on state change:', syncErr);
        }

        if (isMounted) {
          setLoading(false);
        }
      },
      () => {
        if (!isMounted) return;
        setUser(null);
        setToken(null);
        setFirestoreUser(null);
        setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const signInWithGoogle = async (): Promise<User | null> => {
    try {
      setLoading(true);
      const res = await libGoogleSignIn();
      if (res) {
        setUser(res.user);
        setToken(res.accessToken);
        try {
          localStorage.setItem('playall365_session_active', 'true');
          localStorage.setItem('playall365_user_id', res.user.uid);
        } catch {}

        // Ensure Firestore document & wallet are linked immediately with 0 initial balance
        try {
          const profile = await firebaseFirestore.syncUserProfile({
            uid: res.user.uid,
            email: res.user.email,
            displayName: res.user.displayName,
            photoURL: res.user.photoURL,
            phoneNumber: res.user.phoneNumber
          }, 'BDT');
          await firebaseFirestore.ensureUserWallet(res.user.uid, 'BDT', 0);
          setFirestoreUser(profile);
        } catch (err) {
          console.warn('Firestore sync during Google Sign In notice:', err);
        }

        return res.user;
      }
      return null;
    } catch (error: any) {
      console.error('Google Sign In error:', error?.message || error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const registerWithEmail = async (
    email: string,
    pass: string,
    displayName: string,
    preferredCurrency: 'BDT' | 'USD' = 'BDT'
  ): Promise<User | null> => {
    try {
      setLoading(true);
      const res = await libRegisterWithEmail(email, pass, displayName);
      if (res) {
        setUser(res.user);
        setToken(res.accessToken);
        try {
          localStorage.setItem('playall365_session_active', 'true');
          localStorage.setItem('playall365_user_id', res.user.uid);
        } catch {}

        // Ensure user document and initial wallet with 0 balance are linked in Firestore
        try {
          const profile = await firebaseFirestore.syncUserProfile({
            uid: res.user.uid,
            email: res.user.email || email,
            displayName: displayName || res.user.displayName,
            phoneNumber: res.user.phoneNumber
          }, preferredCurrency);
          await firebaseFirestore.ensureUserWallet(res.user.uid, preferredCurrency, 0);
          setFirestoreUser(profile);
        } catch (err) {
          console.warn('Firestore initial registration sync notice:', err);
        }

        return res.user;
      }
      return null;
    } catch (error: any) {
      console.warn('Email Registration notice:', error?.message || error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loginWithEmail = async (email: string, pass: string): Promise<User | null> => {
    try {
      setLoading(true);
      const res = await libLoginWithEmail(email, pass);
      if (res) {
        setUser(res.user);
        setToken(res.accessToken);
        try {
          localStorage.setItem('playall365_session_active', 'true');
          localStorage.setItem('playall365_user_id', res.user.uid);
        } catch {}

        try {
          const profile = await firebaseFirestore.syncUserProfile({
            uid: res.user.uid,
            email: res.user.email || email,
            displayName: res.user.displayName
          }, 'BDT');
          await firebaseFirestore.ensureUserWallet(res.user.uid, 'BDT', 0);
          setFirestoreUser(profile);
        } catch (err) {
          console.warn('Firestore login sync notice:', err);
        }

        return res.user;
      }
      return null;
    } catch (error: any) {
      console.warn('Email Login notice:', error?.message || error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await libLogout();
      setUser(null);
      setToken(null);
      setFirestoreUser(null);
      try {
        localStorage.removeItem('playall365_session_active');
        localStorage.removeItem('playall365_user_id');
      } catch {}
    } catch (error) {
      console.warn('Sign Out error:', error);
    }
  };

  const isAdmin = Boolean(
    firestoreUser?.isAdmin ||
    firestoreUser?.role === 'ADMIN' ||
    (firestoreUser?.role && String(firestoreUser.role).toUpperCase() === 'OPERATOR') ||
    (firestoreUser?.role && String(firestoreUser.role).toUpperCase() === 'SUPER_ADMIN')
  );

  const userRole: 'ADMIN' | 'PLAYER' | 'VIP' = isAdmin
    ? 'ADMIN'
    : (firestoreUser?.role as 'ADMIN' | 'PLAYER' | 'VIP') || 'PLAYER';

  return (
    <AuthContext.Provider
      value={{
        user,
        firestoreUser,
        isAdmin,
        userRole,
        loading,
        token,
        signInWithGoogle,
        registerWithEmail,
        loginWithEmail,
        logout,
        syncFirestoreProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

