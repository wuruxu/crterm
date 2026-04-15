// Copyright 2026 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import '/strings.m.js';

import 'chrome://resources/cr_elements/cr_button/cr_button.js';

import {loadTimeData} from 'chrome://resources/js/load_time_data.js';

function normalizeTerminalUrl(url: string): string {
  const crtermLocalPrefix = 'crterm://local';
  if (url.startsWith(crtermLocalPrefix)) {
    return `chrome://crterm${url.substring(crtermLocalPrefix.length)}`;
  }
  return url;
}

function openTerminalUrl(url: string) {
  const normalizedUrl = normalizeTerminalUrl(url);
  window.location.assign(normalizedUrl);
}

function activateTab(tabButton: HTMLElement) {
  const targetPanelId = tabButton.dataset['tabTarget'];
  if (!targetPanelId) {
    return;
  }

  const tabButtons = document.querySelectorAll<HTMLElement>('.tab-button');
  const tabPanels = document.querySelectorAll<HTMLElement>('.tab-panel');

  tabButtons.forEach(button => {
    const isActive = button === tabButton;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });

  tabPanels.forEach(panel => {
    const isActive = panel.id === targetPanelId;
    panel.classList.toggle('is-active', isActive);
    panel.hidden = !isActive;
  });
}

function setCopyButtonState(button: HTMLButtonElement, label: string) {
  const originalLabel = button.dataset['originalLabel'] ?? 'Copy';
  button.textContent = label;
  button.classList.add('is-copied');

  window.setTimeout(() => {
    button.textContent = originalLabel;
    button.classList.remove('is-copied');
  }, 1400);
}

function fallbackCopyText(text: string): boolean {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.select();

  const copied = document.execCommand('copy');
  document.body.removeChild(textArea);
  return copied;
}

async function copyText(button: HTMLButtonElement) {
  const text = button.dataset['copyText'];
  if (!text) {
    return;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      setCopyButtonState(button, 'Copied');
      return;
    }
  } catch {
  }

  if (fallbackCopyText(text)) {
    setCopyButtonState(button, 'Copied');
    return;
  }

  setCopyButtonState(button, 'Failed');
}

window.addEventListener('DOMContentLoaded', () => {
  const homeButton = document.getElementById('openHomeButton');
  homeButton?.addEventListener('click', () => {
    openTerminalUrl(loadTimeData.getString('homeTermUrl'));
  });

  const tmpButton = document.getElementById('openTmpButton');
  tmpButton?.addEventListener('click', () => {
    openTerminalUrl(loadTimeData.getString('tmpTermUrl'));
  });

  document.querySelectorAll<HTMLElement>('.tab-button').forEach(button => {
    button.addEventListener('click', () => activateTab(button));
  });

  document.querySelectorAll<HTMLButtonElement>('.copy-button').forEach(button => {
    button.dataset['originalLabel'] = button.textContent ?? 'Copy';
    button.addEventListener('click', async () => {
      await copyText(button);
    });
  });
});
