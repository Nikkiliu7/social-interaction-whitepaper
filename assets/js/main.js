/** 应用入口：装配数据、路由、视图与全部交互。 */

import { loadLibrary, filterRecords, facetCounts, DataLoadError } from './data.js';
import {
  initRouter,
  getRoute,
  navigate,
  buildHash,
  toggleFilterValue,
  removeFilterValue
} from './router.js';
import * as state from './state.js';
import { homeHtml, entryById, entryFacets } from './views/home.js';
import { listHtml, mountResults, emptyResultHtml, destroyResults } from './views/list.js';
import { detailBodyHtml, detailFooterHtml, detailTitleHtml } from './views/detail.js';
import * as basketView from './views/basket.js';
import {
  filterPanelHtml,
  activeFiltersHtml,
  initFilterGroups,
  toggleGroup,
  expandGroup,
  openGroup
} from './components/filters.js';
import * as ui from './components/ui.js';
import { createParticles } from './lib/particles.js';
import { exportPlan, parsePlanFile } from './lib/export.js';
import { buildShareUrl, decodeShare, MAX_SHARE_LENGTH } from './lib/share.js';
import {
  qs,
  qsa,
  debounce,
  downloadBlob,
  copyText,
  pickFile,
  escapeHtml,
  formatDateTime
} from './lib/dom.js';

const appRoot = qs('#app');
let model = null;
let particles = null;
let lastShellKey = '';
let basketModalOpen = false;

/* ---------------- 启动 ---------------- */

async function boot() {
  try {
    model = await loadLibrary();
  } catch (error) {
    renderLoadError(error);
    return;
  }

  state.initState({ model });
  setupHeader();
  setupParticles();
  setupEvents();
  state.subscribe(handleStateChange);
  initRouter(render);
  renderFooter();

  if (!state.isPersistent()) {
    ui.showToast('浏览器本地存储不可用，本次选择不会被保存', 'error');
  }
}

function renderLoadError(error) {
  const fileHint = error instanceof DataLoadError && error.likelyFileProtocol;
  appRoot.innerHTML = `
    <div class="page">
      <div class="banner banner--error">数据加载失败：${escapeHtml(error.message)}</div>
      ${
        fileHint
          ? `<div class="card" style="padding:var(--space-5)">
              <h2 style="font-size:var(--fs-lg);margin-bottom:var(--space-3)">请用本地静态服务器打开</h2>
              <p class="text-muted" style="font-size:var(--fs-sm);margin-bottom:var(--space-4)">
                浏览器出于安全限制，禁止 <code>file://</code> 页面读取本地 JSON。在 <code>web/</code> 目录下执行任意一条命令，然后访问
                <code>http://localhost:8000</code>。
              </p>
              <code class="code-block">Windows：  cd web &amp;&amp; python -m http.server 8000</code>
              <div style="height:8px"></div>
              <code class="code-block">macOS：    cd web &amp;&amp; python3 -m http.server 8000</code>
            </div>`
          : ''
      }
    </div>`;
}

function setupHeader() {
  const subtitle = model.build
    ? `${model.build.source_file} · ${model.build.records} 条案例`
    : model.subtitle;
  qs('#header-subtitle').textContent = subtitle;
}

function setupParticles() {
  particles = createParticles(qs('#bg-particles'));
  const enabled = state.getPrefs().particles && !particles.isReduced();
  particles.setEnabled(enabled);
  const toggle = qs('#particles-toggle');
  toggle.setAttribute('aria-pressed', String(enabled));
  if (particles.isReduced()) toggle.title = '系统已开启“减少动态效果”，背景动效保持关闭';
}

function renderFooter() {
  const build = model.build;
  const parts = [
    `数据版本 ${escapeHtml(model.schemaVersion)}`,
    build ? `来源：${escapeHtml(build.source_file)}` : '',
    build ? `导出于 ${escapeHtml(formatDateTime(build.exported_at))}` : '',
    `${model.records.length} 条案例 · ${model.facets.length} 个筛选维度`
  ].filter(Boolean);
  qs('#app-footer').innerHTML = parts.map((part) => `<span>${part}</span>`).join('');

  if (!model.schemaSupported) {
    appRoot.insertAdjacentHTML(
      'afterbegin',
      `<div class="page" style="padding-bottom:0"><div class="banner">
        数据 schema 版本为 ${escapeHtml(model.schemaVersion)}，页面按 1.1 渲染，部分字段可能显示异常。请检查导入器与表格版本。
      </div></div>`
    );
  }
}

