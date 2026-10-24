import './breakage-list.js';

const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
const k = `tab-${tab.id}`;

// ---------- Captured list ----------

const list = document.querySelector('breakage-list');

const { [k]: entries = [] } = await chrome.storage.session.get(k);
list.entries = entries;

// Live updates from background.js.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'session' && changes[k]) {
    list.entries = changes[k].newValue || [];
  }
});

// ---------- Block rules ----------

const form = document.getElementById('block-form');
const input = document.getElementById('pattern');
const ruleList = document.getElementById('rule-list');
const ruleError = document.getElementById('rule-error');

// Session rules for this tab only.
async function tabRules() {
  const rules = await chrome.declarativeNetRequest.getSessionRules();
  return rules.filter((r) => r.condition.tabIds?.includes(tab.id));
}

async function showRules() {
  ruleList.replaceChildren();
  for (const rule of await tabRules()) {
    const li = document.createElement('li');

    const code = document.createElement('code');
    code.textContent = rule.condition.urlFilter;

    const remove = document.createElement('button');
    remove.textContent = 'Remove';
    remove.addEventListener('click', async () => {
      await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [rule.id] });
      await chrome.tabs.reload(tab.id);
      showRules();
    });

    li.append(code, remove);
    ruleList.append(li);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault(); // stay in the popup, don't submit the form
  ruleError.hidden = true;

  const pattern = input.value.trim();
  if (!pattern) return;

  // Every rule needs a unique number.
  const all = await chrome.declarativeNetRequest.getSessionRules();
  const id = Math.max(0, ...all.map((r) => r.id)) + 1;

  try {
    await chrome.declarativeNetRequest.updateSessionRules({
      addRules: [{
        id,
        priority: 1,
        action: { type: 'block' },
        condition: { urlFilter: pattern, tabIds: [tab.id] }
      }]
    });
  } catch (err) {
    // Chrome rejects invalid patterns; show why.
    ruleError.textContent = err.message;
    ruleError.hidden = false;
    return;
  }

  input.value = '';
  await chrome.tabs.reload(tab.id);
  showRules();
});

showRules();
