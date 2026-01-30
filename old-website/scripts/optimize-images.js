/**
 * Image optimization script
 * Converts PrismMTRlogo.png to optimized WebP and creates a fallback optimized PNG
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const inputPath = path.join(__dirname, '..', 'assets', 'img', 'PrismMTRlogo.png');
const outputDir = path.join(__dirname, '..', 'assets', 'img');

async function optimizeImages() {
  console.log('🖼️  Optimizing images...\n');

  const originalSize = fs.statSync(inputPath).size;
  console.log(`Original: ${(originalSize / 1024).toFixed(1)} KB`);

  // Create optimized PNG (for OG/meta tags and favicon)
  const optimizedPngPath = path.join(outputDir, 'PrismMTRlogo-optimized.png');
  await sharp(inputPath)
    .png({ quality: 80, compressionLevel: 9 })
    .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
    .toFile(optimizedPngPath);
  
  const optimizedPngSize = fs.statSync(optimizedPngPath).size;
  console.log(`Optimized PNG: ${(optimizedPngSize / 1024).toFixed(1)} KB (${Math.round((1 - optimizedPngSize / originalSize) * 100)}% smaller)`);

  // Create WebP for modern browsers (header logo)
  const webpPath = path.join(outputDir, 'PrismMTRlogo.webp');
  await sharp(inputPath)
    .webp({ quality: 85 })
    .resize(256, 256, { fit: 'inside', withoutEnlargement: true })
    .toFile(webpPath);
  
  const webpSize = fs.statSync(webpPath).size;
  console.log(`WebP: ${(webpSize / 1024).toFixed(1)} KB (${Math.round((1 - webpSize / originalSize) * 100)}% smaller)`);

  // Create small favicon version
  const faviconPath = path.join(outputDir, 'favicon.png');
  await sharp(inputPath)
    .png({ quality: 80, compressionLevel: 9 })
    .resize(32, 32)
    .toFile(faviconPath);
  
  const faviconSize = fs.statSync(faviconPath).size;
  console.log(`Favicon: ${(faviconSize / 1024).toFixed(1)} KB`);

  // Create medium logo for inline use
  const mediumPath = path.join(outputDir, 'PrismMTRlogo-sm.png');
  await sharp(inputPath)
    .png({ quality: 80, compressionLevel: 9 })
    .resize(64, 64)
    .toFile(mediumPath);
  
  const mediumSize = fs.statSync(mediumPath).size;
  console.log(`Small PNG (64x64): ${(mediumSize / 1024).toFixed(1)} KB`);

  console.log('\n✅ Image optimization complete!');
  console.log('\nNext steps:');
  console.log('1. Update components.js to use WebP with PNG fallback');
  console.log('2. Update meta tags to use optimized PNG');
  console.log('3. Update favicon references');
}

optimizeImages().catch(console.error);
