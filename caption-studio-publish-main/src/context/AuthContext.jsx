import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged, doc, getDoc, setDoc } from '../lib/firebase';

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [userData, setUserData] = useState(null); // Holds credits & subscription from Firestore
    const [loading, setLoading] = useState(true);

    // Sign in with Google
    const loginWithGoogle = async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;

            // Check if user document exists in Firestore
            const userRef = doc(db, 'users', user.uid);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {
                // First time login! Create their document with 3 credits free tier
                const newUserDoc = {
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    credits_remaining: 3,
                    subscription_tier: 'free', // 'free', 'weekly', 'monthly'
                    subscription_expiry: null,
                    createdAt: new Date().toISOString()
                };
                await setDoc(userRef, newUserDoc);
                setUserData(newUserDoc);
            } else {
                setUserData(userSnap.data());
            }
            return user;
        } catch (error) {
            console.error("Google Sign In Error:", error);
            throw error;
        }
    };

    const logout = () => {
        return signOut(auth);
    };

    // Watch Authentication State
    useEffect(() => {
        if (!auth) {
            // Firebase not configured, skip auth listening
            setLoading(false);
            return;
        }

        try {
            const unsubscribe = onAuthStateChanged(auth, (user) => {
                setCurrentUser(user);
                // Unblock the app immediately — don't wait for Firestore
                setLoading(false);


                if (user) {
                    // Fetch Firestore data in the background (non-blocking)
                    const userRef = doc(db, 'users', user.uid);
                    getDoc(userRef)
                        .then((userSnap) => {
                            if (userSnap.exists()) {
                                setUserData(userSnap.data());
                            }
                        })
                        .catch((error) => {
                            console.warn('Failed to fetch user data from Firestore:', error.message);
                        });
                } else {
                    setUserData(null);
                }
            });

            return unsubscribe;
        } catch (err) {
            console.error('Firebase Auth Init Error:', err);
            setLoading(false);
            return () => { };
        }
    }, []);

    // Force a refresh of user data (useful after a Razorpay payment succeeds)
    const refreshUserData = async () => {
        if (currentUser) {
            const userRef = doc(db, 'users', currentUser.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                setUserData(userSnap.data());
            }
        }
    };

    const value = {
        currentUser,
        userData,
        loginWithGoogle,
        logout,
        refreshUserData,
        // Additional properties expected by App.jsx
        user: currentUser,
        isAuthenticated: !!currentUser,
        isLoadingAuth: loading,
        isLoadingPublicSettings: false,
        authError: null,
        navigateToLogin: () => { },
        checkAppState: () => { },
        appPublicSettings: null,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
