/** 首页：渐进式入口。入口只引用字段ID，数据里没有该维度时自动隐藏。 */

import { escapeHtml } from '../lib/dom.js';

export const ENTRIES = [
  {
    id: 'game',
    title: '按游戏 / 品类找',
    desc: '先锁定参考来源：从某款游戏或某个品类出发，看它们怎么做社交。',
    facetKeys: ['game_title', 'game_genres']
  },
  {
    id: 'purpose',
    title: '按社交目的找',
    desc: '从动机与想交付的体验出发：破冰、协作、炫耀、情绪抚慰……',
    facetKeys: ['social_motives', 'expected_experience']
  },
  {
    id: 'stage',
    title: '按游玩阶段找',
    desc: '沿着玩家生命周期：破冰期 → 局外备战 → 局内 → 结算 → 离线异步。',
    facetKeys: ['play_stages']
  },
  {
    id: 'form',
    title: '按功能形态找',
    desc: '从实现形态倒推：交互媒介、作用范围、对象关系。',
    facetKeys: ['interaction_media', 'spatial_scopes', 'relationships']
  }
];

export function entryById(id) {
  return ENTRIES.find((entry) => entry.id === id) || null;
}

export function entryFacets(model, entry) {
  return entry.facetKeys
    .map((key) => model.facets.find((facet) => facet.key === key))
    .filter(Boolean);
}

function statHtml(value, label) {
  return `<div class="stat"><div class="stat__value">${escapeHtml(value)}</div><div class="stat__label">${escapeHtml(
    label
  )}</div></div>`;
}

function entryCardHtml(model, entry, index) {
  const facets = entryFacets(model, entry);
  if (!facets.length) return '';
  const primary = facets[0];
  const preview = primary.options
    .slice(0, 4)
    .map(
      (option) => `
      <span class="tag" role="button" tabindex="0" data-action="open-entry-value"
        data-entry="${escapeHtml(entry.id)}" data-key="${escapeHtml(primary.key)}" data-value="${escapeHtml(
          option.value
        )}" title="直接按「${escapeHtml(primary.label)}：${escapeHtml(option.value)}」筛选">
        ${escapeHtml(option.value)}
      </span>`
    );
  const rest = facets.length > 1 ? facets.slice(1).map((facet) => facet.label).join(' · ') : '';
  return `
    <div class="entry-card" role="button" tabindex="0" data-action="open-entry" data-entry="${escapeHtml(entry.id)}">
      <span class="entry-card__index">0${index + 1}</span>
      <span class="entry-card__title">${escapeHtml(entry.title)}</span>
      <span class="entry-card__desc">${escapeHtml(entry.desc)}</span>
      <span class="entry-card__foot">
        ${preview.join('')}
        ${rest ? `<span class="tag tag__dim">+ ${escapeHtml(rest)}</span>` : ''}
      </span>
    </div>`;
}

function packsSectionHtml(model) {
  if (!model.packs.length) return '';
  const cards = model.packs
    .map(
      (pack) => `
      <button class="entry-card" type="button" data-action="open-pack" data-pack="${escapeHtml(pack.id)}">
        <span class="entry-card__index">场景包</span>
        <span class="entry-card__title">${escapeHtml(pack.title || pack.id)}</span>
        <span class="entry-card__desc">${escapeHtml(pack.desc || '')}</span>
      </button>`
    )
    .join('');
  return `
    <section class="section">
      <div class="section__head"><h2 class="section__title">推荐场景包</h2></div>
      <div class="entry-grid">${cards}</div>
    </section>`;
}

export function homeHtml(model, route) {
  const tagCount = model.facets.reduce((total, facet) => total + facet.options.length, 0);
  const gameFacet = model.facets.find((facet) => facet.key === 'game_title');
  const entries = ENTRIES.map((entry, index) => entryCardHtml(model, entry, index)).filter(Boolean);

  return `
    <div class="page">
      <section class="hero">
        <span class="hero__eyebrow">社交互动设计模式库 · ${escapeHtml(model.schemaVersion)}</span>
        <h1 class="hero__title"><span class="gradient-text">社交互动体验白皮书</span></h1>
        <p class="hero__desc">
          把跨品类的社交设计拆成可检索、可比较、可“点菜”的最小单元。先按你关心的维度进入，
          勾选需要的设计，最后导出一份属于你项目的社交互动设计清单。
        </p>
        <div class="hero__search">
          <div class="field">
            <span class="field__icon" aria-hidden="true">⌕</span>
            <input id="home-search" type="search" placeholder="搜索案例、玩法、关键词，例如：Ping、点赞、庄园" value="${escapeHtml(
              route.query || ''
            )}" aria-label="全局搜索" />
            <button class="btn btn--primary btn--sm" type="button" data-action="submit-search">搜索</button>
          </div>
        </div>
        <div class="stat-row">
          ${statHtml(model.records.length, '社交案例')}
          ${statHtml(gameFacet ? gameFacet.options.length : '—', '覆盖游戏')}
          ${statHtml(model.facets.length, '筛选维度')}
          ${statHtml(tagCount, '标签总数')}
        </div>
      </section>

      <section class="section">
        <div class="section__head">
          <h2 class="section__title">从哪里开始？</h2>
          <button class="btn btn--sm" type="button" data-action="browse-all">直接浏览全部 →</button>
        </div>
        <div class="entry-grid">${entries.join('')}</div>
      </section>

      ${packsSectionHtml(model)}

      <section class="section">
        <div class="section__head"><h2 class="section__title">怎么用</h2></div>
        <div class="entry-grid">
          <div class="card" style="padding:var(--space-5)">
            <h3 style="font-size:var(--fs-md)">1 · 检索</h3>
            <p class="text-muted" style="font-size:var(--fs-sm)">按游戏、目的、阶段或形态进入，多维标签自由组合。</p>
          </div>
          <div class="card" style="padding:var(--space-5)">
            <h3 style="font-size:var(--fs-md)">2 · 点菜</h3>
            <p class="text-muted" style="font-size:var(--fs-sm)">勾选需要的设计，随时查看详情、配图与来源。</p>
          </div>
          <div class="card" style="padding:var(--space-5)">
            <h3 style="font-size:var(--fs-md)">3 · 出清单</h3>
            <p class="text-muted" style="font-size:var(--fs-sm)">保存多套方案，导出 Markdown / CSV / JSON，或用链接分享。</p>
          </div>
        </div>
      </section>
    </div>`;
}
