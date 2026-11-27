'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { COLOR_LABEL, DISPO, HOSPITAL, LEVELS, MODES, ORDER_STATUS_LABEL } from '@/lib/constants'
import { billTotal, complaintLabel, computeBill, displayName, displayRm, dur, icd10Label, icd9Label, lastVital, orderLabel, rupiah, tanggal, tanggalJam } from '@/lib/clinical'
import type { Patient, Visit, VitalSign } from '@/lib/types'
import { useData, useVisit } from '../providers'
import { Empty } from '../ui'

export type JenisDokumen = 'resume' | 'rujukan' | 'kwitansi'
const JUDUL: Record<JenisDokumen, string> = { resume: 'Resume Medis', rujukan: 'Surat Rujukan', kwitansi: 'Kwitansi' }

/* ---------- Bantuan ---------- */
const ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

/** Nomor dokumen dari nomor registrasi, contoh: 012/RJK/IGD/XI/2026. */
export const nomorSurat = (v: Visit, kode: string, at = Date.now()) => {
  const d = new Date(at)
  const n = v.regNo.replace(/\D/g, '').padStart(3, '0')
  return `${n}/${kode}/IGD/${ROMAWI[d.getMonth()]}/${d.getFullYear()}`
}

const SATUAN = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas']
/** Angka ke kata dalam bahasa Indonesia, untuk kolom "terbilang" kwitansi. */
export function terbilang(n: number): string {
  n = Math.floor(Math.abs(n))
  if (n < 12) return SATUAN[n]
  if (n < 20) return `${terbilang(n - 10)} belas`
  if (n < 100) return `${terbilang(Math.floor(n / 10))} puluh ${terbilang(n % 10)}`.trim()
  if (n < 200) return `seratus ${terbilang(n - 100)}`.trim()
  if (n < 1000) return `${terbilang(Math.floor(n / 100))} ratus ${terbilang(n % 100)}`.trim()
  if (n < 2000) return `seribu ${terbilang(n - 1000)}`.trim()
  if (n < 1_000_000) return `${terbilang(Math.floor(n / 1000))} ribu ${terbilang(n % 1000)}`.trim()
  if (n < 1_000_000_000) return `${terbilang(Math.floor(n / 1_000_000))} juta ${terbilang(n % 1_000_000)}`.trim()
  return `${terbilang(Math.floor(n / 1_000_000_000))} miliar ${terbilang(n % 1_000_000_000)}`.trim()
}
const kapital = (s: string) => s.replace(/(^|\s)\S/g, (c) => c.toUpperCase())

const ttv = (x: VitalSign | null) =>
  x ? `TD ${x.sys}/${x.dia} mmHg · Nadi ${x.hr}x/mnt · RR ${x.rr}x/mnt · Suhu ${x.temp} °C · SpO₂ ${x.spo2}%${x.o2 ? ' (O₂)' : ''} · GCS ${x.gcs}` : '-'

/* ---------- Halaman cetak ---------- */
export function HalamanCetak({ id, jenis }: { id: string; jenis: JenisDokumen }) {
  const { v, loading } = useVisit(id)
  const data = useData()
  if (loading) return <div className="loading">Memuat dokumen...</div>
  if (!v) return <Empty>Kunjungan tidak ditemukan.</Empty>
  const master = v.patientId ? data.patients.find((p) => p.id === v.patientId) ?? null : null
  const tab = jenis === 'kwitansi' ? 'tagihan' : 'disposisi'

  return (
    <>
      <div className="row no-print" style={{ marginBottom: 12, justifyContent: 'space-between' }}>
        <Link className="btn sm" href={`/pasien/${encodeURIComponent(v.id)}?tab=${tab}`}>
          &larr; Kembali ke pasien
        </Link>
        <div className="row">
          {(['resume', 'rujukan', 'kwitansi'] as JenisDokumen[]).map((j) => (
            <Link key={j} className={`btn sm ${j === jenis ? 'primary' : ''}`} href={`/pasien/${encodeURIComponent(v.id)}/cetak?jenis=${j}`}>
              {JUDUL[j]}
            </Link>
          ))}
          <button type="button" className="btn primary" onClick={() => window.print()}>
            Cetak / simpan PDF
          </button>
        </div>
      </div>
      {jenis === 'resume' && <Resume v={v} p={master} />}
      {jenis === 'rujukan' && <Rujukan v={v} p={master} />}
      {jenis === 'kwitansi' && <Kwitansi v={v} p={master} />}
    </>
  )
}

