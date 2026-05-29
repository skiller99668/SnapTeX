// background.js - Service Worker

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // 1. Handles the raw image capture from the visible tab
  if (msg.action === 'captureVisibleTab') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ dataUrl });
      }
    });
    return true; // Keep message channel open for async response
  }

  // 2. Receives the final sliced/stitched dataUrl from content.js and saves to bag
  if (msg.action === 'regionCaptureDone') {
    chrome.storage.local.get({ bag: [] }, (result) => {
      const updatedBag = result.bag;
      updatedBag.push(msg.dataUrl);
      chrome.storage.local.set({ bag: updatedBag }, () => {
        sendResponse({ ok: true });
      });
    });
    return true; // Keep message channel open for async response
  }
});