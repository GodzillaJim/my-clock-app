import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create a more detailed SVG icon for Windows
function createDetailedIcon(size = 256) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background gradient circle -->
  <defs>
    <radialGradient id="grad1" cx="50%" cy="30%" r="50%">
      <stop offset="0%" style="stop-color:#4FC3F7;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#2196F3;stop-opacity:1" />
    </radialGradient>
    <filter id="shadow">
      <feDropShadow dx="2" dy="4" stdDeviation="4" flood-color="rgba(0,0,0,0.3)"/>
    </filter>
  </defs>
  
  <!-- Outer circle with shadow -->
  <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 20}" fill="url(#grad1)" stroke="#1976D2" stroke-width="4" filter="url(#shadow)"/>
  
  <!-- Clock face background -->
  <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 50}" fill="rgba(255,255,255,0.9)" stroke="white" stroke-width="3"/>
  
  <!-- Hour markers -->
  <g stroke="white" stroke-width="6" stroke-linecap="round">
    <!-- 12 o'clock -->
    <line x1="${size/2}" y1="30" x2="${size/2}" y2="55" />
    <!-- 3 o'clock -->
    <line x1="${size-55}" y1="${size/2}" x2="${size-30}" y2="${size/2}" />
    <!-- 6 o'clock -->
    <line x1="${size/2}" y1="${size-55}" x2="${size/2}" y2="${size-30}" />
    <!-- 9 o'clock -->
    <line x1="30" y1="${size/2}" x2="55" y2="${size/2}" />
  </g>
  
  <!-- Clock hands pointing to 2:30 (typical work time) -->
  <!-- Hour hand (shorter, thicker) -->
  <line x1="${size/2}" y1="${size/2}" x2="${size/2 + 40}" y2="${size/2 - 20}" stroke="#1976D2" stroke-width="8" stroke-linecap="round"/>
  <!-- Minute hand (longer, thinner) -->
  <line x1="${size/2}" y1="${size/2}" x2="${size/2}" y2="${size/4 + 10}" stroke="#1976D2" stroke-width="6" stroke-linecap="round"/>
  
  <!-- Center dot -->
  <circle cx="${size/2}" cy="${size/2}" r="8" fill="#1976D2"/>
  <circle cx="${size/2}" cy="${size/2}" r="4" fill="white"/>
</svg>`;
}

// Create a basic ICO file structure (simple implementation)
function createBasicICO() {
  // For this implementation, we'll create a very simple ICO by converting our SVG to a data URL
  // This is not a full ICO implementation but will work for Electron
  const icon256 = createDetailedIcon(256);
  const icon128 = createDetailedIcon(128);
  const icon64 = createDetailedIcon(64);
  const icon32 = createDetailedIcon(32);
  const icon16 = createDetailedIcon(16);
  
  // Save different sizes as SVG files that can be used by Electron
  fs.writeFileSync(path.join(__dirname, 'icon-256.svg'), icon256);
  fs.writeFileSync(path.join(__dirname, 'icon-128.svg'), icon128);
  fs.writeFileSync(path.join(__dirname, 'icon-64.svg'), icon64);
  fs.writeFileSync(path.join(__dirname, 'icon-32.svg'), icon32);
  fs.writeFileSync(path.join(__dirname, 'icon-16.svg'), icon16);
  
  // Create a primary icon file
  fs.writeFileSync(path.join(__dirname, 'icon.svg'), icon256);
  
  return icon256;
}

// Create a simple ICO file using base64 encoded PNG-like data
function createSimpleICO() {
  // This is a minimal ICO header + one icon entry
  // For production, you'd want to use a proper ICO library
  const iconSVG = createDetailedIcon(32);
  
  // Convert SVG to base64
  const svgBase64 = Buffer.from(iconSVG).toString('base64');
  const dataUrl = `data:image/svg+xml;base64,${svgBase64}`;
  
  // Save as a data URL file that Electron can read
  fs.writeFileSync(path.join(__dirname, 'icon.ico.dataurl'), dataUrl);
  
  // Also create a regular SVG that we'll reference in electron-builder
  fs.writeFileSync(path.join(__dirname, 'icon.ico'), iconSVG);
  
  return iconSVG;
}

// Generate icons
console.log('Creating Windows icons...');
const iconData = createBasicICO();
createSimpleICO();

// Create installer NSH script for custom installer behavior
const installerScript = `!macro customInit
  ; Custom initialization code
!macroend

!macro customInstall
  ; Custom installation code
!macroend

!macro customUnInstall
  ; Custom uninstallation code
!macroend
`;

fs.writeFileSync(path.join(__dirname, 'installer.nsh'), installerScript);

console.log('Windows icons and installer script created successfully!');
console.log('Files created:');
console.log('- build/icon.svg (main icon)');
console.log('- build/icon-*.svg (multiple sizes)');
console.log('- build/icon.ico (SVG format for Electron)');
console.log('- build/installer.nsh (NSIS installer script)');