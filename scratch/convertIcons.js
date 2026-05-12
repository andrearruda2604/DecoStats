import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const src = path.join(__dirname, '..', 'public', 'logo-512x512.png'); // source JPEG (misnamed)
  const pub = path.join(__dirname, '..', 'public');

  // Convert to real PNGs at correct sizes
  const sizes = [
    { name: 'logo-192x192.png', size: 192 },
    { name: 'logo-512x512.png', size: 512 },
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'favicon-32x32.png', size: 32 },
    { name: 'favicon-16x16.png', size: 16 },
    { name: 'maskable-512x512.png', size: 512 },
  ];

  // Read source (it's actually JPEG)
  const srcBuffer = fs.readFileSync(src);
  
  for (const { name, size } of sizes) {
    const out = path.join(pub, name);
    
    if (name === 'maskable-512x512.png') {
      // Maskable icon: add 20% padding with background
      const paddedSize = Math.round(size * 0.8);
      const icon = await sharp(srcBuffer)
        .resize(paddedSize, paddedSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
        .png()
        .toBuffer();
      
      await sharp({
        create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } }
      })
        .composite([{ input: icon, gravity: 'centre' }])
        .png()
        .toFile(out);
    } else {
      await sharp(srcBuffer)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toFile(out);
    }
    
    console.log(`✓ ${name} (${size}x${size})`);
  }

  // Generate favicon.ico from 32x32 PNG
  const favicon32 = await sharp(srcBuffer)
    .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  
  // Simple ICO: just use PNG (modern browsers support PNG in .ico)
  fs.writeFileSync(path.join(pub, 'favicon.ico'), favicon32);
  console.log('✓ favicon.ico (32x32 PNG)');

  // Generate screenshots for PWA install prompt
  // Wide screenshot (desktop) - 1280x720
  const wideScreenshot = await sharp(srcBuffer)
    .resize(400, 400, { fit: 'contain', background: { r: 10, g: 10, b: 15, alpha: 1 } })
    .png()
    .toBuffer();
  
  await sharp({
    create: { width: 1280, height: 720, channels: 4, background: { r: 10, g: 10, b: 15, alpha: 1 } }
  })
    .composite([{ input: wideScreenshot, gravity: 'centre' }])
    .png()
    .toFile(path.join(pub, 'screenshot-wide.png'));
  console.log('✓ screenshot-wide.png (1280x720)');

  // Narrow screenshot (mobile) - 390x844
  const narrowIcon = await sharp(srcBuffer)
    .resize(300, 300, { fit: 'contain', background: { r: 10, g: 10, b: 15, alpha: 1 } })
    .png()
    .toBuffer();
  
  await sharp({
    create: { width: 390, height: 844, channels: 4, background: { r: 10, g: 10, b: 15, alpha: 1 } }
  })
    .composite([{ input: narrowIcon, gravity: 'centre' }])
    .png()
    .toFile(path.join(pub, 'screenshot-narrow.png'));
  console.log('✓ screenshot-narrow.png (390x844)');

  // Verify all files
  console.log('\n--- Verificação ---');
  const files = ['logo-192x192.png', 'logo-512x512.png', 'apple-touch-icon.png', 'favicon-32x32.png', 'favicon-16x16.png', 'maskable-512x512.png', 'favicon.ico', 'screenshot-wide.png', 'screenshot-narrow.png'];
  for (const f of files) {
    const buf = fs.readFileSync(path.join(pub, f));
    const isPng = buf[0] === 0x89 && buf[1] === 0x50;
    console.log(`  ${f}: ${buf.length} bytes, PNG=${isPng}`);
  }
}

main().catch(console.error);
