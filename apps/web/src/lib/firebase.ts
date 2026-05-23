import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, Auth } from 'firebase/auth';

let app: FirebaseApp | undefined;
let auth: Auth | undefined;

function getFirebaseApp(): FirebaseApp | null {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) return null;

  if (!app) {
    app = getApps().length
      ? getApps()[0]
      : initializeApp({
          apiKey,
          authDomain: process.env.NEXT_BLIC_FIREBASE_AUTH_DOMAIN,PU
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        });
  }
  return app;
}

export function getFirebaseAuth(): Auth | null {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  if (!auth) auth = getAuth(firebaseApp);
  return auth;
}

export async function signInWithGooglePopup(): Promise<string> {
  const firebaseAuth = getFirebaseAuth();
  if (!firebaseAuth) {
    throw new Error('Google sign-in is not configured. Add Firebase env vars to the web app.');
  }
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(firebaseAuth, provider);
  return result.user.getIdToken();
}
