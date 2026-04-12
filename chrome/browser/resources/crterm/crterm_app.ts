import '/strings.m.js';

import {loadTimeData} from 'chrome://resources/js/load_time_data.js';
import {CrLitElement, type PropertyValues} from 'chrome://resources/lit/v3_0/lit.rollup.js';

import {getCss} from './crterm_app.css.js';
import {getHtml} from './crterm_app.html.js';

import type {CrTermProxy} from './crterm_api_proxy.js';
import {CrTermProxyImpl} from './crterm_api_proxy.js';

declare var Terminal: any;

const LOG_CRTERM_TRAFFIC = true;
const TERMINAL_RESIZE_DEBOUNCE_MS = 120;
const HTTPS_LINK_PATTERN = /https:\/\/[^\s<>"'`]+/g;
const TERMINAL_TITLE_PATTERN = /([a-z_][a-z0-9_-]*@[a-z0-9._-]+)/i;

export interface CrTermAppElement {
  $: {
    footer: HTMLElement,
  };
  searchInput: HTMLInputElement,
}

export class CrTermAppElement extends CrLitElement {
  private static readonly SEARCH_INPUT_ID = 'searchInput';
  private static readonly XTERM_STYLESHEET_ID = 'xtermStylesheet';
  private term_: any = null;
  private resizeObserver_: ResizeObserver|null = null;
  private resizeTimeoutId_: number|null = null;
  private outputDecoder_: TextDecoder = new TextDecoder();
  private pendingOscSequence_: string = '';
  private pendingBackendCols_: number|null = null;
  private pendingBackendRows_: number|null = null;
  private keydownListener_: ((event: KeyboardEvent) => void)|null = null;
  private searchMatches_: Array<{row: number, column: number}> = [];
  private searchRenderListener_: {dispose(): void}|null = null;
  private searchScrollListener_: {dispose(): void}|null = null;
  private searchResizeListener_: {dispose(): void}|null = null;
  private restoredOutputLoaded_: boolean = false;
  private terminalSettings_: {
    termTheme: string,
    fontFamily: string,
    fontSize: number,
    scrollback: number,
    restoreTerminalOutputOnStartup: boolean,
  }|null = null;
  static get is() {
    return 'crterm-app';
  }

  static override get styles() {
    return getCss();
  }

  override render() {
    return getHtml.bind(this)();
  }

  static override get properties() {
    return {
      root_: {type: String},
      searchVisible_: {type: Boolean},
      searchQuery_: {type: String},
      searchHighlightStyles_: {type: Array},
      searchMarkerStyles_: {type: Array},
    };
  }

  private crtermProxy_: CrTermProxy = CrTermProxyImpl.getInstance();
  private listenerIds_: number[] = [];
  protected accessor root_: string = "";
  protected accessor searchVisible_: boolean = false;
  protected accessor searchQuery_: string = '';
  protected searchMatchIndex_: number = -1;
  protected accessor searchHighlightStyles_: string[] = [];
  protected accessor searchMarkerStyles_: string[] = [];

  constructor() {
    super();
  }

  private getConfiguredScrollback_(): number {
    if (this.terminalSettings_) {
      return this.terminalSettings_.scrollback > 0 ?
          this.terminalSettings_.scrollback :
          10240;
    }
    const configuredScrollback = loadTimeData.getInteger('scrollback');
    return configuredScrollback > 0 ? configuredScrollback : 10240;
  }

  private getConfiguredFontFamily_(): string {
    if (this.terminalSettings_) {
      const configuredFontFamily = this.terminalSettings_.fontFamily.trim();
      return configuredFontFamily || 'monospace';
    }
    const configuredFontFamily = loadTimeData.getString('fontFamily').trim();
    return configuredFontFamily || 'monospace';
  }

  private getConfiguredFontSize_(): number {
    if (this.terminalSettings_) {
      return Math.min(
          36, Math.max(6, this.terminalSettings_.fontSize || 14));
    }
    const configuredFontSize = loadTimeData.getInteger('fontSize');
    return Math.min(36, Math.max(6, configuredFontSize || 14));
  }

  private shouldRestoreTerminalOutputOnStartup_(): boolean {
    if (this.terminalSettings_) {
      return this.terminalSettings_.restoreTerminalOutputOnStartup;
    }
    return loadTimeData.getBoolean('restoreTerminalOutputOnStartup');
  }

  private getDefaultTheme_(): {[key: string]: string} {
    return {
      background: '#111111',
      selectionBackground: 'rgba(33, 84, 160, 0.96)',
      selectionInactiveBackground: 'rgba(33, 84, 160, 0.96)',
      selectionForeground: '#f7f9fc',
    };
  }

  private normalizeThemeKey_(key: string): string {
    const trimmed = key.trim().replace(/^--/, '');
    return trimmed.replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase());
  }

  private getConfiguredTheme_(): {[key: string]: string} {
    const configuredTheme = this.terminalSettings_ ?
        this.terminalSettings_.termTheme.trim() :
        loadTimeData.getString('termTheme').trim();
    if (!configuredTheme) {
      return this.getDefaultTheme_();
    }

    const parsedTheme: {[key: string]: string} = {};
    const bodyMatch = configuredTheme.match(/\{([\s\S]*)\}/);
    const themeBody: string = bodyMatch?.[1] ?? configuredTheme;
    for (const declaration of themeBody.split(';')) {
      const separator = declaration.indexOf(':');
      if (separator === -1) {
        continue;
      }
      const key = this.normalizeThemeKey_(declaration.slice(0, separator));
      const value = declaration.slice(separator + 1).trim();
      if (!key || !value) {
        continue;
      }
      parsedTheme[key] = value;
    }

    return {
      ...this.getDefaultTheme_(),
      ...parsedTheme,
    };
  }

  private async loadTerminalSettings_() {
    try {
      const {settings} = await this.crtermProxy_.getTerminalSettings();
      this.terminalSettings_ = settings;
    } catch (error) {
      console.error('[crterm] failed to load terminal settings', error);
    }
  }

  private ensureXtermStyles_() {
    if (!this.shadowRoot ||
        this.shadowRoot.getElementById(CrTermAppElement.XTERM_STYLESHEET_ID)) {
      return;
    }

    const stylesheet = document.createElement('link');
    stylesheet.id = CrTermAppElement.XTERM_STYLESHEET_ID;
    stylesheet.rel = 'stylesheet';
    stylesheet.href = 'crterm_xterm.css';
    this.shadowRoot.prepend(stylesheet);
  }

  private registerTerminalLinkProvider_() {
    if (!this.term_?.registerLinkProvider) {
      return;
    }

    this.term_.registerLinkProvider({
      provideLinks: (bufferLineNumber: number, callback: (links: any[]) => void) => {
        callback(this.getLinksForBufferLine_(bufferLineNumber));
      },
    });
  }

  private getLinksForBufferLine_(bufferLineNumber: number): any[] {
    const line = this.term_?.buffer?.active?.getLine?.(bufferLineNumber - 1);
    const text = line?.translateToString(true) || '';
    if (!text) {
      return [];
    }

    const links = [];
    for (const match of text.matchAll(HTTPS_LINK_PATTERN)) {
      const url = this.trimLinkSuffix_(match[0] || '');
      if (!url) {
        continue;
      }

      const startIndex = match.index ?? -1;
      if (startIndex < 0) {
        continue;
      }

      const endIndex = startIndex + url.length;
      links.push({
        text: url,
        range: {
          start: {x: startIndex + 1, y: bufferLineNumber},
          end: {x: endIndex, y: bufferLineNumber},
        },
        activate: () => this.openTerminalLink_(url),
      });
    }

    return links;
  }

  private trimLinkSuffix_(url: string): string {
    return url.replace(/[),.;!?]+$/g, '');
  }

  private openTerminalLink_(url: string) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') {
        return;
      }
    } catch {
      return;
    }

    const newTab = window.open(url, '_blank', 'noopener,noreferrer');
    if (newTab) {
      newTab.opener = null;
    }
  }

  override updated(changedProperties: PropertyValues<this>) {
    super.updated(changedProperties);

    if (!this.searchVisible_) {
      return;
    }

    const searchInput =
        this.shadowRoot?.getElementById(CrTermAppElement.SEARCH_INPUT_ID) as
        HTMLInputElement | null;
    if (searchInput && this.shadowRoot?.activeElement !== searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  }

  private stripOscSequences_(text: string): string {
    let combined = this.pendingOscSequence_ + text;
    this.pendingOscSequence_ = '';

    let sanitized = '';
    let index = 0;
    while (index < combined.length) {
      if (combined[index] !== '\x1b' || index + 1 >= combined.length ||
          combined[index + 1] !== ']') {
        sanitized += combined[index++];
        continue;
      }

      const oscStart = index;
      index += 2;

      let terminated = false;
      while (index < combined.length) {
        if (combined[index] === '\x07') {
          const oscPayload = combined.slice(oscStart + 2, index);
          this.handleOscSequence_(oscPayload);
          index++;
          terminated = true;
          break;
        }

        if (combined[index] === '\x1b' && index + 1 < combined.length &&
            combined[index + 1] === '\\') {
          const oscPayload = combined.slice(oscStart + 2, index);
          this.handleOscSequence_(oscPayload);
          index += 2;
          terminated = true;
          break;
        }

        index++;
      }

      if (!terminated) {
        this.pendingOscSequence_ = combined.slice(oscStart);
        break;
      }
    }

    return sanitized;
  }

  private handleOscSequence_(payload: string) {
    const separator = payload.indexOf(';');
    if (separator === -1) {
      return;
    }

    const command = payload.slice(0, separator);
    const value = payload.slice(separator + 1);
    if (command === '0' || command === '2') {
      document.title = this.formatDocumentTitle_(value);
    }
  }

  private formatDocumentTitle_(value: string): string {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return 'CrTerm';
    }

    const userAndHost = trimmedValue.match(/^([^:\s]+@[^:\s]+)(?::.*)?$/);
    if (userAndHost?.[1]) {
      return userAndHost[1];
    }

    return trimmedValue;
  }

  private updateTitleFromTerminalOutput_(text: string) {
    const plainText = text
                          .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
                          .replace(/[\x00-\x1f\x7f]/g, ' ');
    const match = plainText.match(TERMINAL_TITLE_PATTERN);
    if (!match?.[1]) {
      return;
    }

    document.title = match[1];
  }

  private flushTerminalResize_() {
    if (this.pendingBackendCols_ === null || this.pendingBackendRows_ === null) {
      return;
    }

    this.crtermProxy_.onTerminalResize(
        this.pendingBackendCols_, this.pendingBackendRows_);
    this.pendingBackendCols_ = null;
    this.pendingBackendRows_ = null;
  }

  private scheduleBackendResize_(cols: number, rows: number) {
    this.pendingBackendCols_ = cols;
    this.pendingBackendRows_ = rows;

    if (this.resizeTimeoutId_ !== null) {
      window.clearTimeout(this.resizeTimeoutId_);
    }

    this.resizeTimeoutId_ = window.setTimeout(() => {
      this.resizeTimeoutId_ = null;
      this.flushTerminalResize_();
    }, TERMINAL_RESIZE_DEBOUNCE_MS);
  }

  private fitTerminal_() {
    const terminal = this.shadowRoot?.getElementById('terminal');
    if (!terminal || !this.term_?.element) {
      return;
    }

    const dimensions = this.term_._core?._renderService?.dimensions?.css;
    const cellWidth = dimensions?.cell?.width;
    const cellHeight = dimensions?.cell?.height;
    if (!cellWidth || !cellHeight) {
      return;
    }

    const cols = Math.max(2, Math.floor(terminal.clientWidth / cellWidth));
    const rows = Math.max(2, Math.floor(terminal.clientHeight / cellHeight));
    if (cols === this.term_.cols && rows === this.term_.rows) {
      return;
    }

    this.term_.resize(cols, rows);
    this.scheduleBackendResize_(cols, rows);
  }

  override async firstUpdated() {
    const terminal = this.shadowRoot?.getElementById('terminal');
    if (!terminal || typeof Terminal === 'undefined') {
      return;
    }

    this.ensureXtermStyles_();
    await this.loadTerminalSettings_();

    this.term_ = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontFamily: this.getConfiguredFontFamily_(),
      fontSize: this.getConfiguredFontSize_(),
      scrollback: this.getConfiguredScrollback_(),
      theme: this.getConfiguredTheme_(),
    });
    this.registerTerminalLinkProvider_();
    this.term_.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      if (this.handleSearchShortcut_(event)) {
        return false;
      }
      return true;
    });
    this.term_.open(terminal);
    this.term_.focus();
    requestAnimationFrame(() => {
      void this.initializeTerminalSession_();
    });
    this.searchRenderListener_ =
        this.term_.onRender(() => this.updateSearchHighlightOverlay_());
    this.searchScrollListener_ =
        this.term_.onScroll(() => this.updateSearchHighlightOverlay_());
    this.searchResizeListener_ =
        this.term_.onResize(() => this.updateSearchHighlightOverlay_());
    this.resizeObserver_ = new ResizeObserver(() => this.fitTerminal_());
    this.resizeObserver_.observe(terminal);
    //this.term_.write('Hello from \\x1B[1;3;31mxterm.js\\x1B[0m\\r\\n$ ');
    this.term_.onData((input: string) => this.onUserInput_(input));
    this.keydownListener_ = (event: KeyboardEvent) => this.onKeyDown_(event);
    document.addEventListener('keydown', this.keydownListener_, true);
  }

  override connectedCallback() {
    super.connectedCallback();
    const callbackRouter = this.crtermProxy_.getCallbackRouter();
    this.listenerIds_.push(
        callbackRouter.onTermOutput.addListener((output: number[]) => {
          if (LOG_CRTERM_TRAFFIC) {
            console.log('[crterm] webui onTermOutput bytes=', output);
          }
          this.handleTerminalOutput_(output, true);
        }),
    );
  }

  override disconnectedCallback() {
    this.resizeObserver_?.disconnect();
    this.resizeObserver_ = null;
    if (this.resizeTimeoutId_ !== null) {
      window.clearTimeout(this.resizeTimeoutId_);
      this.resizeTimeoutId_ = null;
    }
    this.pendingBackendCols_ = null;
    this.pendingBackendRows_ = null;
    if (this.keydownListener_) {
      document.removeEventListener('keydown', this.keydownListener_, true);
      this.keydownListener_ = null;
    }
    this.searchRenderListener_?.dispose();
    this.searchRenderListener_ = null;
    this.searchScrollListener_?.dispose();
    this.searchScrollListener_ = null;
    this.searchResizeListener_?.dispose();
    this.searchResizeListener_ = null;
    this.outputDecoder_ = new TextDecoder();
    this.pendingOscSequence_ = '';
    this.restoredOutputLoaded_ = false;
    if (this.term_) {
      this.term_.dispose();
      this.term_ = null;
    }
    super.disconnectedCallback();
  }

  protected onUserInput_(input: string) {
    if (LOG_CRTERM_TRAFFIC) {
      console.log('[crterm] webui onUserInput=', JSON.stringify(input));
    }
    this.crtermProxy_.onUserInput(input);
  }

  private async loadStoredTerminalOutput_() {
    if (!this.shouldRestoreTerminalOutputOnStartup_() ||
        this.restoredOutputLoaded_ || !this.term_) {
      return;
    }

    this.restoredOutputLoaded_ = true;
    try {
      const {output} = await this.crtermProxy_.getStoredTerminalOutput();
      if (!output.length) {
        return;
      }

      if (LOG_CRTERM_TRAFFIC) {
        console.log('[crterm] webui restored bytes=', output.length);
      }
      this.handleTerminalOutput_(output, false);
      this.writeRestoreBanner_();
    } catch (error) {
      console.error('[crterm] failed to load stored terminal output', error);
    }
  }

  private async initializeTerminalSession_() {
    await this.loadStoredTerminalOutput_();
    this.fitTerminal_();
    this.term_?.focus();
  }

  private handleTerminalOutput_(output: number[], stream: boolean) {
    if (!this.term_) {
      return;
    }

    const decodedOutput =
        this.outputDecoder_.decode(new Uint8Array(output), {stream});
    if (LOG_CRTERM_TRAFFIC) {
      console.log('[crterm] webui decoded=', JSON.stringify(decodedOutput));
    }
    const sanitizedOutput = this.stripOscSequences_(decodedOutput);
    if (LOG_CRTERM_TRAFFIC && sanitizedOutput !== decodedOutput) {
      console.log('[crterm] **webui sanitized=', JSON.stringify(sanitizedOutput));
    }
    if (!sanitizedOutput) {
      return;
    }

    this.updateTitleFromTerminalOutput_(sanitizedOutput);
    this.term_.write(sanitizedOutput);
  }

  private writeRestoreBanner_() {
    if (!this.term_) {
      return;
    }

    const text = ' restore from session ';
    const cols = Math.max(this.term_.cols || 0, text.length);
    const leftPadding = Math.max(0, Math.floor((cols - text.length) / 2));
    const rightPadding = Math.max(0, cols - leftPadding - text.length);
    const line =
        ' '.repeat(leftPadding) + text + ' '.repeat(rightPadding);
    this.term_.write(`\r\n\x1b[97;100m${line}\x1b[0m\r\n`);
  }

  protected onSearchInput_(event: Event) {
    this.searchQuery_ = (event.target as HTMLInputElement).value;
    this.updateSearchMatches_();
  }

  protected onSearchKeyDown_(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (event.shiftKey) {
        this.findPrevious_();
      } else {
        this.findNext_();
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeSearch_();
    }
  }

  protected findNext_() {
    this.jumpToSearchMatch_(1);
  }

  protected findPrevious_() {
    this.jumpToSearchMatch_(-1);
  }

  protected closeSearch_() {
    this.searchVisible_ = false;
    this.searchQuery_ = '';
    this.searchMatches_ = [];
    this.searchMatchIndex_ = -1;
    this.searchHighlightStyles_ = [];
    this.searchMarkerStyles_ = [];
    this.term_?.focus();
  }

  protected getSearchCountLabel_(): string {
    if (!this.searchQuery_) {
      return '0';
    }

    if (!this.searchMatches_.length) {
      return '0/0';
    }

    return `${this.searchMatchIndex_ + 1}/${this.searchMatches_.length}`;
  }

  private onKeyDown_(event: KeyboardEvent) {
    if (this.handleSearchShortcut_(event)) {
      return;
    }

    if (event.key === 'Escape' && this.searchVisible_) {
      event.preventDefault();
      this.closeSearch_();
    }
  }

  private handleSearchShortcut_(event: KeyboardEvent): boolean {
    if (event.type !== 'keydown') {
      return false;
    }

    if (event.key.toLowerCase() !== 'f' || (!event.ctrlKey && !event.metaKey)) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();
    this.searchVisible_ = true;
    return true;
  }

  private updateSearchMatches_() {
    this.searchMatches_ = [];
    this.searchMatchIndex_ = -1;
    this.searchHighlightStyles_ = [];
    this.searchMarkerStyles_ = [];

    const query = this.searchQuery_.trim().toLowerCase();
    if (!query || !this.term_?.buffer?.active) {
      return;
    }

    const buffer = this.term_.buffer.active;
    for (let row = 0; row < buffer.length; row++) {
      const line = buffer.getLine(row);
      const text = line?.translateToString(true) || '';
      let fromIndex = 0;
      while (fromIndex <= text.length) {
        const matchIndex = text.toLowerCase().indexOf(query, fromIndex);
        if (matchIndex === -1) {
          break;
        }

        this.searchMatches_.push({row, column: matchIndex});
        fromIndex = matchIndex + Math.max(query.length, 1);
      }
    }

    if (this.searchMatches_.length) {
      this.searchMatchIndex_ = 0;
      this.revealSearchMatch_();
    }
  }

  private jumpToSearchMatch_(direction: number) {
    if (!this.searchMatches_.length) {
      return;
    }

    const total = this.searchMatches_.length;
    this.searchMatchIndex_ =
        (this.searchMatchIndex_ + direction + total) % total;
    this.revealSearchMatch_();
  }

  private revealSearchMatch_() {
    if (this.searchMatchIndex_ < 0 || this.searchMatchIndex_ >= this.searchMatches_.length ||
        !this.term_) {
      return;
    }

    const match = this.searchMatches_[this.searchMatchIndex_];
    if (!match) {
      return;
    }

    this.term_.scrollToLine(match.row);
    requestAnimationFrame(() => this.updateSearchHighlightOverlay_());
  }

  private updateSearchHighlightOverlay_() {
    if (!this.searchVisible_ || this.searchMatchIndex_ < 0 || !this.term_) {
      this.searchHighlightStyles_ = [];
      this.searchMarkerStyles_ = [];
      return;
    }

    const terminal = this.shadowRoot?.getElementById('terminal');
    const dimensions = this.term_._core?._renderService?.dimensions?.css;
    const cellWidth = dimensions?.cell?.width;
    const cellHeight = dimensions?.cell?.height;
    const viewportY = this.term_.buffer?.active?.viewportY ?? 0;
    if (!terminal || !cellWidth || !cellHeight) {
      this.searchHighlightStyles_ = [];
      this.searchMarkerStyles_ = [];
      return;
    }

    const queryWidth = Math.max(this.searchQuery_.length * cellWidth, 4);
    this.searchHighlightStyles_ = this.searchMatches_.map(match => {
      const visibleRow = match.row - viewportY;
      if (visibleRow < 0 || visibleRow >= this.term_.rows) {
        return '';
      }

      const left = match.column * cellWidth;
      const top = visibleRow * cellHeight;
      return `left:${left}px;top:${top}px;width:${queryWidth}px;height:${cellHeight}px;`;
    });

    const terminalHeight = terminal.clientHeight;
    const bufferLength = Math.max(this.term_.buffer?.active?.length ?? 0, 1);
    this.searchMarkerStyles_ = this.searchMatches_.map(match => {
      const topRatio = match.row / bufferLength;
      const top = Math.max(0, Math.min(terminalHeight - 2, topRatio * terminalHeight));
      return `top:${top}px;height:2px;`;
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'crterm-app': CrTermAppElement;
  }
}

customElements.define(
    CrTermAppElement.is, CrTermAppElement);
