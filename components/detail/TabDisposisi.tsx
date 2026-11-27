'use client'

import Link from 'next/link'
import { useState } from 'react'
import { BOARDING_LIMIT, DISPO, WARDS } from '@/lib/constants'
import { dur, hm, icd10Label, lastVital, orderLabel } from '@/lib/clinical'
import { decideDisposition, dischargeVisit } from '@/lib/actions'
import type { DispositionDetail, DispositionType, Visit } from '@/lib/types'
import { useCtx } from '../providers'
import { Chip, ConfirmButton, Timer, useRunner } from '../ui'

export function TabDisposisi({ v }: { v: Visit }) {
  const ctx = useCtx()!
  const { busy, run } = useRunner()
  const d = v.disposition
  const [type, setType] = useState<DispositionType>(d?.type ?? 'pulang')
  const [detail, setDetail] = useState<DispositionDetail>(
    d?.detail ?? { room: WARDS[0], timeOfDeath: hm(Date.now()) },
  )
  const [note, setNote] = useState('')
  const set = (patch: Partial<DispositionDetail>) => setDetail({ ...detail, ...patch })

  if (v.leftAt && d)
    return (
      <section className="panel">
        <h3>Pasien sudah keluar IGD</h3>
        <dl className="kv" style={{ marginTop: 8 }}>
          <dt>Disposisi</dt>
          <dd>{DISPO[d.type]}</dd>
          <dt>Catatan</dt>
          <dd>{d.note || '-'}</dd>
          <dt>Diputuskan</dt>
          <dd className="mono">
            {hm(d.decidedAt)} oleh {d.decidedBy}
          </dd>
          <dt>Keluar IGD</dt>
          <dd className="mono">{hm(v.leftAt)}</dd>
          <dt>Lama di IGD</dt>
          <dd className="mono">{dur(v.leftAt - v.arrivalTime)}</dd>
        </dl>
        <Dokumen v={v} />
      </section>
    )

  return (
    <div className="grid2">
      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault()
          void run(() => decideDisposition(ctx, v, { type, note, detail }), 'Keputusan disimpan. Klik "Pasien keluar IGD" saat pasien benar-benar meninggalkan IGD.')
        }}
      >
        <h3>{d ? 'Ubah keputusan disposisi' : 'Keputusan disposisi'}</h3>
        <div className="checks" style={{ gridTemplateColumns: '1fr 1fr', margin: '10px 0' }}>
          {(Object.keys(DISPO) as DispositionType[]).map((k) => (
            <label key={k}>
              <input type="radio" name="dispo" checked={type === k} onChange={() => setType(k)} />
              <span>{DISPO[k]}</span>
            </label>
          ))}
        </div>
        <div className="fields" style={{ gridTemplateColumns: '1fr' }}>
          {type === 'pulang' && (
            <div className="f">
              <label htmlFor="d-edu">Edukasi dan rencana kontrol</label>
              <input type="text" id="d-edu" value={detail.education ?? ''} onChange={(e) => set({ education: e.target.value })} placeholder="Contoh: kontrol poli bedah 5 hari" />
            </div>
          )}
          {type === 'rawat_inap' && (
            <div className="f">
              <label htmlFor="d-room">Ruang tujuan</label>
              <select id="d-room" value={detail.room ?? WARDS[0]} onChange={(e) => set({ room: e.target.value })}>
                {WARDS.map((w) => (
                  <option key={w}>{w}</option>
                ))}
              </select>
            </div>
          )}
          {type === 'rujuk' && (
            <div className="f">
              <label htmlFor="d-rs">RS tujuan dan alasan rujukan</label>
              <input type="text" id="d-rs" value={detail.referralTarget ?? ''} onChange={(e) => set({ referralTarget: e.target.value })} placeholder="Contoh: RS rujukan, butuh bedah saraf" />
            </div>
          )}
          {type === 'aps' && (
            <label className="row">
              <input type="checkbox" checked={!!detail.refusalSigned} onChange={(e) => set({ refusalSigned: e.target.checked })} /> Formulir penolakan tindakan sudah ditandatangani
            </label>
          )}
          {type === 'meninggal' && (
            <>
              <div className="f">
                <label htmlFor="d-tod">Jam meninggal</label>
                <input type="text" id="d-tod" value={detail.timeOfDeath ?? ''} onChange={(e) => set({ timeOfDeath: e.target.value })} />
              </div>
              <div className="f">
                <label htmlFor="d-cod">Sebab kematian</label>
                <input type="text" id="d-cod" value={detail.causeOfDeath ?? ''} onChange={(e) => set({ causeOfDeath: e.target.value })} />
              </div>
            </>
          )}
          <div className="f">
            <label htmlFor="d-note">Catatan serah terima</label>
            <textarea id="d-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <div className="formfoot">
          <button className="btn primary" disabled={busy}>
            Simpan keputusan
          </button>
        </div>
      </form>

      <div className="stack">
      <Kesiapan v={v} />
      <section className="panel">
        <h3>Status keluar</h3>
        {d ? (
          <>
            <dl className="kv" style={{ marginTop: 8 }}>
              <dt>Keputusan</dt>
              <dd>{DISPO[d.type]}</dd>
              <dt>Catatan</dt>
              <dd>{d.note || '-'}</dd>
              <dt>Diputuskan</dt>
              <dd className="mono">
                {hm(d.decidedAt)} oleh {d.decidedBy}
              </dd>
              <dt>Menunggu sejak keputusan</dt>
              <dd>
                <Timer since={d.decidedAt} target={BOARDING_LIMIT} />
              </dd>
            </dl>
            <p className="note">
              Jam keputusan dan jam keluar dicatat terpisah karena pasien yang tertahan di IGD (misalnya menunggu bed rawat inap) jadi salah satu penyebab IGD penuh.
            </p>
            <div className="formfoot">
              <ConfirmButton
                className="btn primary"
                disabled={busy}
                confirmText="Klik lagi untuk konfirmasi"
                onConfirm={() => void run(() => dischargeVisit(ctx, v), (bed) => `Pasien keluar IGD.${bed ? ` Bed ${bed} kosong.` : ''}`)}
              >
                Pasien keluar IGD
              </ConfirmButton>
              <span className="small muted">Encounter ditutup dan dikirim ke Satu Sehat.</span>
            </div>
          </>
        ) : (
          <p className="muted" style={{ marginTop: 8 }}>
            Belum ada keputusan. Simpan keputusan di kiri dulu.
          </p>
        )}
        <Dokumen v={v} />
      </section>
      </div>
    </div>
  )
}

