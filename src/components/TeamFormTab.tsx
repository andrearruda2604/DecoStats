/**
 * TeamFormTab — aba "Forma" dentro do detalhe do jogo
 * Mostra histórico de resultados dos dois times com barras coloridas.
 */

import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeamInfo {
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
  league_id: number;
  opponent_id: number;
  opponent: { name: string; logo_url: string } | null;
  league:   { name: string; logo_url: string } | null;
  ht_goals_for:     number | null;
  ht_goals_against: number | null;
}

type MandoFilter  = 'all' | 'home' | 'away';
type LigaFilter   = 'all' | 'game';
type Res          = 'W' | 'D' | 'L';

interface Props {
  homeTeam:    TeamInfo;
  awayTeam:    TeamInfo;
  leagueDbId:  number;   // fixtures.league_id → teams_history.league_id
  leagueName:  string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getResult = (gf: number, ga: number): Res =>
  gf > ga ? 'W' : gf < ga ? 'L' : 'D';

const COLORS: Record<Res, { bar: string; text: string; border: string; light: string }> = {
  W: { bar: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-l-emerald-500', light: 'text-emerald-400/80' },
  D: { bar: 'bg-gray-500',    text: 'text-gray-400',    border: 'border-l-gray-500',    light: 'text-gray-400/80'    },
  L: { bar: 'bg-rose-500',    text: 'text-rose-400',    border: 'border-l-rose-500',    light: 'text-rose-400/80'    },
};

// ─── Data fetching ────────────────────────────────────────────────────────────

async function loadHistory(
  teamApiId:   number,
  count:       number,
  mando:       MandoFilter,
  leagueDbId?: number,
): Promise<MatchRow[]> {
  let q = supabase
    .from('teams_history')
    .select('fixture_id,match_date,is_home,goals_for,goals_against,corners,yellow_cards,league_id,opponent_id')
    .eq('team_id', teamApiId)
    .order('match_date', { ascending: false })
    .limit(count);

  if (mando  === 'home') q = q.eq('is_home', true);
  if (mando  === 'away') q = q.eq('is_home', false);
  if (leagueDbId)        q = q.eq('league_id', leagueDbId);

  const { data: rows } = await q;
  if (!rows?.length) return [];

  const oppIds = [...new Set(rows.map(r => r.opponent_id))];
  const lgIds  = [...new Set(rows.map(r => r.league_id))];
  const fixIds = rows.map(r => r.fixture_id);

  const [{ data: opps }, { data: lgs }, { data: fixes }] = await Promise.all([
    supabase.from('teams').select('api_id,name,logo_url').in('api_id', oppIds),
    supabase.from('leagues').select('id,name,logo_url').in('id', lgIds),
    supabase.from('fixtures').select('api_id,ht_home_score,ht_away_score').in('api_id', fixIds),
  ]);

  return rows.map(row => {
    const fix = fixes?.find(f => f.api_id === row.fixture_id);
    return {
      ...row,
      goals_for:        row.goals_for      ?? 0,
      goals_against:    row.goals_against  ?? 0,
      opponent:         opps?.find(o => o.api_id === row.opponent_id) ?? null,
      league:           lgs?.find(l => l.id === row.league_id)        ?? null,
      ht_goals_for:     row.is_home ? (fix?.ht_home_score ?? null) : (fix?.ht_away_score ?? null),
      ht_goals_against: row.is_home ? (fix?.ht_away_score ?? null) : (fix?.ht_home_score ?? null),
    };
  });
}

// ─── Form Bars ────────────────────────────────────────────────────────────────

function FormBars({ history }: { history: MatchRow[] }) {
  const chron  = [...history].reverse();
  const maxGD  = Math.max(...chron.map(m => Math.abs(m.goals_for - m.goals_against)), 1);
  const wins   = history.filter(m => getResult(m.goals_for, m.goals_against) === 'W').length;
  const draws  = history.filter(m => getResult(m.goals_for, m.goals_against) === 'D').length;
  const losses = history.filter(m => getResult(m.goals_for, m.goals_against) === 'L').length;

  return (
    <div className="px-4 pt-4 pb-3">
      {/* Bars */}
      <div className="flex items-end gap-[3px] h-14">
        {chron.map((m, i) => {
          const res = getResult(m.goals_for, m.goals_against);
          const gd  = Math.abs(m.goals_for - m.goals_against);
          const h   = res === 'D' ? 6 : Math.round(Math.max(10, (gd / maxGD) * 52));
          return (
            <div
              key={i}
              title={`${m.goals_for}–${m.goals_against}  ${new Date(m.match_date).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}`}
              className="flex-1 flex flex-col items-center gap-0.5 group cursor-default"
            >
              <div className={`w-full rounded-t-[2px] transition-opacity group-hover:opacity-70 ${COLORS[res].bar}`} style={{ height: h }} />
            </div>
          );
        })}
      </div>
      {/* Score labels */}
      <div className="flex gap-[3px] mt-1">
        {chron.map((m, i) => (
          <div key={i} className="flex-1 text-center">
            <span className="text-[6px] font-bold text-on-surface-variant/40 tabular-nums leading-none">
              {m.goals_for}-{m.goals_against}
            </span>
          </div>
        ))}
      </div>
      {/* W/D/L summary */}
      <div className="flex items-center gap-2 mt-3">
        <span className="text-[9px] font-black text-emerald-400">V {wins}</span>
        <span className="text-[9px] font-black text-gray-400">E {draws}</span>
        <span className="text-[9px] font-black text-rose-400">D {losses}</span>
        <span className="ml-auto text-[8px] text-on-surface-variant/35 font-bold">{history.length} jogos</span>
      </div>
    </div>
  );
}

// ─── Match list row ───────────────────────────────────────────────────────────

function HistoryRow({ m }: { m: MatchRow }) {
  const res    = getResult(m.goals_for, m.goals_against);
  const date   = new Date(m.match_date);
  const hasHT  = m.ht_goals_for != null && m.ht_goals_against != null;

  return (
    <div className={`flex items-center gap-2.5 px-4 py-2.5 border-b border-outline-variant/10 border-l-[3px] ${COLORS[res].border} hover:bg-surface/30 transition-colors`}>
      {/* Date */}
      <span className="text-[9px] font-bold text-on-surface-variant/50 w-16 shrink-0 tabular-nums leading-tight">
        {date.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}
        <span className="block text-[7px] text-on-surface-variant/30">{date.getFullYear()}</span>
      </span>

      {/* League logo */}
      {m.league?.logo_url
        ? <img src={m.league.logo_url} className="w-3.5 h-3.5 object-contain shrink-0 opacity-60" title={m.league.name} />
        : <div className="w-3.5 shrink-0" />
      }

      {/* C/F */}
      <span className={`text-[7px] font-black px-1 py-0.5 rounded shrink-0 ${
        m.is_home ? 'bg-primary/15 text-primary' : 'bg-white/5 text-on-surface-variant/40'
      }`}>
        {m.is_home ? 'C' : 'F'}
      </span>

      {/* Score */}
      <div className="flex items-baseline gap-1 shrink-0 w-16">
        <span className={`text-[13px] font-black tabular-nums leading-none ${COLORS[res].text}`}>
          {m.goals_for}–{m.goals_against}
        </span>
        {hasHT && (
          <span className="text-[8px] text-on-surface-variant/30 font-bold tabular-nums">
            ({m.ht_goals_for}-{m.ht_goals_against})
          </span>
        )}
      </div>

      {/* Opponent */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        {m.opponent?.logo_url && (
          <img
            src={m.opponent.logo_url}
            className="w-4 h-4 object-contain shrink-0"
            onError={e => { (e.target as HTMLImageElement).style.display='none'; }}
          />
        )}
        <span className="text-[11px] font-bold text-on-surface truncate">{m.opponent?.name ?? '—'}</span>
      </div>

      {/* Chips */}
      <div className="flex items-center gap-1 shrink-0">
        {m.corners != null && (
          <span className="text-[7px] font-bold text-on-surface-variant/45 bg-white/5 px-1.5 py-0.5 rounded" title="Escanteios">⌐{m.corners}</span>
        )}
        {m.yellow_cards != null && (
          <span className="text-[7px] font-bold text-amber-400/60 bg-amber-500/5 px-1.5 py-0.5 rounded" title="Cartões">✦{m.yellow_cards}</span>
        )}
      </div>
    </div>
  );
}

// ─── Team panel ───────────────────────────────────────────────────────────────

function TeamPanel({
  team,
  history,
  loading,
  accentColor,
}: {
  team: TeamInfo;
  history: MatchRow[];
  loading: boolean;
  accentColor: string;
}) {
  return (
    <div className="bg-surface/40 border border-outline-variant/20 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className={`flex items-center gap-3 px-4 py-3 border-b-2 ${accentColor}`}>
        <img
          src={team.logo_url}
          className="w-7 h-7 object-contain shrink-0"
          onError={e => { (e.target as HTMLImageElement).style.display='none'; }}
        />
        <span className="text-[11px] font-black uppercase tracking-wider text-white">{team.name}</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent animate-spin rounded-full" />
        </div>
      ) : history.length === 0 ? (
        <p className="text-center text-on-surface-variant/30 text-[11px] font-bold py-8">Sem histórico disponível</p>
      ) : (
        <>
          <FormBars history={history} />
          <div className="border-t border-outline-variant/10">
            {history.map((m, i) => (
              <div key={i}><HistoryRow m={m} /></div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TeamFormTab({ homeTeam, awayTeam, leagueDbId, leagueName }: Props) {
  const [homeHistory, setHomeHistory] = useState<MatchRow[]>([]);
  const [awayHistory, setAwayHistory] = useState<MatchRow[]>([]);
  const [loading, setLoading]         = useState(false);
  const [count, setCount]             = useState(10);
  const [mandoGame, setMandoGame]     = useState(false);
  const [liga, setLiga]               = useState<LigaFilter>('game');

  useEffect(() => {
    setLoading(true);
    const lgId       = liga === 'game' ? leagueDbId : undefined;
    const homeMando: MandoFilter = mandoGame ? 'home' : 'all';
    const awayMando: MandoFilter = mandoGame ? 'away' : 'all';
    Promise.all([
      loadHistory(homeTeam.api_id, count, homeMando, lgId),
      loadHistory(awayTeam.api_id, count, awayMando, lgId),
    ]).then(([home, away]) => {
      setHomeHistory(home);
      setAwayHistory(away);
      setLoading(false);
    });
  }, [homeTeam.api_id, awayTeam.api_id, count, mandoGame, liga, leagueDbId]);

  const btn = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex-shrink-0 ${
      active
        ? 'bg-primary text-on-primary'
        : 'bg-surface border border-outline-variant/30 text-on-surface-variant/55 hover:text-on-surface hover:border-outline-variant/60'
    }`;

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Jogos */}
        <div className="flex gap-1">
          {([5, 10, 15, 20] as const).map(n => (
            <button key={n} onClick={() => setCount(n)} className={btn(count === n)}>{n}</button>
          ))}
        </div>

        <div className="h-5 w-px bg-outline-variant/20 mx-0.5" />

        {/* Liga */}
        <div className="flex gap-1">
          <button onClick={() => setLiga('all')}  className={btn(liga === 'all')}>Todas</button>
          <button onClick={() => setLiga('game')} className={btn(liga === 'game')}>
            {leagueName ? leagueName.split(' ').slice(0,2).join(' ') : 'Do Jogo'}
          </button>
        </div>

        <div className="h-5 w-px bg-outline-variant/20 mx-0.5" />

        {/* Mando */}
        <div className="flex gap-1">
          <button onClick={() => setMandoGame(false)} className={btn(!mandoGame)}>Todos</button>
          <button onClick={() => setMandoGame(true)}  className={btn(mandoGame)}>Casa/Fora</button>
        </div>
      </div>

      {/* Panels */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <TeamPanel team={homeTeam} history={homeHistory} loading={loading} accentColor="border-emerald-500/40" />
        <TeamPanel team={awayTeam} history={awayHistory} loading={loading} accentColor="border-blue-500/40" />
      </div>
    </div>
  );
}
