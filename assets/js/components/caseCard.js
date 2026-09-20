/** 案例卡：列表层只展示名称、游戏、核心标签与勾选控件，视觉层级由 data-dim 与 CSS 决定。 */

import { escapeHtml } from '../lib/dom.js';

const MAX_TAGS_CARD = 5;
const MAX_TAGS_COMPACT = 3;

function chipHtml(value, { dim = '', title = '', variant = '' } = {}) {
  const cls = variant ? `tag tag--${variant}` : 'tag';
  return `<span class="${cls}" data-dim="${escapeHtml(String(dim))}" title="${escapeHtml(
    title || value
  )}">${escapeHtml(value)}</span>`;
}

/** 维度序号 → 色相，新增维度无需改代码即有配色。 */
function dimensionTags(model, record, limit) {
  const chips = [];
  let overflow = 0;
  model.tagFields.forEach((field, index) => {
    if (field.key === 'game_title' || field.key === 'game_genres') return;
    for (const value of record.tags[field.key] || []) {
      if (chips.length >= limit) {
        overflow += 1;
        continue;
      }
      chips.push(chipHtml(value, { dim: index % 6, title: `${field.label}：${value}` }));
    }
  });
  if (overflow) chips.push(`<span class="tag tag--more">+${overflow}</span>`);
  return chips;
}

function badgesHtml(model, record) {
  const badges = [];
  if (record.game) {
    badges.push(`<span class="case-card__badge case-card__badge--game">${escapeHtml(record.game)}</span>`);
  }
  for (const genre of record.tags.game_genres || []) {
    badges.push(`<span class="case-card__badge">${escapeHtml(genre)}</span>`);
  }
  return badges.length ? `<div class="case-card__badges">${badges.join('')}</div>` : '';
}

export function caseCardHtml(model, record, { selected = false, density = 'card' } = {}) {
  const compact = density === 'compact';
  const tags = dimensionTags(model, record, compact ? MAX_TAGS_COMPACT : MAX_TAGS_CARD);
  const summaryText = (record.text.trigger_context || record.text.use_cases || '').replace(/\s+/g, ' ');
  const summary =
    compact || !summaryText
      ? ''
      : `<p class="case-card__summary">${escapeHtml(summaryText)}</p>`;

  return `
    <article class="case-card" data-case-id="${escapeHtml(record.id)}" data-selected="${selected}" data-density="${density}"
      data-action="open-case" data-id="${escapeHtml(record.id)}" role="button" tabindex="0"
      aria-label="查看详情：${escapeHtml(record.shortTitle)}">
      <button class="case-card__check" type="button" role="checkbox" aria-checked="${selected}" aria-pressed="${selected}"
        data-action="toggle-case" data-id="${escapeHtml(record.id)}" title="加入/移出清单">
        <span aria-hidden="true">✓</span>
        <span class="sr-only">${selected ? '移出清单' : '加入清单'}：${escapeHtml(record.shortTitle)}</span>
      </button>
      <div class="case-card__body">
        ${badgesHtml(model, record)}
        <div class="case-card__head">
          <span class="case-card__title">${escapeHtml(record.shortTitle)}</span>
          <span class="case-card__id">${escapeHtml(record.id)}</span>
        </div>
        ${summary}
        <div class="tag-row case-card__tags">${tags.join('')}</div>
      </div>
    </article>`;
}
