# crTerm

crTerm is a new terminal experience built for people who live in the browser.

It brings a real local shell into Chromium, gives terminal sessions the same shape as browser tabs, and keeps the performance profile close to a native application through a C++ backend. It is also designed to be expanded with Chrome extensions, so terminal workflows can grow through the same extension model that already powers the browser.

![crTerm fullscreen terminal UI](gallery/fullscreen.png)

## Why crTerm

Traditional terminals are powerful, but they sit outside the browser workflow. crTerm changes that by making the terminal a first-class browser surface:

- Open terminal sessions in Chromium tabs.
- Move between web pages and shells with the same tab model.
- Use browser navigation, profile settings, address bar state, and session restore concepts.
- Click links from terminal output and continue in the browser.
- Keep project terminals close to the documentation, dashboards, repositories, and tools you already use online.

The result is not a web page pretending to be a terminal. crTerm is a browser-native terminal experience backed by native system integration.

## Key Ideas

### Browser-Style Terminal Experience

crTerm makes terminal sessions feel like part of Chromium instead of a separate application window.

- Launch a terminal from `chrome://crterm/` or `chrome://newterm/`.
- Open a terminal directly in a target directory.
- See the current working directory reflected in the address bar, for example `crterm://local/home/user/project`.
- Search terminal output with `Ctrl+F` or `Cmd+F`.
- Open HTTPS links from terminal output in new browser tabs.
- Restore previous terminal output when restore is enabled.
- Configure terminal preferences through the browser profile.

![crTerm terminal tab](gallery/gallery02.png)

### Native Performance in C++

crTerm is implemented with Chromium-native components and a C++ terminal backend. It connects to the local PTY/ConPTY layer instead of simulating a shell in JavaScript.

That means:

- Real local shell processes.
- Native process and terminal I/O handling.
- Fast startup and responsive input.
- Tight integration with Chromium WebUI, Mojo, preferences, and browser lifecycle.
- A terminal surface that feels browser-native without giving up native execution.

### Extensible with Chrome Extensions

crTerm supports Chrome extensions as a way to extend terminal behavior and browser-terminal workflows.

This makes it possible to build features around the terminal using familiar browser extension patterns, such as:

- Project-specific terminal helpers.
- Workflow automation.
- Developer tools integration.
- Context-aware commands.
- Browser UI that works alongside terminal sessions.

The goal is for crTerm to be more than a fixed terminal application: it should be a terminal platform that can be customized and expanded like the browser itself.

![crTerm terminal search and output](gallery/gallery03.png)

## Common Usage

Open crTerm and use it like a normal terminal:

```bash
pwd
ls
cd ~/dev/my-project
git status
npm test
```

When command output contains an HTTPS link, click it to open the link in Chromium.

When you need to find earlier output, press `Ctrl+F` or `Cmd+F` and search inside the terminal tab.

## Features

- **Browser-native workflow**: terminal sessions live in Chromium tabs.
- **Real shell access**: commands run through the local system shell, backed by PTY/ConPTY integration.
- **C++ native backend**: terminal process handling and browser integration are implemented with native Chromium components.
- **Chrome extension support**: extend terminal workflows through Chrome extensions.
- **Path-aware sessions**: the current directory is visible in the browser address bar.
- **Clickable output links**: HTTPS links in terminal output open directly in the browser.
- **Output restore**: previous terminal output can be restored across sessions.
- **Customizable appearance**: configure shell, theme, font, font size, scrollback, and restore behavior.

## Project Vision

crTerm turns Chromium into a local command-line workspace. It combines the interaction model of the browser, the performance of native C++, and the flexibility of Chrome extensions to create a terminal that feels modern, fast, and deeply integrated with everyday development work.
