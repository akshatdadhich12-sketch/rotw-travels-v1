const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const userDataDir = path.join(os.tmpdir(), 'chrome-verify-' + Date.now());

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
    this.events = [];
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
  console.log('Launching headless Chrome for verification...');
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--user-data-dir=' + userDataDir,
    '--no-first-run',
    '--no-default-browser-check'
  ]);

  try {
    await sleep(1500);
    const verRes = await fetch('http://127.0.0.1:9222/json/version');
    const verData = await verRes.json();
    const browserWs = new CDPClient(verData.webSocketDebuggerUrl);
    await browserWs.connect();

    // Create new target page
    const target = await browserWs.send('Target.createTarget', { url: 'about:blank' });
    const targetId = target.targetId;
    const pageWsUrl = `ws://127.0.0.1:9222/devtools/page/${targetId}`;
    const client = new CDPClient(pageWsUrl);
    await client.connect();

    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Log.enable');

    const urls = [
      'http://127.0.0.1:5180/',
      'http://127.0.0.1:5180/plan.html',
      'http://127.0.0.1:5180/destinations/moscow.html'
    ];

    const widths = [1280, 390];
    const scrollSteps = [0, 300, 600, 1200, 2400, 600, 0];

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

        // Fresh sessionStorage
        await client.send('Page.navigate', { url: testUrl });
        await sleep(1000);

        // Clear sessionStorage and reload to ensure fresh visit test
        await client.send('Runtime.evaluate', {
          expression: `sessionStorage.clear();`
        });
        await client.send('Page.navigate', { url: testUrl });
        
        // Wait for page load and intro timeline (~1.6s) to finish
        await sleep(2400);

        // Compute before-scroll dial & O centers
        const beforeCenterRes = await client.send('Runtime.evaluate', {
          expression: `(() => {
            const dial = document.querySelector('.compass-capsule #lg-dial') || document.querySelector('#lg-dial');
            const oRing = document.querySelector('.compass-capsule #lg-l-o .lg-ring') || document.querySelector('#lg-l-o');
            if (!dial || !oRing) return { error: 'elements not found' };
            const rD = dial.getBoundingClientRect();
            const rO = oRing.getBoundingClientRect();
            return {
              dialX: rD.left + rD.width / 2,
              dialY: rD.top + rD.height / 2,
              oX: rO.left + rO.width / 2,
              oY: rO.top + rO.height / 2,
              dx: Math.abs((rD.left + rD.width / 2) - (rO.left + rO.width / 2)),
              dy: Math.abs((rD.top + rD.height / 2) - (rO.top + rO.height / 2))
            };
          })()`,
          returnByValue: true
        });
        const beforeCenter = beforeCenterRes.result.value;

        const stepResults = [];

        for (const s of scrollSteps) {
          await client.send('Runtime.evaluate', {
            expression: `window.scrollTo(0, ${s});`
          });
          await sleep(800);

          const evalRes = await client.send('Runtime.evaluate', {
            expression: `(() => {
              const dial = document.querySelector('.compass-capsule #lg-dial') || document.querySelector('#lg-dial');
              const capsule = document.querySelector('.compass-capsule');
              const rot = dial ? gsap.getProperty(dial, 'rotation') : null;
              const capRect = capsule ? capsule.getBoundingClientRect() : null;
              return {
                scrollY: window.scrollY || window.pageYOffset || 0,
                rotation: typeof rot === 'number' ? Math.round(rot * 10) / 10 : rot,
                capW: capRect ? Math.round(capRect.width * 10) / 10 : 0,
                capH: capRect ? Math.round(capRect.height * 10) / 10 : 0
              };
            })()`,
            returnByValue: true
          });
          const val = evalRes.result.value;
          stepResults.push({ stepScroll: s, ...val });

          // Take zoomed screenshot at scroll 0 and scroll 600 for home page at 1280
          if (testUrl.endsWith(':5180/') && w === 1280) {
            if (s === 0) {
              const clipRes = await client.send('Runtime.evaluate', {
                expression: `(() => {
                  const b = document.querySelector('.compass-capsule .capsule-brand');
                  const r = b.getBoundingClientRect();
                  return { x: r.left - 10, y: r.top + (window.scrollY || 0) - 10, width: r.width + 20, height: r.height + 20, scale: 2 };
                })()`,
                returnByValue: true
              });
              const clip = clipRes.result.value;
              const ss = await client.send('Page.captureScreenshot', { clip });
              fs.writeFileSync(path.join(__dirname, 'screenshot-logo-scroll-0.png'), Buffer.from(ss.data, 'base64'));
              console.log('Saved screenshot-logo-scroll-0.png');
            } else if (s === 600) {
              const clipRes = await client.send('Runtime.evaluate', {
                expression: `(() => {
                  const b = document.querySelector('.compass-capsule .capsule-brand');
                  const r = b.getBoundingClientRect();
                  return { x: r.left - 10, y: r.top + (window.scrollY || 0) - 10, width: r.width + 20, height: r.height + 20, scale: 2 };
                })()`,
                returnByValue: true
              });
              const clip = clipRes.result.value;
              const ss = await client.send('Page.captureScreenshot', { clip });
              fs.writeFileSync(path.join(__dirname, 'screenshot-logo-scroll-600.png'), Buffer.from(ss.data, 'base64'));
              console.log('Saved screenshot-logo-scroll-600.png');
            }
          }
        }

        // Compute after-scroll dial & O centers
        const afterCenterRes = await client.send('Runtime.evaluate', {
          expression: `(() => {
            const dial = document.querySelector('.compass-capsule #lg-dial') || document.querySelector('#lg-dial');
            const oRing = document.querySelector('.compass-capsule #lg-l-o .lg-ring') || document.querySelector('#lg-l-o');
            if (!dial || !oRing) return { error: 'elements not found' };
            const rD = dial.getBoundingClientRect();
            const rO = oRing.getBoundingClientRect();
            return {
              dialX: rD.left + rD.width / 2,
              dialY: rD.top + rD.height / 2,
              oX: rO.left + rO.width / 2,
              oY: rO.top + rO.height / 2,
              dx: Math.abs((rD.left + rD.width / 2) - (rO.left + rO.width / 2)),
              dy: Math.abs((rD.top + rD.height / 2) - (rO.top + rO.height / 2))
            };
          })()`,
          returnByValue: true
        });
        const afterCenter = afterCenterRes.result.value;

        const maxCenterDiff = Math.max(beforeCenter.dx, beforeCenter.dy, afterCenter.dx, afterCenter.dy);

        console.log('Scroll steps:');
        stepResults.forEach(r => {
          console.log(`  target=${r.stepScroll}px | actual=${r.scrollY}px | dial rotation=${r.rotation}° | capsule=${r.capW}x${r.capH}`);
        });
        console.log(`Dial vs O center difference: before=(dx:${beforeCenter.dx.toFixed(3)}, dy:${beforeCenter.dy.toFixed(3)}), after=(dx:${afterCenter.dx.toFixed(3)}, dy:${afterCenter.dy.toFixed(3)}) -> max=${maxCenterDiff.toFixed(3)} px (<0.5 px: ${maxCenterDiff < 0.5})`);
        console.log(`Console errors: ${client.consoleErrors.length}`);
        if (client.consoleErrors.length > 0) {
          console.log('Errors:', client.consoleErrors);
        }

        results.push({
          url: testUrl,
          width: w,
          stepResults,
          maxCenterDiff,
          errors: client.consoleErrors
        });
      }
    }

    client.close();
    browserWs.close();
    console.log('\n==================================================');
    console.log('ALL TESTS COMPLETED SUCCESSFULLY!');
    console.log('==================================================');
  } finally {
    chrome.kill();
  }
}

run().catch(e => {
  console.error('Verification failed:', e);
  process.exit(1);
});
