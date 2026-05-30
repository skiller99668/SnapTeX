// popup.js - Bag UI, loads from chrome.storage.session via background

// ── Stitch all screenshots into one tall PNG, black-fill for width gaps ──
function stitchImages(images) {
  const maxW = Math.max(...images.map(img => img.naturalWidth));
  const totalH = images.reduce((sum, img) => sum + img.naturalHeight, 0);

  const canvas = document.createElement('canvas');
  canvas.width = maxW;
  canvas.height = totalH;
  const ctx = canvas.getContext('2d');

  // Black background fills any width gaps
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, maxW, totalH);

  let y = 0;
  images.forEach(img => {
    ctx.drawImage(img, 0, y);
    y += img.naturalHeight;
  });

  return canvas.toDataURL('image/png');
}

function loadImages(dataUrls) {
  return Promise.all(dataUrls.map(url => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = url;
  })));
}

// ── Load bag from background and re-render ──
function loadBag() {
  chrome.runtime.sendMessage({ action: 'getBag' }, ({ bag }) => {
    renderBag(bag);
  });
}

function renderBag(bag) {
  const count = document.getElementById('bag-count');
  const thumbnails = document.getElementById('thumbnails');
  const dlBtn = document.getElementById('btn-download-bag');
  const pasteBtn = document.getElementById('btn-paste-bag');
  const clrBtn = document.getElementById('btn-clear-bag');

  count.textContent = `${bag.length} screenshot${bag.length !== 1 ? 's' : ''}`;
  dlBtn.disabled = bag.length === 0;
  pasteBtn.disabled = bag.length === 0;
  clrBtn.disabled = bag.length === 0;

  thumbnails.innerHTML = '';
  bag.forEach((dataUrl, idx) => {
    const thumb = document.createElement('div');
    thumb.className = 'thumbnail';
    const img = document.createElement('img');
    img.src = dataUrl;
    thumb.appendChild(img);

    const del = document.createElement('button');
    del.className = 'delete';
    del.textContent = '✕';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.runtime.sendMessage({ action: 'removeFromBag', index: idx }, loadBag);
    });
    thumb.appendChild(del);
    thumbnails.appendChild(thumb);
  });
}

// ── Listen for bag updates from background ──
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'bagUpdated') loadBag();
});

document.addEventListener('DOMContentLoaded', () => {

  // Load bag on open
  loadBag();

  function isInjectable(url) {
    return url && /^(https?|file):/.test(url);
  }

  function notifyBadPage() {
    const countEl = document.getElementById('bag-count');
    countEl.textContent = "Can't capture this page";
    countEl.style.color = '#ef4444';
    setTimeout(() => { countEl.style.color = ''; loadBag(); }, 2500);
  }

  // Select Region — inject if needed, then close popup so user can draw
  document.getElementById('btn-region').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!isInjectable(tab.url)) { notifyBadPage(); return; }
    try { await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] }); } catch (e) {}
    chrome.tabs.sendMessage(tab.id, { action: 'startRegionSelect' });
    window.close();
  });

  // Visible Area — capture immediately
  document.getElementById('btn-visible').addEventListener('click', () => {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (dataUrl) chrome.runtime.sendMessage({ action: 'addToBag', dataUrl }, loadBag);
    });
  });

  // Full Page — inject if needed, content.js handles the rest
  document.getElementById('btn-fullpage').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!isInjectable(tab.url)) { notifyBadPage(); return; }
    try { await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] }); } catch (e) {}
    chrome.tabs.sendMessage(tab.id, { action: 'startFullPageCapture' });
  });

  // Download Bag
  document.getElementById('btn-download-bag').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'getBag' }, async ({ bag }) => {
      if (!bag.length) return;
      const images = await loadImages(bag);
      const dataUrl = stitchImages(images);
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `snaptex-bag-${Date.now()}.png`;
      link.click();
    });
  });

  // Paste Bag
  document.getElementById('btn-paste-bag').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'getBag' }, async ({ bag }) => {
      if (!bag.length) return;
      const images = await loadImages(bag);
      const dataUrl = stitchImages(images);
      const blob = await (await fetch(dataUrl)).blob();
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        const countEl = document.getElementById('bag-count');
        countEl.textContent = '✓ Copied to clipboard!';
        countEl.style.color = '#22c55e';
        setTimeout(() => { countEl.style.color = ''; loadBag(); }, 2000);
      } catch (e) {
        alert('Clipboard write failed: ' + e.message);
      }
    });
  });

  // Clear Bag
  document.getElementById('btn-clear-bag').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'clearBag' }, loadBag);
  });

  // Equation Converter
  document.getElementById('btn-equation').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('equation.html') });
  });

});