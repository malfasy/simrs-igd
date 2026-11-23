// Semua operasi bisnis IGD. Komponen UI memanggil fungsi di sini, bukan menulis data langsung.
// Setiap fungsi: salin kunjungan, ubah, catat linimasa, simpan, lalu catat resource FHIR.

import {
  COLOR_LABEL,
  DISPO,
  LEVELS,
  MIN,
  ORDERS,
  PATHWAYS,
  REGIONS,
  SATUSEHAT_MODE,
  START_LEVEL,
} from './constants'
import { ageOf, billTotal, computeBill, displayName, formatRm, freeBeds, isoDate, lastVital, pad } from './clinical'
import { addEvent, clone, makeVital, newPatient, newTrauma, newVisit, toLog, uid } from './factory'
import {
  arrivalResources,
  assessmentResources,
  encounterStatusResource,
  finishResource,
  mtpResource,
  patientResource,
  resultResource,
  triageResource,
  vitalResources,
  type FhirDraft,
} from './fhir'
import type { DataStore } from './data/store'
import type {
  ArrivalMode,
  Assessment,
  BillGroup,
  OrderResult,
  Patient,
  PaymentMethod,
  Capacity,
  ComplaintKey,
  CpptNote,
  DispositionDetail,
  DispositionType,
  Incident,
  InsuranceType,
  Mist,
  PathwayKey,
  PreArrival,
  RegionKey,
  Sex,
  TraumaRecord,
  TriageColor,
  TriageLevel,
  UserProfile,
  Visit,
  VitalInput,
} from './types'

export interface Ctx {
  store: DataStore
  user: UserProfile
}

const me = (ctx: Ctx) => ctx.user.name

/* ---------- Satu Sehat ---------- */
async function recordFhir(ctx: Ctx, drafts: FhirDraft[]) {
  if (!drafts.length) return
  const at = Date.now()
  if (SATUSEHAT_MODE === 'sandbox') {
    try {
      const res = await fetch('/api/satusehat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resources: drafts.map((d) => d.resource) }),
      })
      const body = (await res.json()) as { results?: { ok: boolean; status: number; body: string }[]; error?: string }
      const results = body.results ?? []
      await ctx.store.addFhirLogs(
        drafts.map((d, i) => {
          const r = results[i]
          return toLog(d, at, r?.ok ? 'terkirim' : 'gagal', r ? `${r.status} ${r.body}`.slice(0, 2000) : body.error ?? `HTTP ${res.status}`)
        }),
      )
      return
    } catch (e) {
      await ctx.store.addFhirLogs(drafts.map((d) => toLog(d, at, 'gagal', (e as Error).message)))
      return
    }
  }
  await ctx.store.addFhirLogs(drafts.map((d) => toLog(d, at)))
}

async function commit(ctx: Ctx, v: Visit, drafts: FhirDraft[] = []) {
  v.updatedAt = Date.now()
  await ctx.store.saveVisit(v)
  await recordFhir(ctx, drafts)
  return v
}

const regNo = async (ctx: Ctx) => `IGD-${await ctx.store.nextNumber('reg')}`
const tempRm = async (ctx: Ctx) => `IGD-TMP-${String(await ctx.store.nextNumber('tmp')).padStart(4, '0')}`
const newRm = async (ctx: Ctx) => formatRm(await ctx.store.nextNumber('rm'))

/* ---------- Pendaftaran ---------- */
export interface RegisterInput {
  anonymous: boolean
  name: string
  nik: string
  sex: Sex
  age: number | null
  ageEstimated: boolean
  arrivalMode: ArrivalMode
  referral: boolean
  insurance: InsuranceType
  complaint: ComplaintKey
  complaintNote: string
  bed: string | null
}

/** Cari pasien lama berdasarkan NIK (16 digit) di data master. */
export const findOldPatient = (patients: Patient[], nik: string) => {
  const n = nik.trim()
  return n.length === 16 ? patients.find((p) => p.nik === n) ?? null : null
}

const snapshotOf = (p: Patient) => ({ name: p.name, nik: p.nik, sex: p.sex, age: ageOf(p), ageEstimated: !p.birthDate && p.age !== null })

