/** 筛选面板：维度与选项全部来自数据契约，页面不硬编码任何标签。 */

import { escapeHtml } from '../lib/dom.js';
import { countFilters } from '../router.js';

const DEFAULT_VISIBLE = 10;
const openGroups = new Set();
const expandedGroups = new Set();
let initialized = false;

export function initFilterGroups(model, route) {
  if (initialized) return;
  initialized = true;
  const selectedKeys = Object.keys(route.filters || {});
  const defaults = selectedKeys.length ? selectedKeys : model.facets.slice(0, 3).map((f) => f.key);
  for (const key of defaults) openGroups.add(key);
}

export function toggleGroup(key) {
  if (openGroups.has(key)) openGroups.delete(key);
  else openGroups.add(key);
}

export function expandGroup(key) {
  expandedGroups.add(key);
}

export function openGroup(key) {
  openGroups.add(key);
}

function optionHtml(facet, option, selectedValues, counts) {
  const selected = selectedValues.includes(option.value);
  const count = counts?.get(option.value) ?? 0;
  return `
    <button class="filter-option" type="button" role="checkbox" aria-checked="${selected}" aria-pressed="${selected}"
      data-action="toggle-filter" data-key="${escapeHtml(facet.key)}" data-value="${escapeHtml(option.value)}"
      data-empty="${!selected && count === 0}">
      <span class="filter-option__box" aria-hidden="true">✓</span>
      <span class="filter-option__label" title="${escapeHtml(option.value)}">${escapeHtml(option.value)}</span>
      <span class="filter-option__count">${count}</span>
    </button>`;
}

export function filterPanelHtml(model, route, counts) {
  const filters = route.filters || {};
  const total = countFilters(filters);
  const groups = model.facets
    .map((facet) => {
      const selectedValues = filters[facet.key] || [];
      const isOpen = openGroups.has(facet.key) || selectedValues.length > 0;
      const expanded = expandedGroups.has(facet.key);
      const facetCountMap = counts?.get(facet.key);
      const options = facet.options;
      const visible = expanded ? options : options.slice(0, DEFAULT_VISIBLE);
      const more = options.length - visible.length;
      return `
        <div class="filter-group" data-open="${isOpen}">
          <button class="filter-group__head" type="button" data-action="toggle-group" data-key="${escapeHtml(
            facet.key
          )}" aria-expanded="${isOpen}">
            <span>${escapeHtml(facet.label)}${
              selectedValues.length ? `<span class="tag tag--accent" style="margin-left:8px">${selectedValues.length}</span>` : ''
            }</span>
            <span class="filter-group__caret" aria-hidden="true">›</span>
          </button>
          <div class="filter-group__body">
            ${visible.map((option) => optionHtml(facet, option, selectedValues, facetCountMap)).join('')}
            ${
              more > 0
                ? `<button class="btn btn--ghost btn--sm" type="button" data-action="expand-group" data-key="${escapeHtml(
                    facet.key
                  )}">展开其余 ${more} 项</button>`
                : ''
            }
          </div>
        </div>`;
    })
    .join('');

  return `
    <div class="filter-panel__head" style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">
      <strong style="font-size:var(--fs-sm)">筛选条件${total ? `（${total}）` : ''}</strong>
      ${total ? '<button class="btn btn--ghost btn--sm" type="button" data-action="clear-filters">清空</button>' : ''}
    </div>
    ${groups}`;
}

export function activeFiltersHtml(model, route) {
  const filters = route.filters || {};
  const chips = [];
  if (route.query) {
    chips.push(`
      <button class="chip-remove" type="button" data-action="clear-query">
        搜索：${escapeHtml(route.query)} <span class="chip-remove__x" aria-hidden="true">✕</span>
      </button>`);
  }
  for (const facet of model.facets) {
    for (const value of filters[facet.key] || []) {
      chips.push(`
        <button class="chip-remove" type="button" data-action="remove-filter" data-key="${escapeHtml(
          facet.key
        )}" data-value="${escapeHtml(value)}">
          <span class="tag__dim">${escapeHtml(facet.label)}·</span>${escapeHtml(value)}
          <span class="chip-remove__x" aria-hidden="true">✕</span>
        </button>`);
    }
  }
  if (!chips.length) return '';
  chips.push('<button class="btn btn--ghost btn--sm" type="button" data-action="clear-filters">清空全部</button>');
  return `<div class="active-filters">${chips.join('')}</div>`;
}
