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

/**
 * Diagnosis ICD-10 (WHO) yang sering ditemui di IGD, dikelompokkan per sistem.
 * Bukan daftar lengkap. Tambahkan sesuai kebutuhan rumah sakit.
 */
export const ICD10: [string, string][] = [
  // Kardiovaskular
  ['I21.9', 'Infark miokard akut'],
  ['I20.0', 'Angina tidak stabil'],
  ['R07.4', 'Nyeri dada, tidak spesifik'],
  ['I50.9', 'Gagal jantung'],
  ['I10', 'Hipertensi esensial (primer)'],
  ['I48', 'Fibrilasi dan flutter atrium'],
  ['I47.1', 'Takikardia supraventrikular'],
  ['I49.9', 'Aritmia jantung, tidak spesifik'],
  ['I46.9', 'Henti jantung'],
  ['I26.9', 'Emboli paru'],
  ['R57.0', 'Syok kardiogenik'],
  // Saraf
  ['I63.9', 'Stroke infark'],
  ['I61.9', 'Perdarahan intraserebral'],
  ['I64', 'Stroke, tidak dinyatakan perdarahan atau infark'],
  ['G45.9', 'Serangan iskemik sesaat (TIA)'],
  ['G40.9', 'Epilepsi'],
  ['G41.9', 'Status epileptikus'],
  ['R56.0', 'Kejang demam'],
  ['R56.8', 'Kejang lainnya'],
  ['G43.9', 'Migren'],
  ['R51', 'Nyeri kepala'],
  ['R55', 'Sinkop dan kolaps'],
  ['R40.2', 'Koma, tidak spesifik'],
  // Pernapasan
  ['J45.9', 'Asma'],
  ['J46', 'Status asmatikus'],
  ['J44.1', 'PPOK dengan eksaserbasi akut'],
  ['J18.9', 'Pneumonia'],
  ['J81', 'Edema paru'],
  ['J93.9', 'Pneumotoraks'],
  ['J96.0', 'Gagal napas akut'],
  ['J06.9', 'Infeksi saluran napas atas akut'],
  ['R06.0', 'Dispnea'],
  ['R04.0', 'Epistaksis'],
  // Pencernaan
  ['K35.8', 'Apendisitis akut'],
  ['K92.0', 'Hematemesis'],
  ['K92.1', 'Melena'],
  ['K92.2', 'Perdarahan saluran cerna, tidak spesifik'],
  ['K29.7', 'Gastritis'],
  ['K56.6', 'Ileus obstruktif'],
  ['K40.3', 'Hernia inguinalis dengan obstruksi'],
  ['K80.0', 'Kolelitiasis dengan kolesistitis akut'],
  ['K85.9', 'Pankreatitis akut'],
  ['A09', 'Diare dan gastroenteritis'],
  ['E86', 'Dehidrasi'],
  ['R10.4', 'Nyeri perut lainnya'],
  ['R11', 'Mual dan muntah'],
  // Infeksi
  ['A41.9', 'Sepsis'],
  ['A90', 'Demam dengue'],
  ['A91', 'Demam berdarah dengue'],
  ['A01.0', 'Demam tifoid'],
  ['B54', 'Malaria'],
  ['N39.0', 'Infeksi saluran kemih'],
  ['L03.9', 'Selulitis'],
  ['R50.9', 'Demam, tidak spesifik'],
  // Metabolik, ginjal, darah
  ['E11.1', 'Diabetes melitus tipe 2 dengan ketoasidosis'],
  ['E16.2', 'Hipoglikemia'],
  ['E87.1', 'Hiponatremia'],
  ['E87.5', 'Hiperkalemia'],
  ['E87.6', 'Hipokalemia'],
  ['N17.9', 'Gagal ginjal akut'],
  ['N18.5', 'Penyakit ginjal kronik stadium 5'],
  ['N23', 'Kolik renal'],
  ['R33', 'Retensi urin'],
  ['D64.9', 'Anemia'],
  // Trauma
  ['S06.0', 'Komosio serebri'],
  ['S06.5', 'Perdarahan subdural traumatik'],
  ['S06.9', 'Cedera intrakranial'],
  ['S01.9', 'Luka terbuka kepala'],
  ['S22.3', 'Fraktur iga'],
  ['S27.0', 'Pneumotoraks traumatik'],
  ['S36.9', 'Cedera organ intraabdomen'],
  ['S32.8', 'Fraktur pelvis'],
  ['S42.0', 'Fraktur klavikula'],
  ['S52.5', 'Fraktur radius distal'],
  ['S72.0', 'Fraktur leher femur'],
  ['S72.3', 'Fraktur batang femur'],
  ['S82.2', 'Fraktur batang tibia'],
  ['S61.9', 'Luka terbuka pergelangan dan tangan'],
  ['S93.4', 'Keseleo pergelangan kaki'],
  ['T07', 'Cedera multipel'],
  ['T14.9', 'Cedera, tidak spesifik'],
  ['T30.0', 'Luka bakar'],
  ['T79.4', 'Syok traumatik'],
  // Keracunan, alergi, lingkungan
  ['T78.2', 'Syok anafilaktik'],
  ['T78.3', 'Angioedema'],
  ['L50.9', 'Urtikaria'],
  ['T63.0', 'Gigitan ular berbisa'],
  ['T60.0', 'Keracunan insektisida organofosfat'],
  ['T50.9', 'Keracunan obat'],
  ['A05.9', 'Keracunan makanan bakterial'],
  ['F10.0', 'Intoksikasi alkohol akut'],
  ['T67.0', 'Heat stroke'],
  ['T75.1', 'Tenggelam'],
  // Obstetri
  ['O00.9', 'Kehamilan ektopik'],
  ['O03.9', 'Abortus spontan'],
  ['O14.1', 'Preeklampsia berat'],
  ['O15.9', 'Eklampsia'],
  ['O72.1', 'Perdarahan pascapersalinan'],
  // Lainnya
  ['F41.0', 'Gangguan panik'],
]