export async function registerPatient(ctx: Ctx, input: RegisterInput, patients: Patient[], existingId?: string | null): Promise<Visit> {
  const old = input.anonymous ? null : existingId ? patients.find((p) => p.id === existingId) ?? null : findOldPatient(patients, input.nik)
  if (!input.anonymous && !input.name.trim() && !old) throw new Error('Nama pasien wajib diisi, atau centang "tanpa identitas".')
  if (!old && input.nik && !/^\d{16}$/.test(input.nik.trim())) throw new Error('NIK harus 16 digit angka.')
  const base = {
    regNo: await regNo(ctx),
    arrivalMode: input.arrivalMode,
    referral: input.referral,
    insurance: input.insurance,
    complaint: input.complaint,
    complaintNote: input.complaintNote.trim(),
    bed: input.bed,
    isTrauma: input.complaint === 'trauma',
    trauma: input.complaint === 'trauma' ? newTrauma() : null,
  }
  let v: Visit
  if (input.anonymous) {
    const t = await tempRm(ctx)
    v = newVisit({
      ...base,
      anonymous: true,
      tempRm: t,
      tempName: `${input.sex === 'P' ? 'Ny.' : 'Tn.'} X ${t.slice(-2)}`,
      patient: { name: '', nik: '', sex: input.sex, age: input.age, ageEstimated: true },
    })
  } else if (old) {
    v = newVisit({ ...base, patientId: old.id, rm: old.rm, patient: snapshotOf(old) })
  } else {
    const p = newPatient({ rm: await newRm(ctx), name: input.name.trim(), nik: input.nik.trim(), sex: input.sex, age: input.age, insurance: input.insurance })
    await ctx.store.savePatient(p)
    v = newVisit({ ...base, patientId: p.id, rm: p.rm, patient: { ...snapshotOf(p), ageEstimated: input.ageEstimated } })
  }
  addEvent(v, `Terdaftar di IGD oleh ${me(ctx)}${old ? ` (pasien lama ${old.rm})` : ''}`, me(ctx), v.arrivalTime)
  return commit(ctx, v, arrivalResources(v))
}

/* ---------- Pra-kedatangan ---------- */
export async function sendPrearrival(ctx: Ctx, input: { sex: Sex; age: number; etaMinutes: number; mist: Mist; from: string }) {
  const n = await ctx.store.nextNumber('pre')
  const p: PreArrival = {
    id: `PRE-${String(n).padStart(4, '0')}`,
    from: input.from || 'Ambulans',
    sentAt: Date.now(),
    eta: Date.now() + Math.max(1, input.etaMinutes) * MIN,
    sex: input.sex,
    age: input.age,
    mist: input.mist,
  }
  await ctx.store.savePrearrival(p)
  return p
}

export async function receivePrearrival(ctx: Ctx, p: PreArrival, visits: Visit[]): Promise<Visit> {
  const free = freeBeds(visits)
  const bed = free.find((b) => b.area === 'Resusitasi') ?? free[0] ?? null
  const t = await tempRm(ctx)
  const v = newVisit({
    regNo: await regNo(ctx),
    anonymous: true,
    tempRm: t,
    tempName: `${p.sex === 'P' ? 'Ny.' : 'Tn.'} X ${t.slice(-2)}`,
    patient: { name: '', nik: '', sex: p.sex, age: p.age, ageEstimated: true },
    arrivalMode: 'ambulans',
    complaint: 'trauma',
    complaintNote: p.mist.m,
    bed: bed?.id ?? null,
    isTrauma: true,
    trauma: { ...newTrauma(), mist: { ...p.mist } },
  })
  addEvent(v, `Tiba dengan ${p.from}, data MIST disalin dari pra-kedatangan`, me(ctx))
  await commit(ctx, v, arrivalResources(v))
  await ctx.store.deletePrearrival(p.id)
  return v
}

