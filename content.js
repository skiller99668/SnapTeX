// content.js — injected into every page

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'startFullPageCapture') {
    captureFullPage();
    sendResponse({ ok: true });
  }
  if (msg.action === 'startRegionSelect') {
    startRegionSelect();
    sendResponse({ ok: true });
  }
});

// ══════════════════════════════════════════════════════════════
//  FULL-PAGE SCROLLABLE SCREENSHOT
// ══════════════════════════════════════════════════════════════
async function captureFullPage() {
  const originalScrollX = window.scrollX;
  const originalScrollY = window.scrollY;
  const totalHeight = document.documentElement.scrollHeight;
  const totalWidth  = document.documentElement.scrollWidth;
  const viewportH   = window.innerHeight;
  const viewportW   = window.innerWidth;

  const canvas = document.createElement('canvas');
  canvas.width  = totalWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d');

  const steps = Math.ceil(totalHeight / viewportH);

  // Show progress overlay
  const overlay = createProgressOverlay(steps);
  document.body.appendChild(overlay);

  window.scrollTo(0, 0);
  await sleep(300);

  for (let i = 0; i < steps; i++) {
    const scrollY = i * viewportH;
    window.scrollTo(0, scrollY);
    await sleep(250);

    const dataUrl = await captureVisible();
    const img = await loadImage(dataUrl);

    const drawY = scrollY;
    const drawH = Math.min(viewportH, totalHeight - scrollY);

    ctx.drawImage(img, 0, 0, viewportW, drawH, 0, drawY, viewportW, drawH);

    updateProgress(overlay, i + 1, steps);
  }

  // Restore scroll
  window.scrollTo(originalScrollX, originalScrollY);
  document.body.removeChild(overlay);

  const finalDataUrl = canvas.toDataURL('image/png');
  chrome.runtime.sendMessage({ action: 'fullPageDone', dataUrl: finalDataUrl });
}

function captureVisible() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'captureVisibleTab' }, (res) => {
      if (res.error) reject(res.error);
      else resolve(res.dataUrl);
    });
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = dataUrl;
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function createProgressOverlay(steps) {
  const el = document.createElement('div');
  el.id = '__snaptex_progress';
  el.innerHTML = `
    <div style="
      position:fixed; top:20px; right:20px; z-index:2147483647;
      background: rgba(10,10,15,0.92); backdrop-filter:blur(12px);
      border: 1px solid rgba(124,106,247,0.4);
      border-radius: 12px; padding: 14px 18px;
      font-family: 'DM Mono', monospace; color: #e8e8f0;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      min-width: 200px;
    ">
      <div style="font-size:11px; color:#7c6af7; letter-spacing:0.1em; text-transform:uppercase; margin-bottom:8px;">SnapTeX</div>
      <div style="font-size:13px; margin-bottom:10px;" id="__snaptex_msg">Capturing page…</div>
      <div style="background:#1e1e2e; border-radius:4px; height:4px; overflow:hidden;">
        <div id="__snaptex_bar" style="height:100%; background: linear-gradient(90deg,#6d59e8,#7c6af7); width:0%; transition:width 0.2s ease; border-radius:4px;"></div>
      </div>
    </div>
  `;
  return el;
}

function updateProgress(overlay, current, total) {
  const pct = Math.round((current / total) * 100);
  const bar = overlay.querySelector('#__snaptex_bar');
  const msg = overlay.querySelector('#__snaptex_msg');
  if (bar) bar.style.width = pct + '%';
  if (msg) msg.textContent = `Step ${current} / ${total}`;
}

// ══════════════════════════════════════════════════════════════
//  REGION SELECT
// ══════════════════════════════════════════════════════════════
function startRegionSelect() {
  // Prevent double overlay
  if (document.getElementById('__snaptex_region_overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = '__snaptex_region_overlay';
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    z-index: 2147483646; cursor: crosshair;
    background: rgba(10,10,15,0.35);
  `;

  const hint = document.createElement('div');
  hint.style.cssText = `
    position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
    background: rgba(10,10,15,0.9); color: #e8e8f0;
    font-family: 'DM Mono', monospace; font-size: 12px;
    padding: 8px 16px; border-radius: 8px;
    border: 1px solid rgba(124,106,247,0.4);
    pointer-events: none; z-index: 2147483647;
  `;
  hint.textContent = 'Drag to select region · ESC to cancel';
  document.body.appendChild(hint);

  let startX, startY, box;

  overlay.addEventListener('mousedown', (e) => {
    startX = e.clientX;
    startY = e.clientY;

    box = document.createElement('div');
    box.style.cssText = `
      position: fixed; border: 2px solid #7c6af7;
      background: rgba(124,106,247,0.1);
      pointer-events: none; z-index: 2147483647;
    `;
    document.body.appendChild(box);
  });

  overlay.addEventListener('mousemove', (e) => {
    if (!box) return;
    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);
    box.style.left   = x + 'px';
    box.style.top    = y + 'px';
    box.style.width  = w + 'px';
    box.style.height = h + 'px';
  });

  overlay.addEventListener('mouseup', async (e) => {
    if (!box) return;
    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);

    cleanup();

    if (w < 5 || h < 5) return;

    await sleep(100);
    const dataUrl = await captureVisible();
    const img = await loadImage(dataUrl);

    const dpr = window.devicePixelRatio || 1;
    const canvas = document.createElement('canvas');
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, x * dpr, y * dpr, w * dpr, h * dpr, 0, 0, w * dpr, h * dpr);

    const cropped = canvas.toDataURL('image/png');
    chrome.runtime.sendMessage({ action: 'regionDone', dataUrl: cropped });
  });

  document.addEventListener('keydown', escHandler);

  function escHandler(e) {
    if (e.key === 'Escape') cleanup();
  }

  function cleanup() {
    if (box && box.parentNode) box.parentNode.removeChild(box);
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    if (hint.parentNode) hint.parentNode.removeChild(hint);
    document.removeEventListener('keydown', escHandler);
    box = null;
  }

  document.body.appendChild(overlay);
}
