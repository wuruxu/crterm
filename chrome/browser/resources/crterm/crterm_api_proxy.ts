import {PageCallbackRouter, PageHandlerFactory, PageHandlerRemote} from './crterm.mojom-webui.js';

export interface CrFilesReceiveOverlayStateData {
  visible: boolean;
  ipAddress: string;
  port: number;
  pinCode: string;
}

export interface CrTermProxy {
  onUserInput(input: string): void;
  onTerminalResize(cols: number, rows: number): void;
  saveCapturedScreenPng(pngBytes: number[]): Promise<{
    success: boolean,
    path: string,
  }>;
  activateCurrentTab(): Promise<{success: boolean}>;
  setPageTitle(title: string): void;
  getStoredTerminalOutput(): Promise<{output: number[], sessionId: string}>;
  getTerminalSettings(): Promise<{
    settings: {
      termTheme: string,
      fontFamily: string,
      fontSize: number,
      scrollback: number,
      restoreTerminalOutputOnStartup: boolean,
      selectionCopy: boolean,
      enableWebgl: boolean,
      wordSeparator: string,
    },
  }>;
  getCrFilesReceiveOverlayState(): Promise<{
    state: CrFilesReceiveOverlayStateData,
  }>;
  getCallbackRouter(): PageCallbackRouter;
}


export class CrTermProxyImpl implements CrTermProxy {
  private callbackRouter: PageCallbackRouter = new PageCallbackRouter();
  private handler: PageHandlerRemote = new PageHandlerRemote();

  constructor() {
    this.callbackRouter = new PageCallbackRouter();
    this.handler = new PageHandlerRemote();

    const factory = PageHandlerFactory.getRemote();
    factory.createPageHandler(
        this.callbackRouter.$.bindNewPipeAndPassRemote(),
        this.handler.$.bindNewPipeAndPassReceiver());
  }

  onUserInput(input: string) {
    this.handler.onUserInput(input);
  }

  onTerminalResize(cols: number, rows: number) {
    this.handler.onTerminalResize(cols, rows);
  }

  saveCapturedScreenPng(pngBytes: number[]) {
    return this.handler.saveCapturedScreenPng(pngBytes);
  }

  activateCurrentTab() {
    return this.handler.activateCurrentTab();
  }

  setPageTitle(title: string) {
    this.handler.setPageTitle(title);
  }

  getStoredTerminalOutput() {
    return this.handler.getStoredTerminalOutput();
  }

  getTerminalSettings() {
    return this.handler.getTerminalSettings();
  }

  getCrFilesReceiveOverlayState() {
    return this.handler.getCrFilesReceiveOverlayState();
  }

  getCallbackRouter() {
    return this.callbackRouter;
  }

  static getInstance(): CrTermProxy {
    return instance || (instance = new CrTermProxyImpl ());
  }

  static setInstance(obj: CrTermProxy) {
    instance = obj;
  }
}

let instance: CrTermProxy|null = null;