/* ---------- Triase ---------- */
export async function saveTriage(
  ctx: Ctx,
  v0: Visit,
  input: { complaint: ComplaintKey; complaintNote: string; vitals: VitalInput; level: TriageLevel; suggested: TriageLevel; reason: string },
) {
  if (input.level !== input.suggested && !input.reason.trim()) throw new Error('Level berbeda dari saran sistem. Isi alasannya dulu.')
  const v = clone(v0)
  const at = Date.now()
  v.complaint = input.complaint
  v.complaintNote = input.complaintNote.trim()
  const vs = makeVital(input.vitals, at, me(ctx))
  v.vitals.push(vs)
  const rec = {
    at,
    method: 'IGD' as const,
    level: input.level,
    color: LEVELS[input.level].color,
    suggested: input.suggested,
    reason: input.level !== input.suggested ? input.reason.trim() : null,
    by: me(ctx),
  }
  v.triage.push(rec)
  v.level = input.level
  v.color = LEVELS[input.level].color
  v.triagedAt = v.triagedAt ?? at
  if (v.status === 'terdaftar') v.status = 'tertriase'
  addEvent(v, `Triase level ${input.level} (${COLOR_LABEL[v.color]}) oleh ${me(ctx)}`, me(ctx), at)
  if (v.complaint === 'trauma' && !v.isTrauma) {
    v.isTrauma = true
    v.trauma = v.trauma ?? newTrauma()
    addEvent(v, 'Ditandai pasien trauma dari keluhan utama', me(ctx), at)
  }
  if (v.complaint === 'dada' && !v.pathways.stemi) {
    v.pathways.stemi = { activatedAt: at, done: {} }
    addEvent(v, 'Jalur STEMI diaktifkan dari triase', me(ctx), at)
  }
  if (v.complaint === 'stroke' && !v.pathways.stroke) {
    v.pathways.stroke = { activatedAt: at, done: {} }
    addEvent(v, 'Jalur stroke diaktifkan dari triase', me(ctx), at)
  }
  return commit(ctx, v, [triageResource(v, rec), vitalResources(v, vs)])
}

/* ---------- Dokter ---------- */
export async function startCare(ctx: Ctx, v0: Visit) {
  const v = clone(v0)
  v.doctorSeenAt = Date.now()
  v.doctor = me(ctx)
  if (v.status === 'terdaftar' || v.status === 'tertriase') v.status = 'ditangani'
  addEvent(v, `Mulai ditangani ${me(ctx)}`, me(ctx))
  return commit(ctx, v, [encounterStatusResource(v, 'in-progress')])
}

export async function saveAssessment(ctx: Ctx, v0: Visit, a: Omit<Assessment, 'updatedAt' | 'by'>) {
  if (!a.diagnoses.length) throw new Error('Pilih diagnosis utama dulu.')
  const v = clone(v0)
  const drafts: FhirDraft[] = []
  if (!v.doctorSeenAt) {
    v.doctorSeenAt = Date.now()
    v.doctor = me(ctx)
    if (v.status === 'terdaftar' || v.status === 'tertriase') v.status = 'ditangani'
    addEvent(v, `Mulai ditangani ${me(ctx)}`, me(ctx))
    drafts.push(encounterStatusResource(v, 'in-progress'))
  }
  const prev = v.assessment
  const next: Assessment = { ...a, updatedAt: Date.now(), by: me(ctx) }
  v.assessment = next
  next.orders.forEach((k) => {
    if (!v.results[k]) v.results[k] = { status: 'diminta', result: '', critical: false, requestedAt: next.updatedAt, updatedAt: next.updatedAt, by: me(ctx) }
  })
  const newOrders = next.orders.filter((o) => !(prev?.orders ?? []).includes(o)).length
  addEvent(v, `Asesmen disimpan${newOrders ? `, ${newOrders} order penunjang${next.cito ? ' CITO' : ''} dikirim` : ''}`, me(ctx))
  drafts.push(...assessmentResources(v, next, prev))
  await commit(ctx, v, drafts)
  return newOrders
}

export async function addCppt(ctx: Ctx, v0: Visit, note: Omit<CpptNote, 'at' | 'by'>) {
  if (!note.s.trim() && !note.o.trim() && !note.a.trim() && !note.p.trim()) throw new Error('Isi minimal satu bagian SOAP.')
  const v = clone(v0)
  v.cppt.push({ ...note, at: Date.now(), by: me(ctx) })
  addEvent(v, `CPPT ditambahkan oleh ${me(ctx)}`, me(ctx))
  return commit(ctx, v)
}

