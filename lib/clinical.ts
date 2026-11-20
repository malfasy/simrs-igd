import { BEDS, BOARDING_LIMIT, COMPLAINTS, ICD10, ICD9, LEVELS, MIN, ORDERS, TARIFF, targetMinutes } from './constants'
import type { BillItem, ComplaintKey, Patient, TraumaRecord, TriageColor, TriageLevel, VitalInput, Visit } from './types'

/* ---------- Format waktu ---------- */
export const pad = (n: number) => String(n).padStart(2, '0')
export const hm = (ts: number) => {
  const d = new Date(ts)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
export const dur = (ms: number) => {
  const m = Math.floor(Math.max(0, ms) / MIN)
  return m < 60 ? `${m} mnt` : `${Math.floor(m / 60)} j ${pad(m % 60)} mnt`
}
export const clock = (ms: number) => {
  const s = Math.floor(Math.max(0, ms) / 1000)
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}
export const toNum = (v: FormDataEntryValue | string | null | undefined): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = parseFloat(String(v).replace(',', '.'))
  return Number.isNaN(n) ? null : n
}
export const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0)
export const median = (a: number[]) => {
  if (!a.length) return 0
  const b = [...a].sort((x, y) => x - y)
  const m = Math.floor(b.length / 2)
  return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2
}
export const formatRm = (n: number) => {
  const s = String(n).padStart(6, '0')
  return `00.${s.slice(0, 2)}.${s.slice(2, 4)}.${s.slice(4, 6)}`
}

/* ---------- NEWS2 (Royal College of Physicians), skala SpO2 1 ---------- */
export function news2(x: VitalInput): { score: number; hasThree: boolean } {
  let score = 0
  let hasThree = false
  const add = (p: number) => {
    score += p
    if (p === 3) hasThree = true
  }
  const { rr, spo2, sys, hr, temp } = x
  add(rr <= 8 ? 3 : rr <= 11 ? 1 : rr <= 20 ? 0 : rr <= 24 ? 2 : 3)
  add(spo2 <= 91 ? 3 : spo2 <= 93 ? 2 : spo2 <= 95 ? 1 : 0)
  add(x.o2 ? 2 : 0)
  add(sys <= 90 ? 3 : sys <= 100 ? 2 : sys <= 110 ? 1 : sys <= 219 ? 0 : 3)
  add(hr <= 40 ? 3 : hr <= 50 ? 1 : hr <= 90 ? 0 : hr <= 110 ? 1 : hr <= 130 ? 2 : 3)
  // Kesadaran: penyederhanaan, GCS di bawah 15 dianggap bukan "Alert".
  add(x.gcs < 15 ? 3 : 0)
  add(temp <= 35 ? 3 : temp <= 36 ? 1 : temp <= 38 ? 0 : temp <= 39 ? 1 : 2)
  return { score, hasThree }
}

export type RiskClass = 'ok' | 'warn' | 'crit'
export function newsRisk(score: number, hasThree: boolean): { label: string; cls: RiskClass; advice: string } {
  if (score >= 7)
    return { label: 'Risiko tinggi', cls: 'crit', advice: 'Panggil dokter segera, pertimbangkan tim resusitasi.' }
  if (score >= 5) return { label: 'Risiko sedang', cls: 'warn', advice: 'Dokter menilai ulang segera, pantau lebih ketat.' }
  if (hasThree)
    return { label: 'Rendah-sedang', cls: 'warn', advice: 'Ada satu parameter bernilai 3, dokter menilai ulang.' }
  return { label: 'Risiko rendah', cls: 'ok', advice: 'Lanjutkan pemantauan rutin.' }
}