/* ---------- Cek kesiapan sebelum pasien keluar ---------- */
type Cek = { ok: boolean | 'info'; text: string }

function Kesiapan({ v }: { v: Visit }) {
  const a = v.assessment
  const pending = Object.entries(v.results).filter(([, r]) => r.status !== 'selesai')
  const kritis = Object.entries(v.results).filter(([, r]) => r.critical)
  const lv = lastVital(v)
  const pay = v.billing.payment
  const list: Cek[] = [
    { ok: !!a?.diagnoses.length, text: a?.diagnoses.length ? `Diagnosis utama: ${a.diagnoses[0]} ${icd10Label(a.diagnoses[0])}` : 'Diagnosis belum diisi di tab Asesmen (resume medis akan kosong)' },
    { ok: pending.length === 0, text: pending.length ? `${pending.length} penunjang belum ada hasil: ${pending.map(([k]) => orderLabel(k)).join(', ')}` : 'Semua hasil penunjang sudah keluar' },
    ...(kritis.length ? [{ ok: 'info' as const, text: `Ada ${kritis.length} nilai kritis. Pastikan sudah ditindaklanjuti dan dicatat di CPPT.` }] : []),
    { ok: !!lv && Date.now() - lv.at < 60 * 60_000, text: lv ? `Tanda vital terakhir jam ${hm(lv.at)}${Date.now() - lv.at >= 60 * 60_000 ? ', lebih dari 1 jam lalu' : ''}` : 'Belum ada tanda vital' },
    {
      ok: pay ? true : v.insurance === 'Umum' ? false : 'info',
      text: pay ? `Tagihan ${pay.method === 'BPJS' || pay.method === 'Asuransi' ? `ditagihkan ke ${pay.method}` : 'lunas'} (${pay.receiptNo})` : v.insurance === 'Umum' ? 'Tagihan pasien umum belum dibayar' : `Tagihan akan diajukan ke ${v.insurance}`,
    },
  ]
  const siap = list.every((c) => c.ok !== false)
  return (
    <section className="panel">
      <div className="ph">
        <h3 style={{ margin: 0 }}>Kesiapan keluar</h3>
        {siap ? <Chip kind="ok">Siap</Chip> : <Chip kind="warn">{list.filter((c) => c.ok === false).length} perlu dicek</Chip>}
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6, fontSize: 13.5 }}>
        {list.map((c) => (
          <li key={c.text} style={{ display: 'grid', gridTemplateColumns: '22px 1fr', gap: 6 }}>
            <span aria-hidden style={{ color: c.ok === true ? 'var(--ok, green)' : c.ok === false ? 'var(--warn, #b86d00)' : 'var(--accent)' }}>
              {c.ok === true ? '✓' : c.ok === false ? '!' : 'i'}
            </span>
            <span>{c.text}</span>
          </li>
        ))}
      </ul>
      <p className="small muted" style={{ marginTop: 8 }}>
        Daftar ini hanya pengingat. Pasien tetap bisa dikeluarkan, misalnya pada kasus rujuk segera.
      </p>
    </section>
  )
}

/* ---------- Tautan dokumen cetak ---------- */
function Dokumen({ v }: { v: Visit }) {
  const href = (j: string) => `/pasien/${encodeURIComponent(v.id)}/cetak?jenis=${j}`
  const rujuk = v.disposition?.type === 'rujuk'
  return (
    <div style={{ marginTop: 14 }}>
      <div className="small muted" style={{ marginBottom: 6 }}>
        Dokumen
      </div>
      <div className="row">
        <Link className="btn sm" href={href('resume')}>
          Resume medis
        </Link>
        <Link className={`btn sm ${rujuk ? 'primary' : ''}`} href={href('rujukan')}>
          Surat rujukan
        </Link>
        <Link className="btn sm" href={href('kwitansi')}>
          {v.billing.payment ? 'Kwitansi' : 'Rincian biaya'}
        </Link>
      </div>
    </div>
  )
}
