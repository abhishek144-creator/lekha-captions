// Keep one authentication implementation in every environment. If Firebase is
// missing or invalid, the provider fails closed as a signed-out session.
export { AuthProvider, useAuth } from '@/context/AuthContext';
