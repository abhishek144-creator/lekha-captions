// Test-server alias only. Never imported by the application build.
import { createContext, useContext, useState } from 'react'
const Context = createContext(null)
export const testUser = { uid: 'editor-test-a', email: 'editor@example.invalid', getIdToken: async () => 'local-test-token' }
export function AuthProvider({ children }) {
  const [currentUser, setUser] = useState(testUser)
  const [userData, setUserData] = useState({ credits_remaining: 10, subscription_tier: 'pro', subscription_expiry: '2099-01-01' })
  window.setTestEntitlement = (next) => setUserData(next)
  window.switchTestAccount = (uid) => setUser({ ...testUser, uid })
  return <Context.Provider value={{ currentUser, userData, isLoadingAuth: false, refreshUserData: async () => {}, logout: async () => setUser(null) }}>{children}</Context.Provider>
}
export const useAuth = () => useContext(Context)
