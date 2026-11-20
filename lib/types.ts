// Tipe data utama SIMRS IGD.
// Semua waktu disimpan sebagai epoch milidetik (number) agar sama di mode lokal dan Firestore.

export type Role = 'pendaftaran' | 'perawat' | 'dokter' | 'kepala'
export type TriageLevel = 1 | 2 | 3 | 4 | 5
export type TriageColor = 'red' | 'yellow' | 'green' | 'black'
export type VisitStatus =
  | 'terdaftar'
  | 'tertriase'
  | 'ditangani'
  | 'observasi'
  | 'menunggu_disposisi'
  | 'keluar'
export type ArrivalMode = 'sendiri' | 'keluarga' | 'ambulans' | 'polisi'
export type DispositionType = 'pulang' | 'rawat_inap' | 'rujuk' | 'aps' | 'meninggal'
export type Sex = 'L' | 'P'
export type ComplaintKey =
  | 'henti'
  | 'dada'
  | 'stroke'
  | 'kejang'
  | 'perdarahan'
  | 'trauma'
  | 'sesak'
  | 'perut'
  | 'demam'
  | 'luka'
  | 'ringan'
export type PathwayKey = 'stemi' | 'stroke' | 'sepsis'
export type RegionKey =
  | 'kepala'
  | 'leher'
  | 'dada'
  | 'perut'
  | 'pelvis'
  | 'lengan_ka'
  | 'tangan_ka'
  | 'lengan_ki'
  | 'tangan_ki'
  | 'paha_ka'
  | 'tungkai_ka'
  | 'paha_ki'
  | 'tungkai_ki'
export type FastKey = 'ruq' | 'luq' | 'pelvis' | 'perikard'
export type FastResult = 'Belum' | 'Negatif' | 'Positif' | 'Tidak jelas'
export type AbcdeKey = 'A' | 'B' | 'C' | 'D' | 'E'
export type AbcdeStatus = 'Belum dinilai' | 'Aman' | 'Bermasalah'
export type InsuranceType = 'Umum' | 'BPJS' | 'Asuransi swasta' | 'Belum diketahui'

/** Data master pasien (rekam medis). Satu pasien bisa punya banyak kunjungan IGD. */
export interface Patient {
  id: string
  rm: string
  nik: string
  name: string
  sex: Sex
  /** Format YYYY-MM-DD. Kosong jika tidak diketahui, umur dipakai sebagai gantinya. */
  birthDate: string
  age: number | null
  address: string
  phone: string
  bloodType: '' | 'A' | 'B' | 'AB' | 'O'
  allergies: string
  insurance: InsuranceType
  insuranceNo: string
  emergencyName: string
  emergencyRelation: string
  emergencyPhone: string
  createdAt: number
  updatedAt: number
}

export type OrderStatus = 'diminta' | 'diproses' | 'selesai'

export interface OrderResult {
  status: OrderStatus
  result: string
  critical: boolean
  requestedAt: number
  updatedAt: number
  by: string
}

export type BillGroup = 'Administrasi' | 'Pemeriksaan' | 'Tindakan' | 'Penunjang' | 'Obat' | 'Lainnya'

export interface BillItem {
  id: string
  group: BillGroup
  name: string
  qty: number
  price: number
  auto: boolean
}

export type PaymentMethod = 'Tunai' | 'Debit' | 'QRIS' | 'BPJS' | 'Asuransi'

export interface Payment {
  at: number
  by: string
  method: PaymentMethod
  receiptNo: string
  total: number
  items: BillItem[]
}

export interface Billing {
  manual: BillItem[]
  payment: Payment | null
}

export interface PatientInfo {
  name: string
  nik: string
  sex: Sex
  age: number | null
  ageEstimated: boolean
}

export interface VitalInput {
  sys: number
  dia: number
  hr: number
  rr: number
  temp: number
  spo2: number
  gcs: number
  o2: boolean
  pain: number | null
}

export interface VitalSign extends VitalInput {
  at: number
  source: 'manual' | 'monitor'
  news: number
  newsHasThree: boolean
  by: string
}

