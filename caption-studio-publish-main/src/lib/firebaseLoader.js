// Firebase (~370 KB) is loaded on demand so public pages can paint without it.
// Import Firebase through this loader everywhere the landing page can reach;
// a static `import ... from '@/lib/firebase'` there puts it back on the
// critical path (check-release-readiness.mjs guards the entry modules).
let firebaseModule = null
let loadedFirebase = null

export function loadFirebase() {
  // The alias (not './firebase') lets the local editor checks substitute
  // their Firebase double (e2e/fixtures/editorFirebase.js).
  firebaseModule ??= import('@/lib/firebase').then((module) => {
    loadedFirebase = module
    return module
  }, (error) => {
    // A failed chunk load (deploy, network) may succeed on the next attempt.
    firebaseModule = null
    throw error
  })
  return firebaseModule
}

// The Firebase module if something already loaded it, else null. Lets optional
// work (telemetry) skip itself instead of pulling Firebase in.
export function getLoadedFirebase() {
  return loadedFirebase
}
