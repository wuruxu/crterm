const kStorageKey = 'sessionOutputs';

function render(outputs) {
  const content = document.getElementById('content');
  const entries = Object.entries(outputs || {});
  if (!entries.length) {
    content.className = 'empty';
    content.textContent = 'No terminal output received yet.';
    return;
  }

  content.className = '';
  content.textContent = '';

  for (const [sessionId, text] of entries) {
    const section = document.createElement('section');
    section.className = 'session';

    const title = document.createElement('div');
    title.className = 'session-id';
    title.textContent = `Session: ${sessionId}`;

    const output = document.createElement('pre');
    output.textContent = text || '(empty)';

    section.appendChild(title);
    section.appendChild(output);
    content.appendChild(section);
  }
}

async function loadOutputs() {
  const stored = await chrome.storage.local.get(kStorageKey);
  render(stored[kStorageKey] || {});
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes[kStorageKey]) {
    return;
  }
  render(changes[kStorageKey].newValue || {});
});

void loadOutputs();
