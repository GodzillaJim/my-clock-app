import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create SVG icon that will be used to generate ICO
function createIconSVG(size = 256) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background gradient circle -->
  <defs>
    <radialGradient id="grad1" cx="50%" cy="30%" r="50%">
      <stop offset="0%" style="stop-color:#4FC3F7;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#2196F3;stop-opacity:1" />
    </radialGradient>
  </defs>
  <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 20}" fill="url(#grad1)" stroke="#1976D2" stroke-width="4"/>
  
  <!-- Clock face -->
  <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 50}" fill="none" stroke="white" stroke-width="6"/>
  
  <!-- Clock hands -->
  <line x1="${size/2}" y1="${size/4}" x2="${size/2}" y2="${size/2}" stroke="white" stroke-width="8" stroke-linecap="round"/>
  <line x1="${size/2}" y1="${size/2}" x2="${size*3/4}" y2="${size/2}" stroke="white" stroke-width="6" stroke-linecap="round"/>
  
  <!-- Center dot -->
  <circle cx="${size/2}" cy="${size/2}" r="6" fill="white"/>
  
  <!-- Hour markers -->
  <line x1="${size/2}" y1="30" x2="${size/2}" y2="50" stroke="white" stroke-width="4"/>
  <line x1="${size/2}" y1="${size-50}" x2="${size/2}" y2="${size-30}" stroke="white" stroke-width="4"/>
  <line x1="${size-50}" y1="${size/2}" x2="${size-30}" y2="${size/2}" stroke="white" stroke-width="4"/>
  <line x1="30" y1="${size/2}" x2="50" y2="${size/2}" stroke="white" stroke-width="4"/>
</svg>`;
}

// Save SVG icon
const iconSVG = createIconSVG(256);
fs.writeFileSync(path.join(__dirname, 'icon.svg'), iconSVG);

// Create a fallback ICO data (minimal implementation)
// For production, you'd want to use a proper ICO generation library
const simpleICO = createIconSVG(32);
fs.writeFileSync(path.join(__dirname, 'icon-temp.svg'), simpleICO);

console.log('Icons created successfully!');
console.log('Note: For production, convert the SVG to proper ICO format using online tools or imagemagick');
console.log('Commands to run after this script:');
console.log('1. Convert build/icon.svg to build/icon.ico (256x256, 128x128, 64x64, 32x32, 16x16)');
console.log('2. Convert build/icon.svg to build/icon.icns for macOS (optional)');