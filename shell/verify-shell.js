const fs = require('fs');
const path = require('path');

const baseDir = path.resolve(__dirname, '../..');
const prototypeDir = path.join(baseDir, 'prototype');

// Automatically collect all html files under prototype/ except _lab and node_modules
function getHtmlFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      if (file !== '_lab' && file !== 'node_modules' && file !== '_audit' && file !== 'assets') {
        results = results.concat(getHtmlFiles(full));
      }
    } else if (file.endsWith('.html')) {
      results.push(path.relative(baseDir, full).replace(/\\/g, '/'));
    }
  });
  return results;
}

const pages = getHtmlFiles(prototypeDir);

let errors = [];

pages.forEach(relPath => {
  const fullPath = path.join(baseDir, relPath);
  if (!fs.existsSync(fullPath)) {
    errors.push('File missing: ' + relPath);
    return;
  }
  const content = fs.readFileSync(fullPath, 'utf8');

  // Check shell assets
  if (!content.includes('shell.css')) errors.push(relPath + ' missing shell.css');
  if (!content.includes('shell.js')) errors.push(relPath + ' missing shell.js');

  // Check compass capsule
  if (!content.includes('compass-capsule')) errors.push(relPath + ' missing compass-capsule');
  // Check capsule logo (FIX 1)
  if (!content.includes('capsule-logo')) errors.push(relPath + ' missing capsule-logo');

  // Check dock
  if (!content.includes('rotw-dock')) errors.push(relPath + ' missing rotw-dock');
  if (!content.includes('dock-speech')) errors.push(relPath + ' missing dock-speech');

  // Check directory tray
  if (!content.includes('rotw-directory-tray')) errors.push(relPath + ' missing rotw-directory-tray');
  if (!content.includes('tray-doors-block')) errors.push(relPath + ' missing tray-doors-block');
  if (!content.includes('tray-tags-container')) errors.push(relPath + ' missing tray-tags-container');
  if (!content.includes('tray-clocks-section')) errors.push(relPath + ' missing tray-clocks-section');
  if (!content.includes('Дороги мира')) errors.push(relPath + ' missing Russian tagline Дороги мира');

  // Check for forbidden terms
  if (/whatsapp/i.test(content)) errors.push(relPath + ' contains forbidden term: whatsapp');
  if (/24\/7/.test(content)) errors.push(relPath + ' contains forbidden term: 24/7');

  // Extract HTML tags and their attributes (outside of <script> template literals)
  // Strip out <script> contents first to only validate HTML markup attributes
  const htmlWithoutScripts = content.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  const matches = [...htmlWithoutScripts.matchAll(/<(?:img|link|script|source|video|use|a)\b[^>]*?\s(?:src|href)="([^"]+)"/gi)];

  for (const match of matches) {
    const assetUrl = match[1];
    if (assetUrl.startsWith('http') || assetUrl.startsWith('#') || assetUrl.startsWith('mailto:') || assetUrl.startsWith('tel:') || assetUrl.startsWith('data:')) continue;
    if (assetUrl.includes('${')) continue;
    
    // Resolve relative to html file
    const cleanUrl = assetUrl.split('#')[0].split('?')[0];
    if (!cleanUrl) continue;
    const resolvedPath = path.resolve(path.dirname(fullPath), cleanUrl);
    if (!fs.existsSync(resolvedPath)) {
      errors.push(relPath + ' broken link/asset: ' + assetUrl + ' -> ' + resolvedPath);
    }
  }
});

if (errors.length > 0) {
  console.error('Verification failed with ' + errors.length + ' errors:');
  errors.forEach(e => console.error(' - ' + e));
  process.exit(1);
} else {
  console.log('✓ All ' + pages.length + ' verified pages passed all integrity verification checks with 0 errors!');
}