export async function activatePathway(ctx: Ctx, v0: Visit, key: PathwayKey) {
  const v = clone(v0)
  v.pathways[key] = { activatedAt: Date.now(), done: {} }
  addEvent(v, `Jalur ${PATHWAYS[key].name} diaktifkan`, me(ctx))
  return commit(ctx, v)
}

export async function completePathwayStep(ctx: Ctx, v0: Visit, key: PathwayKey, step: string) {
  const v = clone(v0)
  const st = v.pathways[key]
  if (!st) return v0
  st.done[step] = Date.now()
  const label = PATHWAYS[key].steps.find((s) => s[0] === step)?.[1] ?? step
  addEvent(v, `${label} selesai (jalur ${PATHWAYS[key].name})`, me(ctx))
  return commit(ctx, v)
}

/* ---------- Observasi ---------- */
export async function addVitals(ctx: Ctx, v0: Visit, input: VitalInput, source: 'manual' | 'monitor' = 'manual') {
  const v = clone(v0)
  const vs = makeVital(input, Date.now(), source === 'monitor' ? 'Monitor bedside' : me(ctx), source)
  v.vitals.push(vs)
  if (v.status === 'ditangani') v.status = 'observasi'
  addEvent(v, `${source === 'monitor' ? 'Tanda vital masuk dari monitor bedside (HL7 ORU^R01)' : 'Observasi tanda vital'}, NEWS2 ${vs.news}`, me(ctx))
  await commit(ctx, v, [vitalResources(v, vs)])
  return vs
}

/** Simulasi data monitor: tanda vital terakhir diberi variasi kecil. */
export function simulateMonitorReading(v: Visit): VitalInput {
  const l = lastVital(v) ?? { sys: 120, dia: 80, hr: 88, rr: 18, temp: 36.8, spo2: 97, gcs: 15, o2: false, pain: null }
  const j = (n: number, pct = 0.08) => Math.round(n + (Math.random() - 0.5) * n * pct)
  return {
    sys: j(l.sys),
    dia: j(l.dia),
    hr: j(l.hr),
    rr: Math.max(8, j(l.rr, 0.12)),
    temp: Math.round((l.temp + (Math.random() - 0.5) * 0.4) * 10) / 10,
    spo2: Math.min(100, j(l.spo2, 0.04)),
    gcs: l.gcs,
    o2: l.o2,
    pain: null,
  }
}

/* ---------- Identitas dan lokasi ---------- */
export async function mergeIdentity(ctx: Ctx, v0: Visit, input: { name: string; nik: string; age: number | null }, patients: Patient[]) {
  const old = findOldPatient(patients, input.nik)
  if (!input.name.trim() && !old) throw new Error('Nama wajib diisi.')
  if (input.nik && !/^\d{16}$/.test(input.nik.trim())) throw new Error('NIK harus 16 digit angka.')
  const v = clone(v0)
  const prevTemp = v.tempRm
  let p = old
  if (!p) {
    p = newPatient({ rm: await newRm(ctx), name: input.name.trim(), nik: input.nik.trim(), sex: v.patient.sex, age: input.age ?? v.patient.age, insurance: v.insurance })
    await ctx.store.savePatient(p)
  }
  v.anonymous = false
  v.patientId = p.id
  v.rm = p.rm
  v.patient = { ...snapshotOf(p), ageEstimated: !old && input.age === null ? v.patient.ageEstimated : false }
  addEvent(v, `Identitas ditemukan, ${prevTemp} digabung ke No. RM ${v.rm}${old ? ' (pasien lama)' : ''}`, me(ctx))
  const d = patientResource(v)
  d.summary = `Pasien teridentifikasi, digabung dari ${prevTemp}`
  return commit(ctx, v, [d])
}

/* ---------- Data master pasien ---------- */
export type PatientInput = Omit<Patient, 'id' | 'rm' | 'createdAt' | 'updatedAt'>

