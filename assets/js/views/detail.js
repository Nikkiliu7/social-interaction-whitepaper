/** 案例详情：字段顺序、标题全部来自数据契约。 */

import { escapeHtml } from '../lib/dom.js';
import { getDictionaryEntry, getSource, isEmptyValue } from '../data.js';
import { emptyImageHtml, tagHtml } from '../components/ui.js';

function tagsSectionHtml(model, record) {
  const blocks = model.tagFields
    .map((field, index) => {
      const values = record.tags[field.key] || [];
      if (!values.length) return '';
      const chips = values
        .map((value) => {
          const entry = getDictionaryEntry(model, field.label, value);
          return tagHtml(value, {
            variant: field.key === 'game_title' ? 'game' : '',
            dim: field.key === 'game_title' ? '' : index % 6,
            title: entry ? `${entry.meaning}${entry.note ? `\n${entry.note}` : ''}` : `${field.label}：${value}`
          });
        })
        .join('');
      return `
        <div>
          <div class="detail-tags__label">${escapeHtml(field.label)}</div>
          <div class="tag-row">${chips}</div>
        </div>`;
    })
    .filter(Boolean)
    .join('');
  return blocks ? `<div class="detail-tags">${blocks}</div>` : '';
}

function textSectionsHtml(model, record) {
  return model.textFields
    .map((field) => {
      if (field.key === 'reference_case') return '';
      const value = record.text[field.key];
      if (isEmptyValue(value)) return '';
      return `
        <section class="detail-section">
          <h3 class="detail-section__title">${escapeHtml(field.label)}</h3>
          <p class="detail-section__text">${escapeHtml(value)}</p>
        </section>`;
    })
    .filter(Boolean)
    .join('');
}

function galleryHtml(record) {
  if (!record.images.length) return emptyImageHtml('配图待补充，后续在表格中补充后自动显示');
  const items = record.images
    .map(
      (image) => `
      <button class="gallery__item" type="button" data-action="open-image" data-src="${escapeHtml(
        image.src
      )}" data-alt="${escapeHtml(image.alt)}">
        <img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt || record.title)}" loading="lazy" />
      </button>`
    )
    .join('');
  return `<div class="gallery">${items}</div>`;
}

function sourceHtml(model, record) {
  const source = getSource(model, record.id);
  if (!source) return '';
  const rows = Object.entries(source)
    .filter(([key, value]) => key !== '案例ID' && !isEmptyValue(value))
    .map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>`)
    .join('');
  if (!rows) return '';
  return `
    <div class="collapse" data-open="false" id="source-collapse">
      <button class="collapse__head" type="button" data-action="toggle-collapse" data-target="source-collapse">
        <span>来源与原文</span><span aria-hidden="true">›</span>
      </button>
      <div class="collapse__body"><dl class="kv">${rows}</dl></div>
    </div>`;
}

export function detailTitleHtml(record) {
  return `${escapeHtml(record.shortTitle)} <span class="case-card__id">${escapeHtml(record.id)}</span>`;
}

export function detailBodyHtml(model, record) {
  return `
    <div class="detail-meta">
      ${record.game ? tagHtml(record.game, { variant: 'game' }) : ''}
      ${(record.tags.game_genres || []).map((value) => tagHtml(value)).join('')}
    </div>
    ${tagsSectionHtml(model, record)}
    ${textSectionsHtml(model, record)}
    <section class="detail-section">
      <h3 class="detail-section__title">配图</h3>
      ${galleryHtml(record)}
    </section>
    ${sourceHtml(model, record)}`;
}

export function detailFooterHtml(record, selected) {
  return `
    <button class="btn" type="button" data-action="copy-case-link" data-id="${escapeHtml(record.id)}">复制本案例链接</button>
    <button class="btn btn--lg ${selected ? '' : 'btn--primary'}" type="button" data-action="toggle-case" data-id="${escapeHtml(
      record.id
    )}" data-detail="true" aria-pressed="${selected}">
      ${selected ? '移出清单' : '加入清单'}
    </button>`;
}
