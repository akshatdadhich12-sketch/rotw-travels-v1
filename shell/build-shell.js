const fs = require('fs');
const path = require('path');
const { renderHeader, renderFooter } = require('./render-shell');

const PROTOTYPE_DIR = path.resolve(__dirname, '..');

function ensureShellAssets(html, relBase = '.') {
  let res = html;
  const cssHref = `${relBase}/shell/shell.css`;
  const jsSrc = `${relBase}/shell/shell.js`;

  if (!res.includes('shell/shell.css')) {
    if (res.includes('</head>')) {
      res = res.replace('</head>', `  <link rel="stylesheet" href="${cssHref}">\n</head>`);
    } else if (res.includes('</style>')) {
      res = res.replace('</style>', `</style>\n<link rel="stylesheet" href="${cssHref}">`);
    } else {
      res = `<link rel="stylesheet" href="${cssHref}">\n` + res;
    }
  }
  if (!res.includes('shell/shell.js')) {
    if (res.includes('</body>')) {
      res = res.replace('</body>', `  <script src="${jsSrc}" defer></script>\n</body>`);
    } else {
      res = res + `\n<script src="${jsSrc}" defer></script>\n`;
    }
  }
  return res;
}

function stampShellIntoHtml(html, { lang = 'en', relBase = '.', activePage = '', speechText = '', isHome = false }) {
  let res = html;
  res = ensureShellAssets(res, relBase);

  const headerHtml = renderHeader({ lang, relBase, activePage });
  const footerHtml = renderFooter({ lang, relBase, activePage, speechText, isHome });

  // 1. Header replacement
  if (res.includes('<!-- SHELL:HEADER -->') && res.includes('<!-- /SHELL:HEADER -->')) {
    res = res.replace(/<!-- SHELL:HEADER -->[\s\S]*?<!-- \/SHELL:HEADER -->/, headerHtml);
  } else if (res.includes('<header class="top">')) {
    res = res.replace(/<header class="top">[\s\S]*?<\/header>/, headerHtml);
  } else if (res.includes('<header class="top-nav">')) {
    res = res.replace(/<header class="top-nav">[\s\S]*?<\/header>/, headerHtml);
  } else {
    // Insert after skip link or opening <body>
    const skipMatch = res.match(/<a class="skip"[^>]*>[\s\S]*?<\/a>/);
    if (skipMatch) {
      res = res.replace(skipMatch[0], `${skipMatch[0]}\n${headerHtml}`);
    } else {
      res = res.replace(/<body[^>]*>/, m => `${m}\n${headerHtml}`);
    }
  }

  // 2. Footer replacement
  if (res.includes('<!-- SHELL:FOOTER -->') && res.includes('<!-- /SHELL:FOOTER -->')) {
    res = res.replace(/<!-- SHELL:FOOTER -->[\s\S]*?<!-- \/SHELL:FOOTER -->/, footerHtml);
  } else if (res.includes('<footer>') || res.includes('<footer class="foot">') || res.includes('<footer class="footer-tags">')) {
    res = res.replace(/<footer[\s\S]*?<\/footer>/, footerHtml);
  } else {
    // Insert before closing body
    res = res.replace('</body>', `${footerHtml}\n</body>`);
  }

  return res;
}

function buildRootPages() {
  // 1. index.html
  const indexPath = path.join(PROTOTYPE_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    let indexHtml = fs.readFileSync(indexPath, 'utf8');

    // Clean up old redundant separate footer if still present before stamping
    indexHtml = stampShellIntoHtml(indexHtml, {
      lang: 'en',
      relBase: '.',
      activePage: 'home',
      speechText: 'Privet! I’m Sasha, your guide across Russia.',
      isHome: true
    });

    // Make sure guide elements in index.html don't have duplicated floating bubble
    // We adjust #guide CSS to sit above the dock
    if (!indexHtml.includes('.rotw-dock')) {
      // already included by shell.css
    }

    fs.writeFileSync(indexPath, indexHtml, 'utf8');
    console.log('✓ Stamped shell into prototype/index.html');
  }

  // 2. plan.html
  const planPath = path.join(PROTOTYPE_DIR, 'plan.html');
  if (fs.existsSync(planPath)) {
    let planHtml = fs.readFileSync(planPath, 'utf8');
    planHtml = stampShellIntoHtml(planHtml, {
      lang: 'en',
      relBase: '.',
      activePage: 'plan',
      speechText: 'Hi again! Tell me who’s coming and I’ll set the pace of the trip.',
      isHome: false
    });
    fs.writeFileSync(planPath, planHtml, 'utf8');
    console.log('✓ Stamped shell into prototype/plan.html');
  }

  // 3. reviews.html
  const reviewsPath = path.join(PROTOTYPE_DIR, 'reviews.html');
  if (fs.existsSync(reviewsPath)) {
    let reviewsHtml = fs.readFileSync(reviewsPath, 'utf8');
    reviewsHtml = stampShellIntoHtml(reviewsHtml, {
      lang: 'en',
      relBase: '.',
      activePage: 'reviews',
      speechText: 'Reviews from ROTW travellers will appear here.',
      isHome: false
    });
    fs.writeFileSync(reviewsPath, reviewsHtml, 'utf8');
    console.log('✓ Stamped shell into prototype/reviews.html');
  }
}

if (require.main === module) {
  buildRootPages();
}

module.exports = {
  stampShellIntoHtml,
  buildRootPages
};
