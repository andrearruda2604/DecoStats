/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { FixtureEvent } from '../types';

interface MatchEventsProps {
  events: FixtureEvent[];
  homeTeamId: number;
  homeTeamName: string;
  awayTeamName: string;
}

export default function MatchEvents({ events, homeTeamId, homeTeamName, awayTeamName }: MatchEventsProps) {
  if (!events.length) return null;

  const getIcon = (type: string, detail: string) => {
    if (type === 'Goal') return '⚽';
    if (type === 'Card' && detail.includes('Yellow')) return '🟨';
    if (type === 'Card' && detail.includes('Red')) return '🟥';
    if (type === 'Subst') return '🔄';
    if (type === 'Var') return '📺';
    return '•';
  };

  return (
    <div className="bg-surface-container rounded-3xl border border-outline-variant overflow-hidden">
      <div className="py-4 px-6 border-b border-outline-variant/30">
        <h3 className="font-headline font-bold text-[10px] tracking-[0.3em] uppercase text-on-surface-variant flex items-center gap-2">
          <span className="w-6 h-[2px] bg-primary" />
          Eventos da Partida
        </h3>
      </div>

      <div className="divide-y divide-outline-variant/10">
        {events.map((event) => {
          const isHome = event.team_id === homeTeamId;
          return (
            <div
              key={event.id}
              className={`flex items-center gap-4 py-3 px-6 transition-colors hover:bg-surface-container-highest/10 ${
                isHome ? '' : 'flex-row-reverse text-right'
              }`}
            >
              <span className="text-lg">{getIcon(event.type, event.detail)}</span>
              <div className={`flex-1 ${isHome ? '' : 'text-right'}`}>
                <span className="text-xs font-bold text-on-surface">
                  {event.player_name}
                </span>
                {event.assist_name && (
                  <span className="text-[10px] text-on-surface-variant/50 ml-2">
                    ({event.assist_name})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] font-bold text-primary tabular-nums">
                  {event.elapsed}'
                  {event.extra_time ? `+${event.extra_time}` : ''}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
