// Runs in the page's own JavaScript world ("MAIN"), so it sees the
// page's real errors. It cannot use chrome.* APIs, so it passes each
// error to content.js with window.postMessage.
(() => {
  const send = (message, where) =>
    window.postMessage({ source: 'breakage-inspector', message, where }, '*');

  // Uncaught exceptions: ReferenceError, TypeError, throw ...
  window.addEventListener('error', (event) => {
    send(event.message, `${event.filename}:${event.lineno}:${event.colno}`);
  });

  // Rejected promises that nobody catches: "Uncaught (in promise)".
  // async functions report their errors this way.
  window.addEventListener('unhandledrejection', (event) => {
    const r = event.reason;
    const text = r instanceof Error ? `${r.name}: ${r.message}` : String(r);
    const where = r instanceof Error && r.stack ? (r.stack.split('\n')[1] || '').trim() : '';
    send(`Uncaught (in promise) ${text}`, where);
  });
})();
