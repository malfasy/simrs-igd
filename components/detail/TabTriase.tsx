'use client'

import { useMemo, useState } from 'react'
import { COLOR_LABEL, COMPLAINTS, LEVEL_LIST, LEVELS } from '@/lib/constants'
import { hm, lastVital, suggestLevel } from '@/lib/clinical'
import { saveTriage } from '@/lib/actions'
import type { ComplaintKey, TriageLevel, Visit } from '@/lib/types'
import { useCtx } from '../providers'
import { Chip, ColorChip, LevelChip, useRunner } from '../ui'
import { draftFrom, partialVitals, toVitalInput, VitalFields } from './VitalFields'

export function TabTriase({ v }: { v: Visit }) {
  const ctx = useCtx()!
  const { busy, run } = useRunner()
  const [complaint, setComplaint] = useState<ComplaintKey>(v.complaint)
  const [note, setNote] = useState(v.complaintNote)
  const [vit, setVit] = useState(() => draftFrom(lastVital(v)))
  const [chosen, setChosen] = useState<TriageLevel | null>(null)
  const [touched, setTouched] = useState(false)
  const [reason, setReason] = useState('')
  const closed = v.status === 'keluar'

  const sug = useMemo(() => suggestLevel(partialVitals(vit), complaint), [vit, complaint])
  // Sebelum perawat memilih sendiri, level mengikuti saran sistem.
  const level: TriageLevel = touched && chosen ? chosen : sug.level
  const differs = level !== sug.level

  const submit = () =>
    run(async () => {
      const input = toVitalInput(vit, true)
      await saveTriage(ctx, v, { complaint, complaintNote: note, vitals: input, level, suggested: sug.level, reason })
      setTouched(false)
      setReason('')
    }, `Triase tersimpan: Level ${level} (${COLOR_LABEL[LEVELS[level].color]}).`)

  return (
    <>
      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <div className="ph">
          <h3>{v.triage.length ? 'Triase ulang' : 'Triase'}</h3>
          <span className="small muted">Saran level dihitung otomatis. Keputusan tetap di perawat.</span>
        </div>
        <div className="fields">
          <div className="f" style={{ gridColumn: 'span 2' }}>
            <label htmlFor="tr-cc">Keluhan utama</label>
            <select id="tr-cc" value={complaint} onChange={(e) => setComplaint(e.target.value as ComplaintKey)}>
              {COMPLAINTS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="f" style={{ gridColumn: 'span 2' }}>
            <label htmlFor="tr-note">Catatan keluhan</label>
            <input type="text" id="tr-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <VitalFields prefix="tr" value={vit} onChange={setVit} withPain />
        </div>

        <div className="sugg" style={{ marginTop: 14 }}>
          <h4>
            Saran sistem: Level {sug.level} &middot; {LEVELS[sug.level].name} <ColorChip color={LEVELS[sug.level].color} />
          </h4>
          <ul>
            {sug.reasons.slice(0, 5).map((r) => (
              <li key={r.text}>
                {r.text} &rarr; minimal L{r.level}
              </li>
            ))}
          </ul>
        </div>

        <div style={{ marginTop: 14 }}>
          <div className="small muted" style={{ marginBottom: 6 }}>
            Level yang ditetapkan
          </div>
          <div className="levels" role="radiogroup" aria-label="Level triase">
            {LEVEL_LIST.map((n) => (
              <label key={n} className={LEVELS[n].color}>
                <input
                  type="radio"
                  name="level"
                  value={n}
                  checked={level === n}
                  onChange={() => {
                    setChosen(n)
                    setTouched(true)
                  }}
                />
                <b>Level {n}</b>
                <span>{LEVELS[n].name}</span>
                <span className="muted">
                  {COLOR_LABEL[LEVELS[n].color]} &middot; {LEVELS[n].target ? `≤ ${LEVELS[n].target} mnt` : 'segera'}
                </span>
              </label>
            ))}
          </div>
        </div>
        {differs && (
          <div className="f" style={{ marginTop: 12 }}>
            <label htmlFor="tr-reason">Alasan level berbeda dari saran sistem (wajib)</label>
            <textarea id="tr-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        )}
        <div className="formfoot">
          <button className="btn primary" disabled={busy || closed}>
            Simpan triase
          </button>
          <span className="small muted">Dikirim sebagai Observation triase dan tanda vital ke Satu Sehat.</span>
        </div>
      </form>

      {v.triage.length > 0 && (
        <section className="panel" style={{ marginTop: 14 }}>
          <h3>Riwayat triase</h3>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Jam</th>
                  <th>Metode</th>
                  <th>Saran sistem</th>
                  <th>Ditetapkan</th>
                  <th>Alasan perubahan</th>
                  <th>Oleh</th>
                </tr>
              </thead>
              <tbody>
                {[...v.triage].reverse().map((t, i) => (
                  <tr key={`${t.at}-${i}`}>
                    <td className="mono">{hm(t.at)}</td>
                    <td>{t.method === 'START' ? 'START' : 'Triase IGD'}</td>
                    <td>{t.suggested ? `L${t.suggested}` : '-'}</td>
                    <td>{t.level && t.method !== 'START' ? <LevelChip level={t.level} /> : <ColorChip color={t.color} />}</td>
                    <td>{t.reason ?? '-'}</td>
                    <td>{t.by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {closed && <Chip kind="gray">Kunjungan sudah selesai, data hanya bisa dilihat.</Chip>}
    </>
  )
}