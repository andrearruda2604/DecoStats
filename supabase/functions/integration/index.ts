import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  // CORS configuration
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    })
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )
  const apiFootballKey = Deno.env.get('API_FOOTBALL_KEY')

  if (!apiFootballKey) {
    return new Response(JSON.stringify({ error: 'API_FOOTBALL_KEY missing' }), { status: 500 })
  }

  try {
    // Determine the type of integration to run
    const url = new URL(req.url)
    const type = url.searchParams.get('type') || 'fixtures' // fixtures, stats
    
    // We would make external calls to API-Football here
    // Example: fetch('https://v3.football.api-sports.io/fixtures?date=2024-04-17', { headers: { 'x-apisports-key': apiFootballKey } })
    
    // To keep the function lightweight and avoid spending API limits during demo:
    // We log the action to ingestion_jobs table
    const { data: job, error: jobError } = await supabaseAdmin
      .from('ingestion_jobs')
      .insert({
        type: type,
        status: 'processing',
        payload: { message: `Simulated ingestion for ${type}` }
      })
      .select()
      .single()

    if (jobError) throw jobError

    // Finish processing
    await supabaseAdmin
      .from('ingestion_jobs')
      .update({ status: 'done', processed_at: new Date().toISOString() })
      .eq('id', job.id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Integration run for ${type} completed.`,
        job_id: job.id
      }),
      { 
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      }
    )
  }
})
