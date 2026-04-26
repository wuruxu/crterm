// Copyright 2026 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import 'chrome://resources/cr_elements/cr_shared_style.css.js';
import 'chrome://resources/cr_elements/cr_button/cr_button.js';
import 'chrome://resources/cr_elements/cr_toast/cr_toast.js';
import '../controls/settings_dropdown_menu.js';
import '../controls/settings_slider.js';
import '../controls/settings_toggle_button.js';
import '../settings_page/settings_section.js';
import '../settings_shared.css.js';

import type {FontsData} from '/shared/settings/appearance_page/fonts_browser_proxy.js';
import {FontsBrowserProxyImpl} from '/shared/settings/appearance_page/fonts_browser_proxy.js';
import {PrefsMixin} from '/shared/settings/prefs/prefs_mixin.js';
import type {CrToastElement} from 'chrome://resources/cr_elements/cr_toast/cr_toast.js';
import type {SliderTick} from 'chrome://resources/cr_elements/cr_slider/cr_slider.js';
import {loadTimeData} from 'chrome://resources/js/load_time_data.js';
import {PluralStringProxyImpl} from 'chrome://resources/js/plural_string_proxy.js';
import {getTrustedScriptURL} from 'chrome://resources/js/static_types.js';
import {PolymerElement} from 'chrome://resources/polymer/v3_0/polymer/polymer_bundled.min.js';

import {getSearchManager} from '../search_settings.js';
import type {DropdownMenuOptionList} from '../controls/settings_dropdown_menu.js';
import type {SettingsPlugin} from '../settings_main/settings_plugin.js';
import {
  PageCallbackRouter,
  PageHandlerFactory,
  PageHandlerRemote,
} from '../crterm.mojom-webui.js';

import {getTemplate} from './crterm_page.html.js';

declare var Terminal: any;

type TerminalThemeStyle = 'dark'|'light';
type PtyxisPaletteFaceColors = {
  background: string,
  foreground: string,
  cursor: string,
  color0: string,
  color1: string,
  color2: string,
  color3: string,
  color4: string,
  color5: string,
  color6: string,
  color7: string,
  color8: string,
  color9: string,
  color10: string,
  color11: string,
  color12: string,
  color13: string,
  color14: string,
  color15: string,
};
type XtermThemeColors = {
  background: string,
  foreground: string,
  cursor: string,
  cursorAccent: string,
  black: string,
  red: string,
  green: string,
  yellow: string,
  blue: string,
  magenta: string,
  cyan: string,
  white: string,
  brightBlack: string,
  brightRed: string,
  brightGreen: string,
  brightYellow: string,
  brightBlue: string,
  brightMagenta: string,
  brightCyan: string,
  brightWhite: string,
  selectionBackground: string,
  selectionInactiveBackground: string,
  selectionForeground: string,
};
type TerminalThemePalette = {
  id: string,
  name: string,
  light: PtyxisPaletteFaceColors,
  dark: PtyxisPaletteFaceColors,
};

const CRTERM_THEME_PREF = 'crterm.term_theme';
const CRTERM_DEFAULT_SHELL_PREF = 'crterm.default_shell';
const CRTERM_LIMIT_SCROLLBACK_PREF = 'crterm.limit_scrollback';
const MIN_CRTERM_FONT_SIZE = 6;
const MAX_CRTERM_FONT_SIZE = 36;
const TERMINAL_FONT_PREVIEW_MIN_ROWS = 2;
const XTERM_SCRIPT_ID = 'crtermSettingsXtermScript';
const XTERM_STYLESHEET_ID = 'crtermSettingsXtermStylesheet';
const DEFAULT_CRTERM_THEME =
    'background: #111111;\n' +
    'selectionBackground: rgba(33, 84, 160, 0.96);\n' +
    'selectionInactiveBackground: rgba(33, 84, 160, 0.96);\n' +
    'selectionForeground: #f7f9fc;';
