import { PatientDetail } from '@/components/detail/PatientDetail'

export default function Page({ params, searchParams }: { params: { id: string }; searchParams: { tab?: string } }) {
  return <PatientDetail key={params.id} id={decodeURIComponent(params.id)} initialTab={searchParams.tab} />
}