export async function savePatientRecord(ctx: Ctx, input: PatientInput, existing: Patient | null, patients: Patient[], visits: Visit[]) {
  if (!input.name.trim()) throw new Error('Nama pasien wajib diisi.')
  if (input.nik && !/^\d{16}$/.test(input.nik)) throw new Error('NIK harus 16 digit angka.')
  const dup = input.nik && patients.find((p) => p.nik === input.nik && p.id !== existing?.id)
  if (dup) throw new Error(`NIK ini sudah dipakai pasien ${dup.name} (No. RM ${dup.rm}).`)
  if (!input.birthDate && input.age === null) throw new Error('Isi tanggal lahir atau perkiraan umur.')
  const now = Date.now()
  const p: Patient = existing
    ? { ...existing, ...input, name: input.name.trim(), updatedAt: now }
    : newPatient({ ...input, name: input.name.trim(), rm: await newRm(ctx) })
  await ctx.store.savePatient(p)
  // Perbarui salinan identitas di kunjungan yang masih aktif.
  for (const v0 of visits.filter((x) => x.patientId === p.id && x.status !== 'keluar')) {
    const v = clone(v0)
    v.patient = snapshotOf(p)
    v.insurance = p.insurance
    v.updatedAt = now
    await ctx.store.saveVisit(v)
  }
  return p
}

export async function deletePatientRecord(ctx: Ctx, p: Patient) {
  if (ctx.user.role !== 'kepala') throw new Error('Hanya Kepala IGD yang bisa menghapus data pasien.')
  const vs = await ctx.store.visitsByPatient(p.id)
  if (vs.length) throw new Error(`Pasien ini punya ${vs.length} kunjungan. Data rekam medis yang sudah dipakai tidak boleh dihapus.`)
  await ctx.store.deletePatient(p.id)
}

/** Hapus pendaftaran yang salah input, hanya sebelum ada data klinis. */
export async function deleteRegistration(ctx: Ctx, v: Visit) {
  if (ctx.user.role !== 'kepala' && ctx.user.role !== 'pendaftaran') throw new Error('Hanya petugas pendaftaran atau Kepala IGD yang bisa menghapus pendaftaran.')
  // Petugas pendaftaran hanya boleh menghapus sebelum pasien ditriase. Kepala IGD boleh menghapus kunjungan apa pun (misalnya data uji coba).
  if (ctx.user.role !== 'kepala' && (v.status !== 'terdaftar' || v.triage.length || v.vitals.length)) throw new Error('Pendaftaran yang sudah ditriase hanya bisa dihapus Kepala IGD.')
  await ctx.store.deleteVisit(v.id)
  return true
}

export async function moveBed(ctx: Ctx, v0: Visit, bed: string | null) {
  if (bed === v0.bed) return v0
  const v = clone(v0)
  addEvent(v, `Pindah ${v.bed ? `dari bed ${v.bed}` : 'dari ruang tunggu'} ke ${bed ? `bed ${bed}` : 'ruang tunggu'}`, me(ctx))
  v.bed = bed
  return commit(ctx, v)
}

/* ---------- Ubah data pendaftaran (salah ketik, keluhan berubah, dll.) ---------- */
export interface RegistrationEdit {
  name: string
  sex: Sex
  age: number | null
  arrivalMode: ArrivalMode
  insurance: InsuranceType
  complaint: ComplaintKey
  complaintNote: string
}