export interface TriageRecord {
  at: number
  method: 'IGD' | 'START'
  level: TriageLevel | null
  color: TriageColor
  suggested: TriageLevel | null
  reason: string | null
  by: string
}

export interface Assessment {
  anamnesis: string
  allergy: string
  exam: string
  diagnoses: string[]
  procedures: string[]
  orders: string[]
  cito: boolean
  drugs: string[]
  updatedAt: number
  by: string
}

export interface CpptNote {
  at: number
  s: string
  o: string
  a: string
  p: string
  by: string
}

export interface PathwayState {
  activatedAt: number
  done: Record<string, number>
}

export interface Injury {
  region: RegionKey
  type: string
  at: number
}

export interface AbcdeItem {
  status: AbcdeStatus
  note: string
}

export interface Mist {
  m: string
  i: string
  s: string
  t: string
}

export interface TraumaRecord {
  mist: Mist
  criteria: string[]
  abcde: Record<AbcdeKey, AbcdeItem>
  gcs: { e: number; v: number; m: number }
  injuries: Injury[]
  fast: Record<FastKey, FastResult>
  teamActivatedAt: number | null
  teamTier: 'penuh' | 'parsial' | null
  mtpAt: number | null
}

export interface DispositionDetail {
  education?: string
  room?: string
  referralTarget?: string
  refusalSigned?: boolean
  timeOfDeath?: string
  causeOfDeath?: string
}

export interface Disposition {
  type: DispositionType
  decidedAt: number
  decidedBy: string
  note: string
  detail: DispositionDetail
}

export interface TimelineEvent {
  at: number
  text: string
  by?: string
}

export interface Visit {
  id: string
  regNo: string
  /** Tautan ke data master pasien. Null untuk pasien yang belum teridentifikasi. */
  patientId: string | null
  rm: string | null
  tempRm: string | null
  anonymous: boolean
  tempName: string | null
  patient: PatientInfo
  arrivalTime: number
  arrivalMode: ArrivalMode
  referral: boolean
  insurance: InsuranceType
  complaint: ComplaintKey
  complaintNote: string
  status: VisitStatus
  bed: string | null
  doctor: string | null
  isTrauma: boolean
  incidentId: string | null
  level: TriageLevel | null
  color: TriageColor | null
  triagedAt: number | null
  doctorSeenAt: number | null
  triage: TriageRecord[]
  vitals: VitalSign[]
  assessment: Assessment | null
  cppt: CpptNote[]
  /** Hasil penunjang per kode order. */
  results: Record<string, OrderResult>
  billing: Billing
  pathways: Partial<Record<PathwayKey, PathwayState>>
  trauma: TraumaRecord | null
  disposition: Disposition | null
  leftAt: number | null
  events: TimelineEvent[]
  /** Data riwayat untuk Dashboard Mutu (tidak tampil di papan). */
  historic: boolean
  updatedAt: number
}

export interface PreArrival {
  id: string
  from: string
  sentAt: number
  eta: number
  sex: Sex
  age: number
  mist: Mist
}

export interface Incident {
  id: string
  name: string
  location: string
  type: string
  estimate: number
  activatedAt: number
  activatedBy: string
  deactivatedAt: number | null
}

export interface Capacity {
  orTotal: number
  orUsed: number
  prc: number
  staffCalled: number
}

export interface IgdMeta {
  activeIncident: Incident | null
  pastIncidents: Incident[]
  capacity: Capacity
}

export type FhirSendStatus = 'mock' | 'terkirim' | 'gagal'

export interface FhirLogEntry {
  id: string
  at: number
  resourceType: string
  summary: string
  patientLabel: string
  visitId: string | null
  /** Resource FHIR dalam bentuk JSON string (Firestore tidak mendukung array bersarang). */
  payload: string
  status: FhirSendStatus
  response: string | null
}

export interface UserProfile {
  uid: string
  name: string
  role: Role
  email: string | null
}

export interface AppData {
  ready: boolean
  visits: Visit[]
  patients: Patient[]
  prearrivals: PreArrival[]
  meta: IgdMeta
  fhirLogs: FhirLogEntry[]
  error: string | null
}

export type CounterKey = 'rm' | 'tmp' | 'reg' | 'mci' | 'pre' | 'kw'
