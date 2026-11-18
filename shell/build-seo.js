#!/usr/bin/env node
/**
 * prototype/shell/build-seo.js
 *
 * Generates:
 *   1. prototype/sitemap.xml
 *   2. prototype/robots.txt
 *   3. prototype/llms.txt
 *
 * Based on prototype/shell/site.config.json.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SHELL_DIR = __dirname;
const PROTOTYPE_DIR = path.resolve(SHELL_DIR, '..');
const CONFIG_PATH = path.join(SHELL_DIR, 'site.config.json');

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const siteUrl = config.siteUrl.endsWith('/') ? config.siteUrl : config.siteUrl + '/';
const isIndexable = !!config.indexable;

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
      const rel = path.relative(PROTOTYPE_DIR, full).replace(/\\/g, '/');
      if (rel !== 'assets/icons-preview.html') {
        results.push(rel);
      }
    }
  });
  return results;
}

// Find reciprocal alternate pages for a given page
function getAlternatesForPage(relPath, allPages) {
  // Determine page type and slug
  let lang = 'en';
  let cleanRel = relPath;
  if (relPath.startsWith('ru/')) {
    lang = 'ru';
    cleanRel = relPath.slice(3);
  } else if (relPath.startsWith('ar/')) {
    lang = 'ar';
    cleanRel = relPath.slice(3);
  } else if (relPath.startsWith('destinations/ru/')) {
    lang = 'ru';
    cleanRel = 'destinations/' + relPath.slice(16);
  } else if (relPath.startsWith('destinations/ar/')) {
    lang = 'ar';
    cleanRel = 'destinations/' + relPath.slice(16);
  } else if (relPath.startsWith('notes/ru/')) {
    lang = 'ru';
    cleanRel = 'notes/' + relPath.slice(9);
  } else if (relPath.startsWith('notes/ar/')) {
    lang = 'ar';
    cleanRel = 'notes/' + relPath.slice(9);
  } else if (relPath.startsWith('blog/ru/')) {
    lang = 'ru';
    cleanRel = 'blog/' + relPath.slice(8);
  } else if (relPath.startsWith('blog/ar/')) {
    lang = 'ar';
    cleanRel = 'blog/' + relPath.slice(8);
  } else if (relPath.startsWith('journeys/ru/')) {
    lang = 'ru';
    cleanRel = 'journeys/' + relPath.slice(12);
  } else if (relPath.startsWith('journeys/ar/')) {
    lang = 'ar';
    cleanRel = 'journeys/' + relPath.slice(12);
  }

  // Derive equivalent paths in EN, RU, AR
  let enPath = cleanRel;
  let ruPath = 'ru/' + cleanRel;
  let arPath = 'ar/' + cleanRel;

  if (cleanRel.startsWith('destinations/')) {
    const dSub = cleanRel.slice(13);
    enPath = 'destinations/' + dSub;
    ruPath = 'destinations/ru/' + dSub;
    arPath = 'destinations/ar/' + dSub;
  } else if (cleanRel.startsWith('notes/')) {
    const nSub = cleanRel.slice(6);
    enPath = 'notes/' + nSub;
    ruPath = 'notes/ru/' + nSub;
    arPath = 'notes/ar/' + nSub;
  }

  // Check if exists in allPages
  const alts = {};
  if (allPages.includes(enPath)) alts.en = enPath;
  if (allPages.includes(ruPath)) alts.ru = ruPath;
  if (allPages.includes(arPath)) alts.ar = arPath;

  // Root pages (plan.html, reviews.html, index.html) may not have separate ru/ar sub-files yet
  if (!alts.en && allPages.includes(relPath)) alts.en = relPath;

  return alts;
}

function buildSitemap(pages) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
  xml += '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';

  pages.forEach(p => {
    const fullPath = path.join(PROTOTYPE_DIR, p);
    const stat = fs.statSync(fullPath);
    const lastmod = stat.mtime.toISOString().split('T')[0];
    const loc = p === 'index.html' ? siteUrl : `${siteUrl}${p}`;
    const alts = getAlternatesForPage(p, pages);

    xml += '  <url>\n';
    xml += `    <loc>${loc}</loc>\n`;
    xml += `    <lastmod>${lastmod}</lastmod>\n`;
    xml += '    <changefreq>weekly</changefreq>\n';

    if (alts.en) {
      const enUrl = alts.en === 'index.html' ? siteUrl : `${siteUrl}${alts.en}`;
      xml += `    <xhtml:link rel="alternate" hreflang="en" href="${enUrl}"/>\n`;
      xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${enUrl}"/>\n`;
    }
    if (alts.ru) {
      xml += `    <xhtml:link rel="alternate" hreflang="ru" href="${siteUrl}${alts.ru}"/>\n`;
    }
    if (alts.ar) {
      xml += `    <xhtml:link rel="alternate" hreflang="ar" href="${siteUrl}${alts.ar}"/>\n`;
    }

    xml += '  </url>\n';
  });

  xml += '</urlset>\n';
  const outPath = path.join(PROTOTYPE_DIR, 'sitemap.xml');
  fs.writeFileSync(outPath, xml, 'utf8');
  console.log(`✓ Generated ${outPath} with ${pages.length} URLs.`);
}

function buildRobots() {
  let content = 'User-agent: *\n';
  if (!isIndexable) {
    content += 'Disallow: /\n';
  } else {
    content += 'Allow: /\n\n';
    content += `Sitemap: ${siteUrl}sitemap.xml\n`;
  }

  const outPath = path.join(PROTOTYPE_DIR, 'robots.txt');
  fs.writeFileSync(outPath, content, 'utf8');
  console.log(`✓ Generated ${outPath} (indexable: ${isIndexable}).`);
}

function buildLlms(pages) {
  const org = config.organization;
  let text = `# ${org.name}\n\n`;
  text += `> Destination management company in Moscow, planning curated journeys and authentic travel across Russia.\n\n`;

  text += `## Core Service Overview\n`;
  text += `ROTW Travels provides bespoke travel planning, private itinerary curation, and destination management across Russia and partner destinations (Dubai, Oman). All itineraries are tailored per traveller, with confidential B2B net rates for travel agents and dedicated operations desks.\n\n`;

  text += `## Main Pages\n`;
  const mainPages = [
    { name: 'Home', file: 'index.html', desc: 'Curated journeys, travel storytelling, and visual trip planning across Russia.' },
    { name: 'Trip Planner', file: 'plan.html', desc: 'Interactive step-by-step custom travel route designer with live cost estimates.' },
    { name: 'Traveller Reviews', file: 'reviews.html', desc: 'Genuine feedback and authentic travel photography from ROTW journeys.' },
    { name: 'Destinations Hub', file: 'destinations/index.html', desc: 'Comprehensive travel guides for 8 Russian destinations, Dubai, and Oman.' },
    { name: 'Journeys Hub', file: 'journeys/index.html', desc: 'Six classic customizable starter itineraries across Russia.' },
    { name: 'Experiences', file: 'experiences.html', desc: 'Authentic activities and cultural experiences from ice floating to nature expeditions.' },
    { name: "Sasha's Notebook", file: 'notes/index.html', desc: 'Curated field notes, local viewpoints, and practical recommendations across 10 cities.' },
    { name: 'For Travel Agents', file: 'for-agents.html', desc: 'Confidential B2B net rates, multilingual guides, and Moscow operations support.' },
    { name: 'Contact & Bureaus', file: 'contact.html', desc: 'Direct contact details for our Moscow headquarters and international bureaus.' },
    { name: 'Terms of Service', file: 'terms.html', desc: 'Booking terms, custom itinerary policies, and written quote procedures.' },
    { name: 'Privacy Policy', file: 'privacy.html', desc: 'Client privacy statement confirming static operation and zero cookie tracking.' }
  ];

  mainPages.forEach(p => {
    const url = p.file === 'index.html' ? siteUrl : `${siteUrl}${p.file}`;
    text += `- [${p.name}](${url}): ${p.desc}\n`;
  });

  text += `\n## Bureau Desks\n`;
  if (Array.isArray(org.department)) {
    org.department.forEach(d => {
      text += `- **${d.name}**: ${d.address ? (d.address.streetAddress ? `${d.address.streetAddress}, ` : '') + d.address.addressLocality : ''} | Tel: ${d.telephone} | Email: ${d.email}\n`;
    });
  }

  text += `\n## Language Support\n`;
  text += `ROTW Travels operates natively in English, Russian (Русский), and Arabic (العربية).\n`;

  const outPath = path.join(PROTOTYPE_DIR, 'llms.txt');
  fs.writeFileSync(outPath, text, 'utf8');
  console.log(`✓ Generated ${outPath}.`);
}

function run() {
  const pages = getHtmlFiles(PROTOTYPE_DIR);
  buildSitemap(pages);
  buildRobots();
  buildLlms(pages);
}

if (require.main === module) {
  run();
}

module.exports = {
  buildSitemap,
  buildRobots,
  buildLlms,
  run
};
