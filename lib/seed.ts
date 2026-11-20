// Data contoh untuk demo. Dipanggil dari tombol "Muat data contoh". Semua nama, NIK, dan alamat fiktif.

import { DISPO, LEVELS, MIN, MODES, PATHWAYS } from './constants'
import { computeBill, formatRm, isoDate } from './clinical'
import { addEvent, makeVital, newPatient, newTrauma, newVisit, toLog } from './factory'
import { arrivalResources, assessmentResources, triageResource, vitalResources } from './fhir'
import type {
  ComplaintKey,
  DispositionType,
  FhirLogEntry,
  InsuranceType,
  OrderResult,
  PathwayKey,
  Patient,
  PaymentMethod,
  PreArrival,
  Sex,
  TriageLevel,
  Visit,
  VitalInput,
} from './types'

function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const V = (sys: number, dia: number, hr: number, rr: number, temp: number, spo2: number, gcs: number, o2 = false, pain: number | null = null): VitalInput => ({
  sys, dia, hr, rr, temp, spo2, gcs, o2, pain,
})

export interface SeedResult {
  visits: Visit[]
  patients: Patient[]
  prearrivals: PreArrival[]
  fhirLogs: Omit<FhirLogEntry, 'id'>[]
  counters: { rm: number; tmp: number; reg: number; mci: number; pre: number; kw: number }
}

type P = [name: string, sex: Sex, age: number, nik: string, insurance: InsuranceType, address: string, phone: string, blood: Patient['bloodType'], allergies: string]
const PEOPLE: P[] = [
  ['Sri Wahyuni', 'P', 58, '3578016011680003', 'BPJS', 'Jl. Keputih Tegal No. 14, Sukolilo, Surabaya', '081234500101', 'O', ''],
  ['Budi Santoso', 'L', 34, '3578031708920001', 'BPJS', 'Jl. Mulyosari Utara No. 7, Mulyorejo, Surabaya', '081234500102', 'A', ''],
  ['An. Naura Putri', 'P', 6, '3578054402200002', 'Asuransi swasta', 'Jl. Manyar Kertoarjo No. 21, Gubeng, Surabaya', '081234500103', 'B', ''],
  ['Hendra Wijaya', 'L', 45, '3578062909810005', 'Umum', 'Jl. Kertajaya Indah No. 3, Gubeng, Surabaya', '081234500104', 'O', ''],
  ['Rina Kusuma', 'P', 27, '3578074107990006', 'BPJS', 'Jl. Gebang Lor No. 30, Sukolilo, Surabaya', '081234500105', 'AB', 'Amoksisilin (ruam)'],
  ['Slamet Riyadi', 'L', 72, '3578080306540001', 'BPJS', 'Jl. Klampis Jaya No. 9, Sukolilo, Surabaya', '081234500106', 'A', ''],
  ['Ahmad Fauzi', 'L', 21, '3578091212050003', 'Umum', 'Jl. Arif Rahman Hakim No. 55, Sukolilo, Surabaya', '081234500107', '', ''],
  ['Siti Aminah', 'P', 58, '3578014405660002', 'BPJS', 'Jl. Semolowaru No. 18, Sukolilo, Surabaya', '081234500108', 'B', ''],
  ['Dimas Prasetyo', 'L', 36, '3578021203880004', 'Asuransi swasta', 'Jl. Dharmahusada No. 40, Mulyorejo, Surabaya', '081234500109', 'O', ''],
  ['Sugeng Hariyanto', 'L', 74, '3578100101500001', 'BPJS', 'Jl. Nginden Jangkungan No. 2, Sukolilo, Surabaya', '081234500110', 'A', 'Aspirin (sesak)'],
  ['Dewi Lestari', 'P', 41, '3578114506830002', 'BPJS', 'Jl. Kalijudan No. 12, Mulyorejo, Surabaya', '081234500111', 'O', ''],
  ['Agus Setiawan', 'L', 52, '3578121003720003', 'Umum', 'Jl. Raya Menur No. 8, Gubeng, Surabaya', '081234500112', 'B', ''],
  ['Wahyu Nugroho', 'L', 29, '3578132207950001', 'BPJS', 'Jl. Kejawan Putih No. 15, Mulyorejo, Surabaya', '081234500113', 'A', ''],
  ['Lina Marlina', 'P', 33, '3578145508910004', 'Asuransi swasta', 'Jl. Bratang Binangun No. 6, Wonokromo, Surabaya', '081234500114', 'O', ''],
  ['Bambang Sutrisno', 'L', 63, '3578151406610002', 'BPJS', 'Jl. Pucang Anom No. 22, Gubeng, Surabaya', '081234500115', 'AB', ''],
  ['Fitri Handayani', 'P', 24, '3578166104000005', 'Umum', 'Jl. Sutorejo Utara No. 4, Mulyorejo, Surabaya', '081234500116', 'B', ''],
  ['Yoga Pratama', 'L', 19, '3578170905050001', 'Umum', 'Jl. Gubeng Kertajaya No. 11, Gubeng, Surabaya', '081234500117', 'O', ''],
  ['Kartini Rahayu', 'P', 67, '3578186304570003', 'BPJS', 'Jl. Medokan Ayu No. 19, Rungkut, Surabaya', '081234500118', 'A', ''],
  ['Joko Susilo', 'L', 48, '3578192509760002', 'BPJS', 'Jl. Wonorejo Timur No. 27, Rungkut, Surabaya', '081234500119', 'O', ''],
  ['Maya Anggraini', 'P', 38, '3578205211860004', 'Asuransi swasta', 'Jl. Kutisari Indah No. 5, Tenggilis, Surabaya', '081234500120', 'B', ''],
  ['Rudi Kurniawan', 'L', 55, '3578211708690001', 'BPJS', 'Jl. Jemursari No. 33, Wonocolo, Surabaya', '081234500121', 'A', ''],
  ['Nur Aisyah', 'P', 30, '3578226702940002', 'BPJS', 'Jl. Kendangsari No. 10, Tenggilis, Surabaya', '081234500122', 'O', ''],
  ['An. Raka Aditya', 'L', 4, '3578231405220003', 'BPJS', 'Jl. Rungkut Asri No. 16, Rungkut, Surabaya', '081234500123', 'O', ''],
]

