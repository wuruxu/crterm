import {html} from '//resources/lit/v3_0/lit.rollup.js';
import type {CrTermAppElement} from './crterm_app.js';

export function getHtml(this: CrTermAppElement) {
  return html`<!--_html_template_start_-->
<div class="terminal-shell">
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
      <button class="search-button" @click="${this.findPrevious_}">Prev</button>
      <button class="search-button" @click="${this.findNext_}">Next</button>
      <button class="search-button" @click="${this.closeSearch_}">Close</button>
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
