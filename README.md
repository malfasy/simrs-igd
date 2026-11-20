# SIMRS IGD

Sistem Informasi Manajemen Rumah Sakit untuk **Instalasi Gawat Darurat**. Dibangun dengan Next.js 14 (App Router), TypeScript, dan Firebase (Authentication + Cloud Firestore), dengan pemetaan data ke Satu Sehat (FHIR R4).

Aplikasi bisa langsung dijalankan **tanpa Firebase** (mode demo lokal, data di browser). Begitu konfigurasi Firebase diisi di `.env.local`, aplikasi otomatis memakai login dan database Firestore yang realtime antar perangkat.

## Fitur

| Modul | Isi |
|---|---|
| Data Pasien | Master rekam medis: tambah, lihat, edit, hapus pasien; cari nama/No. RM/NIK/telepon; profil lengkap (alamat, penjamin, golongan darah, alergi, kontak darurat) dan riwayat semua kunjungan IGD pasien |
| Riwayat Kunjungan | Semua kunjungan per rentang tanggal, filter disposisi, pencarian diagnosis, ekspor CSV, tautan ke resume tiap kunjungan |
| Resume Medis IGD | Dokumen siap cetak / simpan PDF: identitas, data kunjungan, anamnesis, tanda vital datang dan terakhir, pemeriksaan, penilaian trauma, hasil penunjang, diagnosis ICD-10, tindakan ICD-9-CM, terapi, jalur kritis, kondisi keluar, tanda tangan dokter |
| Surat Rujukan dan Kwitansi | Dibuat otomatis dari data kunjungan (rujukan untuk disposisi Rujuk, kwitansi setelah pembayaran) |
| Hasil Penunjang | Status tiap order lab/radiologi (diminta, diproses, selesai), isian hasil, tanda nilai kritis, DiagnosticReport ke Satu Sehat |
| Tagihan | Rincian biaya otomatis dari karcis, pemeriksaan, tindakan, penunjang, dan obat; item manual; pembayaran tunai/debit/QRIS atau tagihan ke BPJS/asuransi |
| Petugas | Daftar akun petugas dan pengubahan peran oleh Kepala IGD, tabel hak akses per peran |
| Papan IGD | Kartu pasien berurut level triase, timer waktu tunggu yang berubah kuning/merah saat mendekati/melewati target, status bed, notifikasi ambulans, kartu berkedip saat skor peringatan tinggi |
| Pra-Kedatangan | Notifikasi ambulans format MIST, tombol "pasien tiba" yang langsung mendaftarkan pasien tanpa identitas dan menyalin data MIST |
| Pendaftaran Cepat | Field wajib minimal, pasien tanpa identitas (No. RM sementara), cek pasien lama lewat NIK untuk mencegah data ganda |
| Triase | Saran level 1-5 otomatis dari tanda vital dan keluhan, alasan wajib jika perawat memilih level berbeda, riwayat triase ulang |
| Asesmen & Tindakan | Anamnesis, diagnosis ICD-10, tindakan ICD-9-CM, order penunjang CITO, resep, CPPT SOAP, jalur kritis STEMI/stroke/sepsis dengan timer |
| Observasi | Tanda vital berkala, skor NEWS2 dan grafiknya, pengingat interval observasi, simulasi data monitor bedside (HL7) |
| Trauma | Golden hour, saran aktivasi tim trauma, GCS dan Revised Trauma Score, MIST, primary survey ABCDE, peta cedera interaktif, FAST, protokol transfusi masif |
| Disposisi | Pulang, rawat inap, rujuk, pulang atas permintaan sendiri, meninggal; jam keputusan dan jam keluar dicatat terpisah |
| Korban Massal | Aktivasi kejadian (banner di semua layar), registrasi massal, triase START tanya-jawab, kapasitas RS, papan informasi keluarga, rekap laporan |
| Dashboard Mutu | Waktu tanggap per level vs target, persentase sesuai target, median lama di IGD, kedatangan per jam, distribusi disposisi |
| Log Satu Sehat | Semua resource FHIR yang dibuat (Patient, Encounter class EMER, Observation, Condition, Procedure, ServiceRequest, MedicationRequest) |

### Peran dan hak akses

