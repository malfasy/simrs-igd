import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, initializeFirestore, type Firestore } from 'firebase/firestore'

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

/** True jika variabel Firebase sudah diisi di .env.local. Jika tidak, aplikasi memakai mode demo lokal. */
export const firebaseEnabled = Boolean(config.apiKey && config.projectId && config.appId)
export const firebaseProjectId = config.projectId ?? null

let cache: { app: FirebaseApp; auth: Auth; db: Firestore } | null = null

export function getFirebase() {
  if (!firebaseEnabled) return null
  if (cache) return cache
  const existing = getApps().length > 0
  const app = existing ? getApp() : initializeApp(config)
  // ignoreUndefinedProperties: field opsional yang bernilai undefined tidak membuat penulisan gagal.
  const db = existing ? getFirestore(app) : initializeFirestore(app, { ignoreUndefinedProperties: true })
  const auth = getAuth(app)
  cache = { app, auth, db }
  return cache
}