/* ---------- Saran level triase (berbasis aturan, adaptasi skala 5 level) ---------- */
export interface TriageSuggestion {
  level: TriageLevel
  reasons: { level: TriageLevel; text: string }[]
}
export function suggestLevel(x: Partial<Record<keyof VitalInput, number | boolean | null>>, complaint: ComplaintKey): TriageSuggestion {
  const reasons: { level: TriageLevel; text: string }[] = []
  let level: TriageLevel = 5
  const hit = (l: TriageLevel, text: string) => {
    reasons.push({ level: l, text })
    if (l < level) level = l
  }
  const n = (k: keyof VitalInput) => (typeof x[k] === 'number' ? (x[k] as number) : null)
  const c = COMPLAINTS.find((c) => c.key === complaint)
  if (c && c.level < 5) hit(c.level, `Keluhan: ${c.label}`)
  const gcs = n('gcs'), spo2 = n('spo2'), sys = n('sys'), hr = n('hr'), rr = n('rr'), temp = n('temp'), pain = n('pain')
  if (gcs !== null) {
    if (gcs <= 8) hit(1, `GCS ${gcs} (8 ke bawah)`)
    else if (gcs <= 13) hit(2, `GCS ${gcs} (9-13)`)
    else if (gcs === 14) hit(3, 'GCS 14')
  }
  if (spo2 !== null) {
    if (spo2 < 85) hit(1, `SpO₂ ${spo2}%`)
    else if (spo2 < 92) hit(2, `SpO₂ ${spo2}%`)
    else if (spo2 < 95) hit(3, `SpO₂ ${spo2}%`)
  }
  if (sys !== null) {
    if (sys < 80) hit(1, `TD sistolik ${sys}`)
    else if (sys < 90) hit(2, `TD sistolik ${sys}`)
    else if (sys >= 220) hit(2, `TD sistolik ${sys}`)
    else if (sys >= 180) hit(3, `TD sistolik ${sys}`)
  }
  if (hr !== null) {
    if (hr >= 150 || hr < 40) hit(1, `Nadi ${hr}/mnt`)
    else if (hr >= 130) hit(2, `Nadi ${hr}/mnt`)
    else if (hr >= 110 || hr < 50) hit(3, `Nadi ${hr}/mnt`)
  }
  if (rr !== null) {
    if (rr >= 35 || rr < 8) hit(1, `Napas ${rr}/mnt`)
    else if (rr >= 30) hit(2, `Napas ${rr}/mnt`)
    else if (rr >= 24) hit(3, `Napas ${rr}/mnt`)
  }
  if (temp !== null) {
    if (temp >= 40 || temp < 35) hit(2, `Suhu ${temp} °C`)
    else if (temp >= 38.5) hit(3, `Suhu ${temp} °C`)
  }
  if (pain !== null) {
    if (pain >= 8) hit(2, `Nyeri ${pain}/10`)
    else if (pain >= 5) hit(3, `Nyeri ${pain}/10`)
    else if (pain >= 1) hit(4, `Nyeri ${pain}/10`)
  }
  if (!reasons.length) reasons.push({ level: 5, text: 'Tanda vital dalam batas dan keluhan ringan' })
  reasons.sort((a, b) => a.level - b.level)
  return { level, reasons }
}

/* ---------- GCS dan Revised Trauma Score ---------- */
export const gcsTotal = (g: { e: number; v: number; m: number }) => (g.e || 0) + (g.v || 0) + (g.m || 0)
export function revisedTraumaScore(gcs: number, sys: number, rr: number) {
  const cg = gcs >= 13 ? 4 : gcs >= 9 ? 3 : gcs >= 6 ? 2 : gcs >= 4 ? 1 : 0
  const cs = sys > 89 ? 4 : sys >= 76 ? 3 : sys >= 50 ? 2 : sys >= 1 ? 1 : 0
  const cr = rr > 29 ? 3 : rr >= 10 ? 4 : rr >= 6 ? 2 : rr >= 1 ? 1 : 0
  return 0.9368 * cg + 0.7326 * cs + 0.2908 * cr
}

/* ---------- Turunan kunjungan ---------- */
export const displayName = (v: Visit) => (v.anonymous ? v.tempName ?? 'Tanpa nama' : v.patient.name)
export const displayRm = (v: Visit) => (v.anonymous ? v.tempRm ?? '-' : v.rm ?? '-')
export const ageSex = (v: Visit) =>
  `${v.patient.sex}${v.patient.age !== null ? ` · ${v.patient.ageEstimated ? '±' : ''}${v.patient.age} th` : ''}`
export const lastVital = (v: Visit) => (v.vitals.length ? v.vitals[v.vitals.length - 1] : null)
export const isChild = (v: Visit) => v.patient.age !== null && v.patient.age < 16
export const levelColor = (l: TriageLevel): TriageColor => LEVELS[l].color
export const isActive = (v: Visit) => v.status !== 'keluar' && !v.historic
export const isAlert = (v: Visit) => {
  const l = lastVital(v)
  return !!l && !isChild(v) && l.news >= 5 && v.status !== 'keluar'
}
export const areaOf = (v: Visit) => {
  if (!v.bed) return v.incidentId ? 'Zona korban massal' : 'Ruang tunggu'
  return BEDS.find((b) => b.id === v.bed)?.area ?? v.bed
}
export const freeBeds = (visits: Visit[]) => BEDS.filter((b) => !visits.some((v) => isActive(v) && v.bed === b.id))

