import { createClient } from 'jsr:@supabase/supabase-js@2'

const API_FOOTBALL_BASE = 'https://v3.football.api-sports.io';

Deno.serve(async (req) => {
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
    return new Response(JSON.stringify({ error: 'API_FOOTBALL_KEY missing' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
  }

  const fetchApiFootball = async (endpoint: string) => {
    const res = await fetch(`${API_FOOTBALL_BASE}${endpoint}`, {
      headers: {
        'x-apisports-key': apiFootballKey
      }
    });
    if (!res.ok) throw new Error(`API-Football error: ${res.statusText}`);
    const json = await res.json();
    return json.response;
  };

  try {
    const url = new URL(req.url)
    const simulateOnly = url.searchParams.get('simulate') === 'true'
    const dateParam = url.searchParams.get('date') || new Date().toISOString().split('T')[0];

    // Log job start
    const { data: job } = await supabaseAdmin
      .from('ingestion_jobs')
      .insert({ type: 'fixtures', status: 'processing', payload: { message: `Started ingestion for ${dateParam}` } })
      .select().single()

    // 1. Get active leagues from Supabase
    const { data: activeLeagues, error: leaguesErr } = await supabaseAdmin
      .from('leagues')
      .select('id, api_id, name')
      .eq('is_active', true);
      
    if (leaguesErr) throw leaguesErr;
    const activeLeagueApiIds = activeLeagues.map(l => l.api_id);
    const leagueApiIdToDbId = Object.fromEntries(activeLeagues.map(l => [l.api_id, l.id]));

    if (simulateOnly) {
      await supabaseAdmin.from('ingestion_jobs').update({ status: 'done', processed_at: new Date().toISOString() }).eq('id', job.id);
      return new Response(JSON.stringify({ message: "Simulated Run Completed" }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }

    // 2. Fetch today's fixtures
    console.log(`Fetching fixtures for ${dateParam}`);
    const fixturesApi = await fetchApiFootball(`/fixtures?date=${dateParam}`);
    
    // 3. Filter by our active leagues
    const targetFixtures = fixturesApi.filter((f: any) => activeLeagueApiIds.includes(f.league.id));
    console.log(`Found ${targetFixtures.length} fixtures in active leagues.`);

    let insertedCount = 0;

    // 4. Process each fixture
    for (const apiFixture of targetFixtures) {
      const dbLeagueId = leagueApiIdToDbId[apiFixture.league.id];
      const matchId = apiFixture.fixture.id;
      
      // Upsert Teams
      const homeTeam = apiFixture.teams.home;
      const awayTeam = apiFixture.teams.away;
      
      const teamUpserts = [
        { api_id: homeTeam.id, name: homeTeam.name, logo_url: homeTeam.logo, league_id: dbLeagueId },
        { api_id: awayTeam.id, name: awayTeam.name, logo_url: awayTeam.logo, league_id: dbLeagueId }
      ];
      
      const { data: dbTeams, error: teamErr } = await supabaseAdmin
        .from('teams')
        .upsert(teamUpserts, { onConflict: 'api_id', ignoreDuplicates: false })
        .select('id, api_id');
        
      if (teamErr) throw teamErr;

      const homeDbId = dbTeams.find(t => t.api_id === homeTeam.id)?.id;
      const awayDbId = dbTeams.find(t => t.api_id === awayTeam.id)?.id;

      // Upsert Fixture
      const fixtureUpsert = {
        api_id: matchId,
        league_id: dbLeagueId,
        home_team_id: homeDbId,
        away_team_id: awayDbId,
        date: apiFixture.fixture.date,
        status: apiFixture.fixture.status.short, // NS, FT, HT, etc
        home_score: apiFixture.goals.home,
        away_score: apiFixture.goals.away,
        ht_home_score: apiFixture.score.halftime.home,
        ht_away_score: apiFixture.score.halftime.away,
        venue: apiFixture.fixture.venue.name,
        round: apiFixture.league.round,
        season: apiFixture.league.season
      };

      const { data: dbFixture, error: fixErr } = await supabaseAdmin
        .from('fixtures')
        .upsert([fixtureUpsert], { onConflict: 'api_id' })
        .select('id').single();

      if (fixErr) throw fixErr;
      const dbFixtureId = dbFixture.id;
      insertedCount++;

      // If match has started, fetch stats and events
      if (!['NS', 'TBD', 'PST', 'CANC'].includes(apiFixture.fixture.status.short)) {
        // Fetch Statistics
        try {
          const statsApi = await fetchApiFootball(`/fixtures/statistics?fixture=${matchId}`);
          if (statsApi && statsApi.length > 0) {
            for (const teamStats of statsApi) {
              const currentTeamDbId = teamStats.team.id === homeTeam.id ? homeDbId : awayDbId;
              const statsMap: Record<string, any> = {};
              for (const s of teamStats.statistics) {
                statsMap[s.type] = s.value;
              }
              
              // Helper to parse numeric values from API (e.g. '55%' -> 55)
              const parseStat = (val: any) => {
                if (val === null) return 0;
                if (typeof val === 'string' && val.includes('%')) return parseFloat(val.replace('%', ''));
                return Number(val) || 0;
              };

              const statRow = {
                fixture_id: dbFixtureId,
                team_id: currentTeamDbId,
                period: 'FT', // For MVP we map API-Football overall stats as 'FT'
                shots_total: parseStat(statsMap['Total Shots']),
                shots_on_goal: parseStat(statsMap['Shots on Goal']),
                shots_off_goal: parseStat(statsMap['Shots off Goal']),
                corners: parseStat(statsMap['Corner Kicks']),
                yellow_cards: parseStat(statsMap['Yellow Cards']),
                red_cards: parseStat(statsMap['Red Cards']),
                goals: parseStat(currentTeamDbId === homeDbId ? apiFixture.goals.home : apiFixture.goals.away),
                possession: parseStat(statsMap['Ball Possession']),
                fouls: parseStat(statsMap['Fouls']),
                offsides: parseStat(statsMap['Offsides'])
              };

              // Since we enforce unique(fixture_id, team_id, period) in DB, we use UPSERT here usually,
              // but Supabase currently doesn't easily support upserting on multiple columns elegantly without RPC if unique index is used.
              // Wait, we can use OnConflict by specifying the exact constraint or deleting first.
              await supabaseAdmin.from('fixture_stats').delete().match({ fixture_id: dbFixtureId, team_id: currentTeamDbId, period: 'FT' });
              await supabaseAdmin.from('fixture_stats').insert([statRow]);
            }
          }
        } catch (e) {
          console.error(`Error fetching stats for match ${matchId}`, e);
        }

        // Fetch Events
        try {
          const eventsApi = await fetchApiFootball(`/fixtures/events?fixture=${matchId}`);
          if (eventsApi && eventsApi.length > 0) {
            // Clear existing events for this fixture
            await supabaseAdmin.from('fixture_events').delete().eq('fixture_id', dbFixtureId);
            
            const eventsToInsert = eventsApi.map((evt: any) => {
               const evtTeamDbId = evt.team.id === homeTeam.id ? homeDbId : awayDbId;
               return {
                 fixture_id: dbFixtureId,
                 team_id: evtTeamDbId,
                 elapsed: evt.time.elapsed,
                 extra_time: evt.time.extra,
                 type: evt.type, // Goal, Card, Subst, Var
                 detail: evt.detail,
                 player_name: evt.player.name,
                 assist_name: evt.assist.name
               }
            });

            if (eventsToInsert.length > 0) {
              await supabaseAdmin.from('fixture_events').insert(eventsToInsert);
            }
          }
        } catch (e) {
          console.error(`Error fetching events for match ${matchId}`, e);
        }
      }
    }

    // Finish processing
    await supabaseAdmin
      .from('ingestion_jobs')
      .update({ status: 'done', processed_at: new Date().toISOString() })
      .eq('id', job.id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Integration run completed. Synced ${insertedCount} fixtures for ${dateParam}.`
      }),
      { 
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      }
    )
  } catch (error: any) {
    console.error('Integration error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      }
    )
  }
})
