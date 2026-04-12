# crTerm

crTerm is a browser-native terminal experience built directly into Chromium as a trusted WebUI page.
It combines a modern terminal frontend with a real PTY/ConPTY backend, so users can open and use a local shell inside the browser without leaving the Chromium environment.

## What crTerm Does

- Runs a real local shell inside Chromium.
- Supports Linux PTY and Windows ConPTY backends.
- Opens directly from browser UI flows such as `chrome://crterm/` and `chrome://newterm/`.
- Starts in a target directory when a valid path is provided.
- Tracks the current working directory and reflects it in the visible tab URL as `crterm://local/...`.
- Restores previous terminal output on startup when enabled.
- Stores terminal output per tab session under the profile directory.
- Supports in-terminal search with match counting, next/previous navigation, and visual markers.
- Detects `https://` links in terminal output and opens them in a new browser tab.
- Applies profile-based terminal preferences such as shell path, theme, font family, font size, scrollback, and restore behavior.

## Key Innovations

### 1. Browser-Native Terminal, Not an External App

crTerm is implemented as a Chromium WebUI, not as a separate desktop terminal window.
This makes the terminal feel like a first-class browser surface instead of an external tool glued on later.

### 2. Path-Aware Terminal Navigation

crTerm updates the visible URL to match the shell's working directory.
When the shell reports a directory change, the tab can move from one path to another logically, for example:

`crterm://local/home/user/project`

This creates a strong connection between browser navigation and terminal state.

### 3. Session-Oriented Output Persistence

Each terminal tab has its own session log file.
When restore is enabled, crTerm can recover prior output for that tab and continue from a familiar state.
This gives users continuity without requiring a heavyweight terminal multiplexer.

### 4. Terminal Safety Filtering

crTerm filters specific OSC and CSI control sequences before presenting output to the frontend.
This helps keep the browser-hosted terminal stable and reduces dependence on assumptions from desktop terminal emulators.

### 5. Deep Browser Integration

crTerm is integrated with Chromium profile preferences, bookmarks, visible URL updates, tab state, and browser navigation.
This allows Chromium features to understand terminal tabs more naturally than a generic embedded terminal widget would.

## User-Facing Experience

- Open a terminal in the browser.
- Launch directly into Home or `/tmp` through `chrome://newterm/`.
- Search terminal history with `Ctrl+F` / `Cmd+F`.
- Click HTTPS links printed by command output.
- Resume prior output after reopening when restore is enabled.
- Use a customized shell, theme, and typography from Chromium preferences.

## Why crTerm Matters

crTerm turns Chromium into a more capable local workstation shell surface.
It reduces context switching, makes terminal sessions addressable through URLs, and blends terminal workflows into the browser's navigation, tab, and profile model.

In short, crTerm is not just “a terminal in a tab”.
It is a terminal designed to behave like a real browser-native feature.
