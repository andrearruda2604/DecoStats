const fs = require('fs');
const path = require('path');
const dir = 'src/components';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));
let changed = 0;
files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  
  // Substituir <img... por <img referrerPolicy="no-referrer"...
  // Mas apenas se já não tiver referrerPolicy
  content = content.replace(/<img(?!\s+[^>]*referrerPolicy\s*=)/g, '<img referrerPolicy="no-referrer"');
  
  if (content !== original) {
    fs.writeFileSync(filePath, content);
    changed++;
    console.log('Fixed ' + file);
  }
});
console.log('Total files fixed: ' + changed);