export async function updateRegistration(ctx: Ctx, v0: Visit, input: RegistrationEdit, patients: Patient[]) {
  if (v0.status === 'keluar') throw new Error('Kunjungan yang sudah selesai tidak bisa diubah.')
  if (!v0.anonymous && !input.name.trim()) throw new Error('Nama pasien wajib diisi.')
  if (input.age !== null && (input.age < 0 || input.age > 130)) throw new Error('Umur tidak masuk akal.')
  const v = clone(v0)
  const changed: string[] = []
  const name = input.name.trim()
  if (!v.anonymous && name !== v.patient.name) changed.push('nama')
  if (input.sex !== v.patient.sex) changed.push('jenis kelamin')
  if (input.age !== v.patient.age) changed.push('umur')
  if (input.arrivalMode !== v.arrivalMode) changed.push('cara datang')
  if (input.insurance !== v.insurance) changed.push('penjamin')
  if (input.complaint !== v.complaint || input.complaintNote.trim() !== v.complaintNote) changed.push('keluhan')
  if (!changed.length) return v0

  v.patient = { ...v.patient, name: v.anonymous ? v.patient.name : name, sex: input.sex, age: input.age }
  v.arrivalMode = input.arrivalMode
  v.insurance = input.insurance
  v.complaint = input.complaint
  v.complaintNote = input.complaintNote.trim()
  if (input.complaint === 'trauma' && !v.isTrauma) {
    v.isTrauma = true
    v.trauma = v.trauma ?? newTrauma()
  }

  // Ikut perbarui data master pasien supaya kunjungan berikutnya memakai data yang benar.
  const master = !v.anonymous && v.patientId ? patients.find((p) => p.id === v.patientId) : null
  if (master) {
    await ctx.store.savePatient({
      ...master,
      name,
      sex: input.sex,
      age: master.birthDate ? master.age : input.age,
      insurance: input.insurance,
      updatedAt: Date.now(),
    })
  }

  addEvent(v, `Data pendaftaran diubah: ${changed.join(', ')}`, me(ctx))
  return commit(ctx, v, changed.some((c) => c === 'nama' || c === 'jenis kelamin' || c === 'umur') ? [patientResource(v)] : [])
}

/* ---------- Trauma ---------- */
export async function markTrauma(ctx: Ctx, v0: Visit) {
  const v = clone(v0)
  v.isTrauma = true
  v.trauma = v.trauma ?? newTrauma()
  addEvent(v, 'Ditandai sebagai pasien trauma', me(ctx))
  return commit(ctx, v)
}

export async function updateTrauma(ctx: Ctx, v0: Visit, patch: Partial<TraumaRecord>, eventText?: string) {
  const v = clone(v0)
  v.trauma = { ...(v.trauma ?? newTrauma()), ...patch }
  if (eventText) addEvent(v, eventText, me(ctx))
  return commit(ctx, v)
}

export async function addInjury(ctx: Ctx, v0: Visit, region: RegionKey, type: string) {
  const t = v0.trauma ?? newTrauma()
  return updateTrauma(ctx, v0, { injuries: [...t.injuries, { region, type, at: Date.now() }] }, `Cedera ditandai: ${REGIONS[region]}, ${type}`)
}

export async function removeInjury(ctx: Ctx, v0: Visit, index: number) {
  const t = v0.trauma ?? newTrauma()
  return updateTrauma(ctx, v0, { injuries: t.injuries.filter((_, i) => i !== index) })
}

export async function activateTraumaTeam(ctx: Ctx, v0: Visit, tier: 'penuh' | 'parsial') {
  return updateTrauma(ctx, v0, { teamActivatedAt: Date.now(), teamTier: tier }, `Tim trauma diaktifkan (${tier}): bedah, anestesi, radiologi dipanggil`)
}

export async function activateMtp(ctx: Ctx, v0: Visit) {
  const v = clone(v0)
  const at = Date.now()
  v.trauma = { ...(v.trauma ?? newTrauma()), mtpAt: at }
  addEvent(v, 'Protokol transfusi masif diaktifkan, permintaan dikirim ke bank darah', me(ctx), at)
  return commit(ctx, v, [mtpResource(v, at)])
}

/* ---------- Disposisi ---------- */
export async function decideDisposition(ctx: Ctx, v0: Visit, input: { type: DispositionType; note: string; detail: DispositionDetail }) {
  if (input.type === 'aps' && !input.detail.refusalSigned) throw new Error('Untuk pulang atas permintaan sendiri, formulir penolakan wajib ditandatangani.')
  if (input.type === 'rujuk' && !input.detail.referralTarget?.trim()) throw new Error('Isi RS tujuan rujukan.')
  const v = clone(v0)
  const d = input.detail
  const summary = {
    pulang: d.education,
    rawat_inap: d.room,
    rujuk: d.referralTarget,
    aps: 'Formulir penolakan ditandatangani',
    meninggal: `Jam ${d.timeOfDeath ?? '-'}${d.causeOfDeath ? `, ${d.causeOfDeath}` : ''}`,
  }[input.type]
  v.disposition = {
    type: input.type,
    decidedAt: Date.now(),
    decidedBy: me(ctx),
    note: [summary, input.note.trim()].filter(Boolean).join('. '),
    detail: input.detail,
  }
  v.status = 'menunggu_disposisi'
  addEvent(v, `Keputusan disposisi: ${DISPO[input.type]}${summary ? ` (${summary})` : ''}`, me(ctx))
  return commit(ctx, v)
}

