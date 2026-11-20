import type {
  AbcdeKey,
  ArrivalMode,
  BillGroup,
  OrderStatus,
  PaymentMethod,
  ComplaintKey,
  DispositionType,
  FastKey,
  InsuranceType,
  PathwayKey,
  RegionKey,
  Role,
  TriageColor,
  TriageLevel,
  VisitStatus,
} from './types'

export const MIN = 60_000

export const APP_NAME = 'SIMRS IGD'

/** Identitas rumah sakit untuk kop dokumen cetak. Ganti sesuai kebutuhan. */
export const HOSPITAL = {
  name: 'Rumah Sakit Contoh',
  unit: 'Instalasi Gawat Darurat',
  address: 'Jl. Contoh No. 1, Surabaya',
  phone: '(031) 000-0000',
  city: 'Surabaya',
}

export const LEVELS: Record<TriageLevel, { name: string; color: TriageColor; target: number }> = {
  1: { name: 'Resusitasi', color: 'red', target: 0 },
  2: { name: 'Emergensi', color: 'red', target: 15 },
  3: { name: 'Urgen', color: 'yellow', target: 30 },
  4: { name: 'Kurang urgen', color: 'green', target: 60 },
  5: { name: 'Tidak urgen', color: 'green', target: 120 },
}
export const LEVEL_LIST: TriageLevel[] = [1, 2, 3, 4, 5]

/** Target waktu dilihat dokter dalam menit. Level 1 "segera" dihitung 1 menit. */
export const targetMinutes = (level: TriageLevel) => Math.max(LEVELS[level].target, 1)

export const COLOR_LABEL: Record<TriageColor, string> = {
  red: 'Merah',
  yellow: 'Kuning',
  green: 'Hijau',
  black: 'Hitam',
}

/** Interval observasi ulang (menit) per level triase. */
export const OBS_INTERVAL: Record<TriageLevel, number> = { 1: 15, 2: 15, 3: 30, 4: 60, 5: 120 }

/** Batas pasien dianggap tertahan setelah keputusan disposisi (menit). */
export const BOARDING_LIMIT = 120

export const BEDS: { id: string; area: string }[] = [
  { id: 'R1', area: 'Resusitasi' },
  { id: 'R2', area: 'Resusitasi' },
  { id: 'B1', area: 'Bedah' },
  { id: 'B2', area: 'Bedah' },
  { id: 'B3', area: 'Bedah' },
  { id: 'N1', area: 'Non-bedah' },
  { id: 'N2', area: 'Non-bedah' },
  { id: 'N3', area: 'Non-bedah' },
  { id: 'N4', area: 'Non-bedah' },
  { id: 'A1', area: 'Anak' },
  { id: 'A2', area: 'Anak' },
  { id: 'OB1', area: 'Observasi' },
]
export const AREAS = ['Semua', 'Resusitasi', 'Bedah', 'Non-bedah', 'Anak', 'Observasi', 'Ruang tunggu']

export const STATUS_LABEL: Record<VisitStatus, string> = {
  terdaftar: 'Belum triase',
  tertriase: 'Menunggu dokter',
  ditangani: 'Ditangani',
  observasi: 'Observasi',
  menunggu_disposisi: 'Menunggu keluar',
  keluar: 'Keluar',
}

export const MODES: Record<ArrivalMode, string> = {
  sendiri: 'Datang sendiri',
  keluarga: 'Diantar keluarga',
  ambulans: 'Ambulans',
  polisi: 'Diantar polisi',
}

export const INSURANCES: InsuranceType[] = ['Umum', 'BPJS', 'Asuransi swasta', 'Belum diketahui']

export const COMPLAINTS: { key: ComplaintKey; label: string; level: TriageLevel }[] = [
  { key: 'henti', label: 'Henti napas / henti jantung', level: 1 },
  { key: 'dada', label: 'Nyeri dada khas', level: 2 },
  { key: 'stroke', label: 'Kelemahan sesisi / bicara pelo', level: 2 },
  { key: 'kejang', label: 'Kejang', level: 2 },
  { key: 'perdarahan', label: 'Perdarahan aktif', level: 2 },
  { key: 'trauma', label: 'Trauma mayor (KLL, jatuh)', level: 2 },
  { key: 'sesak', label: 'Sesak napas', level: 3 },
  { key: 'perut', label: 'Nyeri perut', level: 3 },
  { key: 'demam', label: 'Demam', level: 4 },
  { key: 'luka', label: 'Luka ringan', level: 4 },
  { key: 'ringan', label: 'Keluhan ringan', level: 5 },
]
export const complaintLabel = (k: ComplaintKey) => COMPLAINTS.find((c) => c.key === k)?.label ?? k

