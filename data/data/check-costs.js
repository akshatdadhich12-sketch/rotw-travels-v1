#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const dataDir = __dirname;
const costsFile = path.join(dataDir, 'estimated-costs.json');
const journeysFile = path.join(dataDir, '..', 'pages', 'src', 'data', 'journeys.json');

const errors = [];

if (!fs.existsSync(costsFile)) {
  console.error(`Error: ${costsFile} not found.`);
  process.exit(1);
}

if (!fs.existsSync(journeysFile)) {
  console.error(`Error: ${journeysFile} not found.`);
  process.exit(1);
}

let costs;
try {
  costs = JSON.parse(fs.readFileSync(costsFile, 'utf8'));
} catch (e) {
  console.error(`Error parsing ${costsFile}:`, e.message);
  process.exit(1);
}

let journeys;
try {
  journeys = JSON.parse(fs.readFileSync(journeysFile, 'utf8'));
} catch (e) {
  console.error(`Error parsing ${journeysFile}:`, e.message);
  process.exit(1);
}

// 1. Top-level checks
if (costs.currency !== 'USD') {
  errors.push(`Expected currency to be "USD", got "${costs.currency}".`);
}

if (costs.validUntil !== null && typeof costs.validUntil !== 'string') {
  errors.push(`validUntil must be null or string.`);
}

['disclaimer', 'pending'].forEach(field => {
  if (!costs[field] || typeof costs[field] !== 'object') {
    errors.push(`Missing or invalid object for "${field}".`);
  } else {
    ['en', 'ru', 'ar'].forEach(lang => {
      if (!costs[field][lang] || typeof costs[field][lang] !== 'string') {
        errors.push(`Missing or invalid "${field}.${lang}".`);
      }
    });
  }
});

if (!costs.assumes || typeof costs.assumes !== 'object') {
  errors.push(`Missing or invalid object for "assumes".`);
}

if (!costs.journeys || typeof costs.journeys !== 'object') {
  errors.push(`Missing or invalid object for "journeys".`);
}

if (!costs.bands || typeof costs.bands !== 'object') {
  errors.push(`Missing or invalid object for "bands".`);
}

const expectedSlugs = journeys.map(j => j.slug);
const actualSlugs = costs.journeys ? Object.keys(costs.journeys) : [];

// 2. Journey keys check
expectedSlugs.forEach(slug => {
  if (!costs.journeys || !costs.journeys[slug]) {
    errors.push(`Missing journey key in estimated-costs.json: "${slug}".`);
  }
});

actualSlugs.forEach(slug => {
  if (!expectedSlugs.includes(slug)) {
    errors.push(`Unexpected journey key in estimated-costs.json: "${slug}".`);
  }
});

// 3. Journey shape and fromUsd checks
let pricedCount = 0;
if (costs.journeys) {
  for (const [slug, item] of Object.entries(costs.journeys)) {
    if (!item || typeof item !== 'object') {
      errors.push(`Journey "${slug}" must be an object.`);
      continue;
    }
    if (item.fromUsd !== null) {
      if (typeof item.fromUsd !== 'number' || !Number.isInteger(item.fromUsd) || item.fromUsd <= 0) {
        errors.push(`Journey "${slug}": fromUsd must be null or a positive integer, got ${item.fromUsd}.`);
      } else {
        pricedCount++;
      }
    }
    if (item.singleSupplementUsd !== null && (typeof item.singleSupplementUsd !== 'number' || !Number.isInteger(item.singleSupplementUsd) || item.singleSupplementUsd <= 0)) {
      errors.push(`Journey "${slug}": singleSupplementUsd must be null or a positive integer.`);
    }
    if (!item.includes || typeof item.includes !== 'object') {
      errors.push(`Journey "${slug}": missing includes object.`);
    }
    if (!item.excludes || typeof item.excludes !== 'object') {
      errors.push(`Journey "${slug}": missing excludes object.`);
    }
  }
}

// 4. Bands check
['b1', 'b2', 'b3', 'b4'].forEach(b => {
  if (!costs.bands || !costs.bands[b] || !Array.isArray(costs.bands[b].journeys)) {
    errors.push(`Missing or invalid bands.${b}.journeys array.`);
  } else {
    costs.bands[b].journeys.forEach(slug => {
      if (!expectedSlugs.includes(slug)) {
        errors.push(`Invalid journey slug "${slug}" in bands.${b}.journeys.`);
      }
    });
  }
});

if (errors.length > 0) {
  console.error(`Validation failed with ${errors.length} error(s):`);
  errors.forEach(err => console.error(` - ${err}`));
  process.exit(1);
}

console.log(`✓ estimated-costs.json is valid. Priced journeys: ${pricedCount}`);