function Kop() {
  return (
    <div className="kop">
      <div className="kop-logo">+</div>
      <div>
        <div className="kop-name">{HOSPITAL.name}</div>
        <div>{HOSPITAL.unit}</div>
        <div className="small">
          {HOSPITAL.address} · Telp. {HOSPITAL.phone}
        </div>
      </div>
    </div>
  )
}

function Ttd({ jabatan, nama, at }: { jabatan: string; nama: string; at: number }) {
  return (
    <div className="sign">
      <div>
        {HOSPITAL.city}, {tanggal(at)}
      </div>
      <div>{jabatan}</div>
      <div className="sign-space" />
      <div>
        <b>
          <u>{nama || '....................................'}</u>
        </b>
      </div>
    </div>
  )
}

function Sec({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="doc-sec">
      <h2>{title}</h2>
      {children}
    </div>
  )
}

function Identitas({ v, p }: { v: Visit; p: Patient | null }) {
  return (
    <table className="doc-kv">
      <tbody>
        <tr>
          <th>Nama</th>
          <td>{displayName(v)}</td>
          <th>No. RM</th>
          <td className="mono">{displayRm(v)}</td>
        </tr>
        <tr>
          <th>Jenis kelamin</th>
          <td>{v.patient.sex === 'P' ? 'Perempuan' : 'Laki-laki'}</td>
          <th>Umur</th>
          <td>{v.patient.age !== null ? `${v.patient.ageEstimated ? '±' : ''}${v.patient.age} tahun` : '-'}</td>
        </tr>
        <tr>
          <th>NIK</th>
          <td className="mono">{v.patient.nik || '-'}</td>
          <th>Penjamin</th>
          <td>
            {v.insurance}
            {p?.insuranceNo ? ` (${p.insuranceNo})` : ''}
          </td>
        </tr>
        <tr>
          <th>Alamat</th>
          <td colSpan={3}>{p?.address || '-'}</td>
        </tr>
      </tbody>
    </table>
  )
}

const Draft = ({ show, children }: { show: boolean; children: ReactNode }) => (show ? <div className="draft no-print">{children}</div> : null)

