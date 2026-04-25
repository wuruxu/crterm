const kStorageKey = 'sessionOutputs';
const kMaxCharsPerSession = 8000;

const decoders = new Map();
let sessionOutputs = {};
const initialStatePromise = chrome.storage.local.get(kStorageKey).then(
    (stored) => {
      sessionOutputs = stored[kStorageKey] || {};
    });

function getDecoder(sessionId) {
  let decoder = decoders.get(sessionId);
  if (!decoder) {
    decoder = new TextDecoder();
    decoders.set(sessionId, decoder);
  }
  return decoder;
}

function stripAnsi(text) {
  return text
      .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
      .replace(/\r/g, '');
}

function trimOutput(text) {
  if (text.length <= kMaxCharsPerSession) {
    return text;
  }
  return text.slice(-kMaxCharsPerSession);
}

async function persistOutputs() {
  await chrome.storage.local.set({[kStorageKey]: sessionOutputs});
}

chrome.runtime.onInstalled.addListener(async () => {
  await initialStatePromise;
  await persistOutputs();
});

chrome.crterm.onTermOutput.addListener(async (sessionId, data) => {
  await initialStatePromise;
  const decoder = getDecoder(sessionId);
  const chunk = stripAnsi(decoder.decode(data, {stream: true}));
  if (!chunk) {
    return;
  }

  const previous = sessionOutputs[sessionId] || '';
  sessionOutputs = {
    ...sessionOutputs,
    [sessionId]: trimOutput(previous + chunk),
  };

  console.log(`[crterm:${sessionId}]`, chunk);
  await persistOutputs();
});
