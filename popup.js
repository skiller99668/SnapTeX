// popup.js - Bag screenshot manager

let bag = []; // Store screenshots as data URLs

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function updateBagUI() {
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
    thumb.innerHTML = `<img src="${dataUrl}">`;
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete';
    deleteBtn.textContent = '✕';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      bag.splice(idx, 1);
      updateBagUI();
    });
    thumb.appendChild(deleteBtn);
    thumbnails.appendChild(thumb);
  });
}

function stitchScreenshots() {
  return new Promise((resolve) => {
    const images = bag.map(url => {
      const img = new Image();
      img.src = url;
      return img;
    });
    
    let loaded = 0;
    images.forEach(img => {
      img.onload = () => {
        loaded++;
        if (loaded === images.length) {
          // All loaded — stitch them
          const width = images[0].width;
          const totalHeight = images.reduce((sum, img) => sum + img.height, 0);
          
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = totalHeight;
          const ctx = canvas.getContext('2d');
          
          let y = 0;
          images.forEach(img => {
            ctx.drawImage(img, 0, y);
            y += img.height;
          });
          
          resolve(canvas.toDataURL('image/png'));
        }
      };
    });
  });
}

// Listen for screenshots from content.js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'regionCaptureDone') {
    bag.push(msg.dataUrl);
    updateBagUI();
    sendResponse({ ok: true });
  }
});

document.addEventListener('DOMContentLoaded', () => {
  // Select Region
  document.getElementById('btn-region').addEventListener('click', async () => {
    const tab = await getActiveTab();
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    } catch (e) {}
    chrome.tabs.sendMessage(tab.id, { action: 'startRegionSelect' });
  });

  // Visible Area
  document.getElementById('btn-visible').addEventListener('click', async () => {
    const tab = await getActiveTab();
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (dataUrl) {
        bag.push(dataUrl);
        updateBagUI();
      }
    });
  });

  // Full Page
  document.getElementById('btn-fullpage').addEventListener('click', async () => {
    const tab = await getActiveTab();
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    } catch (e) {}
    chrome.tabs.sendMessage(tab.id, { action: 'startFullPageCapture' });
  });

  // Download Bag
  document.getElementById('btn-download-bag').addEventListener('click', async () => {
    const dataUrl = await stitchScreenshots();
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `screenshot-bag-${Date.now()}.png`;
    link.click();
  });

  // Paste Bag
  document.getElementById('btn-paste-bag').addEventListener('click', async () => {
    const dataUrl = await stitchScreenshots();
    const blob = await (await fetch(dataUrl)).blob();
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      alert('Bag pasted to clipboard! Paste it into Docs, Word, Slack, etc.');
    } catch (e) {
      alert('Failed to copy to clipboard: ' + e.message);
    }
  });

  // Clear Bag
  document.getElementById('btn-clear-bag').addEventListener('click', () => {
    bag = [];
    updateBagUI();
  });

  // Equation Converter
  document.getElementById('btn-equation').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('equation.html') });
  });

  updateBagUI();
});