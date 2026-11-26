'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Check, Copy, Download, Search } from 'lucide-react'
import { SATUSEHAT_MODE } from '@/lib/constants'
import { hm, isoDate, tanggalJam, tglPendek } from '@/lib/clinical'
import { ORG_ID } from '@/lib/fhir'
import type { FhirLogEntry, FhirSendStatus } from '@/lib/types'
import { useData } from '../providers'
import { Chip, Empty, StatCard } from '../ui'

const STATUS_KIND: Record<FhirSendStatus, string> = { mock: 'gray', terkirim: 'ok', gagal: 'crit' }
const STATUS_LABEL: Record<FhirSendStatus, string> = { mock: 'Simulasi', terkirim: 'Terkirim', gagal: 'Gagal' }

/** Penjelasan singkat tiap resource, untuk presentasi dan pengguna baru. */
const RESOURCE_INFO: Record<string, string> = {
  Patient: 'Identitas pasien (NIK)',
  Encounter: 'Kunjungan IGD: datang, ditangani, selesai',
  Observation: 'Triase, cara datang, tanda vital',
  Condition: 'Diagnosis ICD-10',
  Procedure: 'Tindakan ICD-9-CM',
  ServiceRequest: 'Order lab/radiologi, transfusi',
  MedicationRequest: 'Resep obat',
  DiagnosticReport: 'Hasil penunjang',
}

const PAGE = 25