| Peran | Menu | Tab pasien |
|---|---|---|
| Petugas Pendaftaran | Papan, Pra-Kedatangan, Pendaftaran, Data Pasien, Riwayat | Ringkasan, Tagihan |
| Perawat IGD | Papan, Pra-Kedatangan, Pendaftaran, Data Pasien, Riwayat, Log Satu Sehat | Ringkasan, Triase, Hasil Penunjang, Observasi, Trauma |
| Dokter IGD | Papan, Pra-Kedatangan, Data Pasien, Riwayat, Dashboard Mutu, Log Satu Sehat | Semua tab klinis (tanpa Tagihan) |
| Kepala IGD | Semua menu, termasuk Korban Massal, Petugas, dan pengelolaan data demo | Semua tab |

### Alur pengelolaan pasien

1. Pasien datang: **Pendaftaran Cepat** (cari pasien lama atau buat pasien baru, otomatis masuk Data Pasien) atau **Pra-Kedatangan** dari ambulans.
2. **Triase** oleh perawat, kartu pasien naik ke posisi sesuai prioritas di Papan IGD.
3. Dokter **Mulai penanganan**, mengisi **Asesmen & Tindakan** (diagnosis, tindakan, order penunjang, resep, CPPT).
4. **Hasil Penunjang** diisi, **Observasi** tanda vital berkala dengan skor NEWS2.
5. **Disposisi** (pulang, rawat inap, rujuk, APS, meninggal), **Tagihan** dibayar, pasien keluar IGD.
6. **Resume Medis** dicetak; seluruh kunjungan tersimpan di **Riwayat Kunjungan** dan profil **Data Pasien**.

## Menjalankan di komputer

Butuh Node.js 18.17 atau lebih baru.

```bash
npm install
npm run dev
```

Buka http://localhost:3000. Tanpa `.env.local`, aplikasi berjalan di **mode demo lokal**: pilih peran di halaman masuk, data contoh dimuat otomatis dan disimpan di localStorage browser. Peran bisa diganti dari kanan atas.

Perintah lain:

```bash
npm run build      # build produksi
npm run start      # jalankan hasil build
npm run typecheck  # cek tipe TypeScript
npm run lint       # cek ESLint
```

## Menghubungkan ke Firebase

