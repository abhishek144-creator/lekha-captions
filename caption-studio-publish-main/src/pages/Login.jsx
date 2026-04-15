import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
    const { loginWithGoogle, user } = useAuth();
    const navigate = useNavigate();
    const [loginError, setLoginError] = React.useState(null);
    const [isLoggingIn, setIsLoggingIn] = React.useState(false);

    React.useEffect(() => {
        if (user) {
            navigate('/Dashboard');
        }
    }, [user, navigate]);

    const handleGoogleLogin = async () => {
        setLoginError(null);
        setIsLoggingIn(true);
        try {
            await loginWithGoogle();
            navigate('/Dashboard');
        } catch (error) {
            console.error('Failed to log in', error);
            setLoginError(error?.message || 'Login failed. Please try again.');
        } finally {
            setIsLoggingIn(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
            <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl p-6 md:p-10 mx-4">
                <div className="text-center mb-10">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-2">
                        Welcome to Caption Studio
                    </h1>
                    <p className="text-gray-400 text-base">
                        Get started – it's free. No credit card needed.
                    </p>
                </div>

                {/* Login error */}
                {loginError && (
                    <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center">
                        {loginError}
                    </div>
                )}

                {/* Signup with Google */}
                <button
                    onClick={handleGoogleLogin}
                    disabled={isLoggingIn}
                    className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-white/20 rounded-lg bg-white/5 hover:bg-white/10 text-white font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    <svg className="w-5 h-5" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                        <path fill="none" d="M0 0h48v48H0z" />
                    </svg>
                    <span>Signup with Google</span>
                </button>

                {/* OR Divider */}
                <div className="my-8 flex items-center">
                    <span className="flex-1 border-b border-white/10"></span>
                    <span className="px-4 text-sm text-gray-500">Or</span>
                    <span className="flex-1 border-b border-white/10"></span>
                </div>

                {/* Email input */}
                <div className="space-y-4">
                    <input
                        type="email"
                        placeholder="name@company.com"
                        className="w-full px-4 py-3 border border-white/20 bg-white/5 rounded-lg focus:ring-2 focus:ring-[#F5A623] focus:border-[#F5A623] outline-none text-white placeholder-gray-500 text-base"
                    />
                    <button className="w-full bg-gradient-to-r from-[#F5A623] to-blue-600 hover:from-[#F5A623] hover:to-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors">
                        Continue
                    </button>
                </div>

                {/* Terms */}
                <div className="mt-8 text-center text-sm text-gray-500">
                    By proceeding, you agree to the<br />
                    <a href="#" className="text-[#F5A623] hover:underline">Terms of Service</a> and <a href="#" className="text-[#F5A623] hover:underline">Privacy Policy</a>
                </div>

                {/* Log in */}
                <div className="mt-10 text-center text-sm text-gray-400">
                    Already have an account? <button onClick={handleGoogleLogin} disabled={isLoggingIn} className="text-[#F5A623] font-medium hover:underline disabled:opacity-60">Log in</button>
                </div>
            </div>
        </div>
    );
}
