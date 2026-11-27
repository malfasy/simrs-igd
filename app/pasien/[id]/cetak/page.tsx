import { HalamanCetak, type JenisDokumen } from '@/components/docs/Dokumen'

const JENIS: JenisDokumen[] = ['resume', 'rujukan', 'kwitansi']

export default function Page({ params, searchParams }: { params: { id: string }; searchParams: { jenis?: string } }) {
  const jenis = JENIS.includes(searchParams.jenis as JenisDokumen) ? (searchParams.jenis as JenisDokumen) : 'resume'
  return <HalamanCetak id={decodeURIComponent(params.id)} jenis={jenis} />
}