export async function dischargeVisit(ctx: Ctx, v0: Visit) {
  if (!v0.disposition) throw new Error('Simpan keputusan disposisi dulu.')
  const v = clone(v0)
  v.leftAt = Date.now()
  v.status = 'keluar'
  const freed = v.bed
  v.bed = null
  addEvent(v, `Keluar IGD: ${DISPO[v.disposition!.type]}. Tagihan dikirim ke Kasir${freed ? `, bed ${freed} kosong` : ''}`, me(ctx))
  await commit(ctx, v, [finishResource(v)])
  return freed
}

/* ---------- Hasil penunjang ---------- */
export async function updateResult(ctx: Ctx, v0: Visit, key: string, patch: Pick<OrderResult, 'status' | 'result' | 'critical'>) {
  if (patch.status === 'selesai' && !patch.result.trim()) throw new Error('Isi hasil pemeriksaan sebelum menandai selesai.')
  const v = clone(v0)
  const prev = v.results[key]
  const now = Date.now()
  const r: OrderResult = { requestedAt: prev?.requestedAt ?? now, ...patch, result: patch.result.trim(), updatedAt: now, by: me(ctx) }
  v.results[key] = r
  const label = ORDERS.find((o) => o.key === key)?.label ?? key
  const drafts: FhirDraft[] = []
  if (r.status === 'selesai' && prev?.status !== 'selesai') {
    addEvent(v, `Hasil ${label} keluar${r.critical ? ' (NILAI KRITIS, dokter diberi tahu)' : ''}`, me(ctx))
    drafts.push(resultResource(v, key, r))
  } else if (r.status !== prev?.status) {
    addEvent(v, `${label}: status ${r.status}`, me(ctx))
  }
  return commit(ctx, v, drafts)
}

/* ---------- Tagihan ---------- */
export async function addBillItem(ctx: Ctx, v0: Visit, item: { group: BillGroup; name: string; qty: number; price: number }) {
  if (!item.name.trim()) throw new Error('Nama item wajib diisi.')
  if (item.qty <= 0 || item.price < 0) throw new Error('Jumlah dan harga tidak valid.')
  if (v0.billing.payment) throw new Error('Tagihan sudah dibayar, tidak bisa ditambah.')
  const v = clone(v0)
  v.billing.manual.push({ id: uid('B'), ...item, name: item.name.trim(), auto: false })
  return commit(ctx, v)
}

export async function removeBillItem(ctx: Ctx, v0: Visit, id: string) {
  if (v0.billing.payment) throw new Error('Tagihan sudah dibayar, tidak bisa diubah.')
  const v = clone(v0)
  v.billing.manual = v.billing.manual.filter((i) => i.id !== id)
  return commit(ctx, v)
}

export async function payBill(ctx: Ctx, v0: Visit, method: PaymentMethod) {
  if (v0.billing.payment) throw new Error('Tagihan sudah tercatat lunas.')
  const v = clone(v0)
  const items = computeBill(v)
  const now = Date.now()
  const no = await ctx.store.nextNumber('kw')
  v.billing.payment = { at: now, by: me(ctx), method, receiptNo: `KW-${isoDate(now).replace(/-/g, '')}-${String(no).padStart(4, '0')}`, total: billTotal(items), items }
  addEvent(v, method === 'BPJS' || method === 'Asuransi' ? `Tagihan ditagihkan ke ${method}` : `Pembayaran diterima (${method})`, me(ctx), now)
  return commit(ctx, v)
}

