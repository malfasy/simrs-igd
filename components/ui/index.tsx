'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { COLOR_LABEL, LEVELS, MIN } from '@/lib/constants'
import { clock, dur, hm } from '@/lib/clinical'
import type { TriageColor, TriageLevel, Visit, VitalSign } from '@/lib/types'

/* ---------- Waktu berjalan ---------- */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

/** Timer yang memperbarui dirinya sendiri setiap detik. target dalam menit (opsional). */
export function Timer({ since, target, format = 'dur', className = '' }: { since: number; target?: number; format?: 'dur' | 'clock'; className?: string }) {
  const now = useNow(1000)
  const ms = now - since
  let cls = ''
  if (target !== undefined) {
    const t = target * MIN
    cls = ms > t ? 'over' : ms > 0.75 * t ? 'near' : ''
  }
  return <span className={`tmr ${cls} ${className}`}>{format === 'clock' ? clock(ms) : dur(ms)}</span>
}

export function Countdown({ to, doneText }: { to: number; doneText: string }) {
  const now = useNow(1000)
  const ms = to - now
  return <>{ms > 0 ? `tiba ±${Math.ceil(ms / MIN)} mnt` : doneText}</>
}

export function DueIn({ at }: { at: number }) {
  const now = useNow(1000)
  const ms = at - now
  return <b>{ms > 0 ? `dalam ${dur(ms)}` : `terlambat ${dur(-ms)}`}</b>
}

export function Clock() {
  const now = useNow(1000)
  const d = new Date(now)
  const p = (n: number) => String(n).padStart(2, '0')
  return <span className="clock">{`${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`}</span>
}

/* ---------- Chip ---------- */
export function Chip({ kind = 'soft', children, title }: { kind?: string; children: ReactNode; title?: string }) {
  return (
    <span className={`chip ${kind}`} title={title}>
      {children}
    </span>
  )
}

export function TriageChip({ v, long = false }: { v: Pick<Visit, 'level' | 'color' | 'triage'>; long?: boolean }) {
  if (!v.color) return <Chip kind="gray">Belum triase</Chip>
  const last = v.triage[v.triage.length - 1]
  if (last?.method === 'START' || !v.level) return <Chip kind={v.color}>START {COLOR_LABEL[v.color]}</Chip>
  return (
    <Chip kind={v.color}>
      {long ? `Level ${v.level} · ${LEVELS[v.level].name} · ${COLOR_LABEL[v.color]}` : `L${v.level} · ${COLOR_LABEL[v.color]}`}
    </Chip>
  )
}

export function LevelChip({ level }: { level: TriageLevel }) {
  return <Chip kind={LEVELS[level].color}>L{level}</Chip>
}

export function ColorChip({ color }: { color: TriageColor }) {
  return <Chip kind={color}>{COLOR_LABEL[color]}</Chip>
}

