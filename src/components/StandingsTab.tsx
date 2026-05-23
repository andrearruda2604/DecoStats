import { useState, useEffect } from 'react';
import { fetchStandings } from '../services/api';
import type { StandingRow } from '../types';

interface Props {
  leagueId: number;
  season: number;
  leagueName?: string;
  homeTeamApiId?: number;
  awayTeamApiId?: number;
}

function FormBadge({ char }: { char: string }) {
  const color =
    char === 'W' ? 'bg-blue-500 text-white'
    : char === 'D' ? 'bg-white/20 text-on-surface-variant'
    : 'bg-rose-500 text-white';
  return (
    <span className={`inline-flex items-center justify-center w-4 h-4 rounded-sm text-[8px] font-black ${color}`}>
      {char}
    </span>
  );
}

export default function StandingsTab({ leagueId, season, leagueName, homeTeamApiId, awayTeamApiId }: Props) {
  const [rows, setRows] = useState<StandingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchStandings(leagueId, season)
      .then(data => setRows(data))
      .catch(err => setError(err.message || 'Erro ao carregar classificação'))
      .finally(() => setLoading(false));
  }, [leagueId, season]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent animate-spin rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-on-surface-variant/50">{error}</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-on-surface-variant/40 uppercase tracking-widest font-bold">Classificação não disponível</p>
        <p className="text-[10px] text-on-surface-variant/25 mt-2">Esta competição pode não ter tabela de classificação</p>
      </div>
    );
  }

  // Group by "group" field (single-table leagues have group = '')
  const groups = new Map<string, StandingRow[]>();
  for (const row of rows) {
    if (!groups.has(row.group)) groups.set(row.group, []);
    groups.get(row.group)!.push(row);
  }

  return (
    <div className="space-y-6 pb-4">
      {leagueName && (
        <p className="text-[9px] uppercase tracking-[0.25em] text-on-surface-variant/50 font-black pt-1">
          {leagueName} · {season}
        </p>
      )}

      {Array.from(groups.entries()).map(([group, groupRows]) => (
        <div key={group || 'main'} className="rounded-xl overflow-hidden border border-outline-variant/15">
          {group && (
            <div className="px-3 py-2 bg-surface-container/50 border-b border-outline-variant/15">
              <span className="text-[9px] uppercase tracking-widest font-black text-on-surface-variant/60">{group}</span>
            </div>
          )}

          {/* Header */}
          <div className="flex items-center px-3 py-1.5 bg-surface-container/30 border-b border-outline-variant/10 text-[8px] font-black uppercase tracking-widest text-on-surface-variant/40">
            <span className="w-6 text-center">#</span>
            <span className="flex-1 ml-2">Time</span>
            <div className="flex gap-0 text-center">
              {['P','V','E','D','GP','GC','SG','Pts'].map(h => (
                <span key={h} className="w-7 text-center">{h}</span>
              ))}
            </div>
            <span className="w-20 text-center hidden sm:block">Forma</span>
          </div>

          {/* Rows */}
          {groupRows.map(row => {
            const isHome = row.team_api_id === homeTeamApiId;
            const isAway = row.team_api_id === awayTeamApiId;
            const isHighlighted = isHome || isAway;
            return (
              <div
                key={row.rank}
                className={`flex items-center px-3 py-2 border-b border-outline-variant/5 last:border-b-0 transition-colors ${
                  isHighlighted
                    ? isHome
                      ? 'bg-blue-500/10 border-l-2 border-l-blue-500'
                      : 'bg-rose-500/10 border-l-2 border-l-rose-500'
                    : 'hover:bg-white/3'
                }`}
              >
                {/* Rank */}
                <span className={`w-6 text-center text-[10px] font-black tabular-nums ${
                  row.rank <= 4 ? 'text-blue-400' : row.rank >= groupRows.length - 2 ? 'text-rose-400' : 'text-on-surface-variant/50'
                }`}>
                  {row.rank}
                </span>

                {/* Logo + Name */}
                <div className="flex-1 flex items-center gap-2 ml-2 min-w-0">
                  {row.team_logo && (
                    <img referrerPolicy="no-referrer"
                      src={row.team_logo}
                      alt=""
                      className="w-4 h-4 object-contain flex-shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                  <span className={`text-[11px] truncate ${isHighlighted ? 'font-black text-on-surface' : 'font-medium text-on-surface/80'}`}>
                    {row.team_name}
                  </span>
                </div>

                {/* Stats */}
                <div className="flex gap-0 text-center text-[10px] tabular-nums text-on-surface-variant/70">
                  <span className="w-7 text-center">{row.played}</span>
                  <span className="w-7 text-center">{row.won}</span>
                  <span className="w-7 text-center">{row.drawn}</span>
                  <span className="w-7 text-center">{row.lost}</span>
                  <span className="w-7 text-center">{row.goals_for}</span>
                  <span className="w-7 text-center">{row.goals_against}</span>
                  <span className={`w-7 text-center font-bold ${row.goal_diff > 0 ? 'text-blue-400' : row.goal_diff < 0 ? 'text-rose-400' : 'text-on-surface-variant/50'}`}>
                    {row.goal_diff > 0 ? `+${row.goal_diff}` : row.goal_diff}
                  </span>
                  <span className={`w-7 text-center font-black ${isHighlighted ? 'text-on-surface' : 'text-on-surface/90'}`}>
                    {row.points}
                  </span>
                </div>

                {/* Form */}
                <div className="w-20 hidden sm:flex items-center justify-center gap-0.5 ml-1">
                  {row.form.slice(-5).split('').map((c, i) => (
                    <FormBadge key={i} char={c} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
