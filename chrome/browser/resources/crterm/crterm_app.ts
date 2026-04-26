import '/strings.m.js';

import 'chrome://resources/cr_elements/cr_button/cr_button.js';
import 'chrome://resources/cr_elements/cr_dialog/cr_dialog.js';
import 'chrome://resources/cr_elements/cr_icon_button/cr_icon_button.js';
import 'chrome://resources/cr_elements/icons.html.js';

import {loadTimeData} from 'chrome://resources/js/load_time_data.js';
import {CrLitElement, type PropertyValues} from 'chrome://resources/lit/v3_0/lit.rollup.js';

import {getCss} from './crterm_app.css.js';
import {getHtml} from './crterm_app.html.js';

import type {CrTermProxy} from './crterm_api_proxy.js';
import {CrTermProxyImpl} from './crterm_api_proxy.js';

declare var Terminal: any;
declare var WebglAddon: {WebglAddon: new (preserveDrawingBuffer?: boolean) => any};

const LOG_CRTERM_TRAFFIC = false;
const TERMINAL_RESIZE_DEBOUNCE_MS = 120;
const SEARCH_REFRESH_DEBOUNCE_MS = 120;
const HTTPS_LINK_PATTERN = /https:\/\/[^\s<>"'`]+/g;
const TERMINAL_TITLE_PATTERN = /([a-z_][a-z0-9_-]*@[a-z0-9._-]+)/i;

export interface CrTermAppElement {
  $: {
    capturePreviewStage: HTMLElement,
    footer: HTMLElement,
  };
  searchInput: HTMLInputElement,
}

declare global {
  interface Window {
    __crtermCaptureScreenFromContextMenu?: () => void;
  }
}

export class CrTermAppElement extends CrLitElement {
  private static readonly SEARCH_INPUT_ID = 'searchInput';
  private static readonly XTERM_STYLESHEET_ID = 'xtermStylesheet';
  private term_: any = null;
  private resizeObserver_: ResizeObserver|null = null;
  private resizeTimeoutId_: number|null = null;
  private searchRefreshTimeoutId_: number|null = null;
  private outputDecoder_: TextDecoder = new TextDecoder();
  private pendingOscSequence_: string = '';
  private pendingBackendCols_: number|null = null;
  private pendingBackendRows_: number|null = null;
  private keydownListener_: ((event: KeyboardEvent) => void)|null = null;
  private searchMatches_: Array<{row: number, column: number}> = [];
  private lastSearchScanBaseY_: number = 0;
  private lastSearchScanBufferLength_: number = 0;
  private searchRenderListener_: {dispose(): void}|null = null;
  private searchScrollListener_: {dispose(): void}|null = null;
  private searchResizeListener_: {dispose(): void}|null = null;
  private restoredOutputLoaded_: boolean = false;
  private lastPersistedTitle_: string = '';
  private terminalSettings_: {
    termTheme: string,
    fontFamily: string,
    fontSize: number,
    scrollback: number,
    restoreTerminalOutputOnStartup: boolean,
    enableWebgl: boolean,
  }|null = null;
  private captureCanvas_: HTMLCanvasElement|null = null;
  private captureSelectionActive_: boolean = false;
  private captureSelectionStart_: {x: number, y: number}|null = null;
  private captureSelectionRect_: {x: number, y: number, width: number, height: number}|null = null;
  private captureSelectionDragMode_: 'create'|'move'|null = null;
  private captureSelectionDragOffset_: {x: number, y: number}|null = null;
  private webglAddon_: {dispose(): void}|null = null;
  private webglRendererAttempted_: boolean = false;
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
      captureSelectionVisible_: {type: Boolean},
      capturePreviewDataUrl_: {type: String},
      captureSelectionStyle_: {type: String},
      captureHasSelection_: {type: Boolean},
      root_: {type: String},
      searchVisible_: {type: Boolean},
      searchQuery_: {type: String},
      searchHighlightStyles_: {type: Array},
      searchMarkerStyles_: {type: Array},
    };
  }

  private crtermProxy_: CrTermProxy = CrTermProxyImpl.getInstance();
  private listenerIds_: number[] = [];
  protected accessor captureSelectionVisible_: boolean = false;
  protected accessor capturePreviewDataUrl_: string = '';
  protected accessor captureSelectionStyle_: string = '';
  protected accessor captureHasSelection_: boolean = false;
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
      this.terminalSettings_ = {
        termTheme: settings.termTheme,
        fontFamily: settings.fontFamily,
        fontSize: settings.fontSize,
        scrollback: settings.scrollback,
        restoreTerminalOutputOnStartup: settings.restoreTerminalOutputOnStartup,
        enableWebgl: (settings as any).enableWebgl ?? true,
      };
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
      this.setDocumentTitle_(this.formatDocumentTitle_(value));
    }
  }

  private setDocumentTitle_(title: string) {
    document.title = title;
    if (title === this.lastPersistedTitle_) {
      return;
    }
    this.lastPersistedTitle_ = title;
    this.crtermProxy_.setPageTitle(title);
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

    this.setDocumentTitle_(match[1]);
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

  private logWebglState_(message: string, details: object = {}) {
    console.log(`[crterm] ${message} ${JSON.stringify(details)}`);
  }

  private probeWebgl2Support_(): boolean {
    const hasAddon = typeof WebglAddon !== 'undefined';
    const hasWebgl2Constructor = typeof WebGL2RenderingContext !== 'undefined';
    const canvas = document.createElement('canvas');

    let gl: WebGL2RenderingContext|null = null;
    let contextError = '';
    try {
      gl = canvas.getContext('webgl2');
    } catch (error) {
      contextError = String(error);
    }

    let vendor = '';
    let renderer = '';
    if (gl) {
      const debugInfo =
          gl.getExtension('WEBGL_debug_renderer_info') as {
            UNMASKED_VENDOR_WEBGL: number,
            UNMASKED_RENDERER_WEBGL: number,
          } | null;
      if (debugInfo) {
        vendor = String(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '');
        renderer =
            String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '');
      }
    }

    const supported = hasAddon && hasWebgl2Constructor && !!gl;
    this.logWebglState_('xterm WebGL2 probe', {
      hasAddon,
      hasWebgl2Constructor,
      contextCreated: !!gl,
      supported,
      vendor,
      renderer,
      contextError,
    });
    return supported;
  }

  private patchWebglRendererForShadowDom_(webglAddon: any) {
    const renderer = webglAddon?._renderer;
    const screenElement = renderer?._core?.screenElement as HTMLElement | undefined;
    if (!renderer || !screenElement || typeof renderer.renderRows !== 'function') {
      return;
    }

    renderer._isAttached = !!screenElement.isConnected;
    const originalRenderRows = renderer.renderRows.bind(renderer);
    renderer.renderRows = (...args: unknown[]) => {
      if (!renderer._isAttached &&
          screenElement.isConnected &&
          renderer._charSizeService?.width &&
          renderer._charSizeService?.height) {
        renderer._isAttached = true;
      }
      return originalRenderRows(...args);
    };

    this.logWebglState_('xterm WebGL2 shadow-dom patch applied', {
      isConnected: screenElement.isConnected,
      hasRenderRows: true,
    });
  }

  private isWebglEnabled_(): boolean {
    if (this.terminalSettings_ !== null) {
      return this.terminalSettings_.enableWebgl;
    }
    return loadTimeData.getBoolean('enableWebgl');
  }

  private maybeEnableWebglRenderer_(terminal: HTMLElement) {
    if (!this.term_ || this.webglRendererAttempted_ || this.webglAddon_) {
      return;
    }

    if (!this.isWebglEnabled_()) {
      this.webglRendererAttempted_ = true;
      console.log('[crterm] xterm WebGL2 renderer disabled by settings');
      return;
    }

    const width = terminal.clientWidth;
    const height = terminal.clientHeight;
    if (width <= 0 || height <= 0) {
      this.logWebglState_('xterm WebGL2 waiting for terminal size', {
        width,
        height,
      });
      return;
    }

    if (!this.probeWebgl2Support_()) {
      this.webglRendererAttempted_ = true;
      console.warn('[crterm] xterm WebGL2 renderer not enabled');
      return;
    }

    try {
      const webglAddon = new WebglAddon.WebglAddon();
      if (typeof webglAddon.onContextLoss === 'function') {
        webglAddon.onContextLoss(() => {
          console.warn('[crterm] xterm WebGL2 context lost, disposing addon');
          webglAddon.dispose();
          this.webglAddon_ = null;
        });
      }
      this.webglRendererAttempted_ = true;
      this.webglAddon_ = webglAddon;
      this.term_.loadAddon(webglAddon);
      this.patchWebglRendererForShadowDom_(webglAddon);
      requestAnimationFrame(() => {
        this.fitTerminal_();
        this.term_?.refresh?.(0, Math.max(0, (this.term_?.rows ?? 1) - 1));
        const canvases = Array.from(
            this.term_?.element?.querySelectorAll?.('canvas') ?? [],
            canvas => canvas as HTMLCanvasElement);
        const canvasInfo = canvases.map((canvas: HTMLCanvasElement) => ({
          width: canvas.width,
          height: canvas.height,
          clientWidth: canvas.clientWidth,
          clientHeight: canvas.clientHeight,
        }));
        const rendererType =
            this.term_?._core?._renderService?._renderer?.value?.constructor
                ?.name ??
            this.term_?._core?._renderService?._renderer?.constructor?.name ??
            '';
        this.logWebglState_('xterm WebGL2 renderer enabled', {
          width,
          height,
          cols: this.term_?.cols ?? 0,
          rows: this.term_?.rows ?? 0,
          canvasCount: canvases.length,
          canvasInfo,
          rendererType,
        });
      });
    } catch (error) {
      this.webglRendererAttempted_ = true;
      console.warn('[crterm] failed to enable xterm WebGL2 renderer', error);
    }
  }

  override async firstUpdated() {
    const terminal = this.shadowRoot?.getElementById('terminal');
    if (!terminal || typeof Terminal === 'undefined') {
      return;
    }

    this.ensureXtermStyles_();
    await this.loadTerminalSettings_();
    const customTitle = loadTimeData.getString('customTitle').trim();
    if (customTitle) {
      this.setDocumentTitle_(customTitle);
    }

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
      this.fitTerminal_();
      this.maybeEnableWebglRenderer_(terminal);
      void this.initializeTerminalSession_();
    });
    this.searchRenderListener_ =
        this.term_.onRender(() => this.updateSearchHighlightOverlay_());
    this.searchScrollListener_ =
        this.term_.onScroll(() => this.updateSearchHighlightOverlay_());
    this.searchResizeListener_ =
        this.term_.onResize(() => this.updateSearchHighlightOverlay_());
    this.resizeObserver_ = new ResizeObserver(() => {
      this.fitTerminal_();
      this.maybeEnableWebglRenderer_(terminal);
    });
    this.resizeObserver_.observe(terminal);
    //this.term_.write('Hello from \\x1B[1;3;31mxterm.js\\x1B[0m\\r\\n$ ');
    this.term_.onData((input: string) => this.onUserInput_(input));
    this.keydownListener_ = (event: KeyboardEvent) => this.onKeyDown_(event);
    document.addEventListener('keydown', this.keydownListener_, true);
    window.__crtermCaptureScreenFromContextMenu = () => {
      void this.captureScreenFromContextMenu_();
    };
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
    if (this.searchRefreshTimeoutId_ !== null) {
      window.clearTimeout(this.searchRefreshTimeoutId_);
      this.searchRefreshTimeoutId_ = null;
    }
    this.pendingBackendCols_ = null;
    this.pendingBackendRows_ = null;
    this.webglAddon_ = null;
    this.webglRendererAttempted_ = false;
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
    if (window.__crtermCaptureScreenFromContextMenu) {
      delete window.__crtermCaptureScreenFromContextMenu;
    }
    super.disconnectedCallback();
  }

  protected onUserInput_(input: string) {
    if (LOG_CRTERM_TRAFFIC) {
      console.log('[crterm] webui onUserInput=', JSON.stringify(input));
    }
    this.crtermProxy_.onUserInput(input);
  }

  //private shouldPreserveTerminalSelectionForKeyEvent_(
  //    event: KeyboardEvent): boolean {
  //  if (event.defaultPrevented || event.isComposing) {
  //    return false;
  //  }

  //  if (event.ctrlKey || event.metaKey || event.altKey) {
  //    return false;
  //  }

  //  return event.key.length === 1;
  //}

  //private maybePreserveTerminalSelectionBeforeInput_(event: KeyboardEvent) {
  //  if (!this.term_?.hasSelection?.() ||
  //      !this.shouldPreserveTerminalSelectionForKeyEvent_(event)) {
  //    return;
  //  }

  //  const selection = this.term_.getSelectionPosition?.();
  //  if (!selection?.start || !selection?.end) {
  //    return;
  //  }

  //  this.pendingTerminalSelectionRestore_ = {
  //    start: {x: selection.start.x, y: selection.start.y},
  //    end: {x: selection.end.x, y: selection.end.y},
  //  };
  //}

  //private scheduleTerminalSelectionRestore_() {
  //  if (!this.pendingTerminalSelectionRestore_) {
  //    return;
  //  }

  //  if (this.selectionRestoreTimeoutId_ !== null) {
  //    window.clearTimeout(this.selectionRestoreTimeoutId_);
  //  }

  //  this.selectionRestoreTimeoutId_ = window.setTimeout(() => {
  //    this.selectionRestoreTimeoutId_ = null;
  //    this.restorePendingTerminalSelection_();
  //  }, CrTermAppElement.TERMINAL_SELECTION_RESTORE_DELAY_MS);
  //}

  //private restorePendingTerminalSelection_() {
  //  const selection = this.pendingTerminalSelectionRestore_;
  //  this.pendingTerminalSelectionRestore_ = null;
  //  if (!selection || !this.term_?.select) {
  //    return;
  //  }

  //  const length = (selection.end.y - selection.start.y) * this.term_.cols +
  //      selection.end.x - selection.start.x;
  //  if (length <= 0) {
  //    return;
  //  }

  //  this.term_.select(selection.start.x, selection.start.y, length);
  //}

  protected closeCaptureSelection_() {
    this.captureSelectionVisible_ = false;
    this.capturePreviewDataUrl_ = '';
    this.captureSelectionStyle_ = '';
    this.captureHasSelection_ = false;
    this.captureCanvas_ = null;
    this.captureSelectionRect_ = null;
    this.captureSelectionStart_ = null;
    this.captureSelectionActive_ = false;
    this.captureSelectionDragMode_ = null;
    this.captureSelectionDragOffset_ = null;
    this.term_?.focus();
  }

  private async captureScreenFromContextMenu_() {
    let stream: MediaStream|null = null;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const track = stream.getVideoTracks()[0];
      if (!track) {
        return;
      }

      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      await new Promise<void>((resolve) => {
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          resolve();
          return;
        }
        video.onloadeddata = () => resolve();
      });

      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!width || !height) {
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) {
        return;
      }

      context.drawImage(video, 0, 0, width, height);
      this.captureCanvas_ = canvas;
      this.capturePreviewDataUrl_ = canvas.toDataURL('image/png');
      this.captureSelectionVisible_ = true;
      this.captureSelectionStyle_ = '';
      this.captureHasSelection_ = false;
      this.captureSelectionRect_ = null;
      this.captureSelectionStart_ = null;
      this.captureSelectionActive_ = false;
      this.captureSelectionDragMode_ = null;
      this.captureSelectionDragOffset_ = null;
    } catch (error) {
      console.error('[crterm] failed to capture screen', error);
      this.term_?.focus();
    } finally {
      stream?.getTracks().forEach(track => track.stop());
    }
  }

  private getCapturePreviewPoint_(event: PointerEvent): {x: number, y: number}|null {
    const stage = this.shadowRoot?.getElementById('capturePreviewStage');
    if (!stage) {
      return null;
    }

    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return null;
    }

    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    return {x, y};
  }

  private setCapturePreviewCursor_(cursor: 'crosshair'|'move') {
    const stage = this.shadowRoot?.getElementById('capturePreviewStage');
    if (stage instanceof HTMLElement) {
      stage.style.cursor = cursor;
    }
  }

  private updateCaptureSelectionFromPoints_(
      start: {x: number, y: number},
      end: {x: number, y: number}) {
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);
    this.captureSelectionRect_ = {x, y, width, height};
    this.captureHasSelection_ = width >= 4 && height >= 4;
    this.captureSelectionStyle_ =
        `left:${x}px;top:${y}px;width:${width}px;height:${height}px;`;
  }

  protected beginCaptureSelection_(event: PointerEvent) {
    if (!this.captureSelectionVisible_) {
      return;
    }

    const point = this.getCapturePreviewPoint_(event);
    if (!point) {
      return;
    }

    const target = event.composedPath()[0];
    const clickedSelectionBox =
        target instanceof HTMLElement &&
        target.classList.contains('capture-selection-box');
    if (clickedSelectionBox && this.captureSelectionRect_ &&
        this.captureHasSelection_) {
      this.captureSelectionActive_ = true;
      this.captureSelectionDragMode_ = 'move';
      this.captureSelectionDragOffset_ = {
        x: point.x - this.captureSelectionRect_.x,
        y: point.y - this.captureSelectionRect_.y,
      };
      this.setCapturePreviewCursor_('move');
      (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(
          event.pointerId);
      return;
    }

    this.captureSelectionActive_ = true;
    this.captureSelectionDragMode_ = 'create';
    this.captureSelectionStart_ = point;
    this.captureSelectionDragOffset_ = null;
    this.setCapturePreviewCursor_('crosshair');
    this.updateCaptureSelectionFromPoints_(point, point);
    (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(
        event.pointerId);
  }

  protected updateCaptureSelection_(event: PointerEvent) {
    if (!this.captureSelectionActive_) {
      return;
    }

    const point = this.getCapturePreviewPoint_(event);
    if (!point) {
      return;
    }

    if (this.captureSelectionDragMode_ === 'move' && this.captureSelectionRect_ &&
        this.captureSelectionDragOffset_) {
      const stage = this.shadowRoot?.getElementById('capturePreviewStage');
      if (!stage) {
        return;
      }
      const width = this.captureSelectionRect_.width;
      const height = this.captureSelectionRect_.height;
      const x = Math.max(
          0, Math.min(stage.clientWidth - width,
                      point.x - this.captureSelectionDragOffset_.x));
      const y = Math.max(
          0, Math.min(stage.clientHeight - height,
                      point.y - this.captureSelectionDragOffset_.y));
      this.captureSelectionRect_ = {x, y, width, height};
      this.captureSelectionStyle_ =
          `left:${x}px;top:${y}px;width:${width}px;height:${height}px;`;
      return;
    }

    if (!this.captureSelectionStart_) {
      return;
    }
    this.updateCaptureSelectionFromPoints_(this.captureSelectionStart_, point);
  }

  protected endCaptureSelection_(event: PointerEvent) {
    if (!this.captureSelectionActive_) {
      return;
    }

    const resolvedPoint =
        this.getCapturePreviewPoint_(event) || this.captureSelectionStart_;
    this.captureSelectionActive_ = false;
    if (this.captureSelectionDragMode_ === 'create' &&
        this.captureSelectionStart_ && resolvedPoint) {
      this.updateCaptureSelectionFromPoints_(
          this.captureSelectionStart_, resolvedPoint);
    }
    this.captureSelectionStart_ = null;
    this.captureSelectionDragMode_ = null;
    this.captureSelectionDragOffset_ = null;
    this.setCapturePreviewCursor_('crosshair');
    (event.currentTarget as HTMLElement | null)?.releasePointerCapture?.(
        event.pointerId);
  }

  protected async saveCaptureSelection_() {
    if (!this.captureCanvas_ || !this.captureSelectionRect_ ||
        !this.captureHasSelection_) {
      return;
    }

    const stage = this.shadowRoot?.getElementById('capturePreviewStage');
    if (!stage || !stage.clientWidth || !stage.clientHeight) {
      this.closeCaptureSelection_();
      return;
    }

    const scaleX = this.captureCanvas_.width / stage.clientWidth;
    const scaleY = this.captureCanvas_.height / stage.clientHeight;
    const sourceX = Math.max(0, Math.floor(this.captureSelectionRect_.x * scaleX));
    const sourceY = Math.max(0, Math.floor(this.captureSelectionRect_.y * scaleY));
    const sourceWidth = Math.min(
        this.captureCanvas_.width - sourceX,
        Math.max(1, Math.floor(this.captureSelectionRect_.width * scaleX)));
    const sourceHeight = Math.min(
        this.captureCanvas_.height - sourceY,
        Math.max(1, Math.floor(this.captureSelectionRect_.height * scaleY)));

    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = sourceWidth;
    croppedCanvas.height = sourceHeight;
    const context = croppedCanvas.getContext('2d');
    if (!context) {
      this.closeCaptureSelection_();
      return;
    }

    context.drawImage(
        this.captureCanvas_, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0,
        sourceWidth, sourceHeight);
    const blob = await new Promise<Blob|null>((resolve) => {
      croppedCanvas.toBlob(resolve, 'image/png');
    });
    if (!blob) {
      this.closeCaptureSelection_();
      return;
    }

    const buffer = await blob.arrayBuffer();
    const {success} = await this.crtermProxy_.saveCapturedScreenPng(
        Array.from(new Uint8Array(buffer)));
    if (!success) {
      this.closeCaptureSelection_();
      return;
    }

    this.closeCaptureSelection_();
  }

  private async loadStoredTerminalOutput_() {
    if (!this.shouldRestoreTerminalOutputOnStartup_() ||
        this.restoredOutputLoaded_ || !this.term_) {
      return;
    }

    this.restoredOutputLoaded_ = true;
    try {
      const {output, sessionId} =
          await this.crtermProxy_.getStoredTerminalOutput();
      if (!output.length) {
        return;
      }

      if (LOG_CRTERM_TRAFFIC) {
        console.log('[crterm] webui restored bytes=', output.length);
      }
      this.handleTerminalOutput_(output, false);
      this.writeRestoreBanner_(sessionId);
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
    this.term_.write(sanitizedOutput, () => this.scheduleSearchRefresh_());
  }

  private writeRestoreBanner_(sessionId: string) {
    if (!this.term_) {
      return;
    }

    const text = sessionId ? ` restore from session ${sessionId} ` :
                             ' restore from session ';
    const cols = Math.max(this.term_.cols || 0, text.length);
    const leftPadding = Math.max(0, Math.floor((cols - text.length) / 2));
    const rightPadding = Math.max(0, cols - leftPadding - text.length);
    const line =
        ' '.repeat(leftPadding) + text + ' '.repeat(rightPadding);
    this.term_.write(`\r\n\x1b[97;100m${line}\x1b[0m\r\n`);
  }

  protected onSearchInput_(event: Event) {
    this.searchQuery_ = (event.target as HTMLInputElement).value;
    this.updateSearchMatches_({reveal: true});
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
    this.resetSearchScanState_();
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

  private scheduleSearchRefresh_() {
    if (!this.searchVisible_ || !this.searchQuery_.trim()) {
      return;
    }

    if (this.searchRefreshTimeoutId_ !== null) {
      window.clearTimeout(this.searchRefreshTimeoutId_);
    }

    this.searchRefreshTimeoutId_ = window.setTimeout(() => {
      this.searchRefreshTimeoutId_ = null;
      this.updateSearchMatches_({incremental: true, preserveCurrent: true});
    }, SEARCH_REFRESH_DEBOUNCE_MS);
  }

  private updateSearchMatches_(
      options: {
        incremental?: boolean,
        reveal?: boolean,
        preserveCurrent?: boolean,
      } = {}) {
    const previousMatch = options.preserveCurrent ?
        this.searchMatches_[this.searchMatchIndex_] :
        null;
    const previousIndex = this.searchMatchIndex_;

    const query = this.searchQuery_.trim().toLowerCase();
    if (!query || !this.term_?.buffer?.active) {
      this.searchMatches_ = [];
      this.searchMatchIndex_ = -1;
      this.searchHighlightStyles_ = [];
      this.searchMarkerStyles_ = [];
      this.resetSearchScanState_();
      this.requestUpdate();
      return;
    }

    const buffer = this.term_.buffer.active;
    const bufferLength = buffer.length ?? 0;
    const baseY = buffer.baseY ?? 0;
    const canIncrementalScan =
        options.incremental && this.lastSearchScanBufferLength_ > 0 &&
        bufferLength > 0 && bufferLength >= this.lastSearchScanBufferLength_;

    if (!canIncrementalScan) {
      this.searchMatches_ = [];
      this.searchMatchIndex_ = -1;
      this.searchHighlightStyles_ = [];
      this.searchMarkerStyles_ = [];
      this.scanSearchRows_(query, 0, bufferLength);
    } else {
      const baseYDelta = Math.max(0, baseY - this.lastSearchScanBaseY_);
      if (baseYDelta > 0 &&
          bufferLength === this.lastSearchScanBufferLength_) {
        this.searchMatches_ = this.searchMatches_
            .map(match => ({row: match.row - baseYDelta, column: match.column}))
            .filter(match => match.row >= 0);
      }

      const firstDirtyRow =
          bufferLength > this.lastSearchScanBufferLength_ ?
              Math.max(0, this.lastSearchScanBufferLength_ - 1) :
              Math.max(0, bufferLength - Math.max(baseYDelta, 1) - 1);
      this.searchMatches_ =
          this.searchMatches_.filter(match => match.row < firstDirtyRow);
      this.scanSearchRows_(query, firstDirtyRow, bufferLength);
    }

    this.lastSearchScanBaseY_ = baseY;
    this.lastSearchScanBufferLength_ = bufferLength;

    if (this.searchMatches_.length) {
      if (previousMatch) {
        this.searchMatchIndex_ = this.searchMatches_.findIndex(match =>
          match.row === previousMatch.row &&
          match.column === previousMatch.column);
      }
      if (this.searchMatchIndex_ === -1 && options.preserveCurrent &&
          previousIndex >= 0) {
        this.searchMatchIndex_ =
            Math.min(previousIndex, this.searchMatches_.length - 1);
      }
      if (this.searchMatchIndex_ === -1) {
        this.searchMatchIndex_ = 0;
      }

      if (options.reveal) {
        this.revealSearchMatch_();
      } else {
        this.updateSearchHighlightOverlay_();
      }
    } else {
      this.searchMatchIndex_ = -1;
      this.searchHighlightStyles_ = [];
      this.searchMarkerStyles_ = [];
    }

    this.requestUpdate();
  }

  private scanSearchRows_(query: string, startRow: number, endRow: number) {
    const buffer = this.term_?.buffer?.active;
    if (!buffer) {
      return;
    }

    for (let row = startRow; row < endRow; row++) {
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
  }

  private resetSearchScanState_() {
    this.lastSearchScanBaseY_ = 0;
    this.lastSearchScanBufferLength_ = 0;
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