/* ---------- Toast ---------- */
type Toast = { id: number; text: string; kind: 'info' | 'error' }
const ToastCtx = createContext<(text: string, kind?: 'info' | 'error') => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const seq = useRef(0)
  const push = useCallback((text: string, kind: 'info' | 'error' = 'info') => {
    const id = ++seq.current
    setToasts((t) => [...t.slice(-2), { id, text, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 5000 : 3200)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

/** Menjalankan aksi async dengan status sibuk dan pesan error otomatis. */
export function useRunner() {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const run = useCallback(
    async <T,>(fn: () => Promise<T>, success?: string | ((r: T) => string)): Promise<T | undefined> => {
      setBusy(true)
      try {
        const r = await fn()
        if (success) toast(typeof success === 'function' ? success(r) : success)
        return r
      } catch (e) {
        toast((e as Error).message || 'Terjadi kesalahan.', 'error')
        return undefined
      } finally {
        setBusy(false)
      }
    },
    [toast],
  )
  return { busy, run }
}

/* ---------- Grafik ---------- */
export interface BarItem {
  label: string
  value: number
  target?: number
  cls: string
}

export function BarChart({ items, unit }: { items: BarItem[]; unit: string }) {
  const W = 480, H = 200, L = 34, R = 10, T = 18, B = 24
  const mx = Math.max(1, ...items.map((i) => Math.max(i.value, i.target ?? 0)))
  const step = mx <= 5 ? 1 : mx <= 12 ? 2 : mx <= 30 ? 5 : mx <= 60 ? 10 : mx <= 150 ? 30 : 60
  const ymax = Math.ceil((mx * 1.1) / step) * step
  const Y = (v: number) => T + (1 - v / ymax) * (H - T - B)
  const bw = (W - L - R) / items.length
  const ticks: number[] = []
  for (let s = 0; s <= ymax; s += step) ticks.push(s)
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Grafik batang dalam ${unit}`}>
      {ticks.map((s) => (
        <g key={s}>
          <line className="grid" x1={L} x2={W - R} y1={Y(s)} y2={Y(s)} />
          <text x={L - 6} y={Y(s) + 4} textAnchor="end">
            {s}
          </text>
        </g>
      ))}
      {items.map((it, i) => {
        const x = L + i * bw + bw * 0.2
        const w = bw * 0.6
        return (
          <g key={it.label + i}>
            <rect className={it.cls} x={x} y={Y(it.value)} width={w} height={Math.max(0, Y(0) - Y(it.value))} rx={3} />
            {it.value > 0 && (
              <text className="val" x={x + w / 2} y={Y(it.value) - 5} textAnchor="middle">
                {it.value % 1 ? it.value.toFixed(1) : it.value}
              </text>
            )}
            {it.target !== undefined && it.target > 0 && <line className="tgt" x1={x - 4} x2={x + w + 4} y1={Y(it.target)} y2={Y(it.target)} />}
            <text x={x + w / 2} y={H - 7} textAnchor="middle">
              {it.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function NewsChart({ vitals }: { vitals: VitalSign[] }) {
  if (!vitals.length) return null
  const W = 460, H = 170, L = 30, R = 14, T = 12, B = 26
  const ymax = Math.max(10, ...vitals.map((x) => x.news + 1))
  const t0 = vitals[0].at
  const t1 = Math.max(vitals[vitals.length - 1].at, t0 + 10 * MIN)
  const X = (t: number) => L + ((t - t0) / (t1 - t0)) * (W - L - R)
  const Y = (s: number) => T + (1 - s / ymax) * (H - T - B)
  const pts = vitals.map((x) => [X(x.at), Y(x.news)] as const)
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${Y(0)} L${pts[0][0].toFixed(1)} ${Y(0)} Z`
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Grafik skor NEWS2">
      <rect className="band-crit" x={L} y={Y(ymax)} width={W - L - R} height={Y(7) - Y(ymax)} />
      <rect className="band-warn" x={L} y={Y(7)} width={W - L - R} height={Y(5) - Y(7)} />
      {[0, 5, 7, ymax].map((s) => (
        <g key={s}>
          <line className="grid" x1={L} x2={W - R} y1={Y(s)} y2={Y(s)} />
          <text x={L - 6} y={Y(s) + 4} textAnchor="end">
            {s}
          </text>
        </g>
      ))}
      <path className="area" d={area} />
      <path className="line" d={line} />
      {pts.map((p, i) => (
        <circle key={i} className={`dot ${i === pts.length - 1 ? 'end' : ''}`} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 5 : 3.5} />
      ))}
      {vitals.map((x, i) =>
        i === 0 || i === vitals.length - 1 || vitals.length <= 5 ? (
          <text key={x.at} x={X(x.at)} y={H - 8} textAnchor="middle">
            {hm(x.at)}
          </text>
        ) : null,
      )}
      <text x={W - R} y={Y(ymax) + 12} textAnchor="end">
        7+ tinggi
      </text>
      <text x={W - R} y={Y(7) + 12} textAnchor="end">
        5-6 sedang
      </text>
    </svg>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}

/** Tombol dengan konfirmasi dua kali klik (dialog browser tidak dipakai). */
export function ConfirmButton({ onConfirm, children, confirmText, className = 'btn', disabled }: { onConfirm: () => void; children: ReactNode; confirmText: string; className?: string; disabled?: boolean }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <button
      type="button"
      className={`${className} ${armed ? 'danger' : ''}`}
      disabled={disabled}
      onClick={() => {
        if (armed) {
          setArmed(false)
          onConfirm()
        } else setArmed(true)
      }}
    >
      {armed ? confirmText : children}
    </button>
  )
}
