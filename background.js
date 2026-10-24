// Collects failed requests and JavaScript errors per tab.
// Stored in chrome.storage.session: survives the service worker
// being stopped, cleared when the browser closes.

const key = (tabId) => `tab-${tabId}`;

// Errors can arrive many at once. Writes run one after another
// so two errors never overwrite each other.
let queue = Promise.resolve();

function addEntry(tabId, entry) {
  queue = queue.then(async () => {
    const k = key(tabId);
    const stored = await chrome.storage.session.get(k);
    const list = stored[k] || [];
    list.push(entry);
    await chrome.storage.session.set({ [k]: list });
  });
}

// A new page is committed in a tab's top frame: start a fresh list.
// webNavigation sees every navigation, including ones a site's own
// service worker answers, which webRequest's main_frame event can miss.
chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) return; // only the top frame, not iframes
  queue = queue.then(() => chrome.storage.session.remove(key(details.tabId)));
});

// Any request on any tab that fails.
chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    if (details.tabId < 0) return; // not from a tab
    addEntry(details.tabId, {
      kind: 'request',
      url: details.url,
      type: details.type,   // script, xhr, image, sub_frame...
      error: details.error  // e.g. net::ERR_BLOCKED_BY_CLIENT
    });
  },
  { urls: ['<all_urls>'] }
);

// JavaScript errors reported by content.js.
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.kind !== 'js-error' || !sender.tab) return;
  addEntry(sender.tab.id, {
    kind: 'js-error',
    message: msg.message,
    where: msg.where
  });
});

// Tab closed: forget its list and remove its block rules.
chrome.tabs.onRemoved.addListener(async (tabId) => {
  chrome.storage.session.remove(key(tabId));
  const rules = await chrome.declarativeNetRequest.getSessionRules();
  const ids = rules
    .filter((r) => r.condition.tabIds?.includes(tabId))
    .map((r) => r.id);
  if (ids.length) {
    await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: ids });
  }
});