interface Case {
  complaint: ComplaintKey
  note: string
  dx: string[]
  proc: string[]
  orders: string[]
  drugs: string[]
  level: TriageLevel
  vit: VitalInput
  anam: string
  exam: string
  results?: Record<string, string>
  critical?: string[]
  dispo: DispositionType
  detail: { education?: string; room?: string; referralTarget?: string }
  pathway?: PathwayKey
  child?: boolean
}

const CASES: Case[] = [
  { complaint: 'demam', note: 'Demam hari ke-3', dx: ['A90'], proc: ['38.93'], orders: ['cbc'], drugs: ['Parasetamol 1 g IV', 'Ringer Laktat 500 ml'], level: 3, vit: V(100, 65, 108, 22, 38.9, 97, 15, false, 4), anam: 'Demam 3 hari, nyeri kepala, mual, nafsu makan turun.', exam: 'Akral hangat, nyeri tekan epigastrium, uji torniket positif.', results: { cbc: 'Hb 13,8 g/dL; Leukosit 3.200/µL; Trombosit 98.000/µL; Ht 44%' }, dispo: 'rawat_inap', detail: { room: 'Ruang penyakit dalam' } },
  { complaint: 'perut', note: 'Diare dan muntah sejak pagi', dx: ['A09'], proc: ['38.93'], orders: ['elek'], drugs: ['Ondansetron 4 mg IV', 'Ringer Laktat 500 ml'], level: 3, vit: V(105, 70, 104, 20, 37.8, 98, 15, false, 5), anam: 'Diare cair 6 kali dan muntah 3 kali sejak pagi.', exam: 'Turgor kulit menurun, bising usus meningkat.', results: { elek: 'Na 134 mmol/L; K 3,3 mmol/L; Cl 98 mmol/L' }, dispo: 'pulang', detail: { education: 'Oralit, makan lunak, kontrol jika tidak membaik dalam 2 hari' } },
  { complaint: 'sesak', note: 'Sesak dan mengi', dx: ['J45.9'], proc: ['93.96'], orders: [], drugs: ['Salbutamol nebulisasi'], level: 3, vit: V(128, 82, 112, 28, 36.8, 93, 15), anam: 'Sesak dan mengi sejak malam, riwayat asma sejak kecil.', exam: 'Wheezing ekspirasi di kedua lapang paru.', dispo: 'pulang', detail: { education: 'Lanjutkan inhaler, hindari debu dan asap' } },
  { complaint: 'luka', note: 'Tangan tergores pisau', dx: ['S61.9'], proc: ['86.59'], orders: [], drugs: ['Ketorolak 30 mg IV'], level: 4, vit: V(124, 80, 86, 18, 36.6, 99, 15, false, 4), anam: 'Tangan kiri tergores pisau saat memasak.', exam: 'Luka robek 3 cm di telapak tangan, perdarahan terkontrol, tendon intak.', dispo: 'pulang', detail: { education: 'Rawat luka kering, kontrol lepas jahitan 7 hari' } },
  { complaint: 'dada', note: 'Nyeri dada kiri 2 jam', dx: ['I21.9'], proc: ['89.52', '38.93', '93.96'], orders: ['trop', 'cbc', 'elek'], drugs: ['Aspirin 160 mg oral (dikunyah)', 'Clopidogrel 300 mg oral'], level: 2, vit: V(156, 94, 98, 22, 36.7, 95, 15, false, 8), anam: 'Nyeri dada kiri seperti ditindih sejak 2 jam, menjalar ke lengan kiri, keringat dingin.', exam: 'Akral dingin, tidak ada ronki, bunyi jantung reguler.', results: { trop: 'Troponin I 2,4 ng/mL (meningkat)', cbc: 'Dalam batas normal', elek: 'Dalam batas normal' }, critical: ['trop'], dispo: 'rujuk', detail: { referralTarget: 'RS rujukan dengan fasilitas kateterisasi jantung' }, pathway: 'stemi' },
  { complaint: 'perut', note: 'Nyeri perut kanan bawah', dx: ['K35.8'], proc: ['38.93'], orders: ['cbc', 'usa'], drugs: ['Ketorolak 30 mg IV', 'Ceftriaxone 2 g IV'], level: 3, vit: V(118, 76, 102, 20, 38.2, 98, 15, false, 6), anam: 'Nyeri perut kanan bawah sejak semalam disertai mual.', exam: 'Nyeri tekan titik McBurney, defans muskular lokal.', results: { cbc: 'Leukosit 14.800/µL', usa: 'Gambaran apendisitis akut' }, dispo: 'rawat_inap', detail: { room: 'Ruang bedah' } },
  { complaint: 'demam', note: 'Demam, batuk pilek', dx: ['R50.9'], proc: [], orders: [], drugs: ['Parasetamol 1 g IV'], level: 5, vit: V(118, 76, 92, 18, 38.1, 98, 15, false, 2), anam: 'Demam 1 hari disertai batuk pilek.', exam: 'Faring hiperemis, paru bersih.', dispo: 'pulang', detail: { education: 'Istirahat, banyak minum, kontrol ke puskesmas bila demam lebih dari 3 hari' } },
  { complaint: 'stroke', note: 'Lemah separuh tubuh kanan', dx: ['I63.9'], proc: ['38.93'], orders: ['gds', 'cth', 'cbc'], drugs: ['NaCl 0,9% 500 ml'], level: 2, vit: V(178, 98, 88, 20, 36.8, 96, 13), anam: 'Lemah separuh tubuh kanan dan bicara pelo sejak 1 jam sebelum datang.', exam: 'Hemiparesis kanan, parese nervus VII kanan sentral.', results: { gds: 'GDS 142 mg/dL', cth: 'Tidak tampak perdarahan intrakranial', cbc: 'Dalam batas normal' }, dispo: 'rawat_inap', detail: { room: 'ICU' }, pathway: 'stroke' },
  { complaint: 'trauma', note: 'Jatuh dari motor', dx: ['S06.0', 'T14.9'], proc: ['86.59', '38.93'], orders: ['cth'], drugs: ['Ketorolak 30 mg IV'], level: 3, vit: V(130, 84, 96, 20, 36.7, 98, 15, false, 5), anam: 'Jatuh dari motor, kepala terbentur aspal, sempat pingsan kurang dari 1 menit.', exam: 'Luka robek dahi 4 cm, GCS 15, pupil isokor.', results: { cth: 'Tidak tampak perdarahan maupun fraktur' }, dispo: 'pulang', detail: { education: 'Observasi tanda bahaya cedera kepala di rumah selama 24 jam' } },
  { complaint: 'sesak', note: 'Sesak memberat, kaki bengkak', dx: ['I50.9'], proc: ['93.96', '89.52'], orders: ['xrt', 'elek'], drugs: [], level: 2, vit: V(162, 96, 114, 28, 36.9, 90, 15, true), anam: 'Sesak memberat 2 hari, tidur harus dengan 3 bantal.', exam: 'Ronki basah basal kedua paru, edema tungkai.', results: { xrt: 'Kardiomegali dengan edema paru', elek: 'Na 132 mmol/L; K 4,1 mmol/L' }, dispo: 'rawat_inap', detail: { room: 'Ruang jantung' } },
  { complaint: 'kejang', note: 'Kejang demam di rumah', dx: ['R56.0'], proc: [], orders: ['cbc'], drugs: ['Parasetamol 1 g IV'], level: 2, vit: V(98, 62, 128, 26, 38.7, 97, 15), anam: 'Kejang umum 2 menit di rumah saat demam, sudah berhenti.', exam: 'Sadar penuh, tidak ada defisit neurologis, faring hiperemis.', results: { cbc: 'Leukosit 11.200/µL, lainnya normal' }, dispo: 'pulang', detail: { education: 'Kompres hangat, parasetamol saat demam, kembali bila kejang berulang' }, child: true },
]

