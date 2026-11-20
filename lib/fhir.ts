// Pembentuk resource FHIR R4 untuk Satu Sehat.
// Kode LOINC triase (75910-0) dan cara datang (74286-6) diambil dari sumber sekunder;
// cocokkan dengan playbook modul IGD resmi Satu Sehat sebelum dipakai di produksi.

import { DISPO, DISPO_FHIR, ICD10, ICD9, LEVELS, MODES, ORDERS, COLOR_LABEL } from './constants'
import { displayName } from './clinical'
import type { Assessment, OrderResult, TriageRecord, Visit, VitalSign } from './types'

export const ORG_ID = process.env.NEXT_PUBLIC_SATUSEHAT_ORG_ID || '10000004'

export interface FhirDraft {
  resourceType: string
  summary: string
  patientLabel: string
  visitId: string | null
  resource: Record<string, unknown>
}

const iso = (ts: number) => new Date(ts).toISOString()

const subject = (v: Visit) =>
  v.anonymous || !v.rm
    ? { display: `${v.tempName ?? 'Pasien'} (belum teridentifikasi)` }
    : { reference: `Patient/P${v.rm.replace(/\./g, '')}`, display: v.patient.name }

const encounterRef = (v: Visit) => ({ reference: `Encounter/${v.regNo}` })

const draft = (v: Visit, resourceType: string, summary: string, resource: Record<string, unknown>): FhirDraft => ({
  resourceType,
  summary,
  patientLabel: displayName(v),
  visitId: v.id,
  resource,
})

export function patientResource(v: Visit): FhirDraft {
  return draft(v, 'Patient', `Data pasien (NIK ${v.patient.nik || '-'})`, {
    resourceType: 'Patient',
    identifier: [{ use: 'official', system: 'https://fhir.kemkes.go.id/id/nik', value: v.patient.nik }],
    name: [{ use: 'official', text: v.patient.name }],
    gender: v.patient.sex === 'P' ? 'female' : 'male',
  })
}

export function arrivalResources(v: Visit): FhirDraft[] {
  const out: FhirDraft[] = []
  if (!v.anonymous && v.patient.nik) out.push(patientResource(v))
  out.push(
    draft(v, 'Encounter', 'Kunjungan IGD dibuat, class EMER', {
      resourceType: 'Encounter',
      identifier: [{ system: `http://sys-ids.kemkes.go.id/encounter/${ORG_ID}`, value: v.regNo }],
      status: 'arrived',
      class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'EMER', display: 'emergency' },
      subject: subject(v),
      period: { start: iso(v.arrivalTime) },
      statusHistory: [{ status: 'arrived', period: { start: iso(v.arrivalTime) } }],
      serviceProvider: { reference: `Organization/${ORG_ID}` },
    }),
  )
  out.push(
    draft(v, 'Observation', `Cara datang: ${MODES[v.arrivalMode]}`, {
      resourceType: 'Observation',
      status: 'final',
      code: { coding: [{ system: 'http://loinc.org', code: '74286-6', display: 'Transport mode to hospital' }] },
      subject: subject(v),
      encounter: encounterRef(v),
      effectiveDateTime: iso(v.arrivalTime),
      valueCodeableConcept: { text: MODES[v.arrivalMode] },
    }),
  )
  return out
}

export function triageResource(v: Visit, t: TriageRecord): FhirDraft {
  const label = t.level ? `Level ${t.level} ${LEVELS[t.level].name}` : COLOR_LABEL[t.color]
  return draft(v, 'Observation', `Triase ${t.method === 'START' ? 'START ' + COLOR_LABEL[t.color] : 'level ' + t.level}`, {
    resourceType: 'Observation',
    status: 'final',
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'survey', display: 'Survey' }] }],
    code: { coding: [{ system: 'http://loinc.org', code: '75910-0', display: 'Canadian triage and acuity scale' }] },
    subject: subject(v),
    encounter: encounterRef(v),
    effectiveDateTime: iso(t.at),
    performer: [{ display: t.by }],
    valueCodeableConcept: { text: label },
  })
}

export function vitalResources(v: Visit, x: VitalSign): FhirDraft {
  const o = (code: string, display: string, value: number, unit: string) => ({
    resourceType: 'Observation',
    status: 'final',
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs' }] }],
    code: { coding: [{ system: 'http://loinc.org', code, display }] },
    subject: subject(v),
    encounter: encounterRef(v),
    effectiveDateTime: iso(x.at),
    valueQuantity: { value, unit, system: 'http://unitsofmeasure.org' },
  })
  return draft(v, 'Observation', `Tanda vital × 7 (TD ${x.sys}/${x.dia}, N ${x.hr}, SpO₂ ${x.spo2}%)`, {
    resourceType: 'Bundle',
    type: 'collection',
    entry: [
      o('8480-6', 'Systolic blood pressure', x.sys, 'mm[Hg]'),
      o('8462-4', 'Diastolic blood pressure', x.dia, 'mm[Hg]'),
      o('8867-4', 'Heart rate', x.hr, '/min'),
      o('9279-1', 'Respiratory rate', x.rr, '/min'),
      o('8310-5', 'Body temperature', x.temp, 'Cel'),
      o('59408-5', 'Oxygen saturation by pulse oximetry', x.spo2, '%'),
      o('9269-2', 'Glasgow coma score total', x.gcs, '{score}'),
    ].map((resource) => ({ resource })),
  })
}

