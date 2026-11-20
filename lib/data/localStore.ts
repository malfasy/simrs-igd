import { DEMO_PEOPLE } from '../constants'
import { normalizeVisit } from '../factory'
import { buildSampleData } from '../seed'
import type { AppData, CounterKey, FhirLogEntry, IgdMeta, Patient, PreArrival, Role, UserProfile, Visit } from '../types'
import { DEFAULT_COUNTERS, DEFAULT_META, Emitter, emptyData, type DataStore } from './store'

const KEY = 'simrs-igd:data:v2'
const STAFF_KEY = 'simrs-igd:staff:v1'
const MAX_LOGS = 400

interface Persisted {
  visits: Visit[]
  patients: Patient[]
  prearrivals: PreArrival[]
  meta: IgdMeta
  fhirLogs: FhirLogEntry[]
  counters: Record<CounterKey, number>
}

/** Mode demo lokal: semua data disimpan di localStorage browser ini. */
export class LocalStore implements DataStore {
  readonly mode = 'local' as const
  private emitter = new Emitter()
  private state: AppData = emptyData(false)
  private counters: Record<CounterKey, number> = { ...DEFAULT_COUNTERS }
  private started = false
  subscribe = this.emitter.subscribe
  getSnapshot = () => this.state

  private onStorage = (e: StorageEvent) => {
    if (e.key === KEY) this.load()
  }

  start() {
    if (this.started || typeof window === 'undefined') return
    this.started = true
    const existed = !!this.read()
    this.load()
    if (!existed) void this.loadSampleData()
    window.addEventListener('storage', this.onStorage)
  }

  stop() {
    if (typeof window !== 'undefined') window.removeEventListener('storage', this.onStorage)
    this.started = false
  }

  private read(): Persisted | null {
    try {
      const raw = window.localStorage.getItem(KEY)
      return raw ? (JSON.parse(raw) as Persisted) : null
    } catch {
      return null
    }
  }

  private load() {
    const p = this.read()
    if (p) {
      this.counters = { ...DEFAULT_COUNTERS, ...p.counters }
      this.state = {
        ready: true,
        error: null,
        visits: (p.visits ?? []).map(normalizeVisit),
        patients: p.patients ?? [],
        prearrivals: p.prearrivals ?? [],
        meta: { ...DEFAULT_META, ...p.meta },
        fhirLogs: p.fhirLogs ?? [],
      }
    } else {
      this.state = { ...emptyData(true) }
    }
    this.emitter.emit()
  }

  private commit(next: Partial<AppData>) {
    this.state = { ...this.state, ...next, ready: true }
    try {
      const p: Persisted = {
        visits: this.state.visits,
        patients: this.state.patients,
        prearrivals: this.state.prearrivals,
        meta: this.state.meta,
        fhirLogs: this.state.fhirLogs.slice(0, MAX_LOGS),
        counters: this.counters,
      }
      window.localStorage.setItem(KEY, JSON.stringify(p))
    } catch {
      this.state = { ...this.state, error: 'Penyimpanan browser penuh atau tidak tersedia. Data hanya tersimpan sementara.' }
    }
    this.emitter.emit()
  }

  async saveVisit(v: Visit) {
    const exists = this.state.visits.some((x) => x.id === v.id)
    this.commit({ visits: exists ? this.state.visits.map((x) => (x.id === v.id ? v : x)) : [...this.state.visits, v] })
  }

  async deleteVisit(id: string) {
    this.commit({ visits: this.state.visits.filter((x) => x.id !== id) })
  }

  async getVisit(id: string) {
    return this.state.visits.find((v) => v.id === id) ?? null
  }

  async queryVisits(from: number, to: number) {
    return this.state.visits.filter((v) => v.arrivalTime >= from && v.arrivalTime <= to)
  }

  async visitsByPatient(patientId: string) {
    return this.state.visits.filter((v) => v.patientId === patientId)
  }

  async savePatient(p: Patient) {
    const exists = this.state.patients.some((x) => x.id === p.id)
    this.commit({ patients: exists ? this.state.patients.map((x) => (x.id === p.id ? p : x)) : [...this.state.patients, p] })
  }

  async deletePatient(id: string) {
    this.commit({ patients: this.state.patients.filter((x) => x.id !== id) })
  }

  private staffRoles(): Record<string, Role> {
    try {
      return JSON.parse(window.localStorage.getItem(STAFF_KEY) || '{}') as Record<string, Role>
    } catch {
      return {}
    }
  }

  async listStaff() {
    const overrides = this.staffRoles()
    return (Object.keys(DEMO_PEOPLE) as Role[]).map((r) => ({
      uid: `local-${r}`,
      name: DEMO_PEOPLE[r],
      role: overrides[`local-${r}`] ?? r,
      email: null,
    }))
  }

  async updateStaffRole(uid: string, role: Role) {
    try {
      window.localStorage.setItem(STAFF_KEY, JSON.stringify({ ...this.staffRoles(), [uid]: role }))
    } catch {
      /* abaikan */
    }
  }

  async savePrearrival(p: PreArrival) {
    this.commit({ prearrivals: [...this.state.prearrivals.filter((x) => x.id !== p.id), p] })
  }

  async deletePrearrival(id: string) {
    this.commit({ prearrivals: this.state.prearrivals.filter((x) => x.id !== id) })
  }

  async saveMeta(patch: Partial<IgdMeta>) {
    this.commit({ meta: { ...this.state.meta, ...patch } })
  }

  async addFhirLogs(entries: Omit<FhirLogEntry, 'id'>[]) {
    const withId = entries.map((e, i) => ({ ...e, id: `L${e.at.toString(36)}${i}${Math.random().toString(36).slice(2, 6)}` }))
    const all = [...withId, ...this.state.fhirLogs].sort((a, b) => b.at - a.at)
    this.commit({ fhirLogs: all })
  }

  async nextNumber(key: CounterKey) {
    this.counters[key] = (this.counters[key] ?? 0) + 1
    return this.counters[key]
  }

  async loadSampleData() {
    const s = buildSampleData()
    this.counters = { ...this.counters, ...s.counters }
    const logs = s.fhirLogs.map((e, i) => ({ ...e, id: `S${i}` })).sort((a, b) => b.at - a.at)
    this.commit({ visits: s.visits, patients: s.patients, prearrivals: s.prearrivals, fhirLogs: logs, meta: DEFAULT_META })
  }

  async clearAll() {
    this.counters = { ...DEFAULT_COUNTERS }
    this.commit({ visits: [], patients: [], prearrivals: [], fhirLogs: [], meta: DEFAULT_META })
  }
}

export type { UserProfile }
