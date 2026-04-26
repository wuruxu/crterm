import {loadTimeData} from 'chrome://resources/js/load_time_data.js';
import {html} from '//resources/lit/v3_0/lit.rollup.js';
import type {CrTermAppElement} from './crterm_app.js';

export function getHtml(this: CrTermAppElement) {
  return html`<!--_html_template_start_-->
<div class="terminal-shell">
  ${this.captureSelectionVisible_ ? html`
    <cr-dialog
        class="capture-dialog"
        consume-keydown-event
        no-cancel
        show-on-attach
        @cancel="${this.closeCaptureSelection_}"
        @close="${this.closeCaptureSelection_}">
      <div slot="body" class="capture-dialog-body">
        <div
            id="capturePreviewStage"
            class="capture-preview-stage"
            @pointerdown="${this.beginCaptureSelection_}"
            @pointermove="${this.updateCaptureSelection_}"
            @pointerup="${this.endCaptureSelection_}"
            @pointerleave="${this.endCaptureSelection_}">
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
        <cr-button class="cancel-button" @click="${this.closeCaptureSelection_}">
          ${loadTimeData.getString('cancelLabel')}
        </cr-button>
        <cr-button
            class="action-button"
            ?disabled="${!this.captureHasSelection_}"
            @click="${this.saveCaptureSelection_}">
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
          @keydown="${this.onSearchKeyDown_}">
      <div class="search-count">${this.getSearchCountLabel_()}</div>
      <cr-icon-button
          class="search-icon-button"
          iron-icon="cr:arrow-drop-up"
          title="Prev"
          aria-label="Prev"
          @click="${this.findPrevious_}">
      </cr-icon-button>
      <cr-icon-button
          class="search-icon-button"
          iron-icon="cr:arrow-drop-down"
          title="Next"
          aria-label="Next"
          @click="${this.findNext_}">
      </cr-icon-button>
      <cr-icon-button
          class="search-icon-button"
          iron-icon="cr:close"
          title="Close"
          aria-label="Close"
          @click="${this.closeSearch_}">
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
  <div id="terminal"></div>
</div>
<!--_html_template_end_-->`;
}