export const ICD10: [string, string][] = [
  ['I21.9', 'Infark miokard akut'],
  ['I63.9', 'Stroke infark'],
  ['A41.9', 'Sepsis'],
  ['R56.0', 'Kejang demam'],
  ['A90', 'Demam dengue'],
  ['J45.9', 'Asma'],
  ['J18.9', 'Pneumonia'],
  ['I50.9', 'Gagal jantung'],
  ['K35.8', 'Apendisitis akut'],
  ['S06.0', 'Komosio serebri'],
  ['S72.3', 'Fraktur batang femur'],
  ['S61.9', 'Luka terbuka pergelangan dan tangan'],
  ['T14.9', 'Cedera, tidak spesifik'],
  ['A09', 'Diare dan gastroenteritis'],
  ['R10.4', 'Nyeri perut lainnya'],
  ['R50.9', 'Demam, tidak spesifik'],
]

export const ICD9: [string, string][] = [
  ['38.93', 'Pemasangan infus / kateter vena'],
  ['89.52', 'EKG 12 sadapan'],
  ['93.96', 'Terapi oksigen'],
  ['96.04', 'Intubasi endotrakeal'],
  ['99.60', 'Resusitasi jantung paru'],
  ['86.59', 'Penjahitan luka'],
  ['57.94', 'Pemasangan kateter urin'],
  ['93.54', 'Pemasangan bidai'],
  ['99.29', 'Injeksi / infus obat'],
]

export const ORDERS: { key: string; label: string; loinc: string; unit: 'Lab' | 'Radiologi' }[] = [
  { key: 'cbc', label: 'Darah lengkap', loinc: '58410-2', unit: 'Lab' },
  { key: 'gds', label: 'Gula darah sewaktu', loinc: '2345-7', unit: 'Lab' },
  { key: 'elek', label: 'Elektrolit', loinc: '24326-1', unit: 'Lab' },
  { key: 'trop', label: 'Troponin I', loinc: '10839-9', unit: 'Lab' },
  { key: 'agd', label: 'Analisa gas darah', loinc: '24336-0', unit: 'Lab' },
  { key: 'xrt', label: 'X-Ray thorax', loinc: '36643-5', unit: 'Radiologi' },
  { key: 'cth', label: 'CT scan kepala', loinc: '24725-4', unit: 'Radiologi' },
  { key: 'usa', label: 'USG abdomen', loinc: '24558-9', unit: 'Radiologi' },
]

export const DRUGS = [
  'Parasetamol 1 g IV',
  'Ketorolak 30 mg IV',
  'Ondansetron 4 mg IV',
  'Aspirin 160 mg oral (dikunyah)',
  'Clopidogrel 300 mg oral',
  'Diazepam 5 mg IV',
  'Salbutamol nebulisasi',
  'NaCl 0,9% 500 ml',
  'Ringer Laktat 500 ml',
  'Ceftriaxone 2 g IV',
  'Asam traneksamat 1 g IV',
]

/** Target waktu jalur kritis dalam menit sejak pasien datang. Contoh untuk prototipe. */
export const PATHWAYS: Record<PathwayKey, { name: string; steps: [string, string, number][] }> = {
  stemi: {
    name: 'STEMI',
    steps: [
      ['ekg', 'EKG 12 sadapan', 10],
      ['konsul', 'Konsul kardiologi', 20],
      ['antiplatelet', 'Loading antiplatelet', 30],
      ['reperfusi', 'Keputusan reperfusi', 60],
    ],
  },
  stroke: {
    name: 'Stroke akut',
    steps: [
      ['gds', 'Cek gula darah', 10],
      ['ct', 'CT scan kepala', 25],
      ['baca', 'Interpretasi CT', 45],
      ['trombo', 'Keputusan trombolisis', 60],
    ],
  },
  sepsis: {
    name: 'Sepsis',
    steps: [
      ['kultur', 'Kultur darah', 60],
      ['laktat', 'Periksa laktat', 60],
      ['ab', 'Antibiotik IV', 60],
      ['cairan', 'Bolus kristaloid', 60],
    ],
  },
}

/** Kriteria aktivasi tim trauma (anatomis/mekanisme). Tier 1 = penuh, tier 2 = parsial. */
export const TRAUMA_CRITERIA: { key: string; label: string; tier: 1 | 2 }[] = [
  { key: 'tembus', label: 'Luka tembus kepala, leher, atau badan', tier: 1 },
  { key: 'flail', label: 'Dada flail atau pelvis tidak stabil', tier: 1 },
  { key: 'jatuh', label: 'Jatuh dari ketinggian lebih dari 6 m', tier: 2 },
  { key: 'terlempar', label: 'Terlempar dari kendaraan', tier: 2 },
  { key: 'kecepatan', label: 'Tabrakan kecepatan tinggi', tier: 2 },
  { key: 'lansia', label: 'Usia di atas 65 dengan trauma', tier: 2 },
]

