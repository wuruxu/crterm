This sample MV3 extension listens to `chrome.crterm.onTermOutput`.

How it works:
- `background.js` receives terminal output, strips common ANSI sequences, and stores the latest text per session in `chrome.storage.local`.
- `popup.html` and `popup.js` render the most recent output grouped by CrTerm session ID.

Load this directory as an unpacked extension on a desktop build that includes the `crterm` extension API.
