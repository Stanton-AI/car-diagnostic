import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ResultPageClient from './ResultPageClient'

export default async function ResultPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: convo, error } = await supabase
    .from('conversations')
    .select('*, vehicles(*)')
    .eq('id', params.id)
    .or(`is_public.eq.true,user_id.not.is.null`)
    .single()

  if (error || !convo) notFound()

  return <ResultPageClient conversation={convo} />
}