/* ---------- Resume medis ---------- */
function Resume({ v, p }: { v: Visit; p: Patient | null }) {
  const a = v.assessment
  const t = v.triage[v.triage.length - 1]
  const d = v.disposition
  const done = Object.entries(v.results).filter(([, r]) => r.status === 'selesai')
  const pending = Object.entries(v.results).filter(([, r]) => r.status !== 'selesai')
  return (
    <article className="paper">
      <Kop />
      <div className="doc-title">Resume Medis Gawat Darurat</div>
      <Draft show={!v.leftAt}>Draf: pasien belum keluar IGD. Isi resume dapat berubah.</Draft>
      {!a && <div className="draft no-print">Asesmen dokter belum diisi. Diagnosis dan terapi akan kosong.</div>}

      <Sec title="Identitas pasien">
        <Identitas v={v} p={p} />
      </Sec>

      <Sec title="Data kunjungan">
        <table className="doc-kv">
          <tbody>
            <tr>
              <th>No. registrasi</th>
              <td className="mono">{v.regNo}</td>
              <th>Cara datang</th>
              <td>
                {MODES[v.arrivalMode]}
                {v.referral ? ', dengan rujukan' : ''}
              </td>
            </tr>
            <tr>
              <th>Tanggal masuk</th>
              <td>{tanggalJam(v.arrivalTime)}</td>
              <th>Tanggal keluar</th>
              <td>{v.leftAt ? tanggalJam(v.leftAt) : '-'}</td>
            </tr>
            <tr>
              <th>Triase</th>
              <td>{t ? (t.level ? `Level ${t.level} (${LEVELS[t.level].name}, ${COLOR_LABEL[t.color]})` : `START ${COLOR_LABEL[t.color]}`) : '-'}</td>
              <th>Lama di IGD</th>
              <td>{v.leftAt ? dur(v.leftAt - v.arrivalTime) : '-'}</td>
            </tr>
            <tr>
              <th>DPJP IGD</th>
              <td>{v.doctor ?? a?.by ?? '-'}</td>
              <th>Waktu tanggap</th>
              <td>{v.doctorSeenAt ? dur(v.doctorSeenAt - v.arrivalTime) : '-'}</td>
            </tr>
          </tbody>
        </table>
      </Sec>

      <Sec title="Anamnesis">
        <p>
          <b>Keluhan utama:</b> {complaintLabel(v.complaint)}
          {v.complaintNote ? `, ${v.complaintNote}` : ''}
        </p>
        <p style={{ whiteSpace: 'pre-wrap' }}>{a?.anamnesis || '-'}</p>
        <p>
          <b>Riwayat alergi:</b> {a?.allergy || p?.allergies || '-'}
        </p>
      </Sec>

      <Sec title="Pemeriksaan fisik">
        <p>
          <b>Tanda vital awal:</b> {ttv(v.vitals[0] ?? null)}
        </p>
        <p style={{ whiteSpace: 'pre-wrap' }}>{a?.exam || '-'}</p>
      </Sec>

      <Sec title="Pemeriksaan penunjang">
        {done.length || pending.length ? (
          <table className="doc-table">
            <thead>
              <tr>
                <th>Pemeriksaan</th>
                <th>Hasil</th>
                <th>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {[...done, ...pending].map(([k, r]) => (
                <tr key={k}>
                  <td>{orderLabel(k)}</td>
                  <td style={{ whiteSpace: 'pre-wrap' }}>{r.result || '-'}</td>
                  <td>{r.status === 'selesai' ? (r.critical ? 'Nilai kritis' : 'Selesai') : ORDER_STATUS_LABEL[r.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>Tidak dilakukan.</p>
        )}
      </Sec>

      <Sec title="Diagnosis">
        {a?.diagnoses.length ? (
          <table className="doc-table">
            <thead>
              <tr>
                <th style={{ width: 110 }}>Jenis</th>
                <th style={{ width: 80 }}>ICD-10</th>
                <th>Diagnosis</th>
              </tr>
            </thead>
            <tbody>
              {a.diagnoses.map((c, i) => (
                <tr key={c}>
                  <td>{i === 0 ? 'Utama' : 'Sekunder'}</td>
                  <td className="mono">{c}</td>
                  <td>{icd10Label(c)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>-</p>
        )}
      </Sec>

      <Sec title="Tindakan dan terapi">
        <p>
          <b>Tindakan:</b> {a?.procedures.length ? a.procedures.map((c) => `${icd9Label(c)} (${c})`).join('; ') : '-'}
        </p>
        <p>
          <b>Obat/terapi di IGD:</b> {a?.drugs.length ? a.drugs.join('; ') : '-'}
        </p>
      </Sec>

      <Sec title="Kondisi dan tindak lanjut">
        <table className="doc-kv">
          <tbody>
            <tr>
              <th>Tanda vital akhir</th>
              <td>{ttv(lastVital(v))}</td>
            </tr>
            <tr>
              <th>Cara keluar</th>
              <td>{d ? DISPO[d.type] : 'Belum diputuskan'}</td>
            </tr>
            {d?.type === 'rawat_inap' && (
              <tr>
                <th>Ruang tujuan</th>
                <td>{d.detail.room || '-'}</td>
              </tr>
            )}
            {d?.type === 'rujuk' && (
              <tr>
                <th>Dirujuk ke</th>
                <td>{d.detail.referralTarget || '-'}</td>
              </tr>
            )}
            {d?.type === 'meninggal' && (
              <tr>
                <th>Meninggal</th>
                <td>
                  Jam {d.detail.timeOfDeath || '-'}
                  {d.detail.causeOfDeath ? `, sebab: ${d.detail.causeOfDeath}` : ''}
                </td>
              </tr>
            )}
            <tr>
              <th>Edukasi / instruksi</th>
              <td style={{ whiteSpace: 'pre-wrap' }}>{d?.detail.education || d?.note || '-'}</td>
            </tr>
          </tbody>
        </table>
      </Sec>

      <Ttd jabatan="Dokter Penanggung Jawab IGD" nama={v.doctor ?? a?.by ?? ''} at={v.leftAt ?? Date.now()} />
    </article>
  )
}

/* ---------- Surat rujukan ---------- */
function Rujukan({ v, p }: { v: Visit; p: Patient | null }) {
  const a = v.assessment
  const d = v.disposition
  const at = d?.decidedAt ?? Date.now()
  const done = Object.entries(v.results).filter(([, r]) => r.status === 'selesai')
  return (
    <article className="paper">
      <Kop />
      <div className="doc-title" style={{ marginBottom: 2 }}>
        Surat Rujukan
      </div>
      <p style={{ textAlign: 'center', margin: '0 0 14px' }} className="mono">
        No. {nomorSurat(v, 'RJK', at)}
      </p>
      <Draft show={d?.type !== 'rujuk'}>Disposisi pasien belum ditetapkan &quot;Rujuk&quot;. Surat ini masih draf.</Draft>

      <p>
        Kepada Yth.
        <br />
        <b>Dokter Jaga / Sejawat di {d?.detail.referralTarget || '....................................'}</b>
        <br />
        di tempat
      </p>
      <p>Dengan hormat, mohon pemeriksaan dan penanganan lebih lanjut untuk pasien berikut:</p>

      <Sec title="Identitas pasien">
        <Identitas v={v} p={p} />
      </Sec>

      <Sec title="Ringkasan klinis">
        <table className="doc-kv">
          <tbody>
            <tr>
              <th>Keluhan utama</th>
              <td>
                {complaintLabel(v.complaint)}
                {v.complaintNote ? `, ${v.complaintNote}` : ''}
              </td>
            </tr>
            <tr>
              <th>Anamnesis</th>
              <td style={{ whiteSpace: 'pre-wrap' }}>{a?.anamnesis || '-'}</td>
            </tr>
            <tr>
              <th>Pemeriksaan fisik</th>
              <td style={{ whiteSpace: 'pre-wrap' }}>{a?.exam || '-'}</td>
            </tr>
            <tr>
              <th>Tanda vital terakhir</th>
              <td>
                {ttv(lastVital(v))}
                {lastVital(v) ? ` (jam ${new Date(lastVital(v)!.at).toTimeString().slice(0, 5)})` : ''}
              </td>
            </tr>
            <tr>
              <th>Alergi</th>
              <td>{a?.allergy || p?.allergies || '-'}</td>
            </tr>
            <tr>
              <th>Hasil penunjang</th>
              <td>{done.length ? done.map(([k, r]) => `${orderLabel(k)}: ${r.result}${r.critical ? ' (kritis)' : ''}`).join('; ') : '-'}</td>
            </tr>
          </tbody>
        </table>
      </Sec>

      <Sec title="Diagnosis kerja">
        <p>{a?.diagnoses.length ? a.diagnoses.map((c) => `${icd10Label(c)} (${c})`).join('; ') : '-'}</p>
      </Sec>

      <Sec title="Tindakan dan terapi yang sudah diberikan">
        <p>{[...(a?.procedures.map((c) => icd9Label(c)) ?? []), ...(a?.drugs ?? [])].join('; ') || '-'}</p>
      </Sec>

      <Sec title="Alasan rujukan">
        <p style={{ whiteSpace: 'pre-wrap' }}>{d?.note || '....................................................................'}</p>
      </Sec>

      <p style={{ marginTop: 14 }}>Atas perhatian dan kerja samanya, kami ucapkan terima kasih.</p>
      <Ttd jabatan="Dokter yang merujuk" nama={d?.decidedBy ?? v.doctor ?? ''} at={at} />
    </article>
  )
}

/* ---------- Kwitansi / rincian biaya ---------- */
function Kwitansi({ v, p }: { v: Visit; p: Patient | null }) {
  const pay = v.billing.payment
  const items = computeBill(v)
  const total = pay?.total ?? billTotal(items)
  const at = pay?.at ?? Date.now()
  const viaPenjamin = pay && (pay.method === 'BPJS' || pay.method === 'Asuransi')
  return (
    <article className="paper">
      <Kop />
      <div className="doc-title" style={{ marginBottom: 2 }}>
        {pay ? (viaPenjamin ? `Bukti Tagihan ${pay.method}` : 'Kwitansi Pembayaran') : 'Rincian Biaya Pelayanan'}
      </div>
      <p style={{ textAlign: 'center', margin: '0 0 14px' }} className="mono">
        {pay ? `No. ${pay.receiptNo}` : `Reg. ${v.regNo}`}
      </p>
      <Draft show={!pay}>Belum dibayar. Dokumen ini hanya rincian biaya sementara.</Draft>

      {pay && !viaPenjamin && (
        <table className="doc-kv" style={{ marginBottom: 10 }}>
          <tbody>
            <tr>
              <th>Telah terima dari</th>
              <td>
                {displayName(v)} (No. RM {displayRm(v)})
              </td>
            </tr>
            <tr>
              <th>Uang sejumlah</th>
              <td>
                <i>{kapital(terbilang(total))} rupiah</i>
              </td>
            </tr>
            <tr>
              <th>Untuk pembayaran</th>
              <td>Pelayanan Instalasi Gawat Darurat tanggal {tanggal(v.arrivalTime)}</td>
            </tr>
          </tbody>
        </table>
      )}
      {(!pay || viaPenjamin) && (
        <Sec title="Identitas pasien">
          <Identitas v={v} p={p} />
        </Sec>
      )}

      <Sec title="Rincian">
        <table className="doc-table">
          <thead>
            <tr>
              <th style={{ width: 28 }}>No</th>
              <th>Uraian</th>
              <th style={{ width: 110 }}>Kelompok</th>
              <th style={{ width: 40, textAlign: 'right' }}>Jml</th>
              <th style={{ width: 100, textAlign: 'right' }}>Tarif</th>
              <th style={{ width: 110, textAlign: 'right' }}>Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i, n) => (
              <tr key={i.id}>
                <td>{n + 1}</td>
                <td>{i.name}</td>
                <td>{i.group}</td>
                <td style={{ textAlign: 'right' }}>{i.qty}</td>
                <td style={{ textAlign: 'right' }}>{rupiah(i.price)}</td>
                <td style={{ textAlign: 'right' }}>{rupiah(i.qty * i.price)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={5} style={{ textAlign: 'right' }}>
                Total
              </th>
              <th style={{ textAlign: 'right' }}>{rupiah(total)}</th>
            </tr>
          </tfoot>
        </table>
        <p>
          <b>Terbilang:</b> <i>{kapital(terbilang(total))} rupiah</i>
        </p>
        {pay && (
          <p>
            <b>Metode:</b> {pay.method}
            {viaPenjamin ? ' (ditagihkan ke penjamin, pasien tidak membayar)' : ''} · <b>Waktu:</b> {tanggalJam(pay.at)}
          </p>
        )}
      </Sec>

      <Ttd jabatan={pay ? 'Kasir' : 'Petugas'} nama={pay?.by ?? ''} at={at} />
    </article>
  )
}
