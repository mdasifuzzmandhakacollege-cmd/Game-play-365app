import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  auth,
  googleSignIn as libGoogleSignIn,
  registerWithEmail as libRegisterWithEmail,
  loginWithEmail as libLoginWithEmail,
  logout as libLogout,
  initAuth
} from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  token: string | null;
  signInWithGoogle: () => Promise<User | null>;
  registerWithEmail: (email: string, pass: string, displayName: string) => Promise<User | null>;
  loginWithEmail: (email: string, pass: string) => Promise<User | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  token: null,
  signInWithGoogle: async () => null,
  registerWithEmail: async () => null,
  loginWithEmail: async () => null,
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = initAuth(
      (authUser, authToken) => {
        setUser(authUser);
        setToken(authToken);
        setLoading(false);
      },
      () => {
        setUser(null);
        setToken(null);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async (): Promise<User | null> => {
    try {
      setLoading(true);
      const res = await libGoogleSignIn();
      if (res) {
        setUser(res.user);
        setToken(res.accessToken);
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

  const registerWithEmail = async (email: string, pass: string, displayName: string): Promise<User | null> => {
    try {
      setLoading(true);
      const res = await libRegisterWithEmail(email, pass, displayName);
      if (res) {
        setUser(res.user);
        setToken(res.accessToken);
        return res.user;
      }
      return null;
    } catch (error: any) {
      console.error('Email Registration error:', error?.message || error);
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
        return res.user;
      }
      return null;
    } catch (error: any) {
      console.error('Email Login error:', error?.message || error);
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
    } catch (error) {
      console.warn('Sign Out error:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        token,
        signInWithGoogle,
        registerWithEmail,
        loginWithEmail,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