/** Tindakan ICD-9-CM yang sering dilakukan di IGD. Tarif contoh ada di TARIFF.tindakan. */
export const ICD9: [string, string][] = [
  // Jalan napas dan pernapasan
  ['93.96', 'Terapi oksigen'],
  ['93.94', 'Nebulisasi'],
  ['93.90', 'Ventilasi non-invasif (CPAP/BiPAP)'],
  ['96.04', 'Intubasi endotrakeal'],
  ['96.71', 'Ventilasi mekanik kurang dari 96 jam'],
  ['34.04', 'Pemasangan WSD (chest tube)'],
  ['34.91', 'Torakosentesis'],
  // Sirkulasi dan resusitasi
  ['99.60', 'Resusitasi jantung paru'],
  ['99.62', 'Kardioversi / defibrilasi'],
  ['89.52', 'EKG 12 sadapan'],
  ['38.93', 'Pemasangan infus / kateter vena'],
  ['99.04', 'Transfusi packed red cells'],
  ['99.05', 'Transfusi trombosit'],
  // Obat
  ['99.29', 'Injeksi / infus obat'],
  ['99.21', 'Injeksi antibiotik'],
  ['99.18', 'Injeksi / infus elektrolit'],
  ['99.10', 'Injeksi trombolitik'],
  // Luka dan kulit
  ['86.59', 'Penjahitan luka'],
  ['86.22', 'Debridemen luka (eksisional)'],
  ['86.28', 'Perawatan luka / luka bakar (non-eksisional)'],
  ['86.04', 'Insisi dan drainase abses'],
  // Tulang dan sendi
  ['93.54', 'Pemasangan bidai'],
  ['93.53', 'Pemasangan gips'],
  ['79.00', 'Reposisi tertutup fraktur'],
  ['79.70', 'Reposisi tertutup dislokasi'],
  // Saluran cerna dan kemih
  ['96.07', 'Pemasangan selang nasogastrik (NGT)'],
  ['96.33', 'Bilas lambung'],
  ['54.91', 'Parasentesis abdomen'],
  ['57.94', 'Pemasangan kateter urin'],
  // Lainnya
  ['03.31', 'Pungsi lumbal'],
  ['21.01', 'Tampon hidung anterior (epistaksis)'],
  ['98.11', 'Ekstraksi benda asing telinga'],
  ['88.72', 'USG jantung (ekokardiografi) bedside'],
  ['73.59', 'Pertolongan persalinan normal'],
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

export type ViewKey = 'dashboard' | 'board' | 'prearrival' | 'register' | 'patients' | 'history' | 'mci' | 'quality' | 'staff' | 'fhir'
export const NAV: { key: ViewKey; label: string; href: string; group: string }[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard', group: 'Pelayanan' },
  { key: 'board', label: 'Papan IGD', href: '/', group: 'Pelayanan' },
  { key: 'prearrival', label: 'Pra-Kedatangan', href: '/pra-kedatangan', group: 'Pelayanan' },
  { key: 'register', label: 'Pendaftaran Pasien', href: '/pendaftaran', group: 'Pelayanan' },
  { key: 'mci', label: 'Korban Massal', href: '/korban-massal', group: 'Pelayanan' },
  { key: 'patients', label: 'Data Pasien', href: '/data-pasien', group: 'Rekam medis' },
  { key: 'history', label: 'Riwayat Kunjungan', href: '/riwayat', group: 'Rekam medis' },
  { key: 'quality', label: 'Dashboard Mutu', href: '/mutu', group: 'Manajemen' },
  { key: 'staff', label: 'Petugas', href: '/petugas', group: 'Manajemen' },
  { key: 'fhir', label: 'Log Satu Sehat', href: '/satusehat', group: 'Manajemen' },
]
export const ACCESS: Record<Role, ViewKey[]> = {
  pendaftaran: ['dashboard', 'board', 'prearrival', 'register', 'patients', 'history'],
  perawat: ['dashboard', 'board', 'prearrival', 'register', 'patients', 'history', 'fhir'],
  dokter: ['dashboard', 'board', 'prearrival', 'patients', 'history', 'quality', 'fhir'],
  kepala: ['dashboard', 'board', 'prearrival', 'register', 'mci', 'patients', 'history', 'quality', 'staff', 'fhir'],
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
    '93.96': 60_000,
    '93.94': 75_000,
    '93.90': 400_000,
    '96.04': 750_000,
    '96.71': 1_500_000,
    '34.04': 1_250_000,
    '34.91': 600_000,
    '99.60': 1_000_000,
    '99.62': 500_000,
    '89.52': 75_000,
    '38.93': 85_000,
    '99.04': 450_000,
    '99.05': 500_000,
    '99.29': 50_000,
    '99.21': 50_000,
    '99.18': 50_000,
    '99.10': 350_000,
    '86.59': 175_000,
    '86.22': 350_000,
    '86.28': 150_000,
    '86.04': 250_000,
    '93.54': 150_000,
    '93.53': 300_000,
    '79.00': 500_000,
    '79.70': 400_000,
    '96.07': 100_000,
    '96.33': 150_000,
    '54.91': 500_000,
    '57.94': 120_000,
    '03.31': 400_000,
    '21.01': 150_000,
    '98.11': 100_000,
    '88.72': 300_000,
    '73.59': 1_500_000,
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