// popup.js — fixed version

function showToast(msg, color = '#22c55e') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = color;
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, 2800);
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// ── Visible screenshot ──────────────────────────────────────────────
document.getElementById('btn-visible').addEventListener('click', async () => {
  showToast('📸 Capturing…', '#7c6af7');
  chrome.runtime.sendMessage({ action: 'captureAndDownload' }, (res) => {
    if (chrome.runtime.lastError || res?.error) {
      showToast('Error — reload the page & retry', '#ef4444');
    } else {
      showToast('✓ Saved to Downloads!');
    }
  });
});

// ── Full page screenshot ────────────────────────────────────────────
document.getElementById('btn-fullpage').addEventListener('click', async () => {
  const tab = await getActiveTab();
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  } catch (e) {}

  showToast('📸 Capturing full page…', '#7c6af7');
  chrome.tabs.sendMessage(tab.id, { action: 'startFullPageCapture' }, (res) => {
    if (chrome.runtime.lastError) {
      showToast('Refresh the page & retry', '#ef4444');
    }
  });
});

// ── Region select ───────────────────────────────────────────────────
document.getElementById('btn-region').addEventListener('click', async () => {
  const tab = await getActiveTab();
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  } catch (e) {}

  chrome.tabs.sendMessage(tab.id, { action: 'startRegionSelect' }, (res) => {
    if (chrome.runtime.lastError) {
      showToast('Refresh the page & retry', '#ef4444');
      return;
    }
    showToast('Draw a region on the page', '#7c6af7');
    setTimeout(() => window.close(), 800);
  });
});

// ── Equation converter ──────────────────────────────────────────────
document.getElementById('btn-equation').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
  window.close();
});
