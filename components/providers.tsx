'use client'

import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { DEMO_PEOPLE } from '@/lib/constants'
import { FirestoreStore } from '@/lib/data/firestoreStore'
import { LocalStore } from '@/lib/data/localStore'
import { emptyData, type DataStore } from '@/lib/data/store'
import { firebaseEnabled, getFirebase } from '@/lib/firebase'
import type { AppData, Role, UserProfile, Visit } from '@/lib/types'
import type { Ctx } from '@/lib/actions'

/* ================= Data ================= */
let singleton: DataStore | null = null
function getStore(): DataStore {
  if (singleton) return singleton
  const fb = getFirebase()
  singleton = fb ? new FirestoreStore(fb.db) : new LocalStore()
  return singleton
}

const StoreContext = createContext<DataStore | null>(null)
const SERVER_SNAPSHOT = emptyData(false)

export function useStore() {
  const s = useContext(StoreContext)
  if (!s) throw new Error('useStore harus dipakai di dalam <Providers>')
  return s
}

export function useData(): AppData {
  const store = useStore()
  return useSyncExternalStore(store.subscribe, store.getSnapshot, () => SERVER_SNAPSHOT)
}

/* ================= Auth ================= */
/** Akun Firebase yang sudah login (misalnya lewat Google) tapi belum punya profil petugas. */
export interface PendingAccount {
  uid: string
  email: string | null
  displayName: string | null
}

interface AuthState {
  ready: boolean
  user: UserProfile | null
  pending: PendingAccount | null
  mode: 'local' | 'firebase'
  error: string | null
  loginGoogle(): Promise<void>
  completeProfile(input: { name: string; role: Role }): Promise<void>
  loginLocal(role: Role): void
  switchRole(role: Role): void
  login(email: string, password: string): Promise<void>
  register(input: { email: string; password: string; name: string; role: Role }): Promise<void>
  logout(): Promise<void>
}
const AuthContext = createContext<AuthState | null>(null)
export function useAuth() {
  const a = useContext(AuthContext)
  if (!a) throw new Error('useAuth harus dipakai di dalam <Providers>')
  return a
}

const LOCAL_ROLE_KEY = 'simrs-igd:role'
const localProfile = (role: Role): UserProfile => ({ uid: `local-${role}`, name: DEMO_PEOPLE[role], role, email: null })

function authMessage(e: unknown) {
  const code = (e as { code?: string }).code ?? ''
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return 'Email atau kata sandi salah.'
  if (code.includes('email-already-in-use')) return 'Email ini sudah terdaftar. Silakan masuk.'
  if (code.includes('weak-password')) return 'Kata sandi minimal 6 karakter.'
  if (code.includes('invalid-email')) return 'Format email tidak valid.'
  if (code.includes('operation-not-allowed')) return 'Login email/kata sandi belum diaktifkan di Firebase Console > Authentication.'
  if (code.includes('network')) return 'Tidak ada koneksi ke Firebase. Periksa internet.'
  if (code.includes('popup-closed-by-user') || code.includes('cancelled-popup-request')) return 'Jendela login Google ditutup sebelum selesai.'
  if (code.includes('popup-blocked')) return 'Popup login diblokir browser. Izinkan popup untuk situs ini lalu coba lagi.'
  if (code.includes('unauthorized-domain')) return 'Domain ini belum diizinkan. Tambahkan di Firebase Console > Authentication > Settings > Authorized domains.'
  if (code.includes('account-exists-with-different-credential')) return 'Email ini sudah terdaftar dengan cara login lain. Masuk dengan email dan kata sandi.'
  return (e as Error).message || 'Terjadi kesalahan.'
}