1. **Buat project** di [Firebase Console](https://console.firebase.google.com).
2. **Tambah Web App** di Project settings > General > Your apps > ikon `</>`. Salin nilai konfigurasinya.
3. **Isi `.env.local`**: salin `.env.example` menjadi `.env.local`, lalu isi semua `NEXT_PUBLIC_FIREBASE_*`.
4. **Aktifkan login**: Security > Authentication > Get started > Sign-in method > aktifkan **Email/Password**. Untuk tombol "Masuk dengan Google", aktifkan juga provider **Google** (pilih support email lalu Save). Pengguna yang masuk lewat Google pertama kali akan diminta melengkapi nama dan peran.
5. **Buat database**: Build > Firestore Database > Create database. Pilih mode production dan lokasi `asia-southeast2 (Jakarta)`.
6. **Pasang aturan keamanan** dari file `firestore.rules`. Pilih salah satu:
   - Lewat Console: Firestore Database > Rules, tempel isi `firestore.rules`, klik Publish.
   - Lewat CLI:
     ```bash
     npm install -g firebase-tools
     firebase login
     firebase use --add          # pilih project kamu
     firebase deploy --only firestore:rules
     ```
7. Jalankan ulang `npm run dev`. Halaman masuk sekarang berisi form email dan kata sandi.
8. Klik **Daftar akun petugas**, buat akun pertama dengan peran **Kepala IGD**, lalu klik **Muat data contoh** di papan atau di menu samping.
9. Buat akun lain (perawat, dokter) dari browser atau perangkat lain untuk mencoba data realtime.

Tidak perlu membuat index tambahan; semua query memakai index satu field bawaan Firestore.

Setiap kali `firestore.rules` berubah, tempel ulang isinya di Firestore > Rules lalu Publish.

### Struktur Firestore

```
users/{uid}           nama, peran, email
patients/{patientId}  data master pasien (rekam medis)
visits/{visitId}      satu dokumen per kunjungan IGD (triase, tanda vital, asesmen, trauma, disposisi, linimasa)
prearrivals/{id}      notifikasi ambulans
fhirLogs/{autoId}     log resource Satu Sehat (hanya bisa ditambah)
meta/igd              mode korban massal aktif, riwayat kejadian, kapasitas
meta/counters         penomoran RM, registrasi, nomor sementara (pakai transaksi)
```

## Deploy ke Vercel

1. Push repo ke GitHub.
2. Import project di Vercel.
3. Isi Environment Variables yang sama dengan `.env.local` di Settings > Environment Variables.
4. Tambahkan domain Vercel di Firebase Console > Authentication > Settings > Authorized domains.

## Satu Sehat

Secara bawaan `NEXT_PUBLIC_SATUSEHAT_MODE=mock`: resource FHIR dibentuk lengkap dan dicatat di **Log Satu Sehat**, tanpa dikirim ke server Kemenkes.

Mode `sandbox` mengirim resource lewat API route `app/api/satusehat/route.ts` (token OAuth2 client credentials, kredensial hanya di server). Isi `SATUSEHAT_ORG_ID`, `SATUSEHAT_CLIENT_ID`, dan `SATUSEHAT_CLIENT_SECRET` dari [platform Satu Sehat](https://satusehat.kemkes.go.id/platform). Server Satu Sehat mensyaratkan ID resmi (Patient IHS number, Practitioner, Location), jadi pengiriman sandbox akan ditolak sampai pemetaan ID itu ditambahkan di `lib/fhir.ts`.

## Struktur kode

```
app/                      halaman (App Router) dan API route
  page.tsx                Papan IGD
  pasien/[id]/            detail kunjungan dengan 8 tab
  pasien/[id]/[doc]/      dokumen cetak: resume, rujukan, kwitansi
  data-pasien/            daftar, tambah, dan profil pasien
  riwayat/ petugas/ pra-kedatangan/ pendaftaran/ korban-massal/ mutu/ satusehat/
  api/satusehat/route.ts  pengiriman ke Satu Sehat (mode sandbox)
components/
  AppShell.tsx            bilah atas, menu, banner korban massal, kontrol akses
  LoginScreen.tsx         masuk mode lokal / Firebase
  providers.tsx           konteks data dan autentikasi
  board/ detail/ pages/   UI tiap modul
  patients/               data master pasien
  print/                  dokumen cetak
  ui/                     timer, chip, grafik, toast
lib/
  types.ts                tipe data
  constants.ts            level triase, bed, ICD, kriteria, hak akses
  clinical.ts             NEWS2, saran triase, GCS, RTS, format waktu
  fhir.ts                 pembentuk resource FHIR R4
  actions.ts              semua operasi bisnis (daftar, triase, disposisi, dst.)
  seed.ts                 data contoh
  data/                   LocalStore (localStorage) dan FirestoreStore
firestore.rules           aturan keamanan Firestore
```

Semua perubahan data lewat `lib/actions.ts`. Komponen tidak menulis ke database langsung, jadi logika klinis bisa diuji dan dipindah ke backend lain tanpa mengubah UI.

## Kerja kelompok dengan GitHub

1. Satu anggota membuat repository (Private), lalu menambahkan anggota lain lewat Settings > Collaborators.
2. Semua anggota `git clone`, membuat `.env.local` sendiri (tidak ikut ter-push), lalu `npm install`.
3. Kerjakan per fitur di branch terpisah (`git checkout -b fitur-tagihan`), commit kecil dengan pesan jelas, push, lalu buat Pull Request ke `main`.
4. Jalankan `npm run build` sebelum push untuk memastikan tidak ada error.

## Batasan yang perlu diketahui

- Tarif di `lib/constants.ts` dan identitas rumah sakit (`HOSPITAL`) adalah contoh fiktif.

- Saran triase memakai aturan sederhana yang diadaptasi dari skala 5 level. Ini alat bantu, bukan pengganti penilaian klinis, dan ambangnya perlu disesuaikan dengan pedoman triase rumah sakit.
- NEWS2 di sini menyederhanakan penilaian kesadaran (GCS di bawah 15 dihitung bukan "Alert") dan hanya untuk pasien 16 tahun ke atas. Skor anak (PEWS) belum dibuat.
- Kode LOINC triase (75910-0) dan cara datang (74286-6) diambil dari sumber sekunder. Cocokkan dengan playbook modul IGD resmi Satu Sehat.
- Target waktu jalur kritis adalah contoh untuk demo.
- Pemilihan peran saat daftar akun disediakan untuk demo. Di rumah sakit sungguhan, peran diberikan admin (aturan Firestore sudah mencegah petugas mengubah perannya sendiri).
- Penyimpanan kunjungan menimpa satu dokumen utuh. Jika dua petugas menyimpan tab berbeda pada pasien yang sama di detik yang sama, simpanan terakhir yang berlaku.
- Data contoh (nama, NIK, No. RM) fiktif.