/** Status waktu tunggu dokter: '' normal, 'near' mendekati target, 'over' lewat target. */
export function waitState(v: Visit, now: number): '' | 'near' | 'over' {
  if (!v.level || v.doctorSeenAt || v.status === 'keluar') return ''
  const w = now - v.arrivalTime
  const t = targetMinutes(v.level) * MIN
  if (w > t) return 'over'
  if (w > 0.75 * t) return 'near'
  return ''
}
export const isBoarding = (v: Visit, now: number) =>
  !!v.disposition && !v.leftAt && now - v.disposition.decidedAt > BOARDING_LIMIT * MIN

export function traumaActivation(t: TraumaRecord, v: Visit) {
  const l = lastVital(v)
  const g = gcsTotal(t.gcs)
  const physio: string[] = []
  if (l && l.sys < 90) physio.push(`TD sistolik ${l.sys}`)
  if (g <= 13) physio.push(`GCS ${g}`)
  if (l && (l.rr < 10 || l.rr > 29)) physio.push(`Napas ${l.rr}/mnt`)
  return { physio, gcs: g }
}

/* ---------- Pasien master ---------- */
/** Umur dalam tahun dari tanggal lahir (YYYY-MM-DD), atau umur yang dicatat. */
export function ageOf(p: Pick<Patient, 'birthDate' | 'age'>, at = Date.now()): number | null {
  if (p.birthDate) {
    const b = new Date(`${p.birthDate}T00:00:00`)
    if (!Number.isNaN(b.getTime())) {
      const n = new Date(at)
      let a = n.getFullYear() - b.getFullYear()
      if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--
      return Math.max(0, a)
    }
  }
  return p.age
}

/* ---------- Format tanggal dan uang ---------- */
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
export const tanggal = (ts: number) => {
  const d = new Date(ts)
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`
}
export const tanggalJam = (ts: number) => `${tanggal(ts)}, ${hm(ts)}`
export const tglPendek = (ts: number) => {
  const d = new Date(ts)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}
export const isoDate = (ts: number) => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
export const rupiah = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`

export const icd10Label = (code: string) => ICD10.find((d) => d[0] === code)?.[1] ?? code
export const icd9Label = (code: string) => ICD9.find((d) => d[0] === code)?.[1] ?? code
export const orderLabel = (key: string) => ORDERS.find((o) => o.key === key)?.label ?? key

/* ---------- Tagihan ---------- */
/** Rincian biaya otomatis dari layanan yang tercatat, ditambah item manual. */
export function computeBill(v: Visit): BillItem[] {
  if (v.billing?.payment) return v.billing.payment.items
  const items: BillItem[] = [{ id: 'karcis', group: 'Administrasi', name: 'Karcis dan administrasi IGD', qty: 1, price: TARIFF.karcis, auto: true }]
  if (v.doctorSeenAt && v.level)
    items.push({ id: 'periksa', group: 'Pemeriksaan', name: `Pemeriksaan dokter IGD (triase level ${v.level})`, qty: 1, price: TARIFF.pemeriksaan[v.level], auto: true })
  const a = v.assessment
  a?.procedures.forEach((c) => items.push({ id: `t-${c}`, group: 'Tindakan', name: `${icd9Label(c)} (${c})`, qty: 1, price: TARIFF.tindakan[c] ?? 0, auto: true }))
  a?.orders.forEach((k) => items.push({ id: `p-${k}`, group: 'Penunjang', name: orderLabel(k), qty: 1, price: TARIFF.penunjang[k] ?? 0, auto: true }))
  a?.drugs.forEach((d) => items.push({ id: `o-${d}`, group: 'Obat', name: d, qty: 1, price: TARIFF.obat[d] ?? 0, auto: true }))
  return [...items, ...(v.billing?.manual ?? [])]
}
export const billTotal = (items: BillItem[]) => items.reduce((s, i) => s + i.qty * i.price, 0)

export { complaintLabel } from './constants'
