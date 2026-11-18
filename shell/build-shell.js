const fs = require('fs');
const path = require('path');
const { renderHeader, renderFooter } = require('./render-shell');

const PROTOTYPE_DIR = path.resolve(__dirname, '..');

function ensureShellAssets(html, relBase = '.') {
  let res = html;
  const cssHref = `${relBase}/shell/shell.css`;
  const jsSrc = `${relBase}/shell/shell.js`;
  const logoAnimSrc = `${relBase}/shell/logo-anim.js`;
  const footerRevealSrc = `${relBase}/shell/footer-reveal.js`;
  const sashaChatSrc = `${relBase}/shell/sasha-chat.js`;

  const gsapCore = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js';
  const gsapST = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js';
  const gsapDrag = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/Draggable.min.js';

  if (!res.includes('shell/shell.css')) {
    if (res.includes('</head>')) {
      res = res.replace('</head>', `  <link rel="stylesheet" href="${cssHref}">\n</head>`);
    } else if (res.includes('</style>')) {
      res = res.replace('</style>', `</style>\n<link rel="stylesheet" href="${cssHref}">`);
    } else {
      res = `<link rel="stylesheet" href="${cssHref}">\n` + res;
    }
  }

  if (!res.includes('gsap/3.12.5/gsap.min.js')) {
    const scripts = `<script src="${gsapCore}"></script>\n<script src="${gsapST}"></script>\n<script src="${gsapDrag}"></script>\n<script src="${logoAnimSrc}" defer></script>\n<script src="${jsSrc}" defer></script>\n<script src="${footerRevealSrc}" defer></script>\n<script src="${sashaChatSrc}" defer></script>`;
    if (res.includes('</body>')) {
      res = res.replace('</body>', `  ${scripts}\n</body>`);
    } else {
      res = res + `\n${scripts}\n`;
    }
  } else {
    if (!res.includes('ScrollTrigger.min.js')) {
      res = res.replace(/<script\s+src="[^"]*gsap\.min\.js"[^>]*><\/script>/, m => `${m}\n<script src="${gsapST}"></script>`);
    }
    if (!res.includes('Draggable.min.js')) {
      res = res.replace(/<script\s+src="[^"]*ScrollTrigger\.min\.js"[^>]*><\/script>/, m => `${m}\n<script src="${gsapDrag}"></script>`);
    }
    if (!res.includes('shell/shell.js')) {
      if (res.includes('</body>')) {
        res = res.replace('</body>', `  <script src="${jsSrc}" defer></script>\n</body>`);
      } else {
        res = res + `\n<script src="${jsSrc}" defer></script>\n`;
      }
    }
    if (!res.includes('shell/footer-reveal.js')) {
      res = res.replace(/<script\s+src="[^"]*shell\/shell\.js"[^>]*><\/script>/, m => `${m}\n<script src="${footerRevealSrc}" defer></script>`);
    }
    if (!res.includes('shell/sasha-chat.js')) {
      res = res.replace(/<script\s+src="[^"]*shell\/footer-reveal\.js"[^>]*><\/script>/, m => `${m}\n<script src="${sashaChatSrc}" defer></script>`);
    }
  }
  return res;
}

function stampShellIntoHtml(html, { lang = 'en', relBase = '.', activePage = '', speechText = '', isHome = false, sashaLines = null }) {
  let res = html;
  res = ensureShellAssets(res, relBase);

  if (isHome) {
    if (!res.includes('class="page-home"') && !res.includes("class='page-home'")) {
      if (res.includes('<body')) {
        res = res.replace(/<body([^>]*)>/, '<body$1 class="page-home">');
      } else if (res.includes('<div id="intro"')) {
        res = res.replace('<div id="intro"', '<body class="page-home">\n<div id="intro"');
        if (!res.includes('</body>')) {
          res += '\n</body>';
        }
      }
    }
    res = res.replace(/(<body[^>]*)\bhas-curtain\b\s*([^>]*>)/g, '$1$2');
  } else {
    if (!res.includes('has-curtain')) {
      if (res.includes('<body class="')) {
        res = res.replace(/<body class="([^"]*)"/, '<body class="$1 has-curtain"');
      } else if (res.includes("<body class='")) {
        res = res.replace(/<body class='([^']*)'/, "<body class='$1 has-curtain'");
      } else if (res.includes('<body')) {
        res = res.replace('<body', '<body class="has-curtain"');
      }
    }
  }

  if (Array.isArray(sashaLines) && sashaLines.length > 0 && !speechText) {
    speechText = sashaLines[0].text;
  }

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

  // 3. Wrap page content in page-wrap if not present
  if (!res.includes('class="page-wrap"') && !res.includes("class='page-wrap'")) {
    const headerEndMarker = '<!-- /SHELL:HEADER -->';
    const footerStartMarker = '<!-- SHELL:FOOTER -->';
    if (res.includes(headerEndMarker) && res.includes(footerStartMarker)) {
      const parts = res.split(headerEndMarker);
      const subParts = parts[1].split(footerStartMarker);
      res = parts[0] + headerEndMarker + '\n<div class="page-wrap">\n' + subParts[0].trim() + '\n</div>\n' + footerStartMarker + subParts.slice(1).join(footerStartMarker);
    }
  }

  // 4. Optional Sasha Lines data injection
  if (Array.isArray(sashaLines) && sashaLines.length > 0) {
    const sashaScript = `<script>window.__SASHA_LINES = ${JSON.stringify(sashaLines)};</script>`;
    if (res.includes('window.__SASHA_LINES =')) {
      res = res.replace(/<script>\s*window\.__SASHA_LINES\s*=\s*[\s\S]*?;\s*<\/script>/, sashaScript);
    } else {
      res = res.replace('</body>', `  ${sashaScript}\n</body>`);
    }
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
      isHome: true,
      sashaLines: [{ id: 'home-0', kind: 'greet', text: 'Privet! I’m Sasha, your guide across Russia.' }]
    });

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
      isHome: false,
      sashaLines: [{ id: 'plan', kind: 'greet', text: 'Hi again! Tell me who’s coming and I’ll set the pace of the trip.' }]
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
      isHome: false,
      sashaLines: [{ id: 'reviews', kind: 'greet', text: 'Reviews from ROTW travellers will appear here.' }]
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
