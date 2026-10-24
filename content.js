// Runs in the extension's isolated world on every page.
// Receives errors from page-hook.js and forwards them to background.js.
window.addEventListener('message', (event) => {
  if (event.source !== window) return; // only messages from this page itself
  const d = event.data;
  if (!d || d.source !== 'breakage-inspector') return;

  chrome.runtime.sendMessage({
    kind: 'js-error',
    message: String(d.message).slice(0, 500),
    where: String(d.where || '').slice(0, 300)
  });
});
