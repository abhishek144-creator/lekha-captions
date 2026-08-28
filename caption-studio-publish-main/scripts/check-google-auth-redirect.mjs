import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const loginSource = fs.readFileSync(path.join(root, 'src/pages/Login.jsx'), 'utf8')
const authSource = fs.readFileSync(path.join(root, 'src/context/AuthContext.jsx'), 'utf8')
const firebaseSource = fs.readFileSync(path.join(root, 'src/lib/firebase.js'), 'utf8')
const netlifyHeaders = fs.readFileSync(path.join(root, 'public/_headers'), 'utf8')

const assertions = [
  {
    ok: /loginWithGoogle\(\{\s*consent:/s.test(loginSource),
    message: 'Signup must submit recorded consent to the Google authentication flow.',
  },
  {
    ok: /window\.localStorage\.setItem\(PENDING_CONSENT_KEY,\s*JSON\.stringify\(consent\)\)/s.test(authSource),
    message: 'Consent must be saved before redirecting to Google.',
  },
  {
    ok: /if \(preferRedirect\) \{\s*try \{\s*await signInWithRedirect\(auth, googleProvider\)\s*return \{ redirected: true \}/s.test(authSource),
    message: 'The auth provider must start Google redirect auth and return a redirect sentinel.',
  },
  {
    ok: /catch \(redirectError\)[\s\S]*transportFallbackCodes\.has\(redirectError\?\.code\)[\s\S]*finishPopupSignIn\(\)/s.test(authSource),
    message: 'Browsers that reject redirect transport must fall back to popup auth instead of retrying the same failed redirect.',
  },
  {
    ok: /catch \(popupError\)[\s\S]*transportFallbackCodes\.has\(popupError\?\.code\)[\s\S]*signInWithRedirect\(auth, googleProvider\)/s.test(authSource),
    message: 'Browsers that block popup auth must automatically fall back to same-tab redirect auth.',
  },
  {
    ok: /getRedirectResult\(auth\)[\s\S]*syncUserRecord\(result\.user\)/s.test(authSource),
    message: 'The returning Google redirect must finish account bootstrap.',
  },
  {
    ok: /googleProvider\.setCustomParameters\(\{\s*prompt:\s*['"]select_account['"],?\s*\}\)/s.test(firebaseSource),
    message: 'Google sign-in must show the account chooser so users can select a different email after signing out.',
  },
  {
    ok: /frame-src\s+'self'\s+https:\/\/www\.google\.com/s.test(netlifyHeaders),
    message: 'The deployed Netlify CSP must allow Firebase\'s same-origin auth iframe.',
  },
]

const failures = assertions.filter(({ ok }) => !ok)
if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure.message}`)
  process.exit(1)
}

console.log('Google signup redirect contract passed.')
