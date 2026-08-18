// Try direct wikimedia commons file URLs for 2026 FIFA World Cup logo
const urls = [
  'https://upload.wikimedia.org/wikipedia/commons/4/42/2026_FIFA_World_Cup.svg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/2026_FIFA_World_Cup.svg/200px-2026_FIFA_World_Cup.svg.png',
  'https://upload.wikimedia.org/wikipedia/en/b/bf/2026_FIFA_World_Cup_emblem.svg',
  'https://upload.wikimedia.org/wikipedia/en/thumb/b/bf/2026_FIFA_World_Cup_emblem.svg/200px-2026_FIFA_World_Cup_emblem.svg.png',
  'https://upload.wikimedia.org/wikipedia/en/thumb/b/bf/FIFA_World_Cup_2026_Logo.svg/220px-FIFA_World_Cup_2026_Logo.svg.png',
  'https://upload.wikimedia.org/wikipedia/en/d/df/FIFA_World_Cup_26_Logo.svg',
  'https://upload.wikimedia.org/wikipedia/en/thumb/d/df/FIFA_World_Cup_26_Logo.svg/200px-FIFA_World_Cup_26_Logo.svg.png',
  'https://seeklogo.com/images/F/fifa-world-cup-2026-logo-CC9FECEE9D-seeklogo.com.png',
  'https://brandlogos.net/wp-content/uploads/2023/06/2026_fifa_world_cup-logo_brandlogos.net_pcvgf.png',
];

async function tryAll() {
  for (const url of urls) {
    try {
      const resp = await fetch(url, { method: 'HEAD', redirect: 'follow' });
      const ct = resp.headers.get('content-type');
      console.log(`${resp.ok ? '✓' : '✗'} [${resp.status}] ${ct} — ${url}`);
    } catch (e) {
      console.log(`✗ ERROR — ${url}: ${e.message}`);
    }
  }
}

tryAll();