/* ---------- Korban massal ---------- */
export async function activateIncident(ctx: Ctx, input: { name: string; location: string; type: string; estimate: number }) {
  if (ctx.user.role !== 'kepala') throw new Error('Hanya Kepala IGD yang bisa mengaktifkan mode korban massal.')
  const inc: Incident = { id: uid('INC'), ...input, activatedAt: Date.now(), activatedBy: me(ctx), deactivatedAt: null }
  await ctx.store.saveMeta({ activeIncident: inc })
  return inc
}

export async function deactivateIncident(ctx: Ctx, current: Incident, past: Incident[]) {
  if (ctx.user.role !== 'kepala') throw new Error('Hanya Kepala IGD yang bisa menonaktifkan mode korban massal.')
  await ctx.store.saveMeta({ activeIncident: null, pastIncidents: [...past, { ...current, deactivatedAt: Date.now() }] })
}

export async function bulkRegisterVictims(ctx: Ctx, incident: Incident, n: number) {
  const count = Math.min(30, Math.max(1, Math.floor(n)))
  for (let i = 0; i < count; i++) {
    const no = await ctx.store.nextNumber('mci')
    const sex: Sex = Math.random() > 0.5 ? 'L' : 'P'
    const v = newVisit({
      regNo: await regNo(ctx),
      anonymous: true,
      tempName: `Korban ${pad(no)}`,
      tempRm: `MCI-${String(no).padStart(3, '0')}`,
      patient: { name: '', nik: '', sex, age: 18 + Math.floor(Math.random() * 55), ageEstimated: true },
      arrivalMode: 'ambulans',
      complaint: 'trauma',
      complaintNote: incident.name,
      incidentId: incident.id,
      isTrauma: true,
      trauma: newTrauma(),
    })
    addEvent(v, `Registrasi massal, gelang QR ${v.tempRm} dicetak`, me(ctx), v.arrivalTime)
    await commit(ctx, v, arrivalResources(v))
  }
  return count
}

export async function applyStartTriage(ctx: Ctx, v0: Visit, color: TriageColor) {
  const v = clone(v0)
  const at = Date.now()
  const level = START_LEVEL[color]
  const rec = { at, method: 'START' as const, level, color, suggested: null, reason: null, by: me(ctx) }
  v.triage.push(rec)
  v.level = level
  v.color = color
  v.triagedAt = v.triagedAt ?? at
  if (v.status === 'terdaftar') v.status = 'tertriase'
  addEvent(v, `Triase START: ${COLOR_LABEL[color]} oleh ${me(ctx)}`, me(ctx), at)
  return commit(ctx, v, [triageResource(v, rec)])
}

export async function updateCapacity(ctx: Ctx, current: Capacity, patch: Partial<Capacity>) {
  const next = { ...current, ...patch }
  next.orUsed = Math.min(next.orTotal, Math.max(0, next.orUsed))
  next.prc = Math.max(0, next.prc)
  await ctx.store.saveMeta({ capacity: next })
}

export function incidentSummary(incident: Incident, visits: Visit[], freeBedCount: number, totalBeds: number, cap: Capacity) {
  const vs = visits.filter((v) => v.incidentId === incident.id)
  const c = (k: TriageColor) => vs.filter((v) => v.color === k).length
  return [
    `Kejadian: ${incident.name} (${incident.type})`,
    `Lokasi: ${incident.location}`,
    `Mode aktif sejak: ${new Date(incident.activatedAt).toLocaleString('id-ID')}`,
    `Total korban di IGD: ${vs.length}`,
    `  Merah ${c('red')} | Kuning ${c('yellow')} | Hijau ${c('green')} | Hitam ${c('black')} | Belum dipilah ${vs.filter((v) => !v.color).length}`,
    `Teridentifikasi: ${vs.filter((v) => !v.anonymous).length}`,
    `Bed IGD kosong: ${freeBedCount}/${totalBeds}`,
    `Kamar operasi siap: ${cap.orTotal - cap.orUsed}/${cap.orTotal}`,
    `Stok PRC: ${cap.prc} kantong`,
  ].join('\n')
}

export const visitLabel = displayName