import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
let env = process.env;
try { const f = fs.readFileSync('.env.local','utf8'); f.split(/\r?\n/).forEach(l=>{const m=l.match(/^([^=]+)=(.*)$/);if(m){let v=m[2].trim();if(v.startsWith('"')&&v.endsWith('"'))v=v.slice(1,-1);env[m[1].trim()]=v;}}); } catch(e){}
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const {data} = await sb.from('odd_tickets').select('ticket_data').eq('date','2026-06-27').eq('mode','2.0').single();
const e = data.ticket_data.entries.find(e => e.fixture_id === 1520749);
for (const p of e.picks) {
  console.log(`stat=${p.stat} type=${p.type} threshold=${p.threshold} line="${p.line}" result=${p.result} actual=${p.actualValue}`);
}
