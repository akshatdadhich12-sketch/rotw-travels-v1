const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const userDataDir = path.join(os.tmpdir(), 'chrome-verify-clock-' + Date.now());

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
  console.log('Launching headless Chrome for compass clock verification...');
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9224',
    '--user-data-dir=' + userDataDir,
    '--no-first-run',
    '--no-default-browser-check'
  ]);

  try {
    await sleep(1500);
    const verRes = await fetch('http://127.0.0.1:9224/json/version');
    const verData = await verRes.json();
    const browserWs = new CDPClient(verData.webSocketDebuggerUrl);
    await browserWs.connect();

    const target = await browserWs.send('Target.createTarget', { url: 'about:blank' });
    const targetId = target.targetId;
    const pageWsUrl = `ws://127.0.0.1:9224/devtools/page/${targetId}`;
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
    const scrollSteps = [0, 300, 600, 1200, 600, 0];

    const summaryReport = [];

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
        await sleep(500);
        await client.send('Runtime.evaluate', { expression: `sessionStorage.clear();` });
        await client.send('Page.navigate', { url: testUrl });

        // Wait 3s as specified in spec
        await sleep(3000);

        const stepOutputs = [];

        for (const s of scrollSteps) {
          await client.send('Runtime.evaluate', {
            expression: `window.scrollTo(0, ${s});`
          });
          // Wait 1.5s each as specified in spec
          await sleep(1500);

          const evalRes = await client.send('Runtime.evaluate', {
            expression: `(() => {
              const needle = document.querySelector('.compass-capsule #lg-needle') || document.querySelector('#lg-needle');
              const face = document.querySelector('.compass-capsule #lg-face') || document.querySelector('#lg-face');
              const hub = document.querySelector('.compass-capsule #lg-hub') || document.querySelector('#lg-hub');
              const oRing = document.querySelector('.compass-capsule #lg-l-o .lg-ring') || document.querySelector('#lg-l-o');
              const capsule = document.querySelector('.compass-capsule');

              const rot = needle && window.gsap ? gsap.getProperty(needle, 'rotation') : null;
              const faceTransform = face ? getComputedStyle(face).transform : 'missing';
              const isFaceIdentity = faceTransform === 'none' || faceTransform === 'matrix(1, 0, 0, 1, 0, 0)';

              let hubO_diff = null;
              if (hub && oRing) {
                const rH = hub.getBoundingClientRect();
                const rO = oRing.getBoundingClientRect();
                hubO_diff = Math.hypot((rH.left + rH.width / 2) - (rO.left + rO.width / 2), (rH.top + rH.height / 2) - (rO.top + rO.height / 2));
              }

              let needleHeight = 0;
              if (needle) {
                needleHeight = needle.getBoundingClientRect().height;
              }

              let capW = 0, capH = 0;
              if (capsule) {
                const rC = capsule.getBoundingClientRect();
                capW = Math.round(rC.width * 10) / 10;
                capH = Math.round(rC.height * 10) / 10;
              }

              return {
                scrollY: window.scrollY || window.pageYOffset || 0,
                rotation: typeof rot === 'number' ? Math.round(rot * 10) / 10 : rot,
                faceTransform,
                isFaceIdentity,
                hubO_diff: hubO_diff !== null ? Math.round(hubO_diff * 1000) / 1000 : null,
                needleHeight: Math.round(needleHeight * 10) / 10,
                capW,
                capH
              };
            })()`,
            returnByValue: true
          });

          const val = evalRes.result.value;
          stepOutputs.push({ step: s, ...val });
          console.log(`Scroll ${s}px: needle rotation=${val.rotation}°, face=${val.faceTransform} (identity=${val.isFaceIdentity}), hub-vs-O=${val.hubO_diff}px, needleH=${val.needleHeight}px, capsule=${val.capW}x${val.capH}`);

          // Zoomed screenshots at scroll 0 and scroll 300 on home page at 1280
          if (testUrl.endsWith(':5180/') && w === 1280) {
            if (s === 0) {
              const clipRes = await client.send('Runtime.evaluate', {
                expression: `(() => {
                  const b = document.querySelector('.compass-capsule .capsule-brand');
                  const r = b.getBoundingClientRect();
                  return { x: r.left - 6, y: r.top + (window.scrollY || 0) - 6, width: r.width + 12, height: r.height + 12, scale: 2 };
                })()`,
                returnByValue: true
              });
              const clip = clipRes.result.value;
              const ss = await client.send('Page.captureScreenshot', { clip });
              fs.writeFileSync(path.join(__dirname, 'screenshot-logo-scroll-0.png'), Buffer.from(ss.data, 'base64'));
              fs.writeFileSync(path.join(path.resolve(__dirname, '../..'), 'screenshot-logo-scroll-0.png'), Buffer.from(ss.data, 'base64'));
              console.log('✓ Captured and saved screenshot-logo-scroll-0.png');
            } else if (s === 300) {
              const clipRes = await client.send('Runtime.evaluate', {
                expression: `(() => {
                  const b = document.querySelector('.compass-capsule .capsule-brand');
                  const r = b.getBoundingClientRect();
                  return { x: r.left - 6, y: r.top + (window.scrollY || 0) - 6, width: r.width + 12, height: r.height + 12, scale: 2 };
                })()`,
                returnByValue: true
              });
              const clip = clipRes.result.value;
              const ss = await client.send('Page.captureScreenshot', { clip });
              fs.writeFileSync(path.join(__dirname, 'screenshot-logo-scroll-300.png'), Buffer.from(ss.data, 'base64'));
              fs.writeFileSync(path.join(path.resolve(__dirname, '../..'), 'screenshot-logo-scroll-300.png'), Buffer.from(ss.data, 'base64'));
              console.log('✓ Captured and saved screenshot-logo-scroll-300.png');
            }
          }
        }

        console.log(`Console errors: ${client.consoleErrors.length}`);
        if (client.consoleErrors.length > 0) {
          console.log('Errors:', client.consoleErrors);
        }

        summaryReport.push({
          url: testUrl,
          w,
          stepOutputs,
          errors: client.consoleErrors
        });
      }
    }

    client.close();
    browserWs.close();

    console.log('\n==================================================');
    console.log('ALL VERIFICATIONS COMPLETED');
    console.log('==================================================');
    return summaryReport;
  } finally {
    chrome.kill();
  }
}

run().catch(e => {
  console.error('Clock verification failed:', e);
  process.exit(1);
});