export function SatuSehatLog() {
  const data = useData()
  const logs = data.fhirLogs
  const [q, setQ] = useState('')
  const [type, setType] = useState('semua')
  const [status, setStatus] = useState<'semua' | FhirSendStatus>('semua')
  const [date, setDate] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [limit, setLimit] = useState(PAGE)

  const types = useMemo(() => {
    const m = new Map<string, number>()
    logs.forEach((l) => m.set(l.resourceType, (m.get(l.resourceType) ?? 0) + 1))
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [logs])

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    return logs
      .filter((l) => type === 'semua' || l.resourceType === type)
      .filter((l) => status === 'semua' || l.status === status)
      .filter((l) => !date || isoDate(l.at) === date)
      .filter((l) => !t || `${l.patientLabel} ${l.summary} ${l.resourceType}`.toLowerCase().includes(t) || l.payload.toLowerCase().includes(t))
  }, [logs, q, type, status, date])

  const count = (s: FhirSendStatus) => logs.filter((l) => l.status === s).length
  const patients = new Set(logs.map((l) => l.visitId).filter(Boolean)).size

  const download = () => {
    const bundle = {
      resourceType: 'Bundle',
      type: 'collection',
      timestamp: new Date().toISOString(),
      total: rows.length,
      entry: rows.map((l) => {
        let resource: unknown = null
        try {
          resource = JSON.parse(l.payload)
        } catch {
          resource = l.payload
        }
        return { fullUrl: `urn:log:${l.id}`, resource }
      }),
    }
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/fhir+json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `satusehat-igd-${isoDate(Date.now())}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="ph" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Log Satu Sehat</h1>
          <div className="muted small">
            Resource FHIR R4 yang terbentuk dari setiap kegiatan di IGD. Organisasi <span className="mono">{ORG_ID}</span> &middot; Mode{' '}
            <Chip kind={SATUSEHAT_MODE === 'sandbox' ? 'acc' : 'gray'}>{SATUSEHAT_MODE === 'sandbox' ? 'Sandbox Kemenkes' : 'Simulasi (tidak dikirim)'}</Chip>
          </div>
        </div>
        <button type="button" className="btn" onClick={download} disabled={!rows.length}>
          <Download size={16} /> Unduh {rows.length} resource (JSON)
        </button>
      </div>

      <div className="stats" style={{ marginBottom: 14 }}>
        <StatCard n={logs.length} l="Total resource" />
        <StatCard n={patients} l="Kunjungan terkait" />
        <StatCard n={count('terkirim')} l="Terkirim" tone="green" />
        <StatCard n={count('gagal')} l="Gagal" tone={count('gagal') ? 'red' : ''} />
        <StatCard n={count('mock')} l="Simulasi" />
      </div>

      <div className="grid2" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,2.4fr)', alignItems: 'start' }}>
        <section className="panel">
          <h3>Jenis resource</h3>
          {!types.length && <p className="small muted">Belum ada.</p>}
          <div className="stack" style={{ gap: 4 }}>
            {types.map(([t, n]) => (
              <button
                key={t}
                type="button"
                className={`btn sm ${type === t ? 'primary' : ''}`}
                style={{ justifyContent: 'space-between', display: 'flex', width: '100%', textAlign: 'left' }}
                onClick={() => setType((x) => (x === t ? 'semua' : t))}
                title={RESOURCE_INFO[t]}
              >
                <span>
                  {t}
                  <br />
                  <span className="small" style={{ opacity: 0.75, fontWeight: 400 }}>
                    {RESOURCE_INFO[t] ?? ''}
                  </span>
                </span>
                <b>{n}</b>
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="toolbar">
            <div className="searchbox" style={{ position: 'relative', flex: '1 1 240px' }}>
              <Search size={16} style={{ position: 'absolute', left: 10, top: 10, opacity: 0.5 }} />
              <input
                type="text"
                aria-label="Cari log"
                placeholder="Cari nama pasien, ringkasan, atau kode (misal I21.9)"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value)
                  setLimit(PAGE)
                }}
                style={{ paddingLeft: 32 }}
              />
            </div>
            <select aria-label="Status kirim" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="semua">Semua status</option>
              <option value="mock">Simulasi</option>
              <option value="terkirim">Terkirim</option>
              <option value="gagal">Gagal</option>
            </select>
            <input type="date" aria-label="Tanggal" value={date} onChange={(e) => setDate(e.target.value)} style={{ height: 36 }} />
            {(q || type !== 'semua' || status !== 'semua' || date) && (
              <button
                type="button"
                className="btn sm"
                onClick={() => {
                  setQ('')
                  setType('semua')
                  setStatus('semua')
                  setDate('')
                }}
              >
                Reset
              </button>
            )}
          </div>
          <div className="small muted" style={{ marginBottom: 6 }}>
            Menampilkan {Math.min(limit, rows.length)} dari {rows.length} resource
            {type !== 'semua' && (
              <>
                {' '}
                &middot; jenis <b>{type}</b>
              </>
            )}
          </div>

          {!rows.length ? (
            <Empty>{logs.length ? 'Tidak ada resource yang cocok dengan pencarian.' : 'Belum ada resource. Daftarkan pasien atau simpan triase untuk membentuk resource pertama.'}</Empty>
          ) : (
            <div>
              {rows.slice(0, limit).map((l) => (
                <LogRow key={l.id} l={l} open={open === l.id} onToggle={() => setOpen((x) => (x === l.id ? null : l.id))} />
              ))}
              {rows.length > limit && (
                <div style={{ textAlign: 'center', marginTop: 10 }}>
                  <button type="button" className="btn sm" onClick={() => setLimit((x) => x + PAGE)}>
                    Tampilkan {Math.min(PAGE, rows.length - limit)} lagi
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </>
  )
}

function LogRow({ l, open, onToggle }: { l: FhirLogEntry; open: boolean; onToggle: () => void }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(l.payload)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard tidak tersedia */
    }
  }
  return (
    <div className="fhir-row">
      <div className="mono small">
        {hm(l.at)}
        <div className="muted">{tglPendek(l.at)}</div>
      </div>
      <div>
        <Chip kind="acc">{l.resourceType}</Chip>
        <div style={{ marginTop: 4 }}>
          <Chip kind={STATUS_KIND[l.status]}>{STATUS_LABEL[l.status]}</Chip>
        </div>
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
          <div>
            <b>{l.summary}</b>
            <div className="small muted">
              {l.visitId ? (
                <Link href={`/pasien/${l.visitId}`} style={{ color: 'inherit' }}>
                  {l.patientLabel}
                </Link>
              ) : (
                l.patientLabel
              )}{' '}
              &middot; {tanggalJam(l.at)}
            </div>
          </div>
          <button type="button" className="btn sm" onClick={onToggle} aria-expanded={open}>
            {open ? 'Tutup JSON' : 'Lihat JSON'}
          </button>
        </div>
        {open && (
          <div style={{ marginTop: 8 }}>
            <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 4 }}>
              <button type="button" className="btn sm" onClick={copy}>
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Tersalin' : 'Salin'}
              </button>
            </div>
            <pre className="mono" style={{ margin: 0, maxHeight: 360, overflow: 'auto', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 8, padding: 10, fontSize: 12 }}>
              {l.payload}
            </pre>
            {l.response && (
              <div className={`callout ${l.status === 'gagal' ? 'crit' : 'info'}`} style={{ marginTop: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                <b>Respons server:</b> {l.response}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