const SAMPLE_THEME_TEXT = 'The quick\nbrown fox\njumps over th...';
const TERMINAL_THEME_COLOR_KEYS = [
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
] as const;
const TERMINAL_THEME_PALETTES: TerminalThemePalette[] = [
  {
    id: 'gnome',
    name: 'GNOME',
    light: {
      background: '#ffffff',
      foreground: '#1d1d20',
      cursor: '#1d1d20',
      color0: '#1d1d20',
      color1: '#c01c28',
      color2: '#26a269',
      color3: '#a2734c',
      color4: '#12488b',
      color5: '#a347ba',
      color6: '#2aa1b3',
      color7: '#cfcfcf',
      color8: '#5d5d5d',
      color9: '#f66151',
      color10: '#33d17a',
      color11: '#e9ad0c',
      color12: '#2a7bde',
      color13: '#c061cb',
      color14: '#33c7de',
      color15: '#ffffff',
    },
    dark: {
      background: '#1c1c1f',
      foreground: '#ffffff',
      cursor: '#ffffff',
      color0: '#241f31',
      color1: '#c01c28',
      color2: '#2ec27e',
      color3: '#f5c211',
      color4: '#1e78e4',
      color5: '#9841bb',
      color6: '#0ab9dc',
      color7: '#c0bfbc',
      color8: '#5e5c64',
      color9: '#ed333b',
      color10: '#57e389',
      color11: '#f8e45c',
      color12: '#51a1ff',
      color13: '#c061cb',
      color14: '#4fd2fd',
      color15: '#f6f5f4',
    },
  },
  {
    id: 'vscode',
    name: 'VS Code',
    light: {
      background: '#F9F9F9',
      foreground: '#020202',
      cursor: '#020202',
      color0: '#020202',
      color1: '#CD3232',
      color2: '#00BC00',
      color3: '#A5A900',
      color4: '#0752A8',
      color5: '#BC05BC',
      color6: '#0598BC',
      color7: '#343434',
      color8: '#5E5E5E',
      color9: '#CD3333',
      color10: '#1BCE1A',
      color11: '#ADBB5B',
      color12: '#0752A8',
      color13: '#C451CE',
      color14: '#52A8C7',
      color15: '#A6A3A6',
    },
    dark: {
      background: '#1E1E1E',
      foreground: '#CCCCCC',
      cursor: '#CCCCCC',
      color0: '#6A787A',
      color1: '#E9653B',
      color2: '#39E9A8',
      color3: '#E5B684',
      color4: '#44AAE6',
      color5: '#E17599',
      color6: '#3DD5E7',
      color7: '#C3DDE1',
      color8: '#598489',
      color9: '#E65029',
      color10: '#00FF9A',
      color11: '#E89440',
      color12: '#009AFB',
      color13: '#FF578F',
      color14: '#5FFFFF',
      color15: '#D9FBFF',
    },
  },
  {
    id: 'tango',
    name: 'Tango',
    light: {
      background: '#eeeeec',
      foreground: '#2e3436',
      cursor: '#2e3436',
      color0: '#2e3436',
      color1: '#cc0000',
      color2: '#4e9a06',
      color3: '#c4a000',
      color4: '#3465a4',
      color5: '#75507b',
      color6: '#06989a',
      color7: '#d3d7cf',
      color8: '#555753',
      color9: '#ef2929',
      color10: '#8ae234',
      color11: '#fce94f',
      color12: '#729fcf',
      color13: '#ad7fa8',
      color14: '#34e2e2',
      color15: '#eeeeec',
    },
    dark: {
      background: '#2e3436',
      foreground: '#d3d7cf',
      cursor: '#d3d7cf',
      color0: '#2e3436',
      color1: '#cc0000',
      color2: '#4e9a06',
      color3: '#c4a000',
      color4: '#3465a4',
      color5: '#75507b',
      color6: '#06989a',
      color7: '#d3d7cf',
      color8: '#555753',
      color9: '#ef2929',
      color10: '#8ae234',
      color11: '#fce94f',
      color12: '#729fcf',
      color13: '#ad7fa8',
      color14: '#34e2e2',
      color15: '#eeeeec',
    },
  },
  {
    id: 'linux',
    name: 'Linux',
    light: {
      background: '#ffffff',
      foreground: '#555555',
      cursor: '#000000',
      color0: '#000000',
      color1: '#aa0000',
      color2: '#00aa00',
      color3: '#aa5500',
      color4: '#0000aa',
      color5: '#aa00aa',
      color6: '#00aaaa',
      color7: '#aaaaaa',
      color8: '#555555',
      color9: '#ff5555',
      color10: '#55ff55',
      color11: '#ffff55',
      color12: '#5555ff',
      color13: '#ff55ff',
      color14: '#55ffff',
      color15: '#ffffff',
    },
    dark: {
      background: '#000000',
      foreground: '#aaaaaa',
      cursor: '#aaaaaa',
      color0: '#000000',
      color1: '#aa0000',
      color2: '#00aa00',
      color3: '#aa5500',
      color4: '#0000aa',
      color5: '#aa00aa',
      color6: '#00aaaa',
      color7: '#aaaaaa',
      color8: '#555555',
      color9: '#ff5555',
      color10: '#55ff55',
      color11: '#ffff55',
      color12: '#5555ff',
      color13: '#ff55ff',
      color14: '#55ffff',
      color15: '#ffffff',
    },
  },
  {
    id: 'solarized',
    name: 'Solarized',
    light: {
      background: '#fdf6e3',
      foreground: '#657b83',
      cursor: '#657b83',
      color0: '#073642',
      color1: '#dc322f',
      color2: '#859900',
      color3: '#b58900',
      color4: '#268bd2',
      color5: '#d33682',
      color6: '#2aa198',
      color7: '#eee8d5',
      color8: '#002b36',
      color9: '#cb4b16',
      color10: '#586e75',
      color11: '#657b83',
      color12: '#839496',
      color13: '#6c71c4',
      color14: '#93a1a1',
      color15: '#fdf6e3',
    },
    dark: {
      background: '#002b36',
      foreground: '#839496',
      cursor: '#839496',
      color0: '#073642',
      color1: '#dc322f',
      color2: '#859900',
      color3: '#b58900',
      color4: '#268bd2',
      color5: '#d33682',
      color6: '#2aa198',
      color7: '#eee8d5',
      color8: '#002b36',
      color9: '#cb4b16',
      color10: '#586e75',
      color11: '#657b83',
      color12: '#839496',
      color13: '#6c71c4',
      color14: '#93a1a1',
      color15: '#fdf6e3',
    },
  },
  {
    id: 'nord',
    name: 'Nord',
    light: {
      background: '#e5e9f0',
      foreground: '#414858',
      cursor: '#414858',
      color0: '#3b4251',
      color1: '#bf6069',
      color2: '#a3be8b',
      color3: '#eacb8a',
      color4: '#81a1c1',
      color5: '#b48dac',
      color6: '#88c0d0',
      color7: '#d8dee9',
      color8: '#4c556a',
      color9: '#bf6069',
      color10: '#a3be8b',
      color11: '#eacb8a',
      color12: '#81a1c1',
      color13: '#b48dac',
      color14: '#8fbcbb',
      color15: '#eceff4',
    },
    dark: {
      background: '#2e3440',
      foreground: '#d8dee9',
      cursor: '#d8dee9',
      color0: '#3b4252',
      color1: '#bf616a',
      color2: '#a3be8c',
      color3: '#ebcb8b',
      color4: '#81a1c1',
      color5: '#b48ead',
      color6: '#88c0d0',
      color7: '#e5e9f0',
      color8: '#4c566a',
      color9: '#bf616a',
      color10: '#a3be8c',
      color11: '#ebcb8b',
      color12: '#81a1c1',
      color13: '#b48ead',
      color14: '#8fbcbb',
      color15: '#eceff4',
    },
  },
  {
    id: 'horizon',
    name: 'Horizon',
    light: {
      background: '#FDF0ED',
      foreground: '#1C1E26',
      cursor: '#1C1E26',
      color0: '#16161C',
      color1: '#DA103F',
      color2: '#1EB980',
      color3: '#F6661E',
      color4: '#26BBD9',
      color5: '#EE64AE',
      color6: '#1D8991',
      color7: '#FADAD1',
      color8: '#1A1C23',
      color9: '#F43E5C',
      color10: '#07DA8C',
      color11: '#F77D26',
      color12: '#3FC6DE',
      color13: '#F075B7',
      color14: '#1EAEAE',
      color15: '#FDF0ED',
    },
    dark: {
      background: '#1C1E26',
      foreground: '#FDF0ED',
      cursor: '#FDF0ED',
      color0: '#16161C',
      color1: '#E95678',
      color2: '#29D398',
      color3: '#FAB795',
      color4: '#26BBD9',
      color5: '#EE64AE',
      color6: '#59E3E3',
      color7: '#FADAD1',
      color8: '#232530',
      color9: '#EC6A88',
      color10: '#3FDAA4',
      color11: '#FBC3A7',
      color12: '#3FC6DE',
      color13: '#F075B7',
      color14: '#6BE6E6',
      color15: '#FDF0ED',
    },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    light: {
      background: '#ffffff',
      foreground: '#282a36',
      cursor: '#282a36',
      color0: '#f1f2ff',
      color1: '#b60021',
      color2: '#006800',
      color3: '#515f00',
      color4: '#6946a3',
      color5: '#a41d74',
      color6: '#006274',
      color7: '#f8f8f2',
      color8: '#8393c7',
      color9: '#ac202f',
      color10: '#006803',
      color11: '#585e06',
      color12: '#6c4993',
      color13: '#962f7c',
      color14: '#006465',
      color15: '#595959',
    },
    dark: {
      background: '#282a36',
      foreground: '#f8f8f2',
      cursor: '#f8f8f2',
      color0: '#21222c',
      color1: '#ff5555',
      color2: '#50fa7b',
      color3: '#f1fa8c',
      color4: '#bd93f9',
      color5: '#ff79c6',
      color6: '#8be9fd',
      color7: '#f8f8f2',
      color8: '#6272a4',
      color9: '#ff6e6e',
      color10: '#69ff94',
      color11: '#ffffa5',
      color12: '#d6acff',
      color13: '#ff92df',
      color14: '#a4ffff',
      color15: '#ffffff',
    },
  },
  {
    id: 'xterm',
    name: 'XTerm',
    light: {
      background: '#ffffff',
      foreground: '#000000',
      cursor: '#000000',
      color0: '#000000',
      color1: '#cd0000',
      color2: '#00cd00',
      color3: '#cdcd00',
      color4: '#0000ee',
      color5: '#cd00cd',
      color6: '#00cdcd',
      color7: '#e5e5e5',
      color8: '#7f7f7f',
      color9: '#ff0000',
      color10: '#00ff00',
      color11: '#ffff00',
      color12: '#5c5cff',
      color13: '#ff00ff',
      color14: '#00ffff',
      color15: '#ffffff',
    },
    dark: {
      background: '#000000',
      foreground: '#ffffff',
      cursor: '#ffffff',
      color0: '#000000',
      color1: '#cd0000',
      color2: '#00cd00',
      color3: '#cdcd00',
      color4: '#0000ee',
      color5: '#cd00cd',
      color6: '#00cdcd',
      color7: '#e5e5e5',
      color8: '#7f7f7f',
      color9: '#ff0000',
      color10: '#00ff00',
      color11: '#ffff00',
      color12: '#5c5cff',
      color13: '#ff00ff',
      color14: '#00ffff',
      color15: '#ffffff',
    },
  },
];

