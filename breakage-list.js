// <breakage-list>: shows a tab's JavaScript errors and failed requests.
// Usage: document.querySelector('breakage-list').entries = [...];

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host { display: block; }
    .summary { margin: 0 0 8px; }
    ul { list-style: none; padding: 0; margin: 0; max-height: 400px; overflow-y: auto; }
    li { padding: 6px 0; border-bottom: 1px solid #eee; word-break: break-all; }
    .tag { font-size: 11px; font-weight: 600; padding: 1px 6px; border-radius: 4px; margin-right: 6px; }
    .blocked { background: #fde2e1; color: #a1181d; }
    .jserror { background: #fff1d6; color: #8a4b00; }
    .other { background: #eee; color: #555; }
    .main { font-weight: 600; }
    .sub { display: block; color: #888; font-size: 11px; }
    .empty { color: #888; }
  </style>
  <p class="summary"></p>
  <ul></ul>
`;

class BreakageList extends HTMLElement {
  // Private field: only this class can read or change it.
  #entries = [];

  constructor() {
    super();
    // Give the element its own isolated DOM and copy the template into it.
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.append(template.content.cloneNode(true));
  }

  // Called when the element is added to the page.
  connectedCallback() {
    this.#render();
  }

  // Data comes in as a property, not an attribute:
  // attributes can only hold strings, this is an array of objects.
  set entries(value) {
    this.#entries = Array.isArray(value) ? value : [];
    this.#render();
  }

  get entries() {
    return this.#entries;
  }

  #render() {
    const jsErrors = this.#entries.filter((e) => e.kind === 'js-error');
    const requests = this.#entries.filter((e) => e.kind === 'request');
    const blocked = requests.filter((e) => e.error === 'net::ERR_BLOCKED_BY_CLIENT');

    this.shadowRoot.querySelector('.summary').textContent =
      `${jsErrors.length} JS error(s), ${blocked.length} blocked request(s), ` +
      `${requests.length - blocked.length} other failed request(s).`;

    const ul = this.shadowRoot.querySelector('ul');
    ul.replaceChildren(); // clear the old rows

    if (this.#entries.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'Nothing captured yet. Reload the page to capture from the start.';
      ul.append(li);
      return;
    }

    // JS errors first: they usually explain what broke.
    for (const e of jsErrors) {
      ul.append(this.#row('JS ERROR', 'jserror', e.message, e.where));
    }

    for (const e of requests) {
      const url = new URL(e.url);
      const isBlocked = e.error === 'net::ERR_BLOCKED_BY_CLIENT';
      ul.append(this.#row(
        isBlocked ? 'BLOCKED' : e.error.replace('net::', ''),
        isBlocked ? 'blocked' : 'other',
        url.hostname + url.pathname,
        e.type
      ));
    }
  }

  #row(tagText, tagClass, mainText, subText) {
    const li = document.createElement('li');

    const tag = document.createElement('span');
    tag.className = 'tag ' + tagClass;
    tag.textContent = tagText;

    const main = document.createElement('span');
    main.className = 'main';
    main.textContent = mainText;

    li.append(tag, main);

    if (subText) {
      const sub = document.createElement('span');
      sub.className = 'sub';
      sub.textContent = subText;
      li.append(sub);
    }
    return li;
  }
}

customElements.define('breakage-list', BreakageList);
