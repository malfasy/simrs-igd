import { news2 } from './clinical'
import type { FhirDraft } from './fhir'
import type { FhirLogEntry, Patient, TraumaRecord, Visit, VitalInput, VitalSign } from './types'

export const uid = (prefix = '') =>
  `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

export function newVisit(o: Partial<Visit> & { regNo: string }): Visit {
  const now = Date.now()
  return {
    id: uid('V'),
    patientId: null,
    rm: null,
    tempRm: null,
    anonymous: false,
    tempName: null,
    arrivalTime: now,
    arrivalMode: 'sendiri',
    referral: false,
    insurance: 'Umum',
    complaint: 'ringan',
    complaintNote: '',
    status: 'terdaftar',
    bed: null,
    doctor: null,
    isTrauma: false,
    incidentId: null,
    level: null,
    color: null,
    triagedAt: null,
    doctorSeenAt: null,
    triage: [],
    vitals: [],
    assessment: null,
    cppt: [],
    results: {},
    billing: { manual: [], payment: null },
    pathways: {},
    trauma: null,
    disposition: null,
    leftAt: null,
    events: [],
    historic: false,
    updatedAt: now,
    ...o,
    patient: { name: '', nik: '', sex: 'L', age: null, ageEstimated: false, ...(o.patient ?? {}) },
  }
}

export function newTrauma(): TraumaRecord {
  return {
    mist: { m: '', i: '', s: '', t: '' },
    criteria: [],
    abcde: {
      A: { status: 'Belum dinilai', note: '' },
      B: { status: 'Belum dinilai', note: '' },
      C: { status: 'Belum dinilai', note: '' },
      D: { status: 'Belum dinilai', note: '' },
      E: { status: 'Belum dinilai', note: '' },
    },
    gcs: { e: 4, v: 5, m: 6 },
    injuries: [],
    fast: { ruq: 'Belum', luq: 'Belum', pelvis: 'Belum', perikard: 'Belum' },
    teamActivatedAt: null,
    teamTier: null,
    mtpAt: null,
  }
}

export function makeVital(x: VitalInput, at: number, by: string, source: 'manual' | 'monitor' = 'manual'): VitalSign {
  const n = news2(x)
  return { ...x, at, by, source, news: n.score, newsHasThree: n.hasThree }
}

export function addEvent(v: Visit, text: string, by?: string, at = Date.now()) {
  v.events = [...v.events, { at, text, ...(by ? { by } : {}) }].sort((a, b) => a.at - b.at)
}

export function toLog(d: FhirDraft, at = Date.now(), status: FhirLogEntry['status'] = 'mock', response: string | null = null): Omit<FhirLogEntry, 'id'> {
  return {
    at,
    resourceType: d.resourceType,
    summary: d.summary,
    patientLabel: d.patientLabel,
    visitId: d.visitId,
    payload: JSON.stringify(d.resource, null, 2),
    status,
    response,
  }
}

/** Salinan dalam (deep clone) agar perubahan tidak mengubah objek state lama. */
export const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T

/** Lengkapi field yang belum ada pada dokumen lama (dibuat sebelum fitur baru ditambahkan). */
export function normalizeVisit(v: Visit): Visit {
  return {
    ...v,
    patientId: v.patientId ?? null,
    results: v.results ?? {},
    billing: { manual: v.billing?.manual ?? [], payment: v.billing?.payment ?? null },
    cppt: v.cppt ?? [],
    pathways: v.pathways ?? {},
    events: v.events ?? [],
    triage: v.triage ?? [],
    vitals: v.vitals ?? [],
  }
}

export function newPatient(o: Partial<Patient> & { rm: string; name: string }): Patient {
  const now = Date.now()
  return {
    id: uid('P'),
    nik: '',
    sex: 'L',
    birthDate: '',
    age: null,
    address: '',
    phone: '',
    bloodType: '',
    allergies: '',
    insurance: 'Umum',
    insuranceNo: '',
    emergencyName: '',
    emergencyRelation: '',
    emergencyPhone: '',
    createdAt: now,
    updatedAt: now,
    ...o,
  }
}
