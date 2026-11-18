const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const userDataDir = path.join(os.tmpdir(), 'chrome-verify-hf-' + Date.now());

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
    this.consoleErrors = [];
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      } else if (msg.method) {
        if (msg.method === 'Runtime.consoleAPICalled') {
          if (msg.params.type === 'error') {
            const text = msg.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
            this.consoleErrors.push(text);
          }
        } else if (msg.method === 'Runtime.exceptionThrown') {
          this.consoleErrors.push(msg.params.exceptionDetails.text + ' ' + (msg.params.exceptionDetails.exception?.description || ''));
        }
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function run() {
  console.log('Launching headless Chrome for Header & Footer V3 verification...');
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9225',
    '--user-data-dir=' + userDataDir,
    '--no-first-run',
    '--no-default-browser-check'
  ]);

  try {
    await sleep(1500);
    const verRes = await fetch('http://127.0.0.1:9225/json/version');
    const verData = await verRes.json();
    const browserWs = new CDPClient(verData.webSocketDebuggerUrl);
    await browserWs.connect();

    const target = await browserWs.send('Target.createTarget', { url: 'about:blank' });
    const targetId = target.targetId;
    const pageWsUrl = `ws://127.0.0.1:9225/devtools/page/${targetId}`;
    const client = new CDPClient(pageWsUrl);
    await client.connect();

    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Log.enable');

    const urls = [
      'http://127.0.0.1:5180/',
      'http://127.0.0.1:5180/plan.html',
      'http://127.0.0.1:5180/reviews.html',
      'http://127.0.0.1:5180/notes/moscow.html',
      'http://127.0.0.1:5180/destinations/moscow.html',
      'http://127.0.0.1:5180/destinations/dubai.html',
      'http://127.0.0.1:5180/destinations/ar/moscow.html'
    ];

    const widths = [1280, 390];
    const results = [];

    for (const testUrl of urls) {
      for (const w of widths) {
        const h = (w === 390 ? 844 : 800);
        console.log(`\n==================================================`);
        console.log(`Testing: ${testUrl} @ ${w}x${h}`);
        console.log(`==================================================`);

        client.consoleErrors = [];

        await client.send('Emulation.setDeviceMetricsOverride', {
          width: w,
          height: h,
          deviceScaleFactor: 1,
          mobile: (w === 390)
        });

        await client.send('Page.navigate', { url: testUrl });
        await sleep(1200);

        // Function to evaluate header contrast and capsule size at a scroll position
        const evalHeaderAtScroll = async (scrollY) => {
          await client.send('Runtime.evaluate', {
            expression: `window.scrollTo(0, ${scrollY});`
          });
          await sleep(250);

          const evalRes = await client.send('Runtime.evaluate', {
            expression: `(() => {
              function getLum(r, g, b) {
                const a = [r, g, b].map(v => {
                  v /= 255;
                  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
                });
                return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
              }
              function parseRgb(str) {
                const m = str.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
                return m ? [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])] : [248, 241, 232];
              }
              function contrast(rgb1, rgb2) {
                const l1 = getLum(rgb1[0], rgb1[1], rgb1[2]);
                const l2 = getLum(rgb2[0], rgb2[1], rgb2[2]);
                return ((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05));
              }

              const cap = document.querySelector('.compass-capsule');
              const capRect = cap.getBoundingClientRect();
              const capBg = [11, 22, 38]; // rgba(11,22,38,.96)

              const items = [];
              // Capsule elements
              cap.querySelectorAll('.capsule-link, .capsule-brand, .btn-pill-plan, .capsule-lang-select, .btn-capsule-menu').forEach(el => {
                const cs = window.getComputedStyle(el);
                if (cs.display === 'none') return;
                const text = el.innerText ? el.innerText.trim() : (el.getAttribute('aria-label') || el.className);
                const color = cs.color;
                const rgb = parseRgb(color);

                let cr;
                let bgName;
                if (el.classList.contains('btn-pill-plan')) {
                  // Plan button: gold pill with dark text
                  const bgRgb = parseRgb(cs.backgroundColor); // #F4A63C
                  const pillVsCapsule = contrast(bgRgb, capBg);
                  const textVsPill = contrast(rgb, bgRgb);
                  cr = Math.min(pillVsCapsule, textVsPill);
                  bgName = 'gold pill';
                } else {
                  cr = contrast(rgb, capBg);
                  bgName = 'capsule navy';
                }

                items.push({
                  tag: el.tagName,
                  class: el.className.split(' ')[0],
                  name: text.slice(0, 20),
                  color: color,
                  bg: bgName,
                  contrast: parseFloat(cr.toFixed(2))
                });
              });

              // Check svgs inside capsule (exclude icon inside gold pill as it sits on gold)
              cap.querySelectorAll('svg.shell-icon').forEach(svg => {
                const cs = window.getComputedStyle(svg);
                if (cs.display === 'none') return;
                const insidePill = svg.closest('.btn-pill-plan');
                let cr;
                let stroke = cs.stroke || cs.color;
                let rgb = parseRgb(stroke);
                if (insidePill) {
                  const pillCs = window.getComputedStyle(insidePill);
                  const bgRgb = parseRgb(pillCs.backgroundColor);
                  cr = contrast(rgb, bgRgb);
                } else {
                  cr = contrast(rgb, capBg);
                }
                items.push({
                  tag: 'svg',
                  class: svg.className ? (svg.className.baseVal || '').split(' ')[1] || 'icon' : 'icon',
                  name: svg.getAttribute('use') || 'svg',
                  color: stroke,
                  bg: insidePill ? 'gold pill' : 'capsule navy',
                  contrast: parseFloat(cr.toFixed(2))
                });
              });

              return {
                capsuleWidth: Math.round(capRect.width),
                capsuleHeight: Math.round(capRect.height),
                items: items
              };
            })()`,
            returnByValue: true
          });

          return evalRes.result.value;
        };

        // Scroll 0
        const headerAt0 = await evalHeaderAtScroll(0);
        // Scroll 800
        const headerAt800 = await evalHeaderAtScroll(800);

        // Scroll to bottom
        await client.send('Runtime.evaluate', {
          expression: `window.scrollTo(0, document.documentElement.scrollHeight);`
        });
        await sleep(500);

        const bottomHeader = await evalHeaderAtScroll(999999);

        // Evaluate footer card at bottom
        const footerEval = await client.send('Runtime.evaluate', {
          expression: `(() => {
            const card = document.querySelector('.rotw-footer-card');
            const dock = document.querySelector('.rotw-dock');
            const wmSvg = document.querySelector('.footer-wordmark-svg');
            const cardRect = card ? card.getBoundingClientRect() : null;
            const dockRect = dock ? dock.getBoundingClientRect() : null;
            const wmRect = wmSvg ? wmSvg.getBoundingClientRect() : null;

            const cardCs = card ? window.getComputedStyle(card) : null;
            const padLeft = cardCs ? parseFloat(cardCs.paddingLeft) : 0;
            const padRight = cardCs ? parseFloat(cardCs.paddingRight) : 0;
            const cardInnerWidth = cardRect ? (cardRect.width - padLeft - padRight) : 0;
            const wmWidth = wmRect ? wmRect.width : 0;

            const horizOverflow = document.documentElement.scrollWidth > window.innerWidth;
            const dockTop = dockRect ? dockRect.top : 0;
            const cardBottom = cardRect ? cardRect.bottom : 0;

            // Last line inside card: bottom row
            const bottomRow = document.querySelector('.footer-card-bottom');
            const bottomRowRect = bottomRow ? bottomRow.getBoundingClientRect() : null;
            const lastLineBottom = bottomRowRect ? bottomRowRect.bottom : cardBottom;
            const clearanceAboveDock = dockTop - lastLineBottom;

            return {
              hasCard: !!card,
              cardBox: cardRect ? {
                x: Math.round(cardRect.x),
                y: Math.round(cardRect.y),
                width: Math.round(cardRect.width),
                height: Math.round(cardRect.height)
              } : null,
              wordmarkWidth: Math.round(wmWidth),
              cardInnerWidth: Math.round(cardInnerWidth),
              wordmarkDelta: Math.abs(Math.round(wmWidth) - Math.round(cardInnerWidth)),
              horizontalOverflow: horizOverflow,
              dockTop: Math.round(dockTop),
              lastLineBottom: Math.round(lastLineBottom),
              clearanceAboveDock: Math.round(clearanceAboveDock),
              clearsDock: clearanceAboveDock > 0
            };
          })()`,
          returnByValue: true
        });

        const footerData = footerEval.result.value;

        // Take screenshots for home page at 1280 and 390
        if (testUrl === 'http://127.0.0.1:5180/') {
          const ss = await client.send('Page.captureScreenshot', { format: 'png' });
          const ssPath = path.join(__dirname, `screenshot-footer-${w}.png`);
          fs.writeFileSync(ssPath, Buffer.from(ss.data, 'base64'));
          console.log(`Saved screenshot: ${ssPath}`);
        }

        console.log(`Capsule Size: ${headerAt0.capsuleWidth}x${headerAt0.capsuleHeight} (scroll 0), ${headerAt800.capsuleWidth}x${headerAt800.capsuleHeight} (scroll 800), ${bottomHeader.capsuleWidth}x${bottomHeader.capsuleHeight} (bottom)`);
        console.log(`Header items count: ${headerAt0.items.length}, Min contrast at 0: ${Math.min(...headerAt0.items.map(i => i.contrast))}, Min contrast at 800: ${Math.min(...headerAt800.items.map(i => i.contrast))}, Min contrast at bottom: ${Math.min(...bottomHeader.items.map(i => i.contrast))}`);
        console.log(`Footer Card Box: ${JSON.stringify(footerData.cardBox)}`);
        console.log(`Wordmark Width: ${footerData.wordmarkWidth}px, Card Inner Width: ${footerData.cardInnerWidth}px, Delta: ${footerData.wordmarkDelta}px (<=2px: ${footerData.wordmarkDelta <= 2})`);
        console.log(`Horizontal Overflow: ${footerData.horizontalOverflow} (false)`);
        console.log(`Last line clears dock: ${footerData.clearsDock} (clearance: ${footerData.clearanceAboveDock}px)`);
        console.log(`Console Errors: ${client.consoleErrors.length}`);

        results.push({
          url: testUrl,
          width: w,
          capsuleSize: `${headerAt0.capsuleWidth}x${headerAt0.capsuleHeight}`,
          minContrast0: Math.min(...headerAt0.items.map(i => i.contrast)),
          minContrast800: Math.min(...headerAt800.items.map(i => i.contrast)),
          minContrastBottom: Math.min(...bottomHeader.items.map(i => i.contrast)),
          allContrastGte7: headerAt0.items.every(i => i.contrast >= 7) && headerAt800.items.every(i => i.contrast >= 7) && bottomHeader.items.every(i => i.contrast >= 7),
          cardBox: footerData.cardBox,
          wmWidth: footerData.wordmarkWidth,
          cardInnerWidth: footerData.cardInnerWidth,
          wmDelta: footerData.wordmarkDelta,
          horizOverflow: footerData.horizontalOverflow,
          clearsDock: footerData.clearsDock,
          clearance: footerData.clearanceAboveDock,
          errors: client.consoleErrors
        });
      }
    }

    console.log('\n==================================================');
    console.log('FINAL VERIFICATION SUMMARY TABLE:');
    console.log('==================================================');
    console.table(results.map(r => ({
      Page: r.url.replace('http://127.0.0.1:5180', ''),
      Width: r.width,
      Capsule: r.capsuleSize,
      MinContrast: `${r.minContrast0} / ${r.minContrast800} / ${r.minContrastBottom}`,
      AllContrastGte7: r.allContrastGte7,
      WM_Delta: r.wmDelta + 'px',
      Overflow: r.horizOverflow,
      ClearsDock: `${r.clearsDock} (${r.clearance}px)`,
      Errors: r.errors.length
    })));

    browserWs.close();
    client.close();
  } finally {
    chrome.kill();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