export function Providers({ children }: { children: ReactNode }) {
  const store = useMemo(getStore, [])
  const mode = store.mode
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingAccount | null>(null)
  // Saat mendaftar, profil baru ditulis setelah akun dibuat; jangan baca profil sebelum selesai.
  const registering = useRef(false)

  // Mode lokal: peran disimpan di localStorage.
  useEffect(() => {
    if (mode !== 'local') return
    try {
      const r = window.localStorage.getItem(LOCAL_ROLE_KEY) as Role | null
      if (r && r in DEMO_PEOPLE) setUser(localProfile(r))
    } catch {
      /* localStorage tidak tersedia */
    }
    setReady(true)
  }, [mode])

  // Mode Firebase: ikuti status login, lalu ambil profil petugas dari users/{uid}.
  useEffect(() => {
    if (mode !== 'firebase') return
    const fb = getFirebase()!
    return onAuthStateChanged(fb.auth, async (u) => {
      if (!u) {
        setUser(null)
        setPending(null)
        setReady(true)
        return
      }
      if (registering.current) return
      try {
        const snap = await getDoc(doc(fb.db, 'users', u.uid))
        if (snap.exists()) {
          const d = snap.data() as Omit<UserProfile, 'uid'>
          setUser({ uid: u.uid, name: d.name, role: d.role, email: u.email })
          setPending(null)
          setError(null)
        } else {
          // Login berhasil (misalnya lewat Google) tapi profil petugas belum ada: minta dilengkapi.
          setUser(null)
          setPending({ uid: u.uid, email: u.email, displayName: u.displayName })
        }
      } catch (e) {
        setUser(null)
        setError(`Gagal membaca profil: ${authMessage(e)}`)
      }
      setReady(true)
    })
  }, [mode])

  // Data hanya didengarkan setelah ada pengguna yang login.
  useEffect(() => {
    if (user) store.start()
    else if (mode === 'firebase') store.stop()
  }, [user, store, mode])

  const loginLocal = useCallback((role: Role) => {
    try {
      window.localStorage.setItem(LOCAL_ROLE_KEY, role)
    } catch {
      /* abaikan */
    }
    setUser(localProfile(role))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const fb = getFirebase()!
    setError(null)
    try {
      await signInWithEmailAndPassword(fb.auth, email.trim(), password)
    } catch (e) {
      throw new Error(authMessage(e))
    }
  }, [])

  const register = useCallback(async (input: { email: string; password: string; name: string; role: Role }) => {
    const fb = getFirebase()!
    setError(null)
    registering.current = true
    try {
      const cred = await createUserWithEmailAndPassword(fb.auth, input.email.trim(), input.password)
      await updateProfile(cred.user, { displayName: input.name })
      await setDoc(doc(fb.db, 'users', cred.user.uid), { name: input.name.trim(), role: input.role, email: input.email.trim(), createdAt: Date.now() })
      setUser({ uid: cred.user.uid, name: input.name.trim(), role: input.role, email: input.email.trim() })
      setReady(true)
    } catch (e) {
      throw new Error(authMessage(e))
    } finally {
      registering.current = false
    }
  }, [])

  const loginGoogle = useCallback(async () => {
    const fb = getFirebase()!
    setError(null)
    try {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })
      await signInWithPopup(fb.auth, provider)
    } catch (e) {
      throw new Error(authMessage(e))
    }
  }, [])

  const completeProfile = useCallback(
    async (input: { name: string; role: Role }) => {
      const fb = getFirebase()!
      if (!pending) throw new Error('Tidak ada akun yang menunggu profil.')
      if (!input.name.trim()) throw new Error('Nama wajib diisi.')
      try {
        await setDoc(doc(fb.db, 'users', pending.uid), { name: input.name.trim(), role: input.role, email: pending.email, createdAt: Date.now() })
        setUser({ uid: pending.uid, name: input.name.trim(), role: input.role, email: pending.email })
        setPending(null)
      } catch (e) {
        throw new Error(authMessage(e))
      }
    },
    [pending],
  )

  const logout = useCallback(async () => {
    if (mode === 'firebase') {
      await signOut(getFirebase()!.auth)
    } else {
      try {
        window.localStorage.removeItem(LOCAL_ROLE_KEY)
      } catch {
        /* abaikan */
      }
    }
    setUser(null)
    setPending(null)
  }, [mode])

  const auth: AuthState = {
    ready,
    user,
    pending,
    mode,
    error,
    loginGoogle,
    completeProfile,
    loginLocal,
    switchRole: loginLocal,
    login,
    register,
    logout,
  }

  return (
    <StoreContext.Provider value={store}>
      <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
    </StoreContext.Provider>
  )
}

/** Konteks untuk memanggil fungsi di lib/actions.ts. */
export function useCtx(): Ctx | null {
  const store = useStore()
  const { user } = useAuth()
  return useMemo(() => (user ? { store, user } : null), [store, user])
}

export const isFirebaseMode = firebaseEnabled

/**
 * Ambil satu kunjungan: dari data realtime jika ada, atau diambil sekali dari database
 * (untuk kunjungan lama yang sudah tidak ada di daftar realtime 24 jam).
 */
export function useVisit(id: string) {
  const data = useData()
  const store = useStore()
  const live = data.visits.find((v) => v.id === id) ?? null
  const [fetched, setFetched] = useState<{ id: string; v: Visit | null } | null>(null)
  useEffect(() => {
    if (live || !data.ready) return
    let cancel = false
    store.getVisit(id).then((v) => {
      if (!cancel) setFetched({ id, v })
    })
    return () => {
      cancel = true
    }
  }, [live, id, data.ready, store])
  const v = live ?? (fetched?.id === id ? fetched.v : null)
  const loading = !live && (!data.ready || fetched?.id !== id)
  return { v, loading }
}