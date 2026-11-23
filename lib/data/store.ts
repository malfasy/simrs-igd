import type { AppData, CounterKey, FhirLogEntry, IgdMeta, Patient, PreArrival, Role, UserProfile, Visit } from '../types'

/**
 * Antarmuka penyimpanan data. Ada dua implementasi:
 * - LocalStore: localStorage browser (mode demo, tanpa setup).
 * - FirestoreStore: Cloud Firestore, realtime antar perangkat.
 * Komponen UI hanya bicara dengan antarmuka ini, jadi bisa berpindah mode tanpa mengubah UI.
 */
export interface DataStore {
  readonly mode: 'local' | 'firebase'
  subscribe(cb: () => void): () => void
  getSnapshot(): AppData
  /** Mulai mendengarkan perubahan data (dipanggil setelah pengguna login). */
  start(): void
  stop(): void
  saveVisit(v: Visit): Promise<void>
  /** Hapus kunjungan (hanya untuk pendaftaran yang salah input). */
  deleteVisit(id: string): Promise<void>
  /** Ambil satu kunjungan, termasuk yang sudah lama selesai dan tidak ada di daftar realtime. */
  getVisit(id: string): Promise<Visit | null>
  /** Kunjungan dalam rentang waktu kedatangan (untuk Riwayat Kunjungan). */
  queryVisits(from: number, to: number): Promise<Visit[]>
  /** Semua kunjungan milik satu pasien. */
  visitsByPatient(patientId: string): Promise<Visit[]>
  savePatient(p: Patient): Promise<void>
  deletePatient(id: string): Promise<void>
  /** Daftar petugas (akun). Mode lokal mengembalikan petugas contoh. */
  listStaff(): Promise<(UserProfile & { createdAt?: number })[]>
  updateStaffRole(uid: string, role: Role): Promise<void>
  savePrearrival(p: PreArrival): Promise<void>
  deletePrearrival(id: string): Promise<void>
  saveMeta(patch: Partial<IgdMeta>): Promise<void>
  addFhirLogs(entries: Omit<FhirLogEntry, 'id'>[]): Promise<void>
  nextNumber(key: CounterKey): Promise<number>
  loadSampleData(): Promise<void>
  clearAll(): Promise<void>
}

export const DEFAULT_META: IgdMeta = {
  activeIncident: null,
  pastIncidents: [],
  capacity: { orTotal: 3, orUsed: 1, prc: 24, staffCalled: 0 },
}

export const DEFAULT_COUNTERS: Record<CounterKey, number> = { rm: 184300, tmp: 12, reg: 1100, mci: 0, pre: 3, kw: 100 }

export const emptyData = (ready = false): AppData => ({
  ready,
  visits: [],
  patients: [],
  prearrivals: [],
  meta: DEFAULT_META,
  fhirLogs: [],
  error: null,
})

/** Penyimpan pendengar sederhana untuk useSyncExternalStore. */
export class Emitter {
  private listeners = new Set<() => void>()
  subscribe = (cb: () => void) => {
    this.listeners.add(cb)
    return () => {
      this.listeners.delete(cb)
    }
  }
  emit() {
    this.listeners.forEach((l) => l())
  }
}