export function encounterStatusResource(v: Visit, status: 'in-progress' | 'finished'): FhirDraft {
  const history: Record<string, unknown>[] = [{ status: 'arrived', period: { start: iso(v.arrivalTime), end: iso(v.doctorSeenAt ?? Date.now()) } }]
  if (status === 'in-progress') history.push({ status: 'in-progress', period: { start: iso(v.doctorSeenAt ?? Date.now()) } })
  return draft(v, 'Encounter', `Status kunjungan: ${status}`, {
    resourceType: 'Encounter',
    id: v.regNo,
    status,
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'EMER', display: 'emergency' },
    subject: subject(v),
    participant: v.doctor ? [{ individual: { display: v.doctor } }] : [],
    period: { start: iso(v.arrivalTime) },
    statusHistory: history,
  })
}

/** Resource untuk item asesmen yang baru (dibanding versi sebelumnya). */
export function assessmentResources(v: Visit, a: Assessment, prev: Assessment | null): FhirDraft[] {
  const out: FhirDraft[] = []
  const isNew = (list: string[], x: string) => !list.includes(x)
  a.diagnoses.filter((d) => isNew(prev?.diagnoses ?? [], d)).forEach((code) => {
    const d = ICD10.find((x) => x[0] === code)
    if (!d) return
    out.push(
      draft(v, 'Condition', `Diagnosis ${d[0]} ${d[1]}`, {
        resourceType: 'Condition',
        clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-category', code: 'encounter-diagnosis' }] }],
        code: { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10', code: d[0], display: d[1] }] },
        subject: subject(v),
        encounter: encounterRef(v),
        recordedDate: iso(a.updatedAt),
      }),
    )
  })
  a.procedures.filter((p) => isNew(prev?.procedures ?? [], p)).forEach((code) => {
    const p = ICD9.find((x) => x[0] === code)
    if (!p) return
    out.push(
      draft(v, 'Procedure', `Tindakan ${p[0]} ${p[1]}`, {
        resourceType: 'Procedure',
        status: 'completed',
        code: { coding: [{ system: 'http://hl7.org/fhir/sid/icd-9-cm', code: p[0], display: p[1] }] },
        subject: subject(v),
        encounter: encounterRef(v),
        performedDateTime: iso(a.updatedAt),
        performer: [{ actor: { display: a.by } }],
      }),
    )
  })
  a.orders.filter((o) => isNew(prev?.orders ?? [], o)).forEach((key) => {
    const r = ORDERS.find((x) => x.key === key)
    if (!r) return
    out.push(
      draft(v, 'ServiceRequest', `${r.label}${a.cito ? ' (CITO)' : ''}`, {
        resourceType: 'ServiceRequest',
        status: 'active',
        intent: 'order',
        priority: a.cito ? 'stat' : 'routine',
        code: { coding: [{ system: 'http://loinc.org', code: r.loinc, display: r.label }] },
        subject: subject(v),
        encounter: encounterRef(v),
        authoredOn: iso(a.updatedAt),
        requester: { display: a.by },
      }),
    )
  })
  const newDrugs = a.drugs.filter((d) => isNew(prev?.drugs ?? [], d))
  if (newDrugs.length)
    out.push(
      draft(v, 'MedicationRequest', `${newDrugs.length} item resep`, {
        resourceType: 'MedicationRequest',
        status: 'active',
        intent: 'order',
        subject: subject(v),
        encounter: encounterRef(v),
        authoredOn: iso(a.updatedAt),
        requester: { display: a.by },
        note: newDrugs.map((text) => ({ text })),
      }),
    )
  return out
}

export function mtpResource(v: Visit, at: number): FhirDraft {
  return draft(v, 'ServiceRequest', 'Protokol transfusi masif (stat)', {
    resourceType: 'ServiceRequest',
    status: 'active',
    intent: 'order',
    priority: 'stat',
    code: { text: 'Massive transfusion protocol' },
    subject: subject(v),
    encounter: encounterRef(v),
    authoredOn: iso(at),
  })
}

export function finishResource(v: Visit): FhirDraft {
  const d = v.disposition!
  const [code, display] = DISPO_FHIR[d.type]
  return draft(v, 'Encounter', `Kunjungan selesai: ${DISPO[d.type]}`, {
    resourceType: 'Encounter',
    id: v.regNo,
    status: 'finished',
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'EMER', display: 'emergency' },
    subject: subject(v),
    period: { start: iso(v.arrivalTime), end: iso(v.leftAt ?? Date.now()) },
    hospitalization: {
      dischargeDisposition: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/discharge-disposition', code, display }],
        text: d.note || DISPO[d.type],
      },
    },
  })
}

export function resultResource(v: Visit, key: string, r: OrderResult): FhirDraft {
  const o = ORDERS.find((x) => x.key === key)
  return draft(v, 'DiagnosticReport', `Hasil ${o?.label ?? key}${r.critical ? ' (nilai kritis)' : ''}`, {
    resourceType: 'DiagnosticReport',
    status: 'final',
    category: [
      {
        coding: [
          o?.unit === 'Radiologi'
            ? { system: 'http://terminology.hl7.org/CodeSystem/v2-0074', code: 'RAD', display: 'Radiology' }
            : { system: 'http://terminology.hl7.org/CodeSystem/v2-0074', code: 'LAB', display: 'Laboratory' },
        ],
      },
    ],
    code: { coding: [{ system: 'http://loinc.org', code: o?.loinc ?? key, display: o?.label ?? key }] },
    subject: subject(v),
    encounter: encounterRef(v),
    effectiveDateTime: iso(r.updatedAt),
    issued: iso(r.updatedAt),
    performer: [{ display: r.by }],
    conclusion: r.result,
  })
}
