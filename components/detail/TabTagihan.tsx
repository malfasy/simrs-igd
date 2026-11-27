'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { BILL_GROUPS, PAYMENT_METHODS } from '@/lib/constants'
import { billTotal, computeBill, rupiah, tanggalJam } from '@/lib/clinical'
import { addBillItem, payBill, removeBillItem } from '@/lib/actions'
import type { BillGroup, PaymentMethod, Visit } from '@/lib/types'
import { useAuth, useCtx } from '../providers'
import { Chip, ConfirmButton, useRunner } from '../ui'

export function TabTagihan({ v }: { v: Visit }) {
  const ctx = useCtx()!
  const { user } = useAuth()
  const { busy, run } = useRunner()
  const paid = v.billing.payment
  const items = useMemo(() => computeBill(v), [v])
  const total = billTotal(items)
  const canPay = user?.role === 'pendaftaran' || user?.role === 'kepala'

  // Kelompokkan rincian per jenis biaya, urut sesuai BILL_GROUPS.
  const groups = BILL_GROUPS.map((g) => ({ g, rows: items.filter((i) => i.group === g) })).filter((x) => x.rows.length)

  const defaultMethod: PaymentMethod = v.insurance === 'BPJS' ? 'BPJS' : v.insurance === 'Asuransi swasta' ? 'Asuransi' : 'Tunai'
  const [method, setMethod] = useState<PaymentMethod>(defaultMethod)
  const [cash, setCash] = useState('')
  const cashNum = Number(cash.replace(/\D/g, '')) || 0
  const change = method === 'Tunai' && cashNum ? cashNum - total : null

  const [form, setForm] = useState({ group: 'Lainnya' as BillGroup, name: '', qty: '1', price: '' })

  return (
    <div className="grid2" style={{ gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)', alignItems: 'start' }}>
      <div className="stack">
        <section className="panel">
          <div className="ph">
            <h3 style={{ margin: 0 }}>Rincian biaya</h3>
            <div className="row">
              {paid ? <Chip kind="ok">Lunas · {paid.receiptNo}</Chip> : <Chip kind="warn">Belum dibayar</Chip>}
              <Link className="btn sm" href={`/pasien/${encodeURIComponent(v.id)}/cetak?jenis=kwitansi`}>
                {paid ? 'Cetak kwitansi' : 'Cetak rincian'}
              </Link>
            </div>
          </div>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th style={{ textAlign: 'right' }}>Jml</th>
                  <th style={{ textAlign: 'right' }}>Tarif</th>
                  <th style={{ textAlign: 'right' }}>Subtotal</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {groups.map(({ g, rows }) => (
                  <GroupRows key={g} g={g} rows={rows} canRemove={!paid && canPay} busy={busy} onRemove={(id) => run(() => removeBillItem(ctx, v, id), 'Item dihapus.')} />
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th colSpan={3} style={{ textAlign: 'right' }}>
                    Total
                  </th>
                  <th style={{ textAlign: 'right', fontSize: 16 }} className="mono">
                    {rupiah(total)}
                  </th>
                  <th />
                </tr>
              </tfoot>
            </table>
          </div>
          {!paid && (
            <p className="small muted" style={{ marginTop: 8 }}>
              Item otomatis diambil dari layanan yang tercatat: karcis, pemeriksaan dokter (sesuai level triase), tindakan, penunjang, dan obat dari tab Asesmen. Tarif bersifat contoh.
            </p>
          )}
        </section>

        {!paid && canPay && (
          <form
            className="panel"
            onSubmit={(e) => {
              e.preventDefault()
              void run(async () => {
                await addBillItem(ctx, v, { group: form.group, name: form.name, qty: Number(form.qty) || 0, price: Number(form.price.replace(/\D/g, '')) || 0 })
                setForm({ ...form, name: '', qty: '1', price: '' })
              }, 'Item tagihan ditambahkan.')
            }}
          >
            <h3>Tambah item manual</h3>
            <div className="fields" style={{ display: 'grid', gridTemplateColumns: '150px 1fr 80px 140px', gap: '10px 12px' }}>
              <div className="f">
                <label htmlFor="bi-g">Jenis</label>
                <select id="bi-g" value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value as BillGroup })}>
                  {BILL_GROUPS.map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div className="f">
                <label htmlFor="bi-n">Nama item</label>
                <input type="text" id="bi-n" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Contoh: Bahan habis pakai" />
              </div>
              <div className="f">
                <label htmlFor="bi-q">Jumlah</label>
                <input type="number" id="bi-q" min={1} value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
              </div>
              <div className="f">
                <label htmlFor="bi-p">Tarif (Rp)</label>
                <input type="text" id="bi-p" inputMode="numeric" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value.replace(/\D/g, '') })} />
              </div>
            </div>
            <div className="formfoot">
              <button className="btn" disabled={busy}>
                Tambah item
              </button>
            </div>
          </form>
        )}
      </div>

      <section className="panel">
        <h3>Pembayaran</h3>
        {paid ? (
          <>
            <dl className="kv">
              <dt>No. kwitansi</dt>
              <dd className="mono">{paid.receiptNo}</dd>
              <dt>Metode</dt>
              <dd>{paid.method}</dd>
              <dt>Total</dt>
              <dd className="mono">{rupiah(paid.total)}</dd>
              <dt>Waktu</dt>
              <dd>{tanggalJam(paid.at)}</dd>
              <dt>Petugas</dt>
              <dd>{paid.by}</dd>
            </dl>
            <div className="formfoot">
              <Link className="btn primary" href={`/pasien/${encodeURIComponent(v.id)}/cetak?jenis=kwitansi`}>
                Cetak kwitansi
              </Link>
            </div>
          </>
        ) : !canPay ? (
          <p className="muted">Pembayaran diproses oleh petugas pendaftaran/kasir atau Kepala IGD.</p>
        ) : (
          <>
            <dl className="kv" style={{ marginBottom: 12 }}>
              <dt>Penjamin</dt>
              <dd>{v.insurance}</dd>
              <dt>Total tagihan</dt>
              <dd className="mono" style={{ fontSize: 18, fontWeight: 700 }}>
                {rupiah(total)}
              </dd>
            </dl>
            <div className="f">
              <label>Metode pembayaran</label>
              <div className="seg" role="radiogroup" aria-label="Metode pembayaran" style={{ flexWrap: 'wrap' }}>
                {PAYMENT_METHODS.map((m) => (
                  <button key={m} type="button" className={method === m ? 'on' : ''} onClick={() => setMethod(m)}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
            {method === 'Tunai' && (
              <div className="f" style={{ marginTop: 10 }}>
                <label htmlFor="pay-cash">Uang diterima (Rp)</label>
                <input type="text" id="pay-cash" inputMode="numeric" value={cash ? Number(cash).toLocaleString('id-ID') : ''} onChange={(e) => setCash(e.target.value.replace(/\D/g, ''))} />
                {change !== null && (
                  <span className={`small ${change < 0 ? '' : 'muted'}`} style={change < 0 ? { color: 'var(--crit)' } : undefined}>
                    {change < 0 ? `Kurang ${rupiah(-change)}` : `Kembalian ${rupiah(change)}`}
                  </span>
                )}
              </div>
            )}
            {(method === 'BPJS' || method === 'Asuransi') && v.insurance !== (method === 'BPJS' ? 'BPJS' : 'Asuransi swasta') && (
              <div className="callout warn" style={{ marginTop: 10 }}>
                Penjamin pasien tercatat {v.insurance}. Pastikan kartu {method} sudah diverifikasi.
              </div>
            )}
            {!v.disposition && (
              <div className="callout info" style={{ marginTop: 10 }}>
                Pasien belum diputuskan disposisinya. Biasanya pembayaran dilakukan setelah pelayanan selesai, karena item tidak bisa ditambah setelah lunas.
              </div>
            )}
            <div className="formfoot">
              <ConfirmButton
                className="btn primary"
                disabled={busy || total <= 0 || (method === 'Tunai' && change !== null && change < 0)}
                confirmText={`Konfirmasi ${rupiah(total)}`}
                onConfirm={() => void run(() => payBill(ctx, v, method), method === 'BPJS' || method === 'Asuransi' ? `Tagihan dicatat ke ${method}.` : 'Pembayaran diterima, kwitansi siap dicetak.')}
              >
                {method === 'BPJS' || method === 'Asuransi' ? `Tagihkan ke ${method}` : 'Terima pembayaran'}
              </ConfirmButton>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function GroupRows({ g, rows, canRemove, busy, onRemove }: { g: string; rows: ReturnType<typeof computeBill>; canRemove: boolean; busy: boolean; onRemove: (id: string) => void }) {
  return (
    <>
      <tr>
        <td colSpan={5} style={{ background: 'var(--surface-2)', fontWeight: 600, fontSize: 12.5 }}>
          {g} <span className="muted">· {rupiah(billTotal(rows))}</span>
        </td>
      </tr>
      {rows.map((i) => (
        <tr key={i.id}>
          <td>
            {i.name} {!i.auto && <Chip kind="gray">manual</Chip>}
            {i.auto && i.price === 0 && <Chip kind="warn">tarif belum diatur</Chip>}
          </td>
          <td style={{ textAlign: 'right' }}>{i.qty}</td>
          <td style={{ textAlign: 'right' }} className="mono">
            {rupiah(i.price)}
          </td>
          <td style={{ textAlign: 'right' }} className="mono">
            {rupiah(i.qty * i.price)}
          </td>
          <td style={{ textAlign: 'right' }}>
            {canRemove && !i.auto && (
              <button type="button" className="btn sm" disabled={busy} onClick={() => onRemove(i.id)}>
                Hapus
              </button>
            )}
          </td>
        </tr>
      ))}
    </>
  )
}