const SettingsCrTermPageElementBase = PrefsMixin(PolymerElement);

export interface SettingsCrTermPageElement {
  $: {
    cleanupInactiveSessionToast: CrToastElement,
  };
}

export class SettingsCrTermPageElement extends SettingsCrTermPageElementBase
    implements SettingsPlugin {
  static get is() {
    return 'settings-crterm-page';
  }

  static get template() {
    return getTemplate();
  }

  static get properties() {
    return {
      defaultShell_: {
        type: String,
        value: '/usr/bin/bash',
      },
      webglSystemAvailable_: {
        type: Boolean,
        value: false,
      },
      webglSubLabel_: {
        type: String,
        computed: 'getWebGLSubLabel_(webglSystemAvailable_)',
      },
      cleanupInactiveSessionToastText_: String,
      fontFamilyOptions_: {
        type: Array,
        value: () => [{value: 'monospace', name: 'monospace'}],
      },
      fontSizeTicks_: {
        type: Array,
        value: () => Array.from({length: 31}, (_, index) => {
          const value = index + MIN_CRTERM_FONT_SIZE;
          return {value, label: `${value}`};
        }),
      },
      limitScrollback_: {
        type: String,
        value: '10240',
      },
      termTheme_: {
        type: String,
        value: DEFAULT_CRTERM_THEME,
      },
      terminalThemePalettes_: {
        type: Array,
        value: () => TERMINAL_THEME_PALETTES,
      },
      terminalThemeStyle_: {
        type: String,
        value: () => SettingsCrTermPageElement.getPreferredThemeStyle_(),
      },
      selectedTerminalThemeId_: {
        type: String,
        value: '',
      },
    };
  }

  static get observers() {
    return [
      'syncPrefs_(prefs.crterm.term_theme.value, ' +
          'prefs.crterm.default_shell.value, ' +
          'prefs.crterm.font_family.value, ' +
          'prefs.crterm.font_size.value, ' +
          'prefs.crterm.limit_scrollback.value, ' +
          'prefs.crterm.restore_terminal_output_on_startup.value, ' +
          'prefs.crterm.close_button_visible.value, ' +
          'prefs.crterm.enable_webgl.value)',
    ];
  }

  private fontsBrowserProxy_ = FontsBrowserProxyImpl.getInstance();
  private terminalFontPreview_: any = null;
  private terminalFontPreviewFontFamily_: string|null = null;
  private terminalFontPreviewFontSize_: number|null = null;
  private terminalFontPreviewResetTimeout_: number|null = null;
  private terminalFontPreviewResourcesReady_: Promise<void>|null = null;
  private colorSchemeMediaQuery_: MediaQueryList|null = null;
  private colorSchemeListener_: ((event: MediaQueryListEvent) => void)|null =
      null;
  private crtermCallbackRouter_: PageCallbackRouter = new PageCallbackRouter();
  private crtermHandler_: PageHandlerRemote = new PageHandlerRemote();
  private crtermOutputDecoder_: TextDecoder = new TextDecoder();
  private crtermOutputListenerId_: number|null = null;
  private terminalPreviewOutputBuffer_: string = '';
  private terminalPreviewDataListener_: {dispose(): void}|null = null;
  declare private cleanupInactiveSessionToastText_: string;
  declare private defaultShell_: string;
  declare private webglSystemAvailable_: boolean;
  declare private webglSubLabel_: string;
  declare private fontFamilyOptions_: DropdownMenuOptionList;
  declare private fontSizeTicks_: SliderTick[];
  declare private limitScrollback_: string;
  declare private selectedTerminalThemeId_: string;
  declare private termTheme_: string;
  declare private terminalThemePalettes_: TerminalThemePalette[];
  declare private terminalThemeStyle_: TerminalThemeStyle;

  private static getPreferredThemeStyle_(): TerminalThemeStyle {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ?
        'dark' :
        'light';
  }

  override ready() {
    super.ready();
    this.fontsBrowserProxy_.fetchMonospaceFontsData().then(
        this.setMonospaceFontsData_.bind(this));
    this.initializeTerminalPreviewSession_();
    this.installColorSchemeListener_();
    void this.resetTerminalFontPreview_();
    this.initWebglSystemAvailability_();
  }

  private initWebglSystemAvailability_() {
    try {
      const canvas = document.createElement('canvas');
      this.webglSystemAvailable_ = !!canvas.getContext('webgl2');
    } catch {
      this.webglSystemAvailable_ = false;
    }
  }

  private getWebGLSubLabel_(): string {
    const baseDesc = loadTimeData.getString('crTermEnableWebGLDescription');
    const systemStatus = this.webglSystemAvailable_ ?
        '(system: supported)' : '(system: not supported)';
    return `${baseDesc} ${systemStatus}`;
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    if (this.terminalFontPreviewResetTimeout_ !== null) {
      window.clearTimeout(this.terminalFontPreviewResetTimeout_);
      this.terminalFontPreviewResetTimeout_ = null;
    }
    if (this.colorSchemeMediaQuery_ && this.colorSchemeListener_) {
      this.colorSchemeMediaQuery_.removeEventListener(
          'change', this.colorSchemeListener_);
    }
    this.colorSchemeMediaQuery_ = null;
    this.colorSchemeListener_ = null;
    this.terminalPreviewDataListener_?.dispose();
    this.terminalPreviewDataListener_ = null;
    if (this.crtermOutputListenerId_ !== null) {
      this.crtermCallbackRouter_.removeListener(this.crtermOutputListenerId_);
      this.crtermOutputListenerId_ = null;
    }
    this.terminalFontPreview_?.dispose();
    this.terminalFontPreview_ = null;
  }

  private setMonospaceFontsData_(response: FontsData) {
    const fontMenuOptions = [];
    for (const fontData of response.fontList) {
      fontMenuOptions.push({value: fontData[0], name: fontData[1]});
    }
    if (!fontMenuOptions.length) {
      fontMenuOptions.push({value: 'monospace', name: 'monospace'});
    }
    this.fontFamilyOptions_ = fontMenuOptions;
  }

  private syncPrefs_(
      termTheme: string|undefined,
      defaultShell: string|undefined,
      fontFamily: string|undefined,
      fontSize: number|string|undefined,
      limitScrollback: number|string|undefined,
      _restoreTerminalOutputOnStartup: boolean|undefined,
      _closeButtonVisible: boolean|undefined,
      _enableWebgl: boolean|undefined) {
    if (typeof termTheme === 'string') {
      this.termTheme_ = termTheme || DEFAULT_CRTERM_THEME;
      this.updateSelectedTerminalTheme_();
      if (this.terminalFontPreview_) {
        this.scheduleTerminalFontPreviewReset_();
      }
    }
    if (typeof defaultShell === 'string') {
      this.defaultShell_ = defaultShell;
    }
    if (typeof fontSize === 'number' || typeof fontSize === 'string') {
      const prefFontSize = this.clampFontSize_(Number(fontSize));
      if (this.terminalFontPreview_ &&
          this.terminalFontPreviewFontSize_ !== prefFontSize) {
        this.updateTerminalFontPreview_(prefFontSize);
      } else if (this.terminalFontPreviewFontSize_ === null) {
        this.terminalFontPreviewFontSize_ = prefFontSize;
      }
    }
    if (typeof fontFamily === 'string' && this.terminalFontPreview_) {
      this.scheduleTerminalFontPreviewReset_(fontFamily);
    } else if (typeof fontFamily === 'string' && fontFamily) {
      this.terminalFontPreviewFontFamily_ = fontFamily;
    }
    if (typeof limitScrollback === 'number' ||
        typeof limitScrollback === 'string') {
      this.limitScrollback_ = `${limitScrollback}`;
    }
  }

  private onDefaultShellInput_(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.defaultShell_ = value;
    this.setPrefValue(CRTERM_DEFAULT_SHELL_PREF, value);
  }

  private clampFontSize_(value: number): number {
    if (!Number.isFinite(value)) {
      return 14;
    }
    return Math.min(
        MAX_CRTERM_FONT_SIZE,
        Math.max(MIN_CRTERM_FONT_SIZE, Math.trunc(value)));
  }

  private installColorSchemeListener_() {
    this.colorSchemeMediaQuery_ =
        window.matchMedia('(prefers-color-scheme: dark)');
    this.colorSchemeListener_ = event => {
      const selectedPaletteId = this.selectedTerminalThemeId_;
      this.terminalThemeStyle_ = event.matches ? 'dark' : 'light';
      if (selectedPaletteId) {
        this.applyTerminalThemePalette_(selectedPaletteId);
        return;
      }
      this.updateSelectedTerminalTheme_();
    };
    this.colorSchemeMediaQuery_.addEventListener(
        'change', this.colorSchemeListener_);
  }

  private onTerminalThemePaletteClick_(event: Event) {
    const paletteId =
        (event.currentTarget as HTMLElement).dataset['paletteId'];
    this.applyTerminalThemePalette_(paletteId);
  }

  private async onCleanupInactiveSessionClick_() {
    const {removedCount} =
        await this.crtermHandler_.cleanupInactiveTerminalOutputSessions();
    this.cleanupInactiveSessionToastText_ =
        await PluralStringProxyImpl.getInstance().getPluralString(
            'crTermCleanupInactiveSessionToastLabel', removedCount);
    this.$.cleanupInactiveSessionToast.show();
  }

  private applyTerminalThemePalette_(paletteId: string|undefined) {
    const palette = TERMINAL_THEME_PALETTES.find(({id}) => id === paletteId);
    if (!palette) {
      return;
    }

    const theme = this.createTerminalThemeString_(
        palette[this.terminalThemeStyle_]);
    this.selectedTerminalThemeId_ = palette.id;
    this.termTheme_ = theme;
    this.setPrefValue(CRTERM_THEME_PREF, theme);
    this.scheduleTerminalFontPreviewReset_();
  }

  private getTerminalThemeSelectedClass_(
      paletteId: string, selectedPaletteId: string): string {
    return paletteId === selectedPaletteId ? 'selected' : '';
  }

  private isTerminalThemeSelected_(
      paletteId: string, selectedPaletteId: string): string {
    return `${paletteId === selectedPaletteId}`;
  }

  private getTerminalThemeCardStyle_(
      palette: TerminalThemePalette, style: TerminalThemeStyle): string {
    const colors = palette[style];
    return `background:${colors.background};color:${colors.foreground};`;
  }

  private getTerminalThemeSwatches_(
      palette: TerminalThemePalette, style: TerminalThemeStyle): string[] {
    const colors = this.createXtermThemeFromPtyxisPalette_(palette[style]);
    return TERMINAL_THEME_COLOR_KEYS.map(key => colors[key]);
  }

  private getTerminalThemeSampleText_(): string {
    return SAMPLE_THEME_TEXT;
  }

  private updateSelectedTerminalTheme_() {
    const normalizedTheme = this.normalizeThemeString_(this.termTheme_);
    const palette = TERMINAL_THEME_PALETTES.find(palette => {
      return this.normalizeThemeString_(this.createTerminalThemeString_(
                 palette[this.terminalThemeStyle_])) === normalizedTheme;
    });
    this.selectedTerminalThemeId_ = palette?.id ?? '';
  }

  private normalizeThemeString_(theme: string): string {
    return theme.replace(/\s+/g, '').toLowerCase();
  }

  private createTerminalThemeString_(colors: PtyxisPaletteFaceColors): string {
    const theme = this.createXtermThemeFromPtyxisPalette_(colors);
    return [
      `background: ${theme['background']};`,
      `foreground: ${theme['foreground']};`,
      `cursor: ${theme['cursor']};`,
      `cursorAccent: ${theme['cursorAccent']};`,
      `black: ${theme['black']};`,
      `red: ${theme['red']};`,
      `green: ${theme['green']};`,
      `yellow: ${theme['yellow']};`,
      `blue: ${theme['blue']};`,
      `magenta: ${theme['magenta']};`,
      `cyan: ${theme['cyan']};`,
      `white: ${theme['white']};`,
      `brightBlack: ${theme['brightBlack']};`,
      `brightRed: ${theme['brightRed']};`,
      `brightGreen: ${theme['brightGreen']};`,
      `brightYellow: ${theme['brightYellow']};`,
      `brightBlue: ${theme['brightBlue']};`,
      `brightMagenta: ${theme['brightMagenta']};`,
      `brightCyan: ${theme['brightCyan']};`,
      `brightWhite: ${theme['brightWhite']};`,
      `selectionBackground: ${theme['selectionBackground']};`,
      `selectionInactiveBackground: ${theme['selectionInactiveBackground']};`,
      `selectionForeground: ${theme['selectionForeground']};`,
    ].join('\n');
  }

  private createXtermThemeFromPtyxisPalette_(
      colors: PtyxisPaletteFaceColors): XtermThemeColors {
    // Ptyxis stores VTE ANSI slots as Color0..Color15. xterm.js ITheme expects
    // named ANSI fields instead: black..white and brightBlack..brightWhite.
    return {
      background: colors.background,
      foreground: colors.foreground,
      cursor: colors.cursor,
      cursorAccent: colors.background,
      black: colors.color0,
      red: colors.color1,
      green: colors.color2,
      yellow: colors.color3,
      blue: colors.color4,
      magenta: colors.color5,
      cyan: colors.color6,
      white: colors.color7,
      brightBlack: colors.color8,
      brightRed: colors.color9,
      brightGreen: colors.color10,
      brightYellow: colors.color11,
      brightBlue: colors.color12,
      brightMagenta: colors.color13,
      brightCyan: colors.color14,
      brightWhite: colors.color15,
      selectionBackground: 'rgba(33, 84, 160, 0.96)',
      selectionInactiveBackground: 'rgba(33, 84, 160, 0.96)',
      selectionForeground: '#f7f9fc',
    };
  }

  private getDefaultTheme_(): {[key: string]: string} {
    return {
      background: '#111111',
      foreground: '#e6edf3',
      cursor: '#e6edf3',
      cursorAccent: '#111111',
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
    const configuredTheme = this.termTheme_.trim();
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

  private scheduleTerminalFontPreviewReset_(fontFamily?: string) {
    if (typeof fontFamily === 'string' && fontFamily) {
      this.terminalFontPreviewFontFamily_ = fontFamily;
    }
    if (this.terminalFontPreviewResetTimeout_ !== null) {
      window.clearTimeout(this.terminalFontPreviewResetTimeout_);
    }
    this.terminalFontPreviewResetTimeout_ = window.setTimeout(() => {
      this.terminalFontPreviewResetTimeout_ = null;
      void this.resetTerminalFontPreview_();
    });
  }

  private updateTerminalFontPreview_(fontSize: number) {
    this.terminalFontPreviewFontSize_ = this.clampFontSize_(fontSize);
    this.scheduleTerminalFontPreviewReset_();
  }

  private async resetTerminalFontPreview_() {
    const container = this.shadowRoot?.getElementById('terminalFontPreview');
    if (!container) {
      return;
    }

    try {
      await this.ensureTerminalFontPreviewResources_();
    } catch {
      return;
    }
    if (!this.isConnected || typeof Terminal === 'undefined') {
      return;
    }

    this.terminalFontPreview_?.dispose();
    this.terminalFontPreview_ = null;
    container.textContent = '';

    const fontSize = this.getTerminalFontPreviewSize_();
    const fontFamily = this.getTerminalFontPreviewFamily_();
    const theme = this.getConfiguredTheme_();
    const cols = this.computeTerminalFontPreviewCols_(container, fontSize);
    const rows = this.computeTerminalFontPreviewRows_(container, fontSize);
    this.updateTerminalPreviewGreetingStyle_(fontFamily, fontSize, theme);
    container.style.background = theme['background'] || '#111111';

    this.terminalFontPreview_ = new Terminal({
      cols,
      rows,
      convertEol: true,
      cursorBlink: true,
      disableStdin: true,
      fontFamily,
      fontSize,
      scrollback: 0,
      theme,
    });
    this.terminalFontPreview_.open(container);
    this.terminalPreviewDataListener_?.dispose();
    this.terminalPreviewDataListener_ = null;
    this.writeTerminalPreviewSnapshot_();
    requestAnimationFrame(() => {
      if (!this.isConnected || !this.terminalFontPreview_) {
        return;
      }
      this.crtermHandler_.onTerminalResize(cols, rows);
    });
  }

  private initializeTerminalPreviewSession_() {
    const factory = PageHandlerFactory.getRemote();
    factory.createPageHandler(
        this.crtermCallbackRouter_.$.bindNewPipeAndPassRemote(),
        this.crtermHandler_.$.bindNewPipeAndPassReceiver());
    this.crtermOutputListenerId_ =
        this.crtermCallbackRouter_.onTermOutput.addListener(
            (output: number[]) => this.handleTerminalPreviewOutput_(output));
  }

  private handleTerminalPreviewOutput_(output: number[]) {
    const decodedOutput = this.crtermOutputDecoder_.decode(
        new Uint8Array(output), {stream: true});
    if (!decodedOutput) {
      return;
    }

    this.terminalPreviewOutputBuffer_ += decodedOutput;
    this.trimTerminalPreviewOutputBuffer_();

    if (this.terminalFontPreview_) {
      this.terminalFontPreview_.write(decodedOutput);
    }
  }

  private trimTerminalPreviewOutputBuffer_() {
    if (this.terminalPreviewOutputBuffer_.length > 20000) {
      this.terminalPreviewOutputBuffer_ =
          this.terminalPreviewOutputBuffer_.slice(-20000);
    }
  }

  private writeTerminalPreviewSnapshot_() {
    if (!this.terminalFontPreview_) {
      return;
    }

    if (this.terminalPreviewOutputBuffer_) {
      this.terminalFontPreview_.write(this.terminalPreviewOutputBuffer_);
    }
  }

  private updateTerminalPreviewGreetingStyle_(
      fontFamily: string, fontSize: number, theme: {[key: string]: string}) {
    const greeting =
        this.shadowRoot?.getElementById('terminalPreviewGreeting');
    if (!greeting) {
      return;
    }

    greeting.style.fontFamily = fontFamily;
    greeting.style.fontSize = `${fontSize}px`;
    greeting.style.color = theme['foreground'] || '#e6edf3';
    greeting.style.textShadow = `0 0 8px ${theme['cursor'] || '#58a6ff'}`;
  }

  private getTerminalFontPreviewSize_(): number {
    if (this.terminalFontPreviewFontSize_ !== null) {
      return this.terminalFontPreviewFontSize_;
    }

    return this.clampFontSize_(Number(this.get('prefs.crterm.font_size.value')));
  }

  private getTerminalFontPreviewFamily_(): string {
    const fontFamilyValue = this.get('prefs.crterm.font_family.value');
    return this.terminalFontPreviewFontFamily_ ??
        (typeof fontFamilyValue === 'string' && fontFamilyValue ?
             fontFamilyValue :
             'monospace');
  }

  private computeTerminalFontPreviewCols_(
      container: HTMLElement, fontSize: number): number {
    return Math.max(20, Math.floor(container.clientWidth / (fontSize * 0.62)));
  }

  private computeTerminalFontPreviewRows_(
      container: HTMLElement, fontSize: number): number {
    return Math.max(
        TERMINAL_FONT_PREVIEW_MIN_ROWS,
        Math.floor(container.clientHeight / (fontSize * 1.35)));
  }

  private ensureTerminalFontPreviewResources_(): Promise<void> {
    this.ensureTerminalFontPreviewStyles_();
    if (this.terminalFontPreviewResourcesReady_) {
      return this.terminalFontPreviewResourcesReady_;
    }

    this.terminalFontPreviewResourcesReady_ = new Promise((resolve, reject) => {
      if (typeof Terminal !== 'undefined') {
        resolve();
        return;
      }

      let script =
          document.getElementById(XTERM_SCRIPT_ID) as HTMLScriptElement|null;
      if (!script) {
        script = document.createElement('script');
        script.id = XTERM_SCRIPT_ID;
        script.src = getTrustedScriptURL`./crterm_xterm.js`;
        document.head.appendChild(script);
      }

      script.addEventListener('load', () => resolve(), {once: true});
      script.addEventListener('error', () => reject(), {once: true});
    });
    return this.terminalFontPreviewResourcesReady_;
  }

  private ensureTerminalFontPreviewStyles_() {
    const shadowRoot = this.shadowRoot;
    if (!shadowRoot || shadowRoot.getElementById(XTERM_STYLESHEET_ID)) {
      return;
    }

    const stylesheet = document.createElement('link');
    stylesheet.id = XTERM_STYLESHEET_ID;
    stylesheet.rel = 'stylesheet';
    stylesheet.href = 'crterm_xterm.css';
    shadowRoot.prepend(stylesheet);
  }

  private onLimitScrollbackInput_(event: Event) {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/[^0-9]/g, '');
    if (input.value !== sanitized) {
      input.value = sanitized;
    }
    this.limitScrollback_ = sanitized;
    if (sanitized) {
      this.setPrefValue(CRTERM_LIMIT_SCROLLBACK_PREF, Number(sanitized));
    }
  }

  private onLimitScrollbackBlur_() {
    if (!this.limitScrollback_) {
      this.limitScrollback_ = '10240';
    }
    this.setPrefValue(
        CRTERM_LIMIT_SCROLLBACK_PREF, Number(this.limitScrollback_));
  }

  async searchContents(query: string) {
    const searchRequest = await getSearchManager().search(query, this);
    return searchRequest.getSearchResult();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'settings-crterm-page': SettingsCrTermPageElement;
  }
}

customElements.define(SettingsCrTermPageElement.is, SettingsCrTermPageElement);
