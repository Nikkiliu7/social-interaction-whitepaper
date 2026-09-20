/** 菜篮与清单方案视图。 */

import { escapeHtml, formatDateTime } from '../lib/dom.js';
import { tagHtml } from '../components/ui.js';

export function basketBarHtml(plan, count, persistent) {
  return `
    <div class="basket-bar__info">
      <div class="basket-bar__title">${escapeHtml(plan.name)}</div>
      <div class="basket-bar__meta">已选 ${count} 项${persistent ? '' : '（本次选择不会被保存）'}</div>
    </div>
    <button class="btn btn--sm" type="button" data-action="share-plan">分享</button>
    <button class="btn btn--sm" type="button" data-action="export-plan" data-format="md">导出</button>
    <button class="btn btn--primary btn--sm" type="button" data-action="open-basket">查看清单</button>`;
}

function planItemsHtml(model, plan) {
  if (!plan.caseIds.length) {
    return '<div class="empty-state">清单还是空的。回到列表勾选需要的设计吧。</div>';
  }
  return plan.caseIds
    .map((id) => {
      const record = model.byId.get(id);
      if (!record) {
        return `
          <div class="basket-item">
            <div class="basket-item__body">
              <div class="basket-item__title">${escapeHtml(id)}</div>
              <div class="text-faint" style="font-size:var(--fs-xs)">当前数据中不存在该案例</div>
            </div>
            <button class="btn btn--ghost btn--sm" type="button" data-action="remove-from-plan" data-id="${escapeHtml(
              id
            )}">移除</button>
          </div>`;
      }
      return `
        <div class="basket-item">
          <div class="basket-item__body">
            <button class="basket-item__title" type="button" data-action="open-case" data-id="${escapeHtml(
              record.id
            )}">${escapeHtml(record.title)}</button>
            <div class="tag-row" style="margin-top:4px">
              ${record.game ? tagHtml(record.game, { variant: 'game' }) : ''}
              <span class="tag tag__dim">${escapeHtml(record.id)}</span>
            </div>
          </div>
          <button class="btn btn--ghost btn--sm" type="button" data-action="remove-from-plan" data-id="${escapeHtml(
            record.id
          )}">移除</button>
        </div>`;
    })
    .join('');
}

function plansHtml(planBook) {
  return planBook.plans
    .map(
      (plan) => `
      <div class="plan-item" data-active="${plan.id === planBook.activePlanId}">
        <button class="plan-item__name" type="button" data-action="activate-plan" data-id="${escapeHtml(plan.id)}">
          ${escapeHtml(plan.name)} <span class="text-faint">· ${plan.caseIds.length} 项 · ${escapeHtml(
            formatDateTime(plan.updatedAt)
          )}</span>
        </button>
        <button class="btn btn--ghost btn--sm" type="button" data-action="rename-plan" data-id="${escapeHtml(
          plan.id
        )}">重命名</button>
        <button class="btn btn--ghost btn--sm btn--danger" type="button" data-action="delete-plan" data-id="${escapeHtml(
          plan.id
        )}">删除</button>
      </div>`
    )
    .join('');
}

export function basketModalBodyHtml(model, planBook, plan) {
  return `
    <div class="section__head">
      <h3 style="font-size:var(--fs-md)">清单方案</h3>
      <button class="btn btn--sm" type="button" data-action="new-plan">新建方案</button>
    </div>
    <div class="plan-list">${plansHtml(planBook)}</div>
    <div class="section__head">
      <h3 style="font-size:var(--fs-md)">「${escapeHtml(plan.name)}」共 ${plan.caseIds.length} 项</h3>
      ${
        plan.caseIds.length
          ? '<button class="btn btn--ghost btn--sm btn--danger" type="button" data-action="clear-plan">清空本方案</button>'
          : ''
      }
    </div>
    <div>${planItemsHtml(model, plan)}</div>`;
}

export function basketModalFooterHtml() {
  return `
    <button class="btn btn--sm" type="button" data-action="import-plan">导入 JSON</button>
    <button class="btn btn--sm" type="button" data-action="share-plan">生成分享链接</button>
    <button class="btn btn--sm" type="button" data-action="export-plan" data-format="csv">导出 CSV</button>
    <button class="btn btn--sm" type="button" data-action="export-plan" data-format="json">导出 JSON</button>
    <button class="btn btn--primary btn--sm" type="button" data-action="export-plan" data-format="md">导出 Markdown</button>`;
}

export function shareModalBodyHtml(url, tooLong) {
  return `
    <p class="text-muted" style="font-size:var(--fs-sm)">
      链接已包含本清单的全部案例，无需后端。对方打开后可预览并另存为自己的方案。
    </p>
    ${
      tooLong
        ? '<div class="banner">清单较大，链接可能被部分工具截断，建议改用「导出 JSON」发送文件。</div>'
        : ''
    }
    <code class="code-block" id="share-url">${escapeHtml(url)}</code>`;
}

export function sharePreviewHtml(model, payload, missing) {
  const items = payload.caseIds
    .map((id) => model.byId.get(id))
    .filter(Boolean)
    .map(
      (record) => `
      <div class="basket-item">
        <div class="basket-item__body">
          <button class="basket-item__title" type="button" data-action="open-case" data-id="${escapeHtml(
            record.id
          )}">${escapeHtml(record.title)}</button>
          <div class="tag-row" style="margin-top:4px">
            ${record.game ? tagHtml(record.game, { variant: 'game' }) : ''}
            <span class="tag tag__dim">${escapeHtml(record.id)}</span>
          </div>
        </div>
      </div>`
    )
    .join('');

  return `
    <div class="page">
      <section class="hero" style="padding-top:var(--space-6)">
        <span class="hero__eyebrow">分享的清单</span>
        <h1 class="hero__title" style="font-size:var(--fs-2xl)">${escapeHtml(payload.name)}</h1>
        <p class="hero__desc" style="font-size:var(--fs-md)">
          共 ${payload.caseIds.length - missing.length} 项可用案例${
            missing.length ? `，${missing.length} 项在当前数据中不存在已跳过` : ''
          }。在保存之前，你本地的清单不会被改动。
        </p>
        <div style="display:flex;gap:var(--space-2);flex-wrap:wrap;margin-top:var(--space-5)">
          <button class="btn btn--primary" type="button" data-action="save-shared-plan">保存为我的方案</button>
          <button class="btn" type="button" data-action="browse-all">去浏览全部案例</button>
        </div>
      </section>
      <section class="section">${items || '<div class="empty-state">这个分享链接里没有可用案例。</div>'}</section>
    </div>`;
}
