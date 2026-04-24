import React, { createContext, useContext, useEffect, useState } from 'react'
import {
    auth,
    db,
    googleProvider,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    signOut,
    onAuthStateChanged,
    doc,
    getDoc,
    setDoc
} from '../lib/firebase'

const AuthContext = createContext()

export function useAuth() {
    return useContext(AuthContext)
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null)
    const [userData, setUserData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [authError, setAuthError] = useState(null)

    const syncUserRecord = async (user) => {
        const userRef = doc(db, 'users', user.uid)
        const userSnap = await getDoc(userRef)

        if (!userSnap.exists()) {
            const newUserDoc = {
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                credits_remaining: 3,
                subscription_tier: 'free',
                subscription_expiry: null,
                createdAt: new Date().toISOString()
            }
            await setDoc(userRef, newUserDoc)
            setUserData(newUserDoc)
            return newUserDoc
        }

        const existingUserDoc = userSnap.data()
        setUserData(existingUserDoc)
        return existingUserDoc
    }

    const loginWithGoogle = async ({ preferRedirect = false } = {}) => {
        try {
            setAuthError(null)

            if (preferRedirect) {
                await signInWithRedirect(auth, googleProvider)
                return { redirected: true }
            }

            const result = await signInWithPopup(auth, googleProvider)
            await syncUserRecord(result.user)
            return result.user
        } catch (error) {
            console.error('Google Sign In Error:', error)
            const fallbackCodes = new Set([
                'auth/popup-blocked',
                'auth/popup-closed-by-user',
                'auth/cancelled-popup-request',
            ])

            if (fallbackCodes.has(error?.code)) {
                await signInWithRedirect(auth, googleProvider)
                return { redirected: true }
            }

            setAuthError(error)
            throw error
        }
    }

    const logout = () => signOut(auth)

    useEffect(() => {
        if (!auth) {
            setLoading(false)
            return
        }

        getRedirectResult(auth)
            .then((result) => {
                if (result?.user) {
                    return syncUserRecord(result.user)
                }
                return null
            })
            .catch((error) => {
                console.warn('Google redirect sign-in failed:', error.message)
                setAuthError(error)
            })

        try {
            const unsubscribe = onAuthStateChanged(auth, (user) => {
                setCurrentUser(user)
                setLoading(false)
                setAuthError(null)

                if (user) {
                    const userRef = doc(db, 'users', user.uid)
                    getDoc(userRef)
                        .then((userSnap) => {
                            if (userSnap.exists()) {
                                setUserData(userSnap.data())
                            }
                        })
                        .catch((error) => {
                            console.warn('Failed to fetch user data from Firestore:', error.message)
                        })
                } else {
                    setUserData(null)
                }
            })

            return unsubscribe
        } catch (error) {
            console.error('Firebase Auth Init Error:', error)
            setLoading(false)
            setAuthError(error)
            return () => {}
        }
    }, [])

    const refreshUserData = async () => {
        if (!currentUser) return
        const userRef = doc(db, 'users', currentUser.uid)
        const userSnap = await getDoc(userRef)
        if (userSnap.exists()) {
            setUserData(userSnap.data())
        }
    }

    const value = {
        currentUser,
        userData,
        loginWithGoogle,
        logout,
        refreshUserData,
        user: currentUser,
        isAuthenticated: !!currentUser,
        isLoadingAuth: loading,
        isLoadingPublicSettings: false,
        authError,
        navigateToLogin: () => {},
        checkAppState: () => {},
        appPublicSettings: null,
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}
