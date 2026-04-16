# crTerm

<p>
  <a href="#中文">中文</a> |
  <a href="#english">English</a>
</p>

<details open>
<summary id="中文"><strong>中文</strong></summary>

crTerm 是一个把终端直接放进 Chromium 里的浏览器终端。

你可以像打开普通网页一样打开一个本地 Shell，在浏览器标签页里运行命令、进入项目目录、查看输出、点击链接，并继续使用 Chromium 的标签页、地址栏和个人配置。

![crTerm 全屏终端界面](gallery/fullscreen.png)

## 它适合谁

如果你经常在浏览器和终端之间来回切换，crTerm 可以让这两件事靠得更近：

- 开发者可以在浏览器里直接进入项目目录，运行构建、测试、脚本和 Git 命令。
- 日常 Linux 用户可以把常用命令行操作放在浏览器标签页中完成。
- 喜欢浏览器工作流的人可以用标签页管理终端会话，而不是再单独打开一个终端窗口。

## 你可以用它做什么

- 在 Chromium 里打开真实的本地 Shell。
- 通过 `chrome://crterm/` 或 `chrome://newterm/` 启动终端。
- 在指定目录中打开终端，比如直接进入某个项目文件夹。
- 终端目录变化后，地址栏会跟着显示对应路径，例如 `crterm://local/home/user/project`。
- 使用 `Ctrl+F` 或 `Cmd+F` 搜索终端输出。
- 点击终端输出里的 `https://` 链接，并在新标签页中打开。
- 按个人习惯设置 Shell、主题、字体、字号、滚动历史和恢复行为。
- 开启恢复后，重新打开时可以看到之前的终端输出。

![crTerm 终端标签页](gallery/gallery02.png)

## 为什么它不只是“网页里的终端”

crTerm 使用 Chromium 的 WebUI 构建，不是简单嵌入一个外部终端窗口。

这意味着它更像浏览器自己的功能：

- 终端运行在浏览器标签页中，可以和普通网页一样切换、管理和恢复。
- 当前工作目录会映射到可见 URL，让终端状态更清楚。
- 终端偏好会跟随 Chromium 用户配置保存。
- 每个终端标签页都可以拥有自己的输出记录。
- 浏览器可以更自然地理解这个标签页是一个本地终端，而不是一个普通网页。

![crTerm 终端搜索和输出展示](gallery/gallery03.png)

## 常见使用方式

打开 crTerm 后，你可以直接像平时使用终端一样输入命令：

```bash
pwd
ls
cd ~/dev/my-project
git status
npm test
```

如果命令输出里包含 HTTPS 链接，可以直接点击打开。

如果需要查找之前的输出，按 `Ctrl+F` 或 `Cmd+F` 搜索关键字。

## 主要特性

- **浏览器原生体验**：终端就在 Chromium 标签页里，不需要离开浏览器。
- **真实本地 Shell**：不是模拟命令行，而是连接到本机 PTY/ConPTY 后端。
- **路径感知**：终端所在目录会反映在地址栏中，方便识别当前会话位置。
- **输出恢复**：可在重新打开时恢复之前的终端输出，减少上下文丢失。
- **链接识别**：终端里的 HTTPS 链接可以直接在浏览器中打开。
- **可定制外观**：支持主题、字体、字号、滚动历史等终端偏好设置。

## 一句话总结

crTerm 让 Chromium 不只是浏览网页，也可以成为一个更贴近日常开发和命令行工作的本地工作台。

</details>

<details>
<summary id="english"><strong>English</strong></summary>

crTerm is a browser terminal built directly into Chromium.

It lets you open a real local shell like a normal browser page. You can run commands, move into project folders, read output, open links, and keep using Chromium tabs, the address bar, and your profile settings.

![crTerm fullscreen terminal UI](gallery/fullscreen.png)

## Who It Is For

If you often switch between your browser and terminal, crTerm brings both workflows closer together:

- Developers can open a terminal in the browser, jump into a project directory, and run builds, tests, scripts, and Git commands.
- Linux users can handle everyday command-line work inside browser tabs.
- Browser-first users can manage terminal sessions with tabs instead of opening a separate terminal window.

## What You Can Do

- Open a real local shell inside Chromium.
- Start a terminal from `chrome://crterm/` or `chrome://newterm/`.
- Open a terminal in a target directory, such as a project folder.
- See the current terminal directory reflected in the address bar, for example `crterm://local/home/user/project`.
- Search terminal output with `Ctrl+F` or `Cmd+F`.
- Click `https://` links in terminal output and open them in a new browser tab.
- Customize the shell, theme, font, font size, scrollback, and restore behavior.
- Restore previous terminal output when the restore option is enabled.

![crTerm terminal tab](gallery/gallery02.png)

## More Than a Terminal in a Web Page

crTerm is built as a Chromium WebUI, not as an external terminal window embedded into the browser.

That makes it feel like a native browser feature:

- The terminal runs inside a Chromium tab and can be switched, managed, and restored like a normal page.
- The current working directory maps to a visible URL, so the session state is easier to understand.
- Terminal preferences are saved with the Chromium profile.
- Each terminal tab can keep its own output history.
- Chromium can treat the tab as a local terminal surface instead of a generic web page.

![crTerm terminal search and output](gallery/gallery03.png)

## Common Usage

After opening crTerm, use it like a normal terminal:

```bash
pwd
ls
cd ~/dev/my-project
git status
npm test
```

If command output contains an HTTPS link, you can click it directly.

If you need to find previous output, press `Ctrl+F` or `Cmd+F` and search for a keyword.

## Key Features

- **Browser-native experience**: the terminal lives in a Chromium tab, so you do not need to leave the browser.
- **Real local shell**: it connects to a local PTY/ConPTY backend instead of simulating a command line.
- **Path-aware sessions**: the current directory appears in the address bar, making each session easier to identify.
- **Output restore**: previous terminal output can be restored, reducing lost context.
- **Clickable links**: HTTPS links printed in the terminal can be opened directly in the browser.
- **Customizable appearance**: themes, fonts, font size, scrollback, and other terminal preferences can be adjusted.

## In One Sentence

crTerm turns Chromium into a local workspace for both browsing and command-line work.

</details>
