import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { loadFirebase } from '../lib/firebaseLoader'
import { apiRequest } from '../lib/apiClient'
import { toast } from '@/components/ui/use-toast'

const AuthContext = createContext(undefined)
const PENDING_CONSENT_KEY = 'lekha.pendingConsent'
const RAZORPAY_REVIEW_MODE = import.meta.env.VITE_RAZORPAY_REVIEW_MODE === '1'
// The API refuses to create accounts for temporary/disposable inboxes.
const SIGNUP_REJECTED_CODE = 'signup_email_rejected'
// Marketing and legal pages paint first and restore the session once the
// browser is idle; login, editor and account routes need Firebase at once.
const DEFERRED_AUTH_PATHS = new Set([
    '/', '/home', '/homev2', '/faq', '/termsandconditions', '/privacypolicy',
    '/refundpolicy', '/acceptableusepolicy', '/helpandsupport', '/knownlimitations', '/changelog',
])

function runAuthStartup(start) {
    const path = window.location.pathname.toLowerCase().replace(/\/$/, '') || '/'
    if (!DEFERRED_AUTH_PATHS.has(path)) {
        start()
        return () => {}
    }
    if (typeof window.requestIdleCallback === 'function') {
        const handle = window.requestIdleCallback(start, { timeout: 3000 })
        return () => window.cancelIdleCallback(handle)
    }
    const timer = window.setTimeout(start, 1500)
    return () => window.clearTimeout(timer)
}