/* ---------------- 渲染 ---------------- */

function shellKey(route) {
  return JSON.stringify([route.name, route.filters, route.query, route.entry, route.share]);
}

function render(route = getRoute()) {
  const key = shellKey(route);
  if (key !== lastShellKey) {
    lastShellKey = key;
    destroyResults();
    if (route.name === 'list') renderListView(route);
    else if (route.name === 'share') renderShareView(route);
    else {
      appRoot.innerHTML = homeHtml(model, route);
      renderFooter();
    }
  }
  syncDetail(route);
  renderBasketBar();
  if (qs('#filter-drawer').dataset.open === 'true') refreshFilterPanels(route);
}

function currentRecords(route) {
  return filterRecords(model, { filters: route.filters, query: route.query });
}

function renderListView(route) {
  const entry = entryById(route.entry);
  if (entry) for (const facet of entryFacets(model, entry)) openGroup(facet.key);
  initFilterGroups(model, route);

  const counts = facetCounts(model, { filters: route.filters, query: route.query });
  const records = currentRecords(route);
  const density = state.getPrefs().density;

  appRoot.innerHTML = listHtml(model, route, counts, { density, resultCount: records.length });
  mountResults(appRoot, model, records, { density, isSelected: state.isSelected });
  if (!records.length) qs('#list-empty').innerHTML = emptyResultHtml(route);
  renderFooter();
}

/** 只更新结果与计数，保留搜索框焦点。 */
function refreshResults(route) {
  const counts = facetCounts(model, { filters: route.filters, query: route.query });
  const records = currentRecords(route);
  const density = state.getPrefs().density;
  const countNode = qs('#result-count');
  if (countNode) countNode.textContent = String(records.length);
  const chips = qs('#active-filters');
  if (chips) chips.innerHTML = activeFiltersHtml(model, route);
  refreshFilterPanels(route, counts);
  mountResults(appRoot, model, records, { density, isSelected: state.isSelected });
  const empty = qs('#list-empty');
  if (empty) empty.innerHTML = records.length ? '' : emptyResultHtml(route);
}

function refreshFilterPanels(route, counts) {
  const computed = counts || facetCounts(model, { filters: route.filters, query: route.query });
  const panel = qs('#filter-panel');
  if (panel) panel.innerHTML = filterPanelHtml(model, route, computed);
  const drawerPanel = qs('#drawer-filter-panel');
  if (drawerPanel) drawerPanel.innerHTML = filterPanelHtml(model, route, computed);
}

function renderShareView(route) {
  let payload = null;
  try {
    payload = decodeShare(route.share || '');
  } catch (error) {
    appRoot.innerHTML = `<div class="page"><div class="banner banner--error">分享链接无法解析：${escapeHtml(
      error.message
    )}</div></div>`;
    return;
  }
  const missing = payload.caseIds.filter((id) => !model.byId.has(id));
  appRoot.dataset.sharedName = payload.name;
  appRoot.dataset.sharedIds = payload.caseIds.filter((id) => model.byId.has(id)).join(',');
  appRoot.innerHTML = basketView.sharePreviewHtml(model, payload, missing);
  if (missing.length) {
    ui.showToast(`${missing.length} 项案例在当前数据中不存在，已跳过`, 'error');
  }
  renderFooter();
}

/* ---------------- 详情 ---------------- */

let detailOpenId = null;

function syncDetail(route) {
  const wanted = route.caseId && model.byId.has(route.caseId) ? route.caseId : null;
  if (wanted === detailOpenId) return;
  if (detailOpenId) {
    detailOpenId = null;
    ui.closeAllModals();
  }
  if (!wanted) return;
  openDetail(model.byId.get(wanted));
}

function openDetail(record) {
  detailOpenId = record.id;
  ui.openModal({
    title: detailTitleHtml(record),
    body: detailBodyHtml(model, record),
    footer: detailFooterHtml(record, state.isSelected(record.id)),
    onClose: () => {
      detailOpenId = null;
      if (getRoute().caseId) navigate({ caseId: null });
    }
  });
}

/* ---------------- 菜篮 ---------------- */

