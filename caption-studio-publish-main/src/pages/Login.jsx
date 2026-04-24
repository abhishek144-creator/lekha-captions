import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

function GoogleIcon() {
    return (
        <svg className="w-5 h-5" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            <path fill="none" d="M0 0h48v48H0z" />
        </svg>
    );
}

export default function Login() {
    const { loginWithGoogle, user, authError } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const isLoginMode = searchParams.get('mode') === 'login';

    React.useEffect(() => {
        if (user) {
            navigate('/Dashboard');
        }
    }, [user, navigate]);

    const handleGoogleAuth = async () => {
        try {
            const result = await loginWithGoogle();
            if (!result?.redirected) {
                navigate('/Dashboard');
            }
        } catch (error) {
            console.error('Failed to authenticate', error);
        }
    };

    const setMode = (nextMode) => {
        if (nextMode === 'login') {
            setSearchParams({ mode: 'login' });
            return;
        }
        setSearchParams({});
    };

    const title = isLoginMode ? 'Welcome back to Caption Studio' : 'Welcome to Caption Studio';
    const subtitle = isLoginMode
        ? 'Log in with Google to continue editing your projects.'
        : 'Create your account with Google to start captioning right away.';
    const primaryCta = isLoginMode ? 'Log in with Google' : 'Sign up with Google';
    const emailPlaceholder = isLoginMode ? 'Email login is coming soon' : 'Email signup is coming soon';
    const helperText = isLoginMode
        ? 'Google sign-in works today. Email login is not enabled yet.'
        : 'Google sign-up works today. Email sign-up is not enabled yet.';

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-4">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-10 shadow-2xl">
                <div className="mb-6 flex rounded-xl bg-white/5 p-1">
                    <button
                        type="button"
                        onClick={() => setMode('signup')}
                        className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${!isLoginMode ? 'bg-white text-zinc-900' : 'text-gray-400 hover:text-white'}`}
                    >
                        Sign up
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('login')}
                        className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${isLoginMode ? 'bg-white text-zinc-900' : 'text-gray-400 hover:text-white'}`}
                    >
                        Log in
                    </button>
                </div>

                <div className="mb-10 text-center">
                    <h1 className="mb-2 text-3xl font-bold tracking-tight text-white">{title}</h1>
                    <p className="text-base text-gray-400">{subtitle}</p>
                </div>

                <button
                    type="button"
                    onClick={handleGoogleAuth}
                    className="w-full flex items-center justify-center gap-3 rounded-lg border border-white/20 bg-white/5 px-4 py-3 font-medium text-white transition-colors hover:bg-white/10"
                >
                    <GoogleIcon />
                    <span>{primaryCta}</span>
                </button>

                <div className="my-8 flex items-center">
                    <span className="flex-1 border-b border-white/10"></span>
                    <span className="px-4 text-sm text-gray-500">Or</span>
                    <span className="flex-1 border-b border-white/10"></span>
                </div>

                <div className="space-y-4">
                    <input
                        type="email"
                        disabled
                        placeholder={emailPlaceholder}
                        className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-white outline-none placeholder-gray-500 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <button
                        type="button"
                        onClick={handleGoogleAuth}
                        className="w-full rounded-lg bg-gradient-to-r from-[#F5A623] to-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:from-[#F5A623] hover:to-blue-700"
                    >
                        Continue with Google
                    </button>
                    <p className="text-center text-xs text-gray-500">{helperText}</p>
                </div>

                {authError && (
                    <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                        {authError.message || 'Authentication failed. Please try again.'}
                    </div>
                )}

                <div className="mt-8 text-center text-sm text-gray-500">
                    By proceeding, you agree to the<br />
                    <a href="#" className="text-[#F5A623] hover:underline">Terms of Service</a> and <a href="#" className="text-[#F5A623] hover:underline">Privacy Policy</a>
                </div>

                <div className="mt-10 text-center text-sm text-gray-400">
                    {isLoginMode ? (
                        <>Need an account? <button type="button" onClick={() => setMode('signup')} className="font-medium text-[#F5A623] hover:underline">Sign up</button></>
                    ) : (
                        <>Already have an account? <button type="button" onClick={() => setMode('login')} className="font-medium text-[#F5A623] hover:underline">Log in</button></>
                    )}
                </div>
            </div>
        </div>
    );
}
