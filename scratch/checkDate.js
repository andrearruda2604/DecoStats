const now = new Date('2026-05-02T23:40:11-03:00');
const y = now.getFullYear();
const m = String(now.getMonth() + 1).padStart(2, '0');
const d = String(now.getDate()).padStart(2, '0');
console.log(`LOCAL DATE: ${y}-${m}-${d}`);

const utc = new Date(now.toISOString());
const yu = utc.getUTCFullYear();
const mu = String(utc.getUTCMonth() + 1).padStart(2, '0');
const du = String(utc.getUTCDate()).padStart(2, '0');
console.log(`UTC DATE: ${yu}-${mu}-${du}`);