function renderBasketBar() {
  const bar = qs('#basket-bar');
  const plan = state.getActivePlan();
  const count = plan.caseIds.length;
  qs('#header-basket-count').textContent = String(count);
  if (!count) {
    bar.hidden = true;
    bar.innerHTML = '';
    return;
  }
  bar.hidden = false;
  bar.innerHTML = basketView.basketBarHtml(plan, count, state.isPersistent());
}

function openBasketModal() {
  basketModalOpen = true;
  ui.openModal({
    title: '我的清单',
    body: basketView.basketModalBodyHtml(model, state.getState().planBook, state.getActivePlan()),
    footer: basketView.basketModalFooterHtml(),
    onClose: () => {
      basketModalOpen = false;
    }
  });
}

function refreshBasketModal() {
  if (!basketModalOpen) return;
  const body = qs('#modal-root .modal__body');
  if (body) {
    body.innerHTML = basketView.basketModalBodyHtml(
      model,
      state.getState().planBook,
      state.getActivePlan()
    );
  }
}

function syncSelectionUI() {
  const selected = new Set(state.getSelectedIds());
  for (const node of qsa('[data-case-id]')) {
    const isOn = selected.has(node.dataset.caseId);
    node.dataset.selected = String(isOn);
    const button = node.querySelector('.case-card__check');
    if (button) {
      button.setAttribute('aria-pressed', String(isOn));
      button.setAttribute('aria-checked', String(isOn));
    }
  }
  const detailButton = qs('[data-action="toggle-case"][data-detail="true"]');
  if (detailButton && detailOpenId) {
    const isOn = selected.has(detailOpenId);
    detailButton.textContent = isOn ? '移出清单' : '加入清单';
    detailButton.setAttribute('aria-pressed', String(isOn));
    detailButton.classList.toggle('btn--primary', !isOn);
  }
  renderBasketBar();
  refreshBasketModal();
}

function handleStateChange({ type }) {
  if (type === 'selection') syncSelectionUI();
  else if (type === 'plans') {
    syncSelectionUI();
    refreshBasketModal();
  }
}

/* ---------------- 抽屉 ---------------- */

function openFilterDrawer() {
  const drawer = qs('#filter-drawer');
  const route = getRoute();
  const counts = facetCounts(model, { filters: route.filters, query: route.query });
  drawer.innerHTML = `
    <div class="drawer__scrim" data-action="close-drawer"></div>
    <div class="drawer__panel" role="dialog" aria-label="筛选">
      <div class="drawer__head">
        <strong>筛选</strong>
        <button class="btn btn--sm" type="button" data-action="close-drawer">完成</button>
      </div>
      <div id="drawer-filter-panel">${filterPanelHtml(model, route, counts)}</div>
    </div>`;
  drawer.dataset.open = 'true';
  drawer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('is-locked');
}

function closeFilterDrawer() {
  const drawer = qs('#filter-drawer');
  drawer.dataset.open = 'false';
  drawer.setAttribute('aria-hidden', 'true');
  drawer.innerHTML = '';
  if (!ui.isModalOpen()) document.body.classList.remove('is-locked');
}

/* ---------------- 导航helper ---------------- */

function gotoRoute(partial) {
  const route = {
    name: 'home',
    filters: {},
    query: '',
    caseId: null,
    entry: null,
    share: null,
    ...partial
  };
  location.hash = buildHash(route);
}

/* ---------------- 清单操作 ---------------- */

function chooseDialog({ title, message, options }) {
  return new Promise((resolve) => {
    ui.openModal({
      title: escapeHtml(title),
      size: 'narrow',
      body: `<p class="text-muted">${escapeHtml(message)}</p>`,
      footer: options
        .map(
          (option, index) =>
            `<button class="btn ${option.primary ? 'btn--primary' : ''}" type="button" data-choice="${index}">${escapeHtml(
              option.label
            )}</button>`
        )
        .join(''),
      onMount(panel) {
        for (const button of panel.querySelectorAll('[data-choice]')) {
          button.addEventListener('click', () => {
            ui.closeModal(options[Number(button.dataset.choice)].value);
          });
        }
      },
      onClose: (result) => resolve(result ?? null)
    });
  });
}

async function handleExport(format) {
  const plan = state.getActivePlan();
  if (!plan.caseIds.length) {
    ui.showToast('清单为空，先勾选一些设计吧', 'error');
    return;
  }
  const { filename, mime, content } = exportPlan(model, plan, format);
  downloadBlob(filename, mime, content);
  ui.showToast(`已导出 ${filename}`, 'ok');
}

