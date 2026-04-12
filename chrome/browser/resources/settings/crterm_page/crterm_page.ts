// Copyright 2026 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import 'chrome://resources/cr_elements/cr_shared_style.css.js';
import 'chrome://resources/cr_elements/cr_toggle/cr_toggle.js';
import '../controls/settings_dropdown_menu.js';
import '../controls/settings_toggle_button.js';
import '../settings_page/settings_section.js';
import '../settings_shared.css.js';

import type {FontsData} from '/shared/settings/appearance_page/fonts_browser_proxy.js';
import {FontsBrowserProxyImpl} from '/shared/settings/appearance_page/fonts_browser_proxy.js';
import {PrefsMixin} from '/shared/settings/prefs/prefs_mixin.js';
import {PolymerElement} from 'chrome://resources/polymer/v3_0/polymer/polymer_bundled.min.js';

import {getSearchManager} from '../search_settings.js';
import type {DropdownMenuOptionList} from '../controls/settings_dropdown_menu.js';
import type {SettingsPlugin} from '../settings_main/settings_plugin.js';

import {getTemplate} from './crterm_page.html.js';

const CRTERM_THEME_PREF = 'crterm.term_theme';
const CRTERM_DEFAULT_SHELL_PREF = 'crterm.default_shell';
const CRTERM_FONT_SIZE_PREF = 'crterm.font_size';
const CRTERM_LIMIT_SCROLLBACK_PREF = 'crterm.limit_scrollback';
const MIN_CRTERM_FONT_SIZE = 6;
const MAX_CRTERM_FONT_SIZE = 36;
const DEFAULT_CRTERM_THEME =
    'background: #111111;\n' +
    'selectionBackground: rgba(33, 84, 160, 0.96);\n' +
    'selectionInactiveBackground: rgba(33, 84, 160, 0.96);\n' +
    'selectionForeground: #f7f9fc;';

const SettingsCrTermPageElementBase = PrefsMixin(PolymerElement);

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
      fontFamilyOptions_: {
        type: Array,
        value: () => [{value: 'monospace', name: 'monospace'}],
      },
      fontSize_: {
        type: String,
        value: '14',
      },
      limitScrollback_: {
        type: String,
        value: '10240',
      },
      termTheme_: {
        type: String,
        value: DEFAULT_CRTERM_THEME,
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
          'prefs.crterm.close_button_visible.value)',
    ];
  }

  private fontsBrowserProxy_ = FontsBrowserProxyImpl.getInstance();
  declare private defaultShell_: string;
  declare private fontFamilyOptions_: DropdownMenuOptionList;
  declare private fontSize_: string;
  declare private limitScrollback_: string;
  declare private termTheme_: string;

  override ready() {
    super.ready();
    this.fontsBrowserProxy_.fetchMonospaceFontsData().then(
        this.setMonospaceFontsData_.bind(this));
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
      _fontFamily: string|undefined,
      fontSize: number|string|undefined,
      limitScrollback: number|string|undefined,
      _restoreTerminalOutputOnStartup: boolean|undefined,
      _closeButtonVisible: boolean|undefined) {
    if (typeof termTheme === 'string') {
      this.termTheme_ = termTheme || DEFAULT_CRTERM_THEME;
    }
    if (typeof defaultShell === 'string') {
      this.defaultShell_ = defaultShell;
    }
    if (typeof fontSize === 'number' || typeof fontSize === 'string') {
      this.fontSize_ = `${this.clampNumber_(
          Number(fontSize), MIN_CRTERM_FONT_SIZE, MAX_CRTERM_FONT_SIZE, 14)}`;
    }
    if (typeof limitScrollback === 'number' ||
        typeof limitScrollback === 'string') {
      this.limitScrollback_ = `${limitScrollback}`;
    }
  }

  private onTermThemeInput_(event: Event) {
    const value = (event.target as HTMLTextAreaElement).value;
    this.termTheme_ = value;
    this.setPrefValue(CRTERM_THEME_PREF, value);
  }

  private onDefaultShellInput_(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.defaultShell_ = value;
    this.setPrefValue(CRTERM_DEFAULT_SHELL_PREF, value);
  }

  private clampNumber_(
      value: number, min: number, max: number, fallback: number): number {
    if (!Number.isFinite(value)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, Math.trunc(value)));
  }

  private onFontSizeInput_(event: Event) {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/[^0-9]/g, '');
    if (input.value !== sanitized) {
      input.value = sanitized;
    }
    this.fontSize_ = sanitized;
    if (sanitized) {
      this.setPrefValue(
          CRTERM_FONT_SIZE_PREF,
          this.clampNumber_(
              Number(sanitized), MIN_CRTERM_FONT_SIZE, MAX_CRTERM_FONT_SIZE,
              14));
    }
  }

  private onFontSizeBlur_() {
    this.fontSize_ = `${this.clampNumber_(
        Number(this.fontSize_), MIN_CRTERM_FONT_SIZE, MAX_CRTERM_FONT_SIZE,
        14)}`;
    this.setPrefValue(CRTERM_FONT_SIZE_PREF, Number(this.fontSize_));
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

  private onCloseButtonToggleChanged_(event: CustomEvent<boolean>) {
    this.setPrefValue('crterm.close_button_visible', event.detail);
  }

  private onRestoreTerminalOutputToggleChanged_(event: CustomEvent<boolean>) {
    this.setPrefValue(
        'crterm.restore_terminal_output_on_startup', event.detail);
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
