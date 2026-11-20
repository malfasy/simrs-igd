import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  where,
  writeBatch,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore'
import { normalizeVisit } from '../factory'
import { buildSampleData } from '../seed'
import type { AppData, CounterKey, FhirLogEntry, IgdMeta, Patient, PreArrival, Role, UserProfile, Visit } from '../types'
import { DEFAULT_COUNTERS, DEFAULT_META, Emitter, emptyData, type DataStore } from './store'

/**
 * Struktur Firestore:
 *   users/{uid}            profil petugas (nama, peran)
 *   patients/{patientId}   data master pasien (rekam medis)
 *   visits/{visitId}       satu dokumen per kunjungan IGD
 *   prearrivals/{id}       notifikasi ambulans
 *   fhirLogs/{autoId}      log resource Satu Sehat
 *   meta/igd               mode korban massal + kapasitas
 *   meta/counters          penomoran RM, registrasi, dll
 */
const RECENT_HOURS = 24
const LOG_LIMIT = 300

export class FirestoreStore implements DataStore {
  readonly mode = 'firebase' as const
  private emitter = new Emitter()
  private state: AppData = emptyData(false)
  private unsubs: Unsubscribe[] = []
  private recent = new Map<string, Visit>()
  private activeVisits = new Map<string, Visit>()
  private loaded = { recent: false, active: false, pre: false, meta: false, logs: false, patients: false }
  subscribe = this.emitter.subscribe
  getSnapshot = () => this.state

  constructor(private db: Firestore) {}

  private set(next: Partial<AppData>) {
    const ready = Object.values(this.loaded).every(Boolean)
    this.state = { ...this.state, ...next, ready }
    this.emitter.emit()
  }

  private fail = (e: Error) => {
    const msg = /permission/i.test(e.message)
      ? 'Akses Firestore ditolak. Pastikan aturan keamanan (firestore.rules) sudah di-deploy dan akunmu punya profil petugas.'
      : `Gagal memuat data Firestore: ${e.message}`
    Object.keys(this.loaded).forEach((k) => (this.loaded[k as keyof typeof this.loaded] = true))
    this.set({ error: msg })
  }

  private mergeVisits() {
    const map = new Map(this.recent)
    this.activeVisits.forEach((v, k) => map.set(k, v))
    this.set({ visits: [...map.values()] })
  }

  start() {
    if (this.unsubs.length) return
    const since = Date.now() - RECENT_HOURS * 3600_000
    // Kunjungan 24 jam terakhir (untuk papan dan dashboard) ...
    this.unsubs.push(
      onSnapshot(
        query(collection(this.db, 'visits'), where('arrivalTime', '>=', since)),
        (snap) => {
          this.recent = new Map(snap.docs.map((d) => [d.id, normalizeVisit(d.data() as Visit)]))
          this.loaded.recent = true
          this.mergeVisits()
        },
        this.fail,
      ),
    )
    // ... ditambah pasien yang masih di IGD walaupun datang lebih dari 24 jam lalu.
    this.unsubs.push(
      onSnapshot(
        query(collection(this.db, 'visits'), where('status', '!=', 'keluar')),
        (snap) => {
          this.activeVisits = new Map(snap.docs.map((d) => [d.id, normalizeVisit(d.data() as Visit)]))
          this.loaded.active = true
          this.mergeVisits()
        },
        this.fail,
      ),
    )
    this.unsubs.push(
      onSnapshot(
        collection(this.db, 'patients'),
        (snap) => {
          this.loaded.patients = true
          this.set({ patients: snap.docs.map((d) => d.data() as Patient) })
        },
        this.fail,
      ),
    )
    this.unsubs.push(
      onSnapshot(
        collection(this.db, 'prearrivals'),
        (snap) => {
          this.loaded.pre = true
          this.set({ prearrivals: snap.docs.map((d) => d.data() as PreArrival) })
        },
        this.fail,
      ),
    )
    this.unsubs.push(
      onSnapshot(
        doc(this.db, 'meta', 'igd'),
        (snap) => {
          this.loaded.meta = true
          this.set({ meta: snap.exists() ? { ...DEFAULT_META, ...(snap.data() as Partial<IgdMeta>) } : DEFAULT_META })
        },
        this.fail,
      ),
    )
    this.unsubs.push(
      onSnapshot(
        query(collection(this.db, 'fhirLogs'), orderBy('at', 'desc'), limit(LOG_LIMIT)),
        (snap) => {
          this.loaded.logs = true
          this.set({ fhirLogs: snap.docs.map((d) => ({ ...(d.data() as Omit<FhirLogEntry, 'id'>), id: d.id })) })
        },
        this.fail,
      ),
    )
  }

