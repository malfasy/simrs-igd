'use client'

import { useMemo, useState } from 'react'
import { ORDERS, ORDER_STATUS_LABEL } from '@/lib/constants'
import { dur, hm, tanggalJam } from '@/lib/clinical'
import { updateResult } from '@/lib/actions'
import type { OrderResult, OrderStatus, Visit } from '@/lib/types'
import { useCtx } from '../providers'
import { Chip, Empty, useNow, useRunner } from '../ui'

/** Nilai rujukan contoh (dewasa) dan template isian hasil. Sesuaikan dengan laboratorium RS. */
const REF: Record<string, { ref: string; template: string }> = {
  cbc: { ref: 'Hb 12-16 g/dL · Leukosit 4-10 rb/µL · Trombosit 150-400 rb/µL · Ht 37-48%', template: 'Hb  g/dL, Leukosit  rb/µL, Trombosit  rb/µL, Ht  %' },
  gds: { ref: '70-200 mg/dL (kritis < 50 atau > 400)', template: ' mg/dL' },
  elek: { ref: 'Na 135-145 · K 3,5-5,0 · Cl 98-107 mmol/L', template: 'Na  mmol/L, K  mmol/L, Cl  mmol/L' },
  trop: { ref: '< 0,04 ng/mL', template: ' ng/mL' },
  agd: { ref: 'pH 7,35-7,45 · pCO₂ 35-45 · pO₂ 80-100 mmHg · HCO₃ 22-26', template: 'pH , pCO₂  mmHg, pO₂  mmHg, HCO₃  mmol/L, BE ' },
  xrt: { ref: 'Ekspertise radiolog', template: 'Cor: \nPulmo: \nKesan: ' },
  cth: { ref: 'Ekspertise radiolog', template: 'Parenkim: \nSisterna dan ventrikel: \nKesan: ' },
  usa: { ref: 'Ekspertise radiolog', template: 'Hepar, lien, ginjal, vesika: \nKesan: ' },
}

/** Ambil angka setelah label tertentu, misal "K 6,8" → 6.8. */
const numAfter = (text: string, label: string) => {
  const m = text.match(new RegExp(`${label}\\s*[:=]?\\s*(-?\\d+(?:[.,]\\d+)?)`, 'i'))
  return m ? parseFloat(m[1].replace(',', '.')) : null
}
const firstNum = (text: string) => {
  const m = text.match(/-?\d+(?:[.,]\d+)?/)
  return m ? parseFloat(m[0].replace(',', '.')) : null
}

/** Saran nilai kritis otomatis dari isian hasil. Keputusan akhir tetap di petugas. */
export function criticalHint(key: string, text: string): string | null {
  const t = text.trim()
  if (!t) return null
  const out: string[] = []
  if (key === 'gds') {
    const g = firstNum(t)
    if (g !== null && (g < 50 || g > 400)) out.push(`GDS ${g} mg/dL`)
  }
  if (key === 'trop') {
    const g = firstNum(t)
    if (g !== null && g >= 0.04) out.push(`Troponin ${g} ng/mL (di atas batas)`)
  }
  if (key === 'elek') {
    const k = numAfter(t, 'K')
    const na = numAfter(t, 'Na')
    if (k !== null && (k < 2.5 || k > 6.5)) out.push(`Kalium ${k}`)
    if (na !== null && (na < 120 || na > 160)) out.push(`Natrium ${na}`)
  }
  if (key === 'cbc') {
    const hb = numAfter(t, 'Hb')
    const plt = numAfter(t, 'Trombosit')
    if (hb !== null && hb < 7) out.push(`Hb ${hb} g/dL`)
    if (plt !== null && plt < 20) out.push(`Trombosit ${plt} rb/µL`)
  }
  if (key === 'agd') {
    const ph = numAfter(t, 'pH')
    if (ph !== null && (ph < 7.2 || ph > 7.6)) out.push(`pH ${ph}`)
  }
  if (['xrt', 'cth', 'usa'].includes(key)) {
    // Per baris: ada kata temuan gawat dan tidak ada kata penyangkal.
    const gawat = /(perdarahan|pneumotoraks|pneumothorax|herniasi|ruptur|cairan bebas)/i
    const sangkal = /(tidak|negatif|\(-\)|tak tampak)/i
    if (t.split('\n').some((l) => gawat.test(l) && !sangkal.test(l))) out.push('Temuan radiologi gawat')
  }
  return out.length ? out.join(', ') : null
}

