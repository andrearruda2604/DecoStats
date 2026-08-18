const fs = require('fs');
let content = fs.readFileSync('src/components/OpportunitiesTab.tsx', 'utf8');

const stateInjection = `
  const [selectedLeagueIds, setSelectedLeagueIds] = useState<number[]>([]);
  const [collapsedLeagues, setCollapsedLeagues] = useState<Record<string, boolean>>({});
`;
content = content.replace('  const fixIdsRef = useRef<number[]>([]);', '  const fixIdsRef = useRef<number[]>([]);\n' + stateInjection);

const namesMemo = `
  const selectedLeagueNames = useMemo(() => {
    if (!leagues || !selectedLeagueIds || selectedLeagueIds.length === 0) return null;
    return selectedLeagueIds.map(id => leagues.find(l => l.id === id)?.name).filter(Boolean) as string[];
  }, [leagues, selectedLeagueIds]);
`;
content = content.replace('  let filtered = opportunities.filter', namesMemo + '\n  let filtered = opportunities.filter');

const filterCondition = `
    if (selectedLeagueNames && !selectedLeagueNames.includes(o.leagueName)) {
      return false;
    }
    return true;
`;
content = content.replace('    return true;\n  });', filterCondition + '  });');

const oldReturnStart = '  return (\n    <div className="space-y-6">';
const newReturnStart = `  return (
    <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-5 lg:items-start">
      {leagues && (
        <aside className="lg:sticky lg:top-16 lg:max-h-[calc(100vh-4.5rem)] lg:overflow-y-auto lg:pb-4 no-scrollbar hidden lg:block">
          <LeagueFilter
            leagues={leagues}
            selectedLeagueIds={selectedLeagueIds}
            onSelectLeagues={setSelectedLeagueIds}
            selectedDate={targetDate}
            onSelectDate={(date) => { setTargetDate(date); setSelectedLeagueIds([]); }}
          />
        </aside>
      )}
      <div className="space-y-6 w-full min-w-0">`;
content = content.replace(oldReturnStart, newReturnStart);
content = content.replace('  return (\r\n    <div className="space-y-6">', newReturnStart);

content = content.replace(/    <\/div>\r?\n\s*?\);\r?\n\s*?\}\r?\n?$/, '      </div>\n    </div>\n  );\n}\n');

const oldLeagueMap = /leagueGroups\.map\(lg => \([\s\S]*?renderFixtureGroup\(g, true\)\)}[\s\S]*?<\/div>[\s\S]*?<\/div>\r?\n\s*?\)\)/;

const newLeagueMap = `leagueGroups.map(lg => {
              const isCollapsed = !!collapsedLeagues[lg.leagueName];
              return (
                <div key={lg.leagueName} className="bg-surface/20 border border-outline-variant/10 rounded-2xl overflow-hidden shadow-sm">
                  <button
                    onClick={() => setCollapsedLeagues(prev => ({ ...prev, [lg.leagueName]: !isCollapsed }))}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-surface-container/30 border-b border-outline-variant/10 hover:bg-surface-container/50 transition-colors text-left"
                  >
                    <div className="p-1 -ml-2 rounded-lg text-on-surface-variant/50">
                      {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </div>
                    {lg.leagueLogo && (
                      <div className="w-5 h-5 bg-white/90 rounded-sm flex-shrink-0 flex items-center justify-center p-[2px]">
                        <img referrerPolicy="no-referrer" src={lg.leagueLogo} alt="" className="w-full h-full object-contain" />
                      </div>
                    )}
                    <span className="text-xs font-bold text-on-surface uppercase tracking-wider">{lg.leagueName}</span>
                    <span className="ml-auto text-[10px] text-on-surface-variant/40 font-bold bg-black/20 px-2 py-0.5 rounded-full">
                      {lg.fixtures.reduce((acc, f) => acc + f.rows.length, 0)} picks
                    </span>
                  </button>
                  {!isCollapsed && (
                    <div className="bg-black/10 flex flex-col p-3 gap-3">
                      {lg.fixtures.map(g => renderFixtureGroup(g, true))}
                    </div>
                  )}
                </div>
              );
            })`;

content = content.replace(oldLeagueMap, newLeagueMap);

fs.writeFileSync('src/components/OpportunitiesTab.tsx', content);