async function handleImport() {
  const file = await pickFile('application/json,.json');
  if (!file) return;
  let payload = null;
  try {
    payload = parsePlanFile(await file.text());
  } catch (error) {
    ui.showToast(`导入失败：${error.message}`, 'error');
    return;
  }
  const valid = payload.caseIds.filter((id) => model.byId.has(id));
  const missing = payload.caseIds.filter((id) => !model.byId.has(id));
  if (!valid.length) {
    ui.showToast('导入文件中的案例在当前数据中都不存在', 'error');
    return;
  }
  const choice = await chooseDialog({
    title: '导入清单',
    message: `「${payload.name}」共 ${payload.caseIds.length} 项，其中 ${valid.length} 项可用${
      missing.length ? `，${missing.length} 项将被跳过：${missing.join('、')}` : ''
    }。`,
    options: [
      { label: '新建为独立方案', value: 'new', primary: true },
      { label: '覆盖当前方案', value: 'replace' },
      { label: '取消', value: null }
    ]
  });
  if (choice === 'new') state.createPlan(payload.name, valid);
  else if (choice === 'replace') state.replaceActivePlanCases(valid);
  else return;
  ui.showToast(
    `已导入 ${valid.length} 项${missing.length ? `，跳过 ${missing.length} 项` : ''}`,
    'ok'
  );
  if (basketModalOpen) refreshBasketModal();
  syncSelectionUI();
}

async function handleShare() {
  const plan = state.getActivePlan();
  if (!plan.caseIds.length) {
    ui.showToast('清单为空，先勾选一些设计吧', 'error');
    return;
  }
  const { url } = buildShareUrl(plan);
  ui.openModal({
    title: '分享清单',
    size: 'narrow',
    body: basketView.shareModalBodyHtml(url, url.length > MAX_SHARE_LENGTH),
    footer: '<button class="btn btn--primary" type="button" data-copy-share data-autofocus>复制链接</button>',
    onMount(panel) {
      panel.querySelector('[data-copy-share]')?.addEventListener('click', async () => {
        const ok = await copyText(url);
        ui.showToast(ok ? '链接已复制' : '复制失败，请手动选择链接文本', ok ? 'ok' : 'error');
      });
    }
  });
}

/* ---------------- 事件 ---------------- */

