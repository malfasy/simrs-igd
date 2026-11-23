'use client'

import { toNum } from '@/lib/clinical'
import type { VitalInput, VitalSign } from '@/lib/types'

export type VitalDraft = {
  sys: string
  dia: string
  hr: string
  rr: string
  temp: string
  spo2: string
  gcs: string
  pain: string
  o2: boolean
}

export const draftFrom = (l: VitalSign | VitalInput | null): VitalDraft => ({
  sys: l ? String(l.sys) : '',
  dia: l ? String(l.dia) : '',
  hr: l ? String(l.hr) : '',
  rr: l ? String(l.rr) : '',
  temp: l ? String(l.temp) : '',
  spo2: l ? String(l.spo2) : '',
  gcs: l ? String(l.gcs) : '15',
  pain: l && l.pain !== null ? String(l.pain) : '0',
  o2: l ? l.o2 : false,
})

/** Nilai parsial untuk saran triase (boleh ada yang kosong). */
export const partialVitals = (d: VitalDraft) => ({
  sys: toNum(d.sys),
  dia: toNum(d.dia),
  hr: toNum(d.hr),
  rr: toNum(d.rr),
  temp: toNum(d.temp),
  spo2: toNum(d.spo2),
  gcs: toNum(d.gcs),
  pain: toNum(d.pain),
  o2: d.o2,
})

const RANGES: Record<string, [number, number, string]> = {
  sys: [30, 300, 'TD sistolik'],
  dia: [10, 200, 'TD diastolik'],
  hr: [10, 300, 'Nadi'],
  rr: [0, 80, 'Laju napas'],
  temp: [25, 45, 'Suhu'],
  spo2: [30, 100, 'SpO₂'],
  gcs: [3, 15, 'GCS'],
}

/** Validasi lengkap sebelum disimpan. Melempar Error berbahasa Indonesia jika ada yang salah. */
export function toVitalInput(d: VitalDraft, withPain: boolean): VitalInput {
  const p = partialVitals(d)
  for (const [k, [lo, hi, label]] of Object.entries(RANGES)) {
    const val = p[k as keyof typeof p] as number | null
    if (val === null) throw new Error(`${label} wajib diisi.`)
    if (val < lo || val > hi) throw new Error(`${label} ${val} di luar rentang wajar (${lo}-${hi}). Periksa lagi.`)
  }
  return {
    sys: p.sys!,
    dia: p.dia!,
    hr: p.hr!,
    rr: p.rr!,
    temp: p.temp!,
    spo2: p.spo2!,
    gcs: p.gcs!,
    o2: d.o2,
    pain: withPain ? p.pain ?? 0 : null,
  }
}

export function VitalFields({ prefix, value, onChange, withPain }: { prefix: string; value: VitalDraft; onChange: (d: VitalDraft) => void; withPain: boolean }) {
  const f = (k: keyof Omit<VitalDraft, 'o2'>, label: string, step = '1') => (
    <div className="f" key={k}>
      <label htmlFor={`${prefix}-${k}`}>{label}</label>
      <input type="number" id={`${prefix}-${k}`} step={step} value={value[k]} onChange={(e) => onChange({ ...value, [k]: e.target.value })} />
    </div>
  )
  return (
    <>
      {f('sys', 'TD sistolik (mmHg)')}
      {f('dia', 'TD diastolik (mmHg)')}
      {f('hr', 'Nadi (/mnt)')}
      {f('rr', 'Napas (/mnt)')}
      {f('temp', 'Suhu (°C)', '0.1')}
      {f('spo2', 'SpO₂ (%)')}
      {f('gcs', 'GCS (3-15)')}
      {withPain && f('pain', 'Skala nyeri (0-10)')}
      <div className="f">
        <label htmlFor={`${prefix}-o2`}>Oksigen tambahan</label>
        <select id={`${prefix}-o2`} value={value.o2 ? '1' : '0'} onChange={(e) => onChange({ ...value, o2: e.target.value === '1' })}>
          <option value="0">Udara ruang</option>
          <option value="1">Dengan O₂</option>
        </select>
      </div>
    </>
  )
}