export const REGIONS: Record<RegionKey, string> = {
  kepala: 'Kepala',
  leher: 'Leher',
  dada: 'Dada',
  perut: 'Perut',
  pelvis: 'Pelvis',
  lengan_ka: 'Lengan atas kanan',
  tangan_ka: 'Lengan bawah/tangan kanan',
  lengan_ki: 'Lengan atas kiri',
  tangan_ki: 'Lengan bawah/tangan kiri',
  paha_ka: 'Paha kanan',
  tungkai_ka: 'Tungkai bawah kanan',
  paha_ki: 'Paha kiri',
  tungkai_ki: 'Tungkai bawah kiri',
}

export const INJURY_TYPES = ['Luka robek', 'Memar', 'Fraktur suspek', 'Luka bakar', 'Luka tusuk', 'Deformitas', 'Lecet']

export const FAST_AREAS: [FastKey, string][] = [
  ['ruq', 'Kuadran kanan atas (Morison)'],
  ['luq', 'Kuadran kiri atas (splenorenal)'],
  ['pelvis', 'Pelvis (suprapubik)'],
  ['perikard', 'Perikardium (subxifoid)'],
]

export const ABCDE: [AbcdeKey, string][] = [
  ['A', 'Airway'],
  ['B', 'Breathing'],
  ['C', 'Circulation'],
  ['D', 'Disability'],
  ['E', 'Exposure'],
]

export const GCS_E: [number, string][] = [
  [4, 'Spontan'],
  [3, 'Terhadap suara'],
  [2, 'Terhadap nyeri'],
  [1, 'Tidak ada'],
]
export const GCS_V: [number, string][] = [
  [5, 'Orientasi baik'],
  [4, 'Bingung'],
  [3, 'Kata tidak tepat'],
  [2, 'Suara tidak jelas'],
  [1, 'Tidak ada'],
]
export const GCS_M: [number, string][] = [
  [6, 'Mengikuti perintah'],
  [5, 'Melokalisasi nyeri'],
  [4, 'Menarik dari nyeri'],
  [3, 'Fleksi abnormal'],
  [2, 'Ekstensi'],
  [1, 'Tidak ada'],
]

export type StartOutcome = TriageColor | number
export const START_STEPS: { q: string; yes: StartOutcome; no: StartOutcome }[] = [
  { q: 'Bisa berjalan sendiri?', yes: 'green', no: 1 },
  { q: 'Bernapas setelah jalan napas dibuka?', yes: 2, no: 'black' },
  { q: 'Laju napas lebih dari 30 kali per menit?', yes: 'red', no: 3 },
  { q: 'CRT lebih dari 2 detik atau nadi radial tidak teraba?', yes: 'red', no: 4 },
  { q: 'Bisa mengikuti perintah sederhana?', yes: 'yellow', no: 'red' },
]
export const START_LEVEL: Record<TriageColor, TriageLevel | null> = { red: 1, yellow: 3, green: 4, black: null }

export const DISPO: Record<DispositionType, string> = {
  pulang: 'Pulang',
  rawat_inap: 'Rawat inap',
  rujuk: 'Rujuk',
  aps: 'Pulang atas permintaan sendiri',
  meninggal: 'Meninggal',
}
export const DISPO_FHIR: Record<DispositionType, [string, string]> = {
  pulang: ['home', 'Home'],
  rawat_inap: ['oth', 'Other'],
  rujuk: ['other-hcf', 'Other healthcare facility'],
  aps: ['aadvice', 'Left against advice'],
  meninggal: ['exp', 'Expired'],
}
export const WARDS = ['Ruang penyakit dalam', 'Ruang jantung', 'Ruang bedah', 'Ruang anak', 'ICU', 'HCU']

export const ROLE_LABEL: Record<Role, string> = {
  pendaftaran: 'Petugas Pendaftaran',
  perawat: 'Perawat IGD',
  dokter: 'Dokter IGD',
  kepala: 'Kepala IGD',
}
/** Nama contoh untuk mode demo lokal. */
export const DEMO_PEOPLE: Record<Role, string> = {
  pendaftaran: 'Yusuf (Pendaftaran)',
  perawat: 'Ns. Dewi',
  dokter: 'dr. Arif',
  kepala: 'dr. Laras, Sp.EM',
}