export function useAuth() {
    return useContext(AuthContext)
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null)
    const [userData, setUserData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [authError, setAuthError] = useState(null)
    const reviewSignInStartedRef = useRef(false)
    const rejectedSignupUidRef = useRef('')

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
        let result
        try {
            result = await apiRequest('/api/account-bootstrap', {
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
        } catch (error) {
            if (error?.data?.detail?.code !== SIGNUP_REJECTED_CODE) throw error
            // No account was created: end the Firebase session so the editor
            // never runs signed in without one, and say why once.
            const rejection = /** @type {Error & { signupRejected?: boolean }} */ (
                new Error(error.data.detail.message || 'This email address cannot be used to sign up.')
            )
            rejection.signupRejected = true
            if (rejectedSignupUidRef.current !== user.uid) {
                rejectedSignupUidRef.current = user.uid
                toast({ title: 'Sign-up blocked', description: rejection.message, variant: 'destructive' })
            }
            setAuthError(rejection)
            if (typeof window !== 'undefined') window.localStorage.removeItem(PENDING_CONSENT_KEY)
            const { auth, signOut } = await loadFirebase()
            await signOut(auth).catch(() => {})
            throw rejection
        }
        if (consent?.granted && typeof window !== 'undefined') {
            window.localStorage.removeItem(PENDING_CONSENT_KEY)
        }
        const serverUser = result.user || null
        setUserData(serverUser)
        return serverUser
    }

    const loginWithGoogle = async ({ preferRedirect = false, consent = null } = {}) => {
        // Already loaded on the login page, so the popup still opens within
        // the click's user activation.
        let firebase
        try {
            firebase = await loadFirebase()
        } catch (error) {
            setAuthError(error)
            throw error
        }
        const { auth, googleProvider, signInWithPopup, signInWithRedirect } = firebase
        const transportFallbackCodes = new Set([
            'auth/internal-error',
            'auth/popup-blocked',
            'auth/popup-closed-by-user',
            'auth/cancelled-popup-request',
            'auth/network-request-failed',
            'auth/operation-not-supported-in-this-environment',
            'auth/web-storage-unsupported',
        ])

        const finishPopupSignIn = async () => {
            const result = await signInWithPopup(auth, googleProvider)
            try {
                await syncUserRecord(result.user, consent)
            } catch (syncError) {
                if (syncError?.signupRejected) throw syncError
                console.warn('Signed in, but account setup is still pending:', syncError.message)
                setUserData({
                    uid: result.user.uid,
                    email: result.user.email || '',
                    displayName: result.user.displayName || '',
                    photoURL: result.user.photoURL || '',
                    // Entitlements are still being fetched from the server.
                    // Leave the balance unknown rather than incorrectly
                    // locking the three free exports in the editor.
                    credits_remaining: null,
                    subscription_tier: 'free',
                    bootstrap_pending: true,
                })
            }
            return result.user
        }

        try {
            setAuthError(null)
            if (!auth || !googleProvider) {
                throw new Error('Google sign-up is not configured. Please check the Firebase environment variables.')
            }

            if (consent?.granted && typeof window !== 'undefined') {
                window.localStorage.setItem(PENDING_CONSENT_KEY, JSON.stringify(consent))
            }

            if (preferRedirect) {
                try {
                    await signInWithRedirect(auth, googleProvider)
                    return { redirected: true }
                } catch (redirectError) {
                    // Some privacy-restricted browsers reject redirect auth
                    // before navigation. A popup remains a useful secondary
                    // transport in those environments.
                    if (!transportFallbackCodes.has(redirectError?.code)) throw redirectError
                    return await finishPopupSignIn()
                }
            }

            try {
                return await finishPopupSignIn()
            } catch (popupError) {
                if (!transportFallbackCodes.has(popupError?.code)) throw popupError
                await signInWithRedirect(auth, googleProvider)
                return { redirected: true }
            }
        } catch (error) {
            console.error('Google Sign In Error:', error)
            setAuthError(error)
            throw error
        }
    }

    const logout = async () => {
        const { auth, signOut } = await loadFirebase()
        return signOut(auth)
    }

    // Restores the session and follows sign-in changes; returns the unsubscribe.
    const watchAuth = ({ auth, getRedirectResult, onAuthStateChanged, signInAnonymously }) => {
        if (!auth) {
            setLoading(false)
            return () => {}
        }

        getRedirectResult(auth)
            .then(async (result) => {
                if (result?.user) {
                    try {
                        await syncUserRecord(result.user)
                    } catch (syncError) {
                        if (syncError?.signupRejected) return null
                        console.warn('Signed in after redirect, but account setup is still pending:', syncError.message)
                        setUserData({
                            uid: result.user.uid,
                            email: result.user.email || '',
                            displayName: result.user.displayName || '',
                            photoURL: result.user.photoURL || '',
                            // See the popup fallback above. The export panel
                            // refreshes this authoritative value on open.
                            credits_remaining: null,
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
                // A refused anonymous signup must not restart itself forever.
                if (!user && RAZORPAY_REVIEW_MODE && !rejectedSignupUidRef.current) {
                    if (reviewSignInStartedRef.current) return
                    reviewSignInStartedRef.current = true
                    signInAnonymously(auth)
                        .catch((error) => {
                            console.error('Razorpay review session could not start:', error)
                            setAuthError(error)
                            setLoading(false)
                        })
                    return
                }

                reviewSignInStartedRef.current = false
                setCurrentUser(user)
                setLoading(false)

                if (user) {
                    // Only clear a previous error once a user actually signed in —
                    // clearing unconditionally wiped redirect sign-in failures
                    // before the Login page could display them.
                    if (rejectedSignupUidRef.current !== user.uid) setAuthError(null)
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
    }

    useEffect(() => {
        let cancelled = false
        let unsubscribe = () => {}
        const cancelStartup = runAuthStartup(() => {
            loadFirebase()
                .then((firebase) => {
                    if (!cancelled) unsubscribe = watchAuth(firebase)
                })
                .catch((error) => {
                    console.error('Firebase Auth Init Error:', error)
                    if (cancelled) return
                    setLoading(false)
                    setAuthError(error)
                })
        })
        return () => {
            cancelled = true
            cancelStartup()
            unsubscribe()
        }
        // Subscribes once per mount; watchAuth only uses state setters and refs.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (typeof window === 'undefined') return undefined
        const handleForcedLogout = () => {
            loadFirebase()
                .then(({ auth, signOut }) => auth && signOut(auth))
                .catch((error) => {
                    console.warn('Failed to clear rejected Firebase session:', error.message)
                })
        }
        window.addEventListener('auth:logout', handleForcedLogout)
        return () => window.removeEventListener('auth:logout', handleForcedLogout)
    }, [])

    const refreshUserData = async () => {
        if (!currentUser) return
        // The account endpoint is the entitlement authority. Reading Firestore
        // directly can return a stale/offline cached document immediately after
        // signup or payment, which made valid credits look unavailable.
        try {
            return await syncUserRecord(currentUser)
        } catch (serverError) {
            // Keep the direct read only as an offline fallback for an already
            // initialized account. Do not replace a known server balance with
            // an empty cache result.
            const { db, doc, getDoc } = await loadFirebase()
            if (!db) throw serverError
            const userRef = doc(db, 'users', currentUser.uid)
            const userSnap = await getDoc(userRef)
            if (userSnap.exists()) {
                const cachedUser = userSnap.data()
                setUserData(cachedUser)
                return cachedUser
            }
            throw serverError
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
        isRazorpayReviewMode: RAZORPAY_REVIEW_MODE,
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}
