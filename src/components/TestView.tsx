/**
 * TestView — /teste
 * Acesse em: ?view=teste (requer login)
 */

import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Search } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Team {
  id: number;
  api_id: number;
  name: string;
  logo_url: string;
}

interface MatchRow {
  fixture_id: number;
  match_date: string;
  is_home: boolean;
  goals_for: number;
  goals_against: number;
  corners: number | null;
  yellow_cards: number | null;
  shots_total: number | null;
  league_id: number;
  opponent_id: number;
  season: number;
  opponent: { name: string; logo_url: string } | null;
  league: { name: string; logo_url: string } | null;
  ht_goals_for: number | null;
  ht_goals_against: number | null;
}

type MandoFilter = 'all' | 'home' | 'away';
type Result = 'W' | 'D' | 'L';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getResult(gf: number, ga: number): Result {
  return gf > ga ? 'W' : gf < ga ? 'L' : 'D';
}

const R = {
  W: { bar: 'bg-emerald-500', text: 'text-emerald-400', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', row: 'border-l-emerald-500' },
  D: { bar: 'bg-gray-500',    text: 'text-gray-400',    badge: 'bg-gray-500/10 text-gray-400 border-gray-500/20',         row: 'border-l-gray-500' },
  L: { bar: 'bg-rose-500',    text: 'text-rose-400',    badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20',         row: 'border-l-rose-500' },
};

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchHistory(
  teamApiId: number,
  count: number,
  mando: MandoFilter,
): Promise<MatchRow[]> {
  let q = supabase
    .from('teams_history')
    .select('fixture_id,match_date,is_home,goals_for,goals_against,corners,yellow_cards,shots_total,league_id,opponent_id,season')
    .eq('team_id', teamApiId)
    .order('match_date', { ascending: false })
    .limit(count);

  if (mando === 'home') q = q.eq('is_home', true);
  if (mando === 'away') q = q.eq('is_home', false);

  const { data: rows } = await q;
  if (!rows?.length) return [];

  const oppIds  = [...new Set(rows.map(r => r.opponent_id))];
  const lgIds   = [...new Set(rows.map(r => r.league_id))];
  const fixIds  = rows.map(r => r.fixture_id);

  const [{ data: opps }, { data: lgs }, { data: fixes }] = await Promise.all([
    supabase.from('teams').select('api_id,name,logo_url').in('api_id', oppIds),
    supabase.from('leagues').select('id,name,logo_url').in('id', lgIds),
    supabase.from('fixtures').select('api_id,ht_home_score,ht_away_score').in('api_id', fixIds),
  ]);

  return rows.map(row => {
    const fix = fixes?.find(f => f.api_id === row.fixture_id);
    return {
      ...row,
      goals_for:       row.goals_for  ?? 0,
      goals_against:   row.goals_against ?? 0,
      opponent:        opps?.find(o => o.api_id === row.opponent_id) ?? null,
      league:          lgs?.find(l => l.id === row.league_id) ?? null,
      ht_goals_for:    row.is_home ? (fix?.ht_home_score ?? null) : (fix?.ht_away_score ?? null),
      ht_goals_against: row.is_home ? (fix?.ht_away_score ?? null) : (fix?.ht_home_score ?? null),
    };
  });
}

// ─── Form Bars ────────────────────────────────────────────────────────────────

function FormBars({ history }: { history: MatchRow[] }) {
  const chronological = [...history].reverse();
  const maxGD = Math.max(...chronological.map(m => Math.abs(m.goals_for - m.goals_against)), 1);

  return (
    <div className="bg-surface/40 border border-outline-variant/20 rounded-2xl p-5 mb-1">
      <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/50 mb-4">Forma</p>

      {/* Bars */}
      <div className="flex items-end gap-1 h-[72px]">
        {chronological.map((m, i) => {
          const res = getResult(m.goals_for, m.goals_against);
          const gd  = Math.abs(m.goals_for - m.goals_against);
          const h   = res === 'D' ? 8 : Math.round(Math.max(14, (gd / maxGD) * 64));
          return (
            <div
              key={i}
              title={`${m.goals_for}–${m.goals_against} · ${new Date(m.match_date).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' })}`}
              className="flex-1 flex flex-col items-center gap-0.5 group cursor-default"
            >
              <span className={`text-[6px] font-black opacity-0 group-hover:opacity-100 transition-opacity ${R[res].text}`}>
                {res}
              </span>
              <div
                className={`w-full rounded-t-[3px] transition-opacity group-hover:opacity-80 ${R[res].bar}`}
                style={{ height: h }}
              />
            </div>
          );
        })}
      </div>

      {/* Score labels */}
      <div className="flex gap-1 mt-1.5">
        {chronological.map((m, i) => (
          <div key={i} className="flex-1 text-center">
            <span className="text-[6px] font-bold text-on-surface-variant/40 tabular-nums">
              {m.goals_for}-{m.goals_against}
            </span>
          </div>
        ))}
      </div>

      {/* Summary pills */}
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-outline-variant/10">
        {(['W','D','L'] as Result[]).map(res => {
          const count = history.filter(m => getResult(m.goals_for, m.goals_against) === res).length;
          const labels = { W: 'V', D: 'E', L: 'D' };
          return (
            <span key={res} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-black ${R[res].badge}`}>
              {labels[res]} {count}
            </span>
          );
        })}
        <span className="ml-auto text-[9px] text-on-surface-variant/40 font-bold">
          {history.length} jogos
        </span>
      </div>
    </div>
  );
}

// ─── Match Row ────────────────────────────────────────────────────────────────

function MatchRow({ m }: { m: MatchRow }) {
  const res = getResult(m.goals_for, m.goals_against);
  const date = new Date(m.match_date);
  const hasHT = m.ht_goals_for != null && m.ht_goals_against != null;

  return (
    <div className={`flex items-center gap-3 px-4 py-3.5 border-b border-outline-variant/10 border-l-2 ${R[res].row} hover:bg-surface/40 transition-colors`}>

      {/* Date */}
      <span className="text-[10px] font-bold text-on-surface-variant/55 w-[72px] shrink-0 tabular-nums">
        {date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')}
        <span className="block text-[8px] text-on-surface-variant/30">{date.getFullYear()}</span>
      </span>

      {/* League */}
      {m.league?.logo_url
        ? <img src={m.league.logo_url} className="w-4 h-4 object-contain shrink-0 opacity-70" title={m.league.name} />
        : <div className="w-4 shrink-0" />
      }

      {/* Casa/Fora badge */}
      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded shrink-0 ${
        m.is_home ? 'bg-primary/15 text-primary' : 'bg-on-surface-variant/10 text-on-surface-variant/50'
      }`}>
        {m.is_home ? 'C' : 'F'}
      </span>

      {/* Score */}
      <div className="flex items-baseline gap-1.5 shrink-0 w-20">
        <span className={`text-[15px] font-black tabular-nums leading-none ${R[res].text}`}>
          {m.goals_for}–{m.goals_against}
        </span>
        {hasHT && (
          <span className="text-[9px] text-on-surface-variant/35 font-bold tabular-nums">
            ({m.ht_goals_for}-{m.ht_goals_against})
          </span>
        )}
      </div>

      {/* Opponent */}
      <div className="flex items-center gap-2 min-w-0 flex-1 ml-2">
        {m.opponent?.logo_url && (
          <img
            src={m.opponent.logo_url}
            className="w-5 h-5 object-contain shrink-0"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        <span className="text-[12px] font-bold text-on-surface truncate">
          {m.opponent?.name ?? '—'}
        </span>
      </div>

      {/* Stats chips */}
      <div className="flex items-center gap-1.5 shrink-0">
        {m.corners != null && (
          <span className="text-[8px] font-black text-on-surface-variant/50 bg-surface-container/40 border border-outline-variant/15 px-1.5 py-0.5 rounded" title="Escanteios">
            ⌐ {m.corners}
          </span>
        )}
        {m.yellow_cards != null && (
          <span className="text-[8px] font-black text-amber-400/70 bg-amber-500/5 border border-amber-500/15 px-1.5 py-0.5 rounded" title="Cartões amarelos">
            ✦ {m.yellow_cards}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TestView() {
  const [query, setQuery]             = useState('');
  const [suggestions, setSuggestions] = useState<Team[]>([]);
  const [team, setTeam]               = useState<Team | null>(null);
  const [history, setHistory]         = useState<MatchRow[]>([]);
  const [loading, setLoading]         = useState(false);
  const [count, setCount]             = useState(20);
  const [mando, setMando]             = useState<MandoFilter>('all');

  // Live team search
  useEffect(() => {
    if (query.length < 2) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('teams').select('id,api_id,name,logo_url')
        .ilike('name', `%${query}%`).limit(8);
      setSuggestions(data || []);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  // Load history when team / filters change
  useEffect(() => {
    if (!team) return;
    setLoading(true);
    fetchHistory(team.api_id, count, mando).then(data => {
      setHistory(data);
      setLoading(false);
    });
  }, [team, count, mando]);

  const selectTeam = (t: Team) => {
    setTeam(t);
    setQuery(t.name);
    setSuggestions([]);
  };

  const leagueName = history[0]?.league?.name ?? '';
  const season     = history[0]?.season;

  return (
    <div className="min-h-screen bg-background text-on-surface font-body">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-5">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-black italic tracking-tighter text-white">
            Team Form <span className="text-primary text-base font-black not-italic tracking-normal">beta</span>
          </h1>
          <p className="text-[10px] text-on-surface-variant/40 uppercase tracking-[0.2em] mt-0.5">
            Histórico de resultados por equipe
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setTeam(null); setHistory([]); }}
            placeholder="Buscar time..."
            className="w-full bg-surface border border-outline-variant/40 rounded-xl py-3 pl-11 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-primary/60 transition-colors"
          />
          {suggestions.length > 0 && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-surface border border-outline-variant/30 rounded-xl shadow-2xl z-50 overflow-hidden">
              {suggestions.map(t => (
                <button
                  key={t.id}
                  onClick={() => selectTeam(t)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container/60 transition-colors text-left border-b border-outline-variant/10 last:border-0"
                >
                  <img src={t.logo_url} className="w-6 h-6 object-contain shrink-0" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                  <span className="text-sm font-bold text-on-surface">{t.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {team && (
          <>
            {/* Team header */}
            <div className="flex items-center gap-4 pt-1">
              <img src={team.logo_url} className="w-12 h-12 object-contain" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
              <div>
                <h2 className="text-xl font-black text-white leading-tight">{team.name}</h2>
                <p className="text-[10px] text-on-surface-variant/50 uppercase tracking-widest">
                  {leagueName}{season ? ` · ${season}/${String(season+1).slice(2)}` : ''}
                </p>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              {([5, 10, 15, 20] as const).map(n => (
                <button key={n} onClick={() => setCount(n)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                    count === n
                      ? 'bg-primary text-on-primary shadow-[0_0_12px_rgba(var(--primary-rgb),0.4)]'
                      : 'bg-surface border border-outline-variant/30 text-on-surface-variant/60 hover:text-on-surface hover:border-outline-variant/60'
                  }`}>
                  {n} jogos
                </button>
              ))}
              <div className="h-6 w-px bg-outline-variant/20 self-center mx-1" />
              {(['all', 'home', 'away'] as MandoFilter[]).map(m => (
                <button key={m} onClick={() => setMando(m)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                    mando === m
                      ? 'bg-primary text-on-primary shadow-[0_0_12px_rgba(var(--primary-rgb),0.4)]'
                      : 'bg-surface border border-outline-variant/30 text-on-surface-variant/60 hover:text-on-surface hover:border-outline-variant/60'
                  }`}>
                  {m === 'all' ? 'Todos' : m === 'home' ? 'Casa' : 'Fora'}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex justify-center py-20">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent animate-spin rounded-full" />
              </div>
            ) : history.length > 0 ? (
              <>
                <FormBars history={history} />

                {/* Match list */}
                <div className="bg-surface/40 border border-outline-variant/20 rounded-2xl overflow-hidden">
                  {/* Column headers */}
                  <div className="flex items-center gap-3 px-4 py-2 border-b border-outline-variant/15 bg-surface/60">
                    <span className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant/40 w-[72px] shrink-0">Data</span>
                    <span className="w-4 shrink-0" />
                    <span className="w-[18px] shrink-0" />
                    <span className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant/40 w-20 shrink-0">Placar</span>
                    <span className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant/40 ml-2">Adversário</span>
                    <span className="ml-auto text-[8px] font-black uppercase tracking-widest text-on-surface-variant/40">⌐ ✦</span>
                  </div>

                  {history.map((m: MatchRow, i: number) => {
                    const row = <MatchRow m={m} />;
                    return <div key={`row-${i}`}>{row}</div>;
                  })}
                </div>
              </>
            ) : (
              <div className="text-center py-16 text-on-surface-variant/40 text-sm font-bold">
                Sem dados históricos para este time.
              </div>
            )}
          </>
        )}

        {!team && !loading && (
          <p className="text-center text-on-surface-variant/30 text-sm py-8">
            Digite o nome de um time para começar
          </p>
        )}

        <p className="text-center text-[8px] uppercase tracking-[0.3em] text-on-surface-variant/20 pt-4">
          DecoStats · Team Form Beta · <a href="/" className="hover:text-primary transition-colors">← Voltar ao app</a>
        </p>
      </div>
    </div>
  );
}