type Filter = 'semua' | 'Lab' | 'Radiologi' | 'belum' | 'kritis'

export function TabPenunjang({ v }: { v: Visit }) {
  const now = useNow(30_000)
  const [filter, setFilter] = useState<Filter>('semua')
  const [open, setOpen] = useState<string | null>(null)
  const closed = v.status === 'keluar'

  const rows = useMemo(
    () =>
      Object.entries(v.results)
        .map(([key, r]) => ({ key, r, o: ORDERS.find((x) => x.key === key) }))
        .sort((a, b) => Number(b.r.critical) - Number(a.r.critical) || a.r.requestedAt - b.r.requestedAt),
    [v.results],
  )
  const shown = rows.filter(({ r, o }) => {
    if (filter === 'semua') return true
    if (filter === 'belum') return r.status !== 'selesai'
    if (filter === 'kritis') return r.critical
    return o?.unit === filter
  })
  const crit = rows.filter((x) => x.r.critical)
  const done = rows.filter((x) => x.r.status === 'selesai')
  const tats = done.map((x) => x.r.updatedAt - x.r.requestedAt)
  const avgTat = tats.length ? tats.reduce((s, x) => s + x, 0) / tats.length : 0

  if (!rows.length)
    return <Empty>Belum ada order penunjang. Dokter membuat order dari tab Asesmen &amp; Tindakan.</Empty>

  return (
    <>
      {crit.length > 0 && (
        <div className="callout crit" style={{ marginBottom: 12 }}>
          <b>Nilai kritis ({crit.length}):</b> {crit.map((x) => `${x.o?.label ?? x.key}: ${x.r.result}`).join(' · ')}. Laporkan ke dokter penanggung jawab dan catat di CPPT.
        </div>
      )}

      <div className="stats compact" style={{ marginBottom: 12 }}>
        <div className="stat">
          <div className="n">{rows.length}</div>
          <div className="l">Total order{v.assessment?.cito ? ' (CITO)' : ''}</div>
        </div>
        <div className="stat">
          <div className="n">{rows.length - done.length}</div>
          <div className="l">Menunggu hasil</div>
        </div>
        <div className="stat">
          <div className="n">{done.length}</div>
          <div className="l">Hasil selesai</div>
        </div>
        <div className="stat">
          <div className="n">{done.length ? dur(avgTat) : '-'}</div>
          <div className="l">Rata-rata waktu hasil</div>
        </div>
      </div>

      <section className="panel">
        <div className="toolbar">
          <div className="seg" role="group" aria-label="Saring order">
            {(
              [
                ['semua', 'Semua'],
                ['Lab', 'Laboratorium'],
                ['Radiologi', 'Radiologi'],
                ['belum', 'Belum selesai'],
                ['kritis', 'Kritis'],
              ] as [Filter, string][]
            ).map(([k, l]) => (
              <button key={k} type="button" className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="tablewrap">
          <table className="datatable">
            <thead>
              <tr>
                <th>Pemeriksaan</th>
                <th>Unit</th>
                <th>Diminta</th>
                <th>Status</th>
                <th>Waktu</th>
                <th>Hasil</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map(({ key, r, o }) => (
                <Row
                  key={key}
                  v={v}
                  k={key}
                  r={r}
                  label={o?.label ?? key}
                  unit={o?.unit ?? '-'}
                  now={now}
                  open={open === key}
                  onToggle={() => setOpen((x) => (x === key ? null : key))}
                  readOnly={closed}
                />
              ))}
              {!shown.length && (
                <tr>
                  <td colSpan={7} className="muted">
                    Tidak ada order pada saringan ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

function Row(props: { v: Visit; k: string; r: OrderResult; label: string; unit: string; now: number; open: boolean; onToggle: () => void; readOnly: boolean }) {
  const { v, k, r, label, unit, now, open, onToggle, readOnly } = props
  const elapsed = (r.status === 'selesai' ? r.updatedAt : now) - r.requestedAt
  const kind = r.status === 'selesai' ? 'ok' : r.status === 'diproses' ? 'acc' : 'warn'
  return (
    <>
      <tr>
        <td>
          <b>{label}</b>
          {v.assessment?.cito && r.status !== 'selesai' && (
            <>
              {' '}
              <Chip kind="crit">CITO</Chip>
            </>
          )}
        </td>
        <td>{unit}</td>
        <td className="mono">{hm(r.requestedAt)}</td>
        <td>
          <Chip kind={kind}>{ORDER_STATUS_LABEL[r.status]}</Chip>
        </td>
        <td className="mono">{dur(elapsed)}</td>
        <td style={{ whiteSpace: 'pre-wrap', maxWidth: 320 }}>
          {r.result || <span className="muted">-</span>}
          {r.critical && (
            <>
              {' '}
              <Chip kind="crit">Kritis</Chip>
            </>
          )}
        </td>
        <td style={{ textAlign: 'right' }}>
          <button type="button" className="btn sm" onClick={onToggle}>
            {open ? 'Tutup' : readOnly || r.status === 'selesai' ? 'Detail' : 'Isi hasil'}
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={7} style={{ background: 'var(--surface-2)' }}>
            <ResultForm v={v} k={k} r={r} readOnly={readOnly} onDone={onToggle} />
          </td>
        </tr>
      )}
    </>
  )
}

function ResultForm({ v, k, r, readOnly, onDone }: { v: Visit; k: string; r: OrderResult; readOnly: boolean; onDone: () => void }) {
  const ctx = useCtx()!
  const { busy, run } = useRunner()
  const [status, setStatus] = useState<OrderStatus>(r.status)
  const [result, setResult] = useState(r.result)
  const [critical, setCritical] = useState(r.critical)
  const hint = criticalHint(k, result)
  const ref = REF[k]

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void run(async () => {
          await updateResult(ctx, v, k, { status, result, critical })
          onDone()
        }, status === 'selesai' ? `Hasil disimpan${critical ? ' dan ditandai kritis' : ''}.` : 'Status order diperbarui.')
      }}
    >
      <fieldset disabled={readOnly || busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <div className="fields" style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '10px 12px' }}>
          <div className="f">
            <label htmlFor={`rs-st-${k}`}>Status</label>
            <select id={`rs-st-${k}`} value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
              {(Object.keys(ORDER_STATUS_LABEL) as OrderStatus[]).map((s) => (
                <option key={s} value={s}>
                  {ORDER_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, cursor: 'pointer', color: 'var(--ink)' }}>
              <input type="checkbox" checked={critical} onChange={(e) => setCritical(e.target.checked)} /> Nilai kritis
            </label>
          </div>
          <div className="f">
            <label htmlFor={`rs-res-${k}`}>Hasil {ref && <span>· rujukan: {ref.ref}</span>}</label>
            <textarea id={`rs-res-${k}`} rows={3} value={result} onChange={(e) => setResult(e.target.value)} placeholder="Isi hasil pemeriksaan" />
            {ref && !result && !readOnly && (
              <button type="button" className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setResult(ref.template)}>
                Pakai template isian
              </button>
            )}
          </div>
        </div>
        {hint && !critical && (
          <div className="callout warn" style={{ marginTop: 10 }}>
            Sistem mendeteksi kemungkinan nilai kritis: <b>{hint}</b>.{' '}
            <button type="button" className="btn sm" onClick={() => setCritical(true)}>
              Tandai kritis
            </button>
          </div>
        )}
      </fieldset>
      <div className="formfoot">
        {!readOnly && (
          <button className="btn primary" disabled={busy}>
            Simpan
          </button>
        )}
        <span className="small muted">
          Diperbarui {tanggalJam(r.updatedAt)} oleh {r.by}. Hasil selesai dikirim sebagai DiagnosticReport ke Satu Sehat.
        </span>
      </div>
    </form>
  )
}
