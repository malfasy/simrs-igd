import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="panel" style={{ maxWidth: 520 }}>
      <h2>Halaman tidak ditemukan</h2>
      <div className="formfoot">
        <Link className="btn primary" href="/">
          Kembali ke Papan IGD
        </Link>
      </div>
    </div>
  )
}
