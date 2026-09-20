/** 案例卡：列表层只展示名称、游戏、核心标签与勾选控件。 */

import { escapeHtml } from '../lib/dom.js';
import { tagHtml } from './ui.js';

const MAX_TAGS_CARD = 6;
const MAX_TAGS_COMPACT = 4;

function coreTags(model, record, limit) {
  const chips = [];
  if (record.game) chips.push(tagHtml(record.game, { variant: 'game' }));
  for (const field of model.tagFields) {
    if (field.key === 'game_title') continue;
    for (const value of record.tags[field.key] || []) {
      if (chips.length >= limit) return chips;
      chips.push(tagHtml(value, { title: `${field.label}：${value}` }));
    }
  }
  return chips;
}

export function caseCardHtml(model, record, { selected = false, density = 'card' } = {}) {
  const limit = density === 'compact' ? MAX_TAGS_COMPACT : MAX_TAGS_CARD;
  const tags = coreTags(model, record, limit);
  const summary =
    density === 'compact'
      ? ''
      : `<p class="text-muted" style="font-size:var(--fs-sm);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${escapeHtml(
          (record.text.trigger_context || record.text.use_cases || '').replace(/\s+/g, ' ')
        )}</p>`;

  return `
    <article class="case-card" data-case-id="${escapeHtml(record.id)}" data-selected="${selected}" data-density="${density}">
      <button class="case-card__check" type="button" role="checkbox" aria-checked="${selected}" aria-pressed="${selected}"
        data-action="toggle-case" data-id="${escapeHtml(record.id)}" title="加入/移出清单">
        <span aria-hidden="true">✓</span>
        <span class="sr-only">${selected ? '移出清单' : '加入清单'}：${escapeHtml(record.title)}</span>
      </button>
      <div class="case-card__body">
        <div class="case-card__head">
          <button class="case-card__title" type="button" data-action="open-case" data-id="${escapeHtml(record.id)}">
            ${escapeHtml(record.title)}
          </button>
          <span class="case-card__id">${escapeHtml(record.id)}</span>
        </div>
        ${summary}
        <div class="tag-row">${tags.join('')}</div>
      </div>
    </article>`;
}