const ACTIONS = {
  'go-home': () => gotoRoute({ name: 'home' }),
  'browse-all': () => gotoRoute({ name: 'list' }),
  'open-entry': (_event, target) => gotoRoute({ name: 'list', entry: target.dataset.entry }),
  'open-entry-value': (_event, target) =>
    gotoRoute({
      name: 'list',
      entry: target.dataset.entry,
      filters: { [target.dataset.key]: [target.dataset.value] }
    }),
  'open-pack': (_event, target) => {
    const pack = model.packs.find((item) => item.id === target.dataset.pack);
    if (!pack) return;
    gotoRoute({ name: 'list', filters: pack.filters || {}, query: pack.query || '' });
  },
  'submit-search': () => {
    const input = qs('#home-search') || qs('#list-search');
    gotoRoute({ name: 'list', query: input ? input.value.trim() : '' });
  },
  'toggle-filter': (_event, target) => {
    const route = getRoute();
    const filters = toggleFilterValue(route.filters, target.dataset.key, target.dataset.value);
    navigate({ name: 'list', filters, caseId: null });
  },
  'remove-filter': (_event, target) => {
    const route = getRoute();
    const filters = removeFilterValue(route.filters, target.dataset.key, target.dataset.value);
    navigate({ name: 'list', filters });
  },
  'clear-filters': () => navigate({ name: 'list', filters: {} }),
  'clear-query': () => navigate({ name: 'list', query: '' }),
  'clear-all': () => navigate({ name: 'list', filters: {}, query: '' }),
  'toggle-group': (_event, target) => {
    toggleGroup(target.dataset.key);
    refreshFilterPanels(getRoute());
  },
  'expand-group': (_event, target) => {
    expandGroup(target.dataset.key);
    refreshFilterPanels(getRoute());
  },
  'set-density': (_event, target) => {
    state.setPrefs({ density: target.dataset.value });
    lastShellKey = '';
    render(getRoute());
  },
  'open-case': (_event, target) => navigate({ caseId: target.dataset.id }),
  'close-modal': () => ui.closeModal(),
  'toggle-case': (_event, target) => state.toggleCase(target.dataset.id),
  'remove-from-plan': (_event, target) => state.removeCase(target.dataset.id),
  'open-basket': () => openBasketModal(),
  'new-plan': async () => {
    const name = await ui.promptDialog({ title: '新建清单方案', label: '方案名称', value: '新方案' });
    if (name) {
      state.createPlan(name, []);
      ui.showToast(`已创建方案「${name}」`, 'ok');
    }
  },
  'activate-plan': (_event, target) => {
    state.setActivePlan(target.dataset.id);
    ui.showToast('已切换方案', 'ok');
  },
  'rename-plan': async (_event, target) => {
    const plan = state.getPlans().find((item) => item.id === target.dataset.id);
    if (!plan) return;
    const name = await ui.promptDialog({ title: '重命名方案', label: '方案名称', value: plan.name });
    if (name) state.renamePlan(plan.id, name);
  },
  'delete-plan': async (_event, target) => {
    const plan = state.getPlans().find((item) => item.id === target.dataset.id);
    if (!plan) return;
    const ok = await ui.confirmDialog({
      title: '删除方案',
      message: `确定删除「${plan.name}」？该方案的 ${plan.caseIds.length} 项选择将一并移除。`,
      confirmText: '删除',
      danger: true
    });
    if (ok) {
      state.deletePlan(plan.id);
      ui.showToast('方案已删除');
    }
  },
  'clear-plan': async () => {
    const ok = await ui.confirmDialog({
      title: '清空清单',
      message: '确定清空当前方案的全部选择？',
      confirmText: '清空',
      danger: true
    });
    if (ok) state.clearActivePlan();
  },
  'export-plan': (_event, target) => handleExport(target.dataset.format || 'md'),
  'import-plan': () => handleImport(),
  'share-plan': () => handleShare(),
  'save-shared-plan': () => {
    const name = appRoot.dataset.sharedName || '分享清单';
    const ids = (appRoot.dataset.sharedIds || '').split(',').filter(Boolean);
    if (!ids.length) {
      ui.showToast('没有可保存的案例', 'error');
      return;
    }
    state.createPlan(name, ids);
    ui.showToast(`已保存为方案「${name}」`, 'ok');
    openBasketModal();
  },
  'copy-case-link': async (_event, target) => {
    const route = getRoute();
    const hash = buildHash({ ...route, caseId: target.dataset.id });
    const ok = await copyText(`${location.origin}${location.pathname}${hash}`);
    ui.showToast(ok ? '链接已复制' : '复制失败', ok ? 'ok' : 'error');
  },
  'open-image': (_event, target) => ui.openLightbox(target.dataset.src, target.dataset.alt),
  'toggle-collapse': (_event, target) => {
    const node = document.getElementById(target.dataset.target);
    if (node) node.dataset.open = node.dataset.open === 'true' ? 'false' : 'true';
  },
  'open-filter-drawer': () => openFilterDrawer(),
  'close-drawer': () => closeFilterDrawer(),
  'toggle-particles': () => {
    const next = !state.getPrefs().particles;
    state.setPrefs({ particles: next });
    particles.setEnabled(next);
    const toggle = qs('#particles-toggle');
    toggle.setAttribute('aria-pressed', String(next && !particles.isReduced()));
    if (next && particles.isReduced()) {
      ui.showToast('系统已开启“减少动态效果”，背景动效保持关闭');
    }
  }
};

function setupEvents() {
  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const handler = ACTIONS[target.dataset.action];
    if (!handler) return;
    event.preventDefault();
    handler(event, target);
  });

  // role="button" 的非按钮元素支持键盘
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target.closest('[data-action][role="button"]');
    if (!target) return;
    event.preventDefault();
    target.click();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (ui.isLightboxOpen()) ui.closeLightbox();
    else if (ui.isModalOpen()) ui.closeModal();
    else if (qs('#filter-drawer').dataset.open === 'true') closeFilterDrawer();
  });

  qs('#lightbox').addEventListener('click', () => ui.closeLightbox());

  const runSearch = debounce((value) => {
    navigate({ name: 'list', query: value }, { silent: true });
    refreshResults(getRoute());
  }, 260);

  document.addEventListener('input', (event) => {
    if (event.target.id === 'list-search') runSearch(event.target.value.trim());
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    if (event.target.id === 'home-search') {
      gotoRoute({ name: 'list', query: event.target.value.trim() });
    }
  });
}

boot();