const DOCTORS = ['dr. Arif', 'dr. Maya Putri', 'dr. Bayu Ramadhan']
const NURSES = ['Ns. Dewi', 'Ns. Rizky', 'Ns. Ayu']

export function buildSampleData(T0 = Date.now()): SeedResult {
  const ago = (m: number) => T0 - m * MIN
  const NURSE = NURSES[0]
  const DOC = DOCTORS[0]
  let reg = 1001
  let rmNo = 184200
  let receipt = 1

  const patients: Patient[] = PEOPLE.map(([name, sex, age, nik, insurance, address, phone, blood, allergies], i) => {
    const y = new Date(T0).getFullYear() - age
    return newPatient({
      id: `P${String(i + 1).padStart(4, '0')}`,
      rm: formatRm(rmNo++),
      name, sex, nik, insurance, address, phone,
      birthDate: `${y}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`,
      age: null,
      bloodType: blood,
      allergies,
      insuranceNo: insurance === 'BPJS' ? `000${nik.slice(-10)}` : insurance === 'Asuransi swasta' ? `POL-${nik.slice(-6)}` : '',
      emergencyName: sex === 'P' ? 'Suami/keluarga' : 'Istri/keluarga',
      emergencyRelation: 'Keluarga',
      emergencyPhone: phone.replace(/01(\d\d)$/, '02$1'),
      createdAt: ago(60 * 24 * 30),
      updatedAt: ago(60 * 24 * 30),
    })
  })
  const byName = (n: string) => patients.find((p) => p.name === n)!
  const snap = (p: Patient) => ({ name: p.name, nik: p.nik, sex: p.sex, age: new Date(T0).getFullYear() - Number(p.birthDate.slice(0, 4)), ageEstimated: false })

  const visits: Visit[] = []
  const add = (o: Partial<Visit>) => {
    const v = newVisit({ regNo: `IGD-${reg++}`, ...o })
    visits.push(v)
    return v
  }
  const linked = (name: string, o: Partial<Visit>) => {
    const p = byName(name)
    return add({ patientId: p.id, rm: p.rm, patient: snap(p), insurance: p.insurance, ...o })
  }
  const triage = (v: Visit, level: TriageLevel, at: number, by = NURSE) => {
    v.triage.push({ at, method: 'IGD', level, color: LEVELS[level].color, suggested: level, reason: null, by })
    v.level = level
    v.color = LEVELS[level].color
    v.triagedAt = at
    v.status = 'tertriase'
    addEvent(v, `Triase level ${level} oleh ${by}`, by, at)
  }
  const start = (v: Visit, at: number, doc = DOC) => {
    v.doctorSeenAt = at
    v.doctor = doc
    v.status = 'ditangani'
    addEvent(v, `Mulai ditangani ${doc}`, doc, at)
  }
  const result = (status: OrderResult['status'], text: string, requestedAt: number, updatedAt: number, by = NURSE, critical = false): OrderResult => ({
    status, result: text, critical, requestedAt, updatedAt, by,
  })

  // ---------- Pasien aktif di IGD ----------
  // 1. Trauma tanpa identitas
  let v = add({
    anonymous: true, tempName: 'Tn. X', tempRm: 'IGD-TMP-0011', patient: { name: '', nik: '', sex: 'L', age: 30, ageEstimated: true },
    arrivalTime: ago(18), arrivalMode: 'ambulans', complaint: 'trauma', complaintNote: 'KLL motor vs truk, tanpa helm', bed: 'R1', isTrauma: true, insurance: 'Belum diketahui',
  })
  v.vitals.push(makeVital(V(86, 50, 128, 28, 36.2, 91, 10, true), ago(17), NURSE), makeVital(V(94, 58, 118, 24, 36.4, 95, 11, true), ago(5), NURSE))
  v.trauma = {
    ...newTrauma(),
    mist: {
      m: 'Pengendara motor vs truk, terlempar sekitar 5 m, tanpa helm',
      i: 'Luka robek kepala, jejas dada kanan, deformitas paha kiri',
      s: 'TD 86/50, N 128, RR 28, SpO₂ 91%, GCS 10',
      t: 'Neck collar, O₂ NRM 10 lpm, bidai paha kiri',
    },
    criteria: ['terlempar', 'kecepatan'],
    gcs: { e: 2, v: 4, m: 5 },
    injuries: [
      { region: 'kepala', type: 'Luka robek', at: ago(15) },
      { region: 'dada', type: 'Memar', at: ago(15) },
      { region: 'paha_ki', type: 'Fraktur suspek', at: ago(15) },
    ],
    fast: { ruq: 'Negatif', luq: 'Negatif', pelvis: 'Tidak jelas', perikard: 'Negatif' },
    abcde: {
      A: { status: 'Aman', note: 'Paten, neck collar terpasang' },
      B: { status: 'Bermasalah', note: 'Jejas dada kanan, suara napas kanan menurun' },
      C: { status: 'Bermasalah', note: 'Takikardia, akral dingin, 2 jalur IV' },
      D: { status: 'Bermasalah', note: 'GCS 11, pupil isokor' },
      E: { status: 'Aman', note: 'Selimut hangat, log roll selesai' },
    },
    teamActivatedAt: ago(17),
    teamTier: 'penuh',
    mtpAt: null,
  }
  triage(v, 1, ago(17))
  addEvent(v, 'Tim trauma diaktifkan (penuh)', NURSE, ago(17))
  start(v, ago(16))
  v.assessment = {
    anamnesis: 'Dibawa ambulans setelah KLL motor vs truk. Riwayat dari pengantar terbatas.', allergy: 'Tidak diketahui', exam: 'Jejas dada kanan, deformitas femur kiri, luka robek parietal 5 cm.',
    diagnoses: ['T14.9', 'S72.3'], procedures: ['38.93', '93.96', '93.54'], orders: ['cbc', 'agd', 'xrt', 'cth'], cito: true,
    drugs: ['Ringer Laktat 500 ml', 'Asam traneksamat 1 g IV'], updatedAt: ago(12), by: DOC,
  }
  v.results = {
    cbc: result('selesai', 'Hb 9,8 g/dL (turun); Leukosit 15.200/µL; Trombosit 210.000/µL', ago(12), ago(4), 'Analis lab', true),
    agd: result('diproses', '', ago(12), ago(8)),
    xrt: result('selesai', 'Kontusio paru kanan, tidak tampak pneumotoraks', ago(12), ago(6), 'dr. Radiologi'),
    cth: result('diminta', '', ago(12), ago(12)),
  }

  // 2. Nyeri dada, jalur STEMI aktif, belum dilihat dokter
  v = linked('Sri Wahyuni', { arrivalTime: ago(9), arrivalMode: 'keluarga', complaint: 'dada', complaintNote: 'Nyeri dada kiri menjalar ke lengan sejak 1 jam', bed: 'N1' })
  v.vitals.push(makeVital(V(150, 92, 104, 22, 36.8, 95, 15, false, 8), ago(7), NURSE))
  triage(v, 2, ago(7))
  v.pathways.stemi = { activatedAt: ago(7), done: { ekg: ago(4) } }
  addEvent(v, 'Jalur STEMI diaktifkan dari triase', NURSE, ago(7))
  addEvent(v, 'EKG 12 sadapan selesai', NURSE, ago(4))

  // 3. Dengue, observasi
  v = linked('Budi Santoso', { arrivalTime: ago(42), complaint: 'demam', complaintNote: 'Demam hari ke-4, mual, nyeri ulu hati', bed: 'N2' })
  v.vitals.push(makeVital(V(104, 68, 112, 22, 39.2, 96, 15, false, 4), ago(38), NURSE), makeVital(V(98, 62, 116, 22, 38.6, 96, 15, false, 3), ago(12), NURSE))
  triage(v, 3, ago(38))
  start(v, ago(20))
  v.status = 'observasi'
  v.assessment = {
    anamnesis: 'Demam 4 hari, mual, nyeri ulu hati.', allergy: 'Tidak ada', exam: 'Nyeri tekan epigastrium, akral hangat.',
    diagnoses: ['A90'], procedures: ['38.93'], orders: ['cbc'], cito: true, drugs: ['Parasetamol 1 g IV', 'Ringer Laktat 500 ml'], updatedAt: ago(17), by: DOC,
  }
  v.results = { cbc: result('selesai', 'Hb 14,9 g/dL; Leukosit 2.900/µL; Trombosit 82.000/µL; Ht 47%', ago(17), ago(6), 'Analis lab') }

  // 4. Anak kejang demam
  v = linked('An. Naura Putri', { arrivalTime: ago(25), arrivalMode: 'keluarga', complaint: 'kejang', complaintNote: 'Kejang 3 menit di rumah, sudah berhenti', bed: 'A1' })
  v.vitals.push(makeVital(V(100, 64, 132, 26, 38.9, 97, 15), ago(24), NURSE))
  triage(v, 2, ago(24))
  start(v, ago(22))
  v.status = 'observasi'
  v.assessment = {
    anamnesis: 'Kejang umum 3 menit, demam sejak pagi.', allergy: 'Tidak ada', exam: 'Sadar penuh, tidak ada defisit neurologis.',
    diagnoses: ['R56.0'], procedures: [], orders: ['cbc', 'elek'], cito: false, drugs: ['Parasetamol 1 g IV'], updatedAt: ago(19), by: DOC,
  }
  v.results = { cbc: result('selesai', 'Leukosit 12.400/µL, lainnya dalam batas normal', ago(19), ago(8), 'Analis lab'), elek: result('diproses', '', ago(19), ago(15)) }

  // 5. Luka robek, siap pulang, tagihan belum dibayar
  v = linked('Hendra Wijaya', { arrivalTime: ago(55), complaint: 'luka', complaintNote: 'Telapak tangan kanan tergores seng', bed: 'B2' })
  v.vitals.push(makeVital(V(128, 80, 84, 18, 36.6, 98, 15, false, 4), ago(52), NURSE))
  triage(v, 4, ago(52))
  start(v, ago(30))
  v.assessment = {
    anamnesis: 'Luka robek telapak tangan kanan 4 cm tergores seng.', allergy: 'Tidak ada', exam: 'Luka bersih, tendon intak, sensorik baik.',
    diagnoses: ['S61.9'], procedures: ['86.59', '99.29'], orders: [], cito: false, drugs: ['Ketorolak 30 mg IV'], updatedAt: ago(25), by: DOC,
  }
  v.billing.manual.push({ id: 'm-tt', group: 'Obat', name: 'Vaksin tetanus (TT)', qty: 1, price: 85_000, auto: false })
  v.disposition = { type: 'pulang', decidedAt: ago(5), decidedBy: DOC, note: 'Kontrol poli bedah 5 hari, rawat luka', detail: { education: 'Kontrol poli bedah 5 hari, rawat luka' } }
  v.status = 'menunggu_disposisi'
  addEvent(v, 'Keputusan disposisi: Pulang', DOC, ago(5))

  // 6. Nyeri perut, lewat target waktu dokter
  v = linked('Rina Kusuma', { arrivalTime: ago(36), complaint: 'perut', complaintNote: 'Nyeri perut kanan bawah sejak semalam', bed: 'N3' })
  v.vitals.push(makeVital(V(118, 74, 102, 20, 38.1, 98, 15, false, 6), ago(33), NURSE))
  triage(v, 3, ago(33))

  // 7. Gagal jantung, tertahan menunggu bed rawat inap
  v = linked('Slamet Riyadi', { arrivalTime: ago(150), arrivalMode: 'keluarga', complaint: 'sesak', complaintNote: 'Sesak memberat 2 hari, kaki bengkak', bed: 'R2' })
  v.vitals.push(
    makeVital(V(168, 96, 118, 30, 37.2, 89, 15, true), ago(148), NURSE),
    makeVital(V(150, 88, 104, 24, 37.0, 93, 15, true), ago(60), NURSE),
    makeVital(V(146, 86, 100, 22, 36.9, 94, 15, true), ago(14), NURSE),
  )
  triage(v, 2, ago(148))
  start(v, ago(145))
  v.assessment = {
    anamnesis: 'Sesak memberat, ortopnea, edema tungkai.', allergy: 'Tidak ada', exam: 'Ronki basah kedua basal paru, JVP meningkat.',
    diagnoses: ['I50.9'], procedures: ['93.96', '89.52'], orders: ['cbc', 'elek', 'xrt', 'agd'], cito: true, drugs: [], updatedAt: ago(140), by: DOC,
  }
  v.results = {
    cbc: result('selesai', 'Dalam batas normal', ago(140), ago(110), 'Analis lab'),
    elek: result('selesai', 'Na 131 mmol/L; K 4,4 mmol/L', ago(140), ago(110), 'Analis lab'),
    xrt: result('selesai', 'Kardiomegali, edema paru', ago(140), ago(120), 'dr. Radiologi'),
    agd: result('selesai', 'pH 7,35; pCO₂ 44; pO₂ 68; HCO₃ 23', ago(140), ago(125), 'Analis lab'),
  }
  v.disposition = { type: 'rawat_inap', decidedAt: ago(130), decidedBy: DOC, note: 'Ruang jantung, menunggu bed kosong', detail: { room: 'Ruang jantung' } }
  v.status = 'menunggu_disposisi'
  addEvent(v, 'Keputusan disposisi: Rawat inap ruang jantung', DOC, ago(130))

  // 8. Baru datang, belum triase
  linked('Ahmad Fauzi', { arrivalTime: ago(4), complaint: 'demam', complaintNote: 'Demam dan batuk 2 hari' })

  const fhirLogs: Omit<FhirLogEntry, 'id'>[] = []
  for (const x of visits) {
    addEvent(x, `Terdaftar di IGD (${MODES[x.arrivalMode].toLowerCase()})`, undefined, x.arrivalTime)
    arrivalResources(x).forEach((d) => fhirLogs.push(toLog(d, x.arrivalTime)))
    x.triage.forEach((t) => fhirLogs.push(toLog(triageResource(x, t), t.at)))
    x.vitals.forEach((s) => fhirLogs.push(toLog(vitalResources(x, s), s.at)))
    if (x.assessment) assessmentResources(x, x.assessment, null).forEach((d) => fhirLogs.push(toLog(d, x.assessment!.updatedAt)))
  }

  // ---------- Riwayat 7 hari (kunjungan yang sudah selesai) ----------
  const r = rng(11)
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)]
  const adults = patients.filter((p) => !p.name.startsWith('An.'))
  const kids = patients.filter((p) => p.name.startsWith('An.'))
  for (let i = 0; i < 42; i++) {
    // 14 kunjungan pertama dalam 12 jam terakhir (untuk Dashboard Mutu), sisanya tersebar 7 hari.
    const arr = i < 14 ? ago(170 + Math.floor(r() * 520)) : ago(720 + Math.floor(r() * 60 * 24 * 6.5))
    const c = pick(CASES)
    const p = c.child ? pick(kids) : pick(adults)
    const doc = pick(DOCTORS)
    const nurse = pick(NURSES)
    const h = newVisit({
      regNo: `IGD-${reg++}`, patientId: p.id, rm: p.rm, patient: snap(p), insurance: p.insurance, historic: true,
      arrivalTime: arr, arrivalMode: r() > 0.8 ? 'ambulans' : r() > 0.5 ? 'keluarga' : 'sendiri', complaint: c.complaint, complaintNote: c.note,
      isTrauma: c.complaint === 'trauma', trauma: c.complaint === 'trauma' ? newTrauma() : null,
    })
    addEvent(h, `Terdaftar di IGD (${MODES[h.arrivalMode].toLowerCase()})`, undefined, arr)
    const tAt = arr + (1 + r() * 4) * MIN
    h.vitals.push(makeVital(c.vit, tAt, nurse))
    triage(h, c.level, tAt, nurse)
    const tgt = Math.max(LEVELS[c.level].target, 1.5)
    const resp = c.level === 1 ? r() * 1.2 : tgt * (0.25 + r() * 1.2)
    const seen = arr + resp * MIN
    start(h, Math.max(seen, tAt + 0.5 * MIN), doc)
    const asAt = h.doctorSeenAt! + 8 * MIN
    h.assessment = { anamnesis: c.anam, allergy: p.allergies || 'Tidak ada', exam: c.exam, diagnoses: c.dx, procedures: c.proc, orders: c.orders, cito: c.level <= 2, drugs: c.drugs, updatedAt: asAt, by: doc }
    addEvent(h, `Asesmen disimpan${c.orders.length ? `, ${c.orders.length} order penunjang dikirim` : ''}`, doc, asAt)
    c.orders.forEach((k) => {
      h.results[k] = result('selesai', c.results?.[k] ?? 'Dalam batas normal', asAt, asAt + (30 + r() * 40) * MIN, 'Analis lab', c.critical?.includes(k) ?? false)
    })
    if (c.pathway) h.pathways[c.pathway] = { activatedAt: tAt, done: Object.fromEntries(PATHWAYS[c.pathway].steps.map(([k, , t]) => [k, arr + t * (0.6 + r() * 0.5) * MIN])) }
    const los = 70 + r() * (c.dispo === 'rawat_inap' ? 260 : 120)
    const decided = arr + los * 0.75 * MIN
    h.vitals.push(makeVital({ ...c.vit, hr: c.vit.hr - 8, temp: Math.min(c.vit.temp, 37.8), spo2: Math.min(99, c.vit.spo2 + 2), pain: c.vit.pain !== null ? Math.max(0, c.vit.pain - 3) : null }, decided - 15 * MIN, nurse))
    h.disposition = { type: c.dispo, decidedAt: decided, decidedBy: doc, note: [c.detail.education, c.detail.room, c.detail.referralTarget].filter(Boolean).join('. '), detail: c.detail }
    addEvent(h, `Keputusan disposisi: ${DISPO[c.dispo]}`, doc, decided)
    h.leftAt = arr + los * MIN
    h.status = 'keluar'
    const method: PaymentMethod = p.insurance === 'BPJS' ? 'BPJS' : p.insurance === 'Asuransi swasta' ? 'Asuransi' : pick<PaymentMethod>(['Tunai', 'Debit', 'QRIS'])
    const items = computeBill(h)
    h.billing.payment = {
      at: h.leftAt - 10 * MIN, by: 'Yusuf (Pendaftaran)', method,
      receiptNo: `KW-${isoDate(h.leftAt).replace(/-/g, '')}-${String(receipt++).padStart(4, '0')}`,
      total: items.reduce((s, it) => s + it.qty * it.price, 0), items,
    }
    addEvent(h, `Keluar IGD. Tagihan ${method === 'BPJS' || method === 'Asuransi' ? 'ditagihkan ke penjamin' : 'lunas'}`, undefined, h.leftAt)
    visits.push(h)
  }

  const prearrivals: PreArrival[] = [
    {
      id: 'PRE-0003', from: 'Ambulans PSC 119', sentAt: ago(3), eta: T0 + 6 * MIN, sex: 'L', age: 40,
      mist: {
        m: 'Jatuh dari perancah sekitar 5 m',
        i: 'Nyeri pinggang, deformitas pergelangan kaki kanan',
        s: 'TD 110/70, N 108, RR 22, SpO₂ 96%, GCS 15',
        t: 'Long spine board, bidai kaki kanan',
      },
    },
  ]

  fhirLogs.sort((a, b) => a.at - b.at)
  return { visits, patients, prearrivals, fhirLogs, counters: { rm: rmNo, tmp: 12, reg, mci: 0, pre: 3, kw: receipt } }
}
