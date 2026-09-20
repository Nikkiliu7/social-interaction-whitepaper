/** 列表页：筛选 + 结果增量渲染。 */

import { escapeHtml } from '../lib/dom.js';
import { filterPanelHtml, activeFiltersHtml } from '../components/filters.js';
import { caseCardHtml } from '../components/caseCard.js';

const BATCH_SIZE = 40;
let observer = null;

export function listHtml(model, route, counts, { density = 'card', resultCount = 0 } = {}) {
  return `
    <div class="page">
      <div class="list-layout">
        <aside class="filter-panel list-layout__sidebar" id="filter-panel">
          ${filterPanelHtml(model, route, counts)}
        </aside>
        <section>
          <div class="results-head">
            <div class="field field--sm" style="flex:1;min-width:220px">
              <span class="field__icon" aria-hidden="true">⌕</span>
              <input id="list-search" type="search" placeholder="在结果中搜索关键词" value="${escapeHtml(
                route.query || ''
              )}" aria-label="搜索案例" />
            </div>
            <button class="btn btn--sm only-narrow" type="button" data-action="open-filter-drawer">筛选</button>
            <div class="btn-group" role="group" aria-label="列表密度">
              <button class="btn" type="button" data-action="set-density" data-value="card" aria-pressed="${
                density === 'card'
              }">卡片</button>
              <button class="btn" type="button" data-action="set-density" data-value="compact" aria-pressed="${
                density === 'compact'
              }">紧凑</button>
            </div>
            <span class="results-head__count"><strong id="result-count">${resultCount}</strong> 条结果</span>
          </div>
          <div id="active-filters">${activeFiltersHtml(model, route)}</div>
          <div class="case-grid" id="case-grid" data-density="${density}"></div>
          <div class="sentinel" id="list-sentinel"></div>
          <div id="list-empty"></div>
        </section>
      </div>
    </div>`;
}

export function emptyResultHtml(route) {
  const hint = route.query ? `没有匹配“${escapeHtml(route.query)}”的案例。` : '当前筛选条件下没有案例。';
  return `
    <div class="empty-state">
      <strong style="color:var(--text-strong)">${hint}</strong>
      <span>试试减少条件，或换一个关键词。</span>
      <button class="btn btn--primary btn--sm" type="button" data-action="clear-all">清除筛选与搜索</button>
    </div>`;
}

/** 增量渲染：每批 40 条，滚动到底再追加，避免一次性铺开全部节点。 */
export function mountResults(root, model, records, { density, isSelected }) {
  const grid = root.querySelector('#case-grid');
  const sentinel = root.querySelector('#list-sentinel');
  const empty = root.querySelector('#list-empty');
  if (!grid) return;

  observer?.disconnect();
  grid.innerHTML = '';
  if (empty) empty.innerHTML = '';

  if (!records.length) return;

  let rendered = 0;
  const renderBatch = () => {
    const slice = records.slice(rendered, rendered + BATCH_SIZE);
    if (!slice.length) return;
    grid.insertAdjacentHTML(
      'beforeend',
      slice
        .map((record) => caseCardHtml(model, record, { selected: isSelected(record.id), density }))
        .join('')
    );
    rendered += slice.length;
    if (rendered >= records.length) observer?.disconnect();
  };

  renderBatch();

  if (sentinel && rendered < records.length) {
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) renderBatch();
      },
      { rootMargin: '400px 0px' }
    );
    observer.observe(sentinel);
  }
}

export function destroyResults() {
  observer?.disconnect();
  observer = null;
}
