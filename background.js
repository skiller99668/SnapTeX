// background.js - Service Worker
// Bag stored in chrome.storage.local (unlimitedStorage permission removes the quota)

// Clear any leftover session storage from older versions (frees the quota)
chrome.storage.session.clear().catch(() => {});

async function getBag() {
  const { bag } = await chrome.storage.local.get('bag');
  return bag || [];
}

async function addToBag(dataUrl) {
  const bag = await getBag();
  bag.push(dataUrl);
  await chrome.storage.local.set({ bag });
  chrome.runtime.sendMessage({ action: 'bagUpdated' }).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  if (msg.action === 'captureVisibleTab') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      sendResponse(chrome.runtime.lastError ? { error: chrome.runtime.lastError.message } : { dataUrl });
    });
    return true;
  }

  if (msg.action === 'addToBag') {
    addToBag(msg.dataUrl).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg.action === 'getBag') {
    getBag().then(bag => sendResponse({ bag }));
    return true;
  }

  if (msg.action === 'removeFromBag') {
    getBag().then(async bag => {
      bag.splice(msg.index, 1);
      await chrome.storage.local.set({ bag });
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.action === 'clearBag') {
    chrome.storage.local.set({ bag: [] }).then(() => sendResponse({ ok: true }));
    return true;
  }

  return false; // no async response for unknown actions
});