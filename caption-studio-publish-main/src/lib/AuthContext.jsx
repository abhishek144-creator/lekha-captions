import React, { createContext, useState, useContext, useEffect } from 'react';
import { AuthProvider as FirebaseAuthProvider, useAuth as useFirebaseAuth } from '@/context/AuthContext';

const StubAuthContext = createContext();

// Check if Firebase is configured
const isFirebaseConfigured = !!import.meta.env.VITE_FIREBASE_API_KEY;

// Stub provider for local dev without Firebase
const StubAuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);

    useEffect(() => {
        setUser({
            id: 'guest',
            email: 'guest@captionstudio.io',
            displayName: 'Guest User',
            plan: 'pro',
            credits_remaining: 30,
            accessToken: 'mock-token',
            getIdToken: async () => 'mock-token',
        });
    }, []);

    const value = {
        currentUser: user,
        userData: user ? { credits_remaining: 30, subscription_tier: 'free' } : null,
        loginWithGoogle: async () => { console.warn('Firebase not configured'); return user; },
        logout: () => setUser(null),
        refreshUserData: async () => { },
        user,
        isAuthenticated: !!user,
        isLoadingAuth: !user,
        isLoadingPublicSettings: false,
        authError: null,
        navigateToLogin: () => { },
        checkAppState: () => { },
        appPublicSettings: null,
    };

    return (
        <StubAuthContext.Provider value={value}>
            {children}
        </StubAuthContext.Provider>
    );
};

export const AuthProvider = isFirebaseConfigured ? FirebaseAuthProvider : StubAuthProvider;

export const useAuth = isFirebaseConfigured
    ? useFirebaseAuth
    : () => {
        const context = useContext(StubAuthContext);
        if (!context) {
            throw new Error('useAuth must be used within an AuthProvider');
        }
        return context;
    };
