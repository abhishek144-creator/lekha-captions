// Test-server alias only. Never imported by the application build.
import { createContext, useContext, useState } from 'react'
const Context = createContext(null)
export const testUser = { uid: 'editor-test-a', email: 'editor@example.invalid', getIdToken: async () => 'local-test-token' }
export function AuthProvider({ children }) {
  const [currentUser, setUser] = useState(testUser)
  window.switchTestAccount = (uid) => setUser({ ...testUser, uid })
  return <Context.Provider value={{ currentUser, userData: { credits_remaining: 10, subscription_tier: 'pro', subscription_expiry: '2099-01-01' }, isLoadingAuth: false, refreshUserData: async () => {}, logout: async () => setUser(null) }}>{children}</Context.Provider>
}
export const useAuth = () => useContext(Context)
