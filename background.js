// background.js — Service Worker (central hub)

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  // ── Capture the visible tab (used by content.js during scroll) ────
  if (msg.action === 'captureVisibleTab') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ dataUrl });
      }
    });
    return true;
  }

  // ── Full-page done: download from background (popup may be closed) ─
  if (msg.action === 'fullPageDone') {
    chrome.downloads.download({
      url: msg.dataUrl,
      filename: 'screenshot-fullpage.png',
      saveAs: false
    });
    sendResponse({ ok: true });
    return true;
  }

  // ── Region done: download from background ─────────────────────────
  if (msg.action === 'regionDone') {
    chrome.downloads.download({
      url: msg.dataUrl,
      filename: 'screenshot-region.png',
      saveAs: false
    });
    sendResponse({ ok: true });
    return true;
  }

  // ── Visible screenshot: capture + download immediately ────────────
  if (msg.action === 'captureAndDownload') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
        return;
      }
      chrome.downloads.download({
        url: dataUrl,
        filename: 'screenshot-visible.png',
        saveAs: false
      });
      sendResponse({ ok: true });
    });
    return true;
  }

});