export type ViewKey = 'board' | 'prearrival' | 'register' | 'patients' | 'history' | 'mci' | 'quality' | 'staff' | 'fhir'
export const NAV: { key: ViewKey; label: string; href: string; group: string }[] = [
  { key: 'board', label: 'Papan IGD', href: '/', group: 'Pelayanan' },
  { key: 'prearrival', label: 'Pra-Kedatangan', href: '/pra-kedatangan', group: 'Pelayanan' },
  { key: 'register', label: 'Pendaftaran Cepat', href: '/pendaftaran', group: 'Pelayanan' },
  { key: 'mci', label: 'Korban Massal', href: '/korban-massal', group: 'Pelayanan' },
  { key: 'patients', label: 'Data Pasien', href: '/data-pasien', group: 'Rekam medis' },
  { key: 'history', label: 'Riwayat Kunjungan', href: '/riwayat', group: 'Rekam medis' },
  { key: 'quality', label: 'Dashboard Mutu', href: '/mutu', group: 'Manajemen' },
  { key: 'staff', label: 'Petugas', href: '/petugas', group: 'Manajemen' },
  { key: 'fhir', label: 'Log Satu Sehat', href: '/satusehat', group: 'Manajemen' },
]
export const ACCESS: Record<Role, ViewKey[]> = {
  pendaftaran: ['board', 'prearrival', 'register', 'patients', 'history'],
  perawat: ['board', 'prearrival', 'register', 'patients', 'history', 'fhir'],
  dokter: ['board', 'prearrival', 'patients', 'history', 'quality', 'fhir'],
  kepala: ['board', 'prearrival', 'register', 'mci', 'patients', 'history', 'quality', 'staff', 'fhir'],
}

export type TabKey = 'ringkasan' | 'triase' | 'asesmen' | 'penunjang' | 'observasi' | 'trauma' | 'disposisi' | 'tagihan'
export const TAB_LABEL: Record<TabKey, string> = {
  ringkasan: 'Ringkasan',
  triase: 'Triase',
  asesmen: 'Asesmen & Tindakan',
  penunjang: 'Hasil Penunjang',
  observasi: 'Observasi',
  trauma: 'Trauma',
  disposisi: 'Disposisi',
  tagihan: 'Tagihan',
}
export const TAB_ACCESS: Record<Role, TabKey[]> = {
  pendaftaran: ['ringkasan', 'tagihan'],
  perawat: ['ringkasan', 'triase', 'penunjang', 'observasi', 'trauma'],
  dokter: ['ringkasan', 'triase', 'asesmen', 'penunjang', 'observasi', 'trauma', 'disposisi'],
  kepala: ['ringkasan', 'triase', 'asesmen', 'penunjang', 'observasi', 'trauma', 'disposisi', 'tagihan'],
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  diminta: 'Diminta',
  diproses: 'Sampel/pemeriksaan diproses',
  selesai: 'Hasil selesai',
}

export const PAYMENT_METHODS: PaymentMethod[] = ['Tunai', 'Debit', 'QRIS', 'BPJS', 'Asuransi']
export const BILL_GROUPS: BillGroup[] = ['Administrasi', 'Pemeriksaan', 'Tindakan', 'Penunjang', 'Obat', 'Lainnya']
export const BLOOD_TYPES = ['', 'A', 'B', 'AB', 'O'] as const

/** Tarif contoh (fiktif) dalam rupiah. Sesuaikan dengan tarif rumah sakit. */
export const TARIFF = {
  karcis: 75_000,
  pemeriksaan: { 1: 250_000, 2: 200_000, 3: 150_000, 4: 100_000, 5: 100_000 } as Record<TriageLevel, number>,
  tindakan: {
    '38.93': 85_000,
    '89.52': 75_000,
    '93.96': 60_000,
    '96.04': 750_000,
    '99.60': 1_000_000,
    '86.59': 175_000,
    '57.94': 120_000,
    '93.54': 150_000,
    '99.29': 50_000,
  } as Record<string, number>,
  penunjang: { cbc: 95_000, gds: 30_000, elek: 140_000, trop: 250_000, agd: 300_000, xrt: 175_000, cth: 950_000, usa: 350_000 } as Record<string, number>,
  obat: {
    'Parasetamol 1 g IV': 65_000,
    'Ketorolak 30 mg IV': 25_000,
    'Ondansetron 4 mg IV': 35_000,
    'Aspirin 160 mg oral (dikunyah)': 5_000,
    'Clopidogrel 300 mg oral': 40_000,
    'Diazepam 5 mg IV': 20_000,
    'Salbutamol nebulisasi': 30_000,
    'NaCl 0,9% 500 ml': 20_000,
    'Ringer Laktat 500 ml': 22_000,
    'Ceftriaxone 2 g IV': 90_000,
    'Asam traneksamat 1 g IV': 45_000,
  } as Record<string, number>,
}

export const SATUSEHAT_MODE = (process.env.NEXT_PUBLIC_SATUSEHAT_MODE === 'sandbox' ? 'sandbox' : 'mock') as
  | 'mock'
  | 'sandbox'
