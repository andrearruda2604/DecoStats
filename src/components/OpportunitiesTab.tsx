import { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { TrendingUp, Search, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

interface Opportunity {
  fixture_id: number;
  fixture_db_id?: number;
  home: string;
  away: string;
  homeLogo: string;
  awayLogo: string;
  date_time: string;
  leagueName: string;
  leagueLogo: string;
  stat: string;
  period: string;
  teamTarget: string;
  team: string;
  type: 'OVER' | 'UNDER' | 'H' | 'D' | 'A';
  threshold: number;
  line: string;
  market: string;
  probability: number;
  histHits: number;
  histTotal: number;
  odd: number;
}

const STAT_LABELS: Record<string, string> = {
  GOLS: 'Gols',
  ESCANTEIOS: 'Escanteios',
  CARTÕES: 'Cartões',
  CHUTES_GOL: 'Chutes a Gol',
  CHUTES_TOTAL: 'Chutes Totais',
  RESULTADO: '1x2 Resultado',
};

const PERIOD_LABELS: Record<string, string> = {
  FT: 'Jogo Completo',
  HT: '1° Tempo',
  '2H': '2° Tempo',
};

// Opções estáticas de filtro — sempre visíveis independente dos dados do dia
const STAT_OPTIONS = [
  { value: 'RESULTADO',    label: '1x2 Resultado' },
  { value: 'GOLS',         label: 'Gols' },
  { value: 'ESCANTEIOS',   label: 'Escanteios' },
  { value: 'CARTÕES',      label: 'Cartões' },
  { value: 'CHUTES_GOL',   label: 'Chutes a Gol' },
  { value: 'CHUTES_TOTAL', label: 'Chutes Totais' },
];

function SignalBars({ pct }: { pct: number }) {
  const filled = pct >= 97 ? 4 : pct >= 93 ? 3 : pct >= 90 ? 2 : 1;
  const heights = [5, 8, 11, 14];
  return (
    <span className="inline-flex items-end gap-[2px]">
      {heights.map((h, i) => (
        <span
          key={i}
          style={{ height: h, width: 3 }}
          className={`rounded-sm inline-block ${i < filled ? 'bg-emerald-400' : 'bg-white/15'}`}
        />
      ))}
    </span>
  );
}

function ProbBadge({ pct }: { pct: number }) {
  const color = pct >= 97 ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30'
    : pct >= 93 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    : 'text-lime-400 bg-lime-500/10 border-lime-500/20';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-black ${color}`}>
      <SignalBars pct={pct} />
      {pct}%
    </span>
  );
}

const FT_STATUSES = ['FT', 'AET', 'PEN', 'AWD', 'WO'];

export default function OpportunitiesTab({ onSelectMatch }: { onSelectMatch?: (id: number) => void }) {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [targetDate, setTargetDate] = useState('');
  const [search, setSearch] = useState('');
  const [filterStat, setFilterStat] = useState<string>('all');
  const [filterPeriod, setFilterPeriod] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [sortKey, setSortKey] = useState<'probability' | 'odd' | 'fixture'>('probability');
  const [sortAsc, setSortAsc] = useState(false);
  const [generatedAt, setGeneratedAt] = useState('');
  const [hideFinished, setHideFinished] = useState(false);
  const [finishedIds, setFinishedIds] = useState<Set<number>>(new Set());
  const [loadingFinished, setLoadingFinished] = useState(false);
  // scores: api_id → {home, away, htHome, htAway, status}
  const [scores, setScores] = useState<Record<number, { home: number; away: number; htHome: number | null; htAway: number | null; status: string }>>({});

  useEffect(() => {
    const brt = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const date = brt.toISOString().split('T')[0]; // hoje em BRT
    setTargetDate(date);

    loadOpportunities(date);
  }, []);

  async function loadOpportunities(date: string) {
    setLoading(true);
    const { data } = await supabase.from('odd_tickets')
      .select('ticket_data, date')
      .eq('date', date)
      .eq('mode', 'opp')
      .maybeSingle();

    if (data?.ticket_data?.opportunities) {
      const opps: Opportunity[] = data.ticket_data.opportunities;
      setOpportunities(opps);
      setGeneratedAt(data.ticket_data.generated_at || '');

      // Busca placares atuais para avaliar picks finalizados
      const fixIds = [...new Set(opps.map(o => o.fixture_id))];
      if (fixIds.length) {
        const { data: fixes } = await supabase
          .from('fixtures')
          .select('api_id, home_score, away_score, ht_home_score, ht_away_score, status')
          .in('api_id', fixIds);
        const map: typeof scores = {};
        (fixes || []).forEach(f => {
          map[f.api_id] = { home: f.home_score ?? 0, away: f.away_score ?? 0, htHome: f.ht_home_score, htAway: f.ht_away_score, status: f.status };
        });
        setScores(map);
        const fin = new Set<number>((fixes || []).filter(f => FT_STATUSES.includes(f.status)).map(f => f.api_id as number));
        setFinishedIds(fin);
      }
    } else {
      setOpportunities([]);
    }
    setLoading(false);
  }

  function evalPick(o: Opportunity): 'WON' | 'LOST' | null {
    const s = scores[o.fixture_id];
    if (!s || !FT_STATUSES.includes(s.status)) return null;
    let val: number | undefined;
    if (o.stat === 'GOLS') {
      if (o.period === 'FT') {
        if (o.teamTarget === 'TOTAL') val = s.home + s.away;
        else if (o.teamTarget === 'HOME') val = s.home;
        else val = s.away;
      } else if (o.period === 'HT' && s.htHome != null && s.htAway != null) {
        if (o.teamTarget === 'TOTAL') val = s.htHome + s.htAway;
        else if (o.teamTarget === 'HOME') val = s.htHome;
        else val = s.htAway;
      } else if (o.period === '2H' && s.htHome != null) {
        const h2H = s.home - s.htHome, h2A = s.away - (s.htAway ?? 0);
        if (o.teamTarget === 'TOTAL') val = h2H + h2A;
        else if (o.teamTarget === 'HOME') val = h2H;
        else val = h2A;
      }
    }
    if (val === undefined) return null;
    if (o.type === 'OVER')  return val > o.threshold  ? 'WON' : 'LOST';
    if (o.type === 'UNDER') return val < o.threshold  ? 'WON' : 'LOST';
    return null;
  }

  async function toggleHideFinished() {
    setHideFinished(v => !v);
  }

  function handleSort(key: typeof sortKey) {
    if (sortKey === key) setSortAsc(v => !v);
    else { setSortKey(key); setSortAsc(false); }
  }

  function SortIcon({ col }: { col: typeof sortKey }) {
    if (sortKey !== col) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortAsc ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />;
  }

  const periodOptions = Array.from(new Set(opportunities.map(o => o.period)));

  const finishedCount = finishedIds.size;

  const filtered = opportunities
    .filter(o => {
      if (hideFinished && finishedIds.has(o.fixture_id)) return false;
      if (filterStat !== 'all' && o.stat !== filterStat) return false;
      if (filterPeriod !== 'all' && o.period !== filterPeriod) return false;
      if (filterType === '1x2' && !['H','D','A'].includes(o.type)) return false;
      if (filterType !== 'all' && filterType !== '1x2' && o.type !== filterType) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!o.home.toLowerCase().includes(q) && !o.away.toLowerCase().includes(q) && !o.leagueName.toLowerCase().includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      let diff = 0;
      if (sortKey === 'probability') diff = b.probability - a.probability || b.odd - a.odd;
      else if (sortKey === 'odd') diff = b.odd - a.odd || b.probability - a.probability;
      else diff = a.home.localeCompare(b.home);
      return sortAsc ? -diff : diff;
    });

  // Group by fixture for header rows
  const grouped: { fixture_id: number; fixture_db_id?: number; home: string; away: string; homeLogo: string; awayLogo: string; date_time: string; leagueName: string; leagueLogo: string; rows: Opportunity[] }[] = [];
  const seenFix = new Set<number>();
  for (const o of filtered) {
    if (!seenFix.has(o.fixture_id)) {
      seenFix.add(o.fixture_id);
      grouped.push({ fixture_id: o.fixture_id, fixture_db_id: o.fixture_db_id, home: o.home, away: o.away, homeLogo: o.homeLogo, awayLogo: o.awayLogo, date_time: o.date_time, leagueName: o.leagueName, leagueLogo: o.leagueLogo, rows: [] });
    }
    grouped[grouped.length - 1].rows.push(o);
  }

  const fmtTime = (dt: string) => {
    try { return new Date(dt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }); }
    catch { return ''; }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-black uppercase tracking-widest text-on-surface">Oportunidades do Dia</h2>
          </div>
          <p className="text-[11px] text-on-surface-variant/50">
            {targetDate} — picks com probabilidade histórica ≥ 90% | Odds: Bet365
          </p>
          {generatedAt && (
            <p className="text-[10px] text-on-surface-variant/30 mt-0.5">
              Gerado: {new Date(generatedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-on-surface-variant/40 font-bold uppercase tracking-wider">
            {filtered.length} oportunidade{filtered.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={toggleHideFinished}
            disabled={loadingFinished}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-black transition-all border ${
              hideFinished
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                : 'bg-surface/40 border-outline-variant/20 text-on-surface-variant/50 hover:border-rose-500/30 hover:text-rose-400/80'
            } ${loadingFinished ? 'opacity-50 cursor-wait' : ''}`}
          >
            {loadingFinished ? (
              <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin inline-block" />
            ) : (
              <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="6" cy="6" r="5" />
                <path d="M4 4l4 4M8 4l-4 4" strokeLinecap="round" />
              </svg>
            )}
            {hideFinished
              ? `Finalizados ocultos${finishedCount > 0 ? ` (${finishedCount})` : ''}`
              : 'Ocultar finalizados'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-on-surface-variant/40 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar jogo ou liga..."
            className="w-full bg-surface/40 border border-outline-variant/20 rounded-lg pl-8 pr-3 py-1.5 text-[12px] text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary/40"
          />
        </div>

        {/* Stat filter */}
        <select
          value={filterStat}
          onChange={e => setFilterStat(e.target.value)}
          className="bg-surface/40 border border-outline-variant/20 rounded-lg px-3 py-1.5 text-[11px] font-bold text-on-surface focus:outline-none focus:border-primary/40"
        >
          <option value="all">Todos os mercados</option>
          {STAT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        {/* Period filter */}
        <select
          value={filterPeriod}
          onChange={e => setFilterPeriod(e.target.value)}
          className="bg-surface/40 border border-outline-variant/20 rounded-lg px-3 py-1.5 text-[11px] font-bold text-on-surface focus:outline-none focus:border-primary/40"
        >
          <option value="all">Todos os tempos</option>
          {periodOptions.map(p => <option key={String(p)} value={String(p)}>{PERIOD_LABELS[String(p)] || p}</option>)}
        </select>

        {/* Tipo filter */}
        <div className="flex rounded-lg overflow-hidden border border-outline-variant/20">
          {[
            { v: 'all', label: 'Todos' },
            { v: 'OVER', label: 'Mais de' },
            { v: 'UNDER', label: 'Menos de' },
            { v: '1x2', label: '1x2' },
          ].map(t => (
            <button key={t.v} onClick={() => setFilterType(t.v)}
              className={`px-3 py-1.5 text-[11px] font-black transition-colors ${filterType === t.v ? 'bg-primary text-on-primary' : 'bg-surface/40 text-on-surface-variant/60 hover:bg-surface/60'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : opportunities.length === 0 ? (
        <div className="text-center py-20">
          <TrendingUp className="w-10 h-10 text-on-surface-variant/20 mx-auto mb-3" />
          <p className="text-sm text-on-surface-variant/40 font-bold">Nenhuma oportunidade gerada para {targetDate}</p>
          <p className="text-[11px] text-on-surface-variant/25 mt-1">Execute o script <code className="font-mono">generateOpportunities.js</code> para popular.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-on-surface-variant/40">Nenhum resultado para os filtros selecionados.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Sort bar */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-3 text-[10px] font-black uppercase tracking-widest text-on-surface-variant/30">
            <button onClick={() => handleSort('fixture')} className="text-left flex items-center gap-1 hover:text-on-surface-variant/60 transition-colors">
              Jogo <SortIcon col="fixture" />
            </button>
            <span className="text-center w-28 hidden sm:block">Mercado</span>
            <button onClick={() => handleSort('probability')} className="flex items-center gap-1 hover:text-on-surface-variant/60 transition-colors w-20 justify-center">
              Prob <SortIcon col="probability" />
            </button>
            <button onClick={() => handleSort('odd')} className="flex items-center gap-1 hover:text-on-surface-variant/60 transition-colors w-14 justify-end">
              Odd <SortIcon col="odd" />
            </button>
          </div>

          {grouped.map(g => (
            <div key={g.fixture_id} className="bg-surface/20 border border-outline-variant/10 rounded-2xl overflow-hidden">
              {/* Liga */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-outline-variant/10 bg-surface/30">
                {g.leagueLogo && (
                  <div className="w-4 h-4 bg-white/90 rounded-sm flex-shrink-0 flex items-center justify-center p-[2px]">
                    <img src={g.leagueLogo} alt="" className="w-full h-full object-contain" />
                  </div>
                )}
                <span className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-wider">{g.leagueName}</span>
                <div className="ml-auto flex items-center gap-2">
                  {scores[g.fixture_id] && FT_STATUSES.includes(scores[g.fixture_id].status) && (
                    <span className="text-[11px] font-black text-on-surface/70">
                      {scores[g.fixture_id].home} – {scores[g.fixture_id].away}
                    </span>
                  )}
                  <span className="text-[10px] text-on-surface-variant/30">{fmtTime(g.date_time)}</span>
                </div>
              </div>

              {/* Fixture — clicável para ir às estatísticas */}
              <button
                onClick={() => { const navId = g.fixture_db_id ?? g.fixture_id; onSelectMatch?.(navId); }}
                className={`w-full flex items-center justify-center gap-3 px-4 py-2.5 border-b border-outline-variant/10 transition-colors ${onSelectMatch ? 'hover:bg-white/[0.04] cursor-pointer group' : ''}`}
              >
                <div className="flex items-center gap-2 flex-1 justify-end">
                  {g.homeLogo && <img src={g.homeLogo} alt="" className="w-5 h-5 object-contain" />}
                  <span className="text-[13px] font-black text-on-surface">{g.home}</span>
                </div>
                <span className="text-[10px] font-bold text-on-surface-variant/30 px-2">vs</span>
                <div className="flex items-center gap-2 flex-1">
                  {g.awayLogo && <img src={g.awayLogo} alt="" className="w-5 h-5 object-contain" />}
                  <span className="text-[13px] font-black text-on-surface">{g.away}</span>
                </div>
                {onSelectMatch && (
                  <ExternalLink className="w-3.5 h-3.5 text-on-surface-variant/20 group-hover:text-primary/60 transition-colors flex-shrink-0" />
                )}
              </button>

              {/* Opportunities rows */}
              <div className="divide-y divide-outline-variant/5">
                {g.rows.map((o, i) => {
                  const result = evalPick(o);
                  const isFinishedGame = FT_STATUSES.includes(scores[o.fixture_id]?.status ?? '');
                  return (
                  <div key={i} className={`grid grid-cols-[1fr_auto_auto] sm:grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 px-4 py-2.5 transition-colors ${
                    result === 'WON' ? 'bg-emerald-500/[0.04]' : result === 'LOST' ? 'bg-rose-500/[0.04]' : 'hover:bg-white/[0.02]'
                  }`}>
                    {/* Market + line + resultado */}
                    <div className="min-w-0">
                      <div className="text-[12px] font-bold text-on-surface leading-tight truncate">
                        {o.market}
                        {o.teamTarget !== 'TOTAL' && (
                          <span className="ml-1.5 text-[10px] text-on-surface-variant/40 font-normal">
                            ({o.teamTarget === 'HOME' ? 'Casa' : 'Fora'})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={`text-[11px] font-black ${
                          o.type === 'OVER' || o.type === 'H' ? 'text-emerald-400'
                          : o.type === 'D' ? 'text-amber-400'
                          : 'text-sky-400'
                        }`}>
                          {o.line}
                        </span>
                        <span className="text-[10px] text-on-surface-variant/30">
                          {PERIOD_LABELS[o.period] || o.period}
                        </span>
                        {result === 'WON' && (
                          <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded">✓ GREEN</span>
                        )}
                        {result === 'LOST' && (
                          <span className="text-[10px] font-black text-rose-400 bg-rose-500/15 px-1.5 py-0.5 rounded">✗ RED</span>
                        )}
                        {result === null && isFinishedGame && (
                          <span className="text-[10px] font-bold text-on-surface-variant/30 italic">sem dados</span>
                        )}
                      </div>
                    </div>

                    {/* Historico */}
                    <div className="hidden sm:block text-center w-28">
                      <div className="text-[11px] font-bold text-on-surface-variant/60">
                        {o.histHits}/{o.histTotal} jogos
                      </div>
                    </div>

                    {/* Probabilidade */}
                    <div className="flex justify-center w-20">
                      <ProbBadge pct={o.probability} />
                    </div>

                    {/* Odd */}
                    <div className="text-right w-14">
                      <span className="text-[14px] font-black text-amber-400">{o.odd.toFixed(2)}</span>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
