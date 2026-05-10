import {loadTimeData} from 'chrome://resources/js/load_time_data.js';
import {html} from '//resources/lit/v3_0/lit.rollup.js';
import type {CrtermAppElement} from './crterm_app.js';

export function getHtml(this: CrtermAppElement) {
  return html`<!--_html_template_start_-->
<div class="terminal-shell">
  ${this.captureCountdownVisible_ ? html`
    <div class="capture-countdown-overlay" aria-live="assertive">
      <div class="capture-countdown-value">
        ${this.captureCountdownValue_}
      </div>
    </div>` : ''}
  ${this.captureSelectionVisible_ ? html`
    <cr-dialog
        class="capture-dialog"
        consume-keydown-event
        no-cancel
        show-on-attach
        @cancel="${this.onCaptureCancel_}"
        @close="${this.onCaptureClose_}">
      <div slot="body" class="capture-dialog-body">
        <div
            id="capturePreviewStage"
            class="capture-preview-stage"
            @pointerdown="${this.onCapturePointerdown_}"
            @pointermove="${this.onCapturePointermove_}"
            @pointerup="${this.onCapturePointerup_}"
            @pointerleave="${this.onCapturePointerleave_}">
          <img
              class="capture-preview-image"
              src="${this.capturePreviewDataUrl_}"
              alt="Captured screen preview"
              draggable="false">
          ${this.captureSelectionStyle_ ? html`
            <div class="capture-selection-box"
                style="${this.captureSelectionStyle_}"></div>` : ''}
        </div>
      </div>
      <div slot="button-container">
        <cr-button class="cancel-button" @click="${this.onCaptureCancelClick_}">
          ${loadTimeData.getString('cancelLabel')}
        </cr-button>
        <cr-button
            class="action-button"
            ?disabled="${!this.captureHasSelection_}"
            @click="${this.onCaptureSaveClick_}">
          ${loadTimeData.getString('okLabel')}
        </cr-button>
      </div>
    </cr-dialog>` : ''}
  ${this.searchVisible_ ? html`
    <div class="search-box" role="search">
      <input
          id="searchInput"
          class="search-input"
          type="text"
          .value="${this.searchQuery_}"
          placeholder="Search terminal"
          @input="${this.onSearchInput_}"
          @keydown="${this.onSearchKeydown_}">
      <div class="search-count">${this.getSearchCountLabel_()}</div>
      <cr-icon-button
          class="search-icon-button"
          iron-icon="cr:arrow-drop-up"
          title="Prev"
          aria-label="Prev"
          @click="${this.onSearchPreviousClick_}">
      </cr-icon-button>
      <cr-icon-button
          class="search-icon-button"
          iron-icon="cr:arrow-drop-down"
          title="Next"
          aria-label="Next"
          @click="${this.onSearchNextClick_}">
      </cr-icon-button>
      <cr-icon-button
          class="search-icon-button"
          iron-icon="cr:close"
          title="Close"
          aria-label="Close"
          @click="${this.onSearchCloseClick_}">
      </cr-icon-button>
    </div>` : ''}
  ${this.searchVisible_ && this.searchMarkerStyles_.length ? html`
    <div class="search-marker-layer">
      ${this.searchMarkerStyles_.map((style, index) => style ? html`
        <div
            class="${index === this.searchMatchIndex_ ? 'search-marker current' :
                                                         'search-marker'}"
            style="${style}"></div>` : '')}
    </div>` : ''}
  ${this.searchHighlightStyles_.map((style, index) => style ? html`
    <div
        class="${index === this.searchMatchIndex_ ? 'search-highlight current' :
                                                     'search-highlight'}"
        style="${style}"></div>` : '')}
  ${this.crFilesReceiveOverlayVisible_ ? html`
    <div class="crfiles-receive-dock">
      ${this.crFilesReceivePanelOpen_ ? html`
        <div class="crfiles-receive-panel" role="status" aria-live="polite">
          <div class="crfiles-receive-panel-header">
            <div class="crfiles-receive-title">CrFiles Receive</div>
            <cr-icon-button
                class="crfiles-receive-close"
                iron-icon="cr:close"
                title="Close"
                aria-label="Close"
                @click="${this.onCrFilesReceivePanelCloseClick_}">
            </cr-icon-button>
          </div>
          <div class="crfiles-receive-status">
            <span class="crfiles-receive-running-dot"></span>
            <span>Service started</span>
          </div>
          <div class="crfiles-receive-detail">
            <span class="crfiles-receive-label">Address</span>
            <span class="crfiles-receive-value">
              ${this.crFilesReceiveOverlayEndpoint_}
            </span>
          </div>
          <div class="crfiles-receive-inline-row">
            <div class="crfiles-receive-detail crfiles-receive-pin-detail">
              <span class="crfiles-receive-label">PIN</span>
              <span class="crfiles-receive-pin">
                ${this.crFilesReceiveOverlayPinCode_}
              </span>
            </div>
            <div class="crfiles-receive-detail">
              <span class="crfiles-receive-label">Directory</span>
              <span class="crfiles-receive-value">
                ${this.crFilesReceiveOverlaySaveDir_}
              </span>
            </div>
          </div>
        </div>` : ''}
      <button
          class="crfiles-receive-button"
          title="CrFiles receive"
          aria-label="CrFiles receive"
          aria-expanded="${this.crFilesReceivePanelOpen_}"
          @click="${this.onCrFilesReceiveButtonClick_}">
        <img src="filedrop.svg" alt="" draggable="false">
        <span class="crfiles-receive-button-running"></span>
      </button>
    </div>` : ''}
  <div id="terminal"></div>
</div>
<!--_html_template_end_-->`;
}