  stop() {
    this.unsubs.forEach((u) => u())
    this.unsubs = []
    this.recent.clear()
    this.activeVisits.clear()
    this.loaded = { recent: false, active: false, pre: false, meta: false, logs: false, patients: false }
    this.state = emptyData(false)
    this.emitter.emit()
  }

  async saveVisit(v: Visit) {
    await setDoc(doc(this.db, 'visits', v.id), v)
  }

  async deleteVisit(id: string) {
    await deleteDoc(doc(this.db, 'visits', id))
  }

  async getVisit(id: string) {
    const live = this.state.visits.find((v) => v.id === id)
    if (live) return live
    const snap = await getDoc(doc(this.db, 'visits', id))
    return snap.exists() ? normalizeVisit(snap.data() as Visit) : null
  }

  async queryVisits(from: number, to: number) {
    const snap = await getDocs(query(collection(this.db, 'visits'), where('arrivalTime', '>=', from), where('arrivalTime', '<=', to)))
    return snap.docs.map((d) => normalizeVisit(d.data() as Visit))
  }

  async visitsByPatient(patientId: string) {
    const snap = await getDocs(query(collection(this.db, 'visits'), where('patientId', '==', patientId)))
    return snap.docs.map((d) => normalizeVisit(d.data() as Visit))
  }

  async savePatient(p: Patient) {
    await setDoc(doc(this.db, 'patients', p.id), p)
  }

  async deletePatient(id: string) {
    await deleteDoc(doc(this.db, 'patients', id))
  }

  async listStaff() {
    const snap = await getDocs(collection(this.db, 'users'))
    return snap.docs.map((d) => {
      const x = d.data() as Omit<UserProfile, 'uid'> & { createdAt?: number }
      return { uid: d.id, name: x.name, role: x.role, email: x.email ?? null, createdAt: x.createdAt }
    })
  }

  async updateStaffRole(uid: string, role: Role) {
    await setDoc(doc(this.db, 'users', uid), { role }, { merge: true })
  }

  async savePrearrival(p: PreArrival) {
    await setDoc(doc(this.db, 'prearrivals', p.id), p)
  }

  async deletePrearrival(id: string) {
    await deleteDoc(doc(this.db, 'prearrivals', id))
  }

  async saveMeta(patch: Partial<IgdMeta>) {
    await setDoc(doc(this.db, 'meta', 'igd'), patch, { merge: true })
  }

  async addFhirLogs(entries: Omit<FhirLogEntry, 'id'>[]) {
    for (let i = 0; i < entries.length; i += 450) {
      const batch = writeBatch(this.db)
      entries.slice(i, i + 450).forEach((e) => batch.set(doc(collection(this.db, 'fhirLogs')), e))
      await batch.commit()
    }
  }

  /** Penomoran aman dari bentrok antar perangkat memakai transaksi. */
  async nextNumber(key: CounterKey) {
    const ref = doc(this.db, 'meta', 'counters')
    return runTransaction(this.db, async (tx) => {
      const snap = await tx.get(ref)
      const cur = snap.exists() ? (snap.data() as Record<CounterKey, number>) : DEFAULT_COUNTERS
      const next = (cur[key] ?? DEFAULT_COUNTERS[key]) + 1
      tx.set(ref, { ...DEFAULT_COUNTERS, ...cur, [key]: next })
      return next
    })
  }

  private async writeAll(col: string, items: { id: string }[]) {
    for (let i = 0; i < items.length; i += 450) {
      const batch = writeBatch(this.db)
      items.slice(i, i + 450).forEach((it) => batch.set(doc(this.db, col, it.id), it))
      await batch.commit()
    }
  }

  private async deleteAll(col: string) {
    const snap = await getDocs(collection(this.db, col))
    for (let i = 0; i < snap.docs.length; i += 450) {
      const batch = writeBatch(this.db)
      snap.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref))
      await batch.commit()
    }
  }

  async loadSampleData() {
    const s = buildSampleData()
    await this.writeAll('patients', s.patients)
    await this.writeAll('visits', s.visits)
    await this.writeAll('prearrivals', s.prearrivals)
    await this.addFhirLogs(s.fhirLogs)
    await setDoc(doc(this.db, 'meta', 'counters'), { ...DEFAULT_COUNTERS, ...s.counters })
    await setDoc(doc(this.db, 'meta', 'igd'), DEFAULT_META)
  }

  async clearAll() {
    await this.deleteAll('visits')
    await this.deleteAll('patients')
    await this.deleteAll('prearrivals')
    await this.deleteAll('fhirLogs')
    await setDoc(doc(this.db, 'meta', 'igd'), DEFAULT_META)
    await setDoc(doc(this.db, 'meta', 'counters'), DEFAULT_COUNTERS)
  }
}
