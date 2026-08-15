import { createContext, useContext, useEffect, useState } from 'react'
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
    getDoc
} from '../lib/firebase'
import { apiRequest } from '../lib/apiClient'

const AuthContext = createContext()
const PENDING_CONSENT_KEY = 'lekha.pendingConsent'

export function useAuth() {
    return useContext(AuthContext)
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null)
    const [userData, setUserData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [authError, setAuthError] = useState(null)

    const syncUserRecord = async (user, consentOverride = null) => {
        const idToken = await user.getIdToken()
        let consent = consentOverride
        if (!consent && typeof window !== 'undefined') {
            try {
                consent = JSON.parse(window.localStorage.getItem(PENDING_CONSENT_KEY) || 'null')
            } catch {
                consent = null
            }
        }
        const result = await apiRequest('/api/account-bootstrap', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
                id_token: idToken,
                consent_granted: consent?.granted === true,
                terms_version: consent?.termsVersion || '',
                privacy_version: consent?.privacyVersion || '',
            }),
        })
        if (consent?.granted && typeof window !== 'undefined') {
            window.localStorage.removeItem(PENDING_CONSENT_KEY)
        }
        const serverUser = result.user || null
        setUserData(serverUser)
        return serverUser
    }

    const loginWithGoogle = async ({ preferRedirect = false, consent = null } = {}) => {
        try {
            setAuthError(null)
            if (!auth || !googleProvider) {
                throw new Error('Google sign-up is not configured. Please check the Firebase environment variables.')
            }

            if (consent?.granted && typeof window !== 'undefined') {
                window.localStorage.setItem(PENDING_CONSENT_KEY, JSON.stringify(consent))
            }

            if (preferRedirect) {
                await signInWithRedirect(auth, googleProvider)
                return { redirected: true }
            }

            const result = await signInWithPopup(auth, googleProvider)
            try {
                await syncUserRecord(result.user, consent)
            } catch (syncError) {
                console.warn('Signed in, but account setup is still pending:', syncError.message)
                setUserData({
                    uid: result.user.uid,
                    email: result.user.email || '',
                    displayName: result.user.displayName || '',
                    photoURL: result.user.photoURL || '',
                    credits_remaining: 0,
                    subscription_tier: 'free',
                    bootstrap_pending: true,
                })
            }
            return result.user
        } catch (error) {
            console.error('Google Sign In Error:', error)
            const fallbackCodes = new Set([
                // Some embedded/privacy-restricted browsers surface a blocked
                // Firebase popup transport as internal-error instead of the
                // more specific popup-blocked code. Redirect auth does not
                // depend on the popup channel and is the safe fallback.
                'auth/internal-error',
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
            .then(async (result) => {
                if (result?.user) {
                    try {
                        await syncUserRecord(result.user)
                    } catch (syncError) {
                        console.warn('Signed in after redirect, but account setup is still pending:', syncError.message)
                        setUserData({
                            uid: result.user.uid,
                            email: result.user.email || '',
                            displayName: result.user.displayName || '',
                            photoURL: result.user.photoURL || '',
                            credits_remaining: 0,
                            subscription_tier: 'free',
                            bootstrap_pending: true,
                        })
                    }
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

                if (user) {
                    // Only clear a previous error once a user actually signed in —
                    // clearing unconditionally wiped redirect sign-in failures
                    // before the Login page could display them.
                    setAuthError(null)
                    // Account defaults and credits are initialized by the API;
                    // the browser is never allowed to write entitlement fields.
                    syncUserRecord(user)
                        .catch((error) => {
                            console.warn('Failed to sync user data from Firestore:', error.message)
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

    useEffect(() => {
        if (!auth || typeof window === 'undefined') return undefined
        const handleForcedLogout = () => {
            signOut(auth).catch((error) => {
                console.warn('Failed to clear rejected Firebase session:', error.message)
            })
        }
        window.addEventListener('auth:logout', handleForcedLogout)
        return () => window.removeEventListener('auth:logout', handleForcedLogout)
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
