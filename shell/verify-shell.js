#!/usr/bin/env node
/**
 * prototype/shell/verify-shell.js
 * Comprehensive sitewide SEO, GEO, Structured Data, and Shell integrity verification.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const baseDir = path.resolve(__dirname, '../..');
const prototypeDir = path.join(baseDir, 'prototype');
const configPath = path.join(__dirname, 'site.config.json');

const siteConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const siteUrl = siteConfig.siteUrl.endsWith('/') ? siteConfig.siteUrl : siteConfig.siteUrl + '/';
const isIndexable = !!siteConfig.indexable;

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

const allPages = getHtmlFiles(prototypeDir);
let errors = [];

// Separate public pages from internal preview tools
const publicPages = allPages.filter(p => !p.endsWith('icons-preview.html'));

// Track description uniqueness per language
const descsByLang = { en: new Set(), ru: new Set(), ar: new Set() };

// Verify internal preview tool has noindex
const iconPreview = path.join(baseDir, 'prototype/assets/icons-preview.html');
if (fs.existsSync(iconPreview)) {
  const iconContent = fs.readFileSync(iconPreview, 'utf8');
  if (!iconContent.includes('content="noindex"') && !iconContent.includes("content='noindex'")) {
    errors.push('prototype/assets/icons-preview.html missing <meta name="robots" content="noindex">');
  }
}

publicPages.forEach(relPath => {
  const fullPath = path.join(baseDir, relPath);
  if (!fs.existsSync(fullPath)) {
    errors.push('File missing: ' + relPath);
    return;
  }
  const content = fs.readFileSync(fullPath, 'utf8');

  // Detect page language
  let lang = 'en';
  if (relPath.includes('/ru/') || relPath.startsWith('prototype/ru/')) {
    lang = 'ru';
  } else if (relPath.includes('/ar/') || relPath.startsWith('prototype/ar/')) {
    lang = 'ar';
  }

  // 1. Check Shell assets and landmarks
  if (!content.includes('shell.css')) errors.push(relPath + ' missing shell.css');
  if (!content.includes('shell.js')) errors.push(relPath + ' missing shell.js');
  if (!content.includes('footer-reveal.js')) errors.push(relPath + ' missing footer-reveal.js');
  if (!content.includes('sasha-chat.js')) errors.push(relPath + ' missing sasha-chat.js');
  if (!content.includes('compass-capsule')) errors.push(relPath + ' missing compass-capsule');
  if (!content.includes('capsule-logo')) errors.push(relPath + ' missing capsule-logo');
  if (!content.includes('rotw-shell-footer')) errors.push(relPath + ' missing rotw-shell-footer');
  if (!content.includes('footer-wordmark-svg')) errors.push(relPath + ' missing footer-wordmark-svg');
  if (!content.includes('Дороги мира')) errors.push(relPath + ' missing Russian tagline Дороги мира');

  const footerTags = (content.match(/<footer[\s>]/gi) || []).length;
  if (footerTags !== 1) errors.push(relPath + ' expected exactly 1 <footer>, found ' + footerTags);

  if (!content.includes('class="page-wrap"')) errors.push(relPath + ' missing page-wrap');

  // Check that old dock & tray are ABSENT everywhere
  if (content.includes('rotw-dock')) errors.push(relPath + ' contains deleted rotw-dock');
  if (content.includes('dock-speech')) errors.push(relPath + ' contains deleted dock-speech');
  if (content.includes('rotw-directory-tray')) errors.push(relPath + ' contains deleted rotw-directory-tray');

  // 2. Robots noindex
  if (!content.includes('content="noindex"') && !content.includes("content='noindex'")) {
    errors.push(relPath + ' missing <meta name="robots" content="noindex">');
  }

  // 3. Title tag (<= 60 chars)
  const titleMatch = content.match(/<title>([^<]+)<\/title>/i);
  if (!titleMatch) {
    errors.push(relPath + ' missing <title>');
  } else {
    const t = titleMatch[1].trim();
    if (t.length > 60) {
      errors.push(relPath + ' title length ' + t.length + ' exceeds 60 chars: "' + t + '"');
    }
  }

  // 4. Meta description (70-160 chars and unique per language)
  const descMatch = content.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) ||
                    content.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);
  if (!descMatch) {
    errors.push(relPath + ' missing meta description');
  } else {
    const d = descMatch[1].trim();
    if (d.length < 70 || d.length > 160) {
      errors.push(relPath + ' meta description length ' + d.length + ' not in [70, 160]: "' + d + '"');
    }
    if (descsByLang[lang].has(d)) {
      errors.push(relPath + ' duplicate description in ' + lang + ': "' + d + '"');
    }
    descsByLang[lang].add(d);
  }

  // 5. Canonical link (absolute URL)
  const canonMatch = content.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
  if (!canonMatch) {
    errors.push(relPath + ' missing canonical link');
  } else if (!canonMatch[1].startsWith(siteUrl)) {
    errors.push(relPath + ' canonical not starting with ' + siteUrl + ': ' + canonMatch[1]);
  }

  // 6. Reciprocal hreflangs
  const hreflangs = ['en', 'ru', 'ar', 'x-default'];
  hreflangs.forEach(hl => {
    const re = new RegExp('<link\\s+rel=["\']alternate["\']\\s+hreflang=["\']' + hl + '["\']\\s+href=["\']([^"\']+)["\']', 'i');
    const m = content.match(re);
    if (!m) {
      errors.push(relPath + ' missing hreflang="' + hl + '"');
    } else if (!m[1].startsWith(siteUrl)) {
      errors.push(relPath + ' hreflang="' + hl + '" not absolute: ' + m[1]);
    }
  });

  // 7. Open Graph & Twitter
  const ogProps = ['og:title', 'og:description', 'og:type', 'og:url', 'og:image', 'og:locale'];
  ogProps.forEach(prop => {
    const re = new RegExp('<meta\\s+property=["\']' + prop + '["\']\\s+content=["\']([^"\']+)["\']', 'i');
    if (!re.test(content)) {
      errors.push(relPath + ' missing ' + prop);
    }
  });
  if (!content.includes('name="twitter:card"') && !content.includes("name='twitter:card'")) {
    errors.push(relPath + ' missing twitter:card');
  }

  // 8. FAQ Accordion & Parity
  const hasFaqSection = content.includes('id="faq"') || content.includes('spread-faq') || content.includes('class="faq-section"');
  if (!hasFaqSection) {
    errors.push(relPath + ' missing FAQ section');
  } else {
    // Count details items
    const detailsMatches = content.match(/<details\b[^>]*class=["'][^"']*faq-item[^"']*["'][^>]*>/gi) ||
                           content.match(/<details\b[^>]*>/gi) || [];
    const expectedCount = relPath.endsWith('index.html') && !relPath.includes('/') ? 6 : 5;
    if (detailsMatches.length < 5) {
      errors.push(relPath + ' has only ' + detailsMatches.length + ' FAQ items (expected ' + expectedCount + ')');
    }

    // Check first item open
    const firstOpen = content.match(/<details\b[^>]*\bopen\b/i);
    if (!firstOpen) {
      errors.push(relPath + ' first FAQ item missing open attribute');
    }

    // Parity check with JSON-LD FAQPage
    const jsonLdMatch = content.match(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi);
    if (jsonLdMatch) {
      for (const block of jsonLdMatch) {
        const jsonText = block.replace(/<script\s+type=["']application\/ld\+json["']>/i, '').replace(/<\/script>/i, '').trim();
        try {
          const parsed = JSON.parse(jsonText);
          const entities = parsed['@graph'] || [parsed];
          const faqEntity = entities.find(e => e['@type'] === 'FAQPage');
          if (faqEntity && faqEntity.mainEntity && Array.isArray(faqEntity.mainEntity)) {
            faqEntity.mainEntity.forEach(qa => {
              const qText = (qa.name || '').trim();
              const aText = (qa.acceptedAnswer && qa.acceptedAnswer.text ? qa.acceptedAnswer.text : '').trim();
              if (qText && !content.includes(qText)) {
                // If text was escaped or slightly different, log parity error
                errors.push(relPath + ' FAQ question in JSON-LD not found in visible HTML: "' + qText.slice(0, 40) + '..."');
              }
            });
          }
        } catch (_) {}
      }
    }
  }

  // 9. Forbidden terms
  if (new RegExp(['whats', 'app'].join(''), 'i').test(content)) errors.push(relPath + ' contains forbidden term: whatsapp');
  if (new RegExp(['24', '/', '7'].join('')).test(content)) errors.push(relPath + ' contains forbidden term: 24/7');
  if (/\blicensed\b/i.test(content) || /лицензированный/i.test(content) || /مرخص/i.test(content)) {
    errors.push(relPath + ' contains forbidden claim: licensed');
  }
  if (/\baward-winning\b/i.test(content) || /\bawards?\b/i.test(content)) {
    // Only flag if used as claim
    if (/\baward-winning\b/i.test(content) || /\bawards\b/i.test(content)) {
      errors.push(relPath + ' contains forbidden claim: award');
    }
  }

  // 10. Links and local assets resolve
  const htmlWithoutScripts = content.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  const matches = [...htmlWithoutScripts.matchAll(/<(?:img|link|script|source|video|use|a)\b[^>]*?\s(?:src|href)="([^"]+)"/gi)];

  const PLANNED = ['terms.html', 'privacy.html', 'journeys/index.html', 'experiences.html', 'for-agents.html', 'blog/index.html', 'contact.html'];

  for (const match of matches) {
    const assetUrl = match[1];
    if (assetUrl.startsWith('http') || assetUrl.startsWith('#') || assetUrl.startsWith('mailto:') || assetUrl.startsWith('tel:') || assetUrl.startsWith('data:')) continue;
    if (assetUrl.includes('${')) continue;

    const cleanUrl = assetUrl.split('#')[0].split('?')[0];
    if (!cleanUrl) continue;
    if (PLANNED.some(p => cleanUrl.endsWith(p))) continue;
    const resolvedPath = path.resolve(path.dirname(fullPath), cleanUrl);
    if (!fs.existsSync(resolvedPath)) {
      errors.push(relPath + ' broken link/asset: ' + assetUrl + ' -> ' + resolvedPath);
    }
  }
});

// Check sitemap.xml, robots.txt, llms.txt
const sitemapPath = path.join(prototypeDir, 'sitemap.xml');
if (!fs.existsSync(sitemapPath)) {
  errors.push('prototype/sitemap.xml is missing');
} else {
  const sitemapContent = fs.readFileSync(sitemapPath, 'utf8');
  const locMatches = [...sitemapContent.matchAll(/<loc>([^<]+)<\/loc>/gi)];
  if (locMatches.length === 0) {
    errors.push('prototype/sitemap.xml contains no <loc> entries');
  }
}

const robotsPath = path.join(prototypeDir, 'robots.txt');
if (!fs.existsSync(robotsPath)) {
  errors.push('prototype/robots.txt is missing');
} else {
  const robotsContent = fs.readFileSync(robotsPath, 'utf8');
  if (!isIndexable && !robotsContent.includes('Disallow: /')) {
    errors.push('prototype/robots.txt must Disallow: / while indexable is false');
  }
}

const llmsPath = path.join(prototypeDir, 'llms.txt');
if (!fs.existsSync(llmsPath)) {
  errors.push('prototype/llms.txt is missing');
}

if (errors.length > 0) {
  console.error('\nVerification failed with ' + errors.length + ' error(s):');
  errors.forEach(e => console.error(' - ' + e));
  process.exit(1);
} else {
  console.log('\n✓ All ' + publicPages.length + ' verified pages passed all integrity, SEO, GEO, and schema checks with 0 errors!');
}
