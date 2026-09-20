// 开发期自检：用 jsdom 跑真实 DOM 流程（首页 → 列表 → 勾选 → 详情 → 清单导出）。
// 需要 jsdom：npm install jsdom --no-save --prefix <临时目录>
// 用法：SLW_JSDOM=<jsdom 入口路径> node web/tools/dom-smoke.mjs
// 未提供 jsdom 时自动跳过，不阻塞其他检查。
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(here, '..');

let JSDOM;
try {
  const specifier = process.env.SLW_JSDOM
    ? pathToFileURL(path.resolve(process.env.SLW_JSDOM)).href
    : 'jsdom';
  ({ JSDOM } = await import(specifier));
} catch {
  console.log('跳过 DOM 自检：未找到 jsdom（设置 SLW_JSDOM 或全局安装后可运行）');
  process.exit(0);
}

const html = readFileSync(path.join(webRoot, 'index.html'), 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost:8000/', pretendToBeVisual: true });
const { window } = dom;

globalThis.window = window;
globalThis.document = window.document;
globalThis.location = window.location;
globalThis.history = window.history;
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  get: () => window.navigator
});
globalThis.localStorage = window.localStorage;
globalThis.Blob = window.Blob;
globalThis.URL = window.URL;
globalThis.requestAnimationFrame = (fn) => window.setTimeout(() => fn(Date.now()), 16);
globalThis.cancelAnimationFrame = (id) => window.clearTimeout(id);
globalThis.IntersectionObserver = class {
  observe() {}
  disconnect() {}
};
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
globalThis.matchMedia = window.matchMedia;
globalThis.fetch = async (url) => {
  const file = path.join(webRoot, String(url));
  try {
    const text = readFileSync(file, 'utf8');
    return { ok: true, status: 200, json: async () => JSON.parse(text) };
  } catch {
    return { ok: false, status: 404, json: async () => null };
  }
};

const tick = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));
const qs = (selector) => window.document.querySelector(selector);
const qsa = (selector) => [...window.document.querySelectorAll(selector)];
const click = (node) => {
  assert.ok(node, '目标节点不存在');
  node.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
};

const results = [];
const check = async (name, fn) => {
  try {
    await fn();
    results.push(`  ✓ ${name}`);
  } catch (error) {
    results.push(`  ✗ ${name}\n    ${error.stack?.split('\n').slice(0, 3).join('\n    ')}`);
    process.exitCode = 1;
  }
};

window.addEventListener('error', (event) => {
  results.push(`  ✗ 运行时错误：${event.error?.stack || event.message}`);
  process.exitCode = 1;
});

await import('../assets/js/main.js');
await tick(120);

await check('首页渲染入口与统计', () => {
  assert.ok(qs('.hero__title'), '缺少首页标题');
  const entries = qsa('[data-action="open-entry"]');
  assert.ok(entries.length >= 3 && entries.length <= 6, `入口数量异常：${entries.length}`);
  assert.equal(qsa('.filter-group').length, 0, '首页不应铺开筛选面板');
  assert.ok(qs('#header-subtitle').textContent.includes('条案例'));
  assert.ok(qs('#app-footer').textContent.includes('数据版本'));
});

await check('入口进入列表并预置筛选', async () => {
  const chip = qs('[data-action="open-entry-value"]');
  const key = chip.dataset.key;
  const value = chip.dataset.value;
  click(chip);
  await tick(80);
  assert.ok(window.location.hash.includes('/list'), `hash 异常：${window.location.hash}`);
  assert.ok(qs('#case-grid'), '列表未渲染');
  const chips = qs('#active-filters').textContent;
  assert.ok(chips.includes(value), `已选条件未显示：${key}=${value}`);
  assert.ok(Number(qs('#result-count').textContent) > 0);
});

await check('移除条件后结果变化', async () => {
  const before = Number(qs('#result-count').textContent);
  click(qs('[data-action="remove-filter"]'));
  await tick(80);
  const after = Number(qs('#result-count').textContent);
  assert.ok(after >= before, '清除条件后结果应不少于之前');
  assert.equal(qs('#active-filters').textContent.trim(), '');
});

await check('跨维度筛选与计数更新', async () => {
  const options = qsa('[data-action="toggle-filter"]');
  click(options[0]);
  await tick(80);
  const first = Number(qs('#result-count').textContent);
  const others = qsa('[data-action="toggle-filter"]').filter(
    (node) => node.dataset.key !== options[0].dataset.key
  );
  click(others[0]);
  await tick(80);
  const second = Number(qs('#result-count').textContent);
  assert.ok(second <= first, '跨维度应收敛结果');
  click(qs('[data-action="clear-filters"]'));
  await tick(80);
});

await check('增量渲染与密度切换', async () => {
  const cards = qsa('.case-card');
  assert.equal(cards.length, 40, `首批应渲染 40 条，实际 ${cards.length}`);
  click(qs('[data-action="set-density"][data-value="compact"]'));
  await tick(80);
  assert.equal(qs('#case-grid').dataset.density, 'compact');
  click(qs('[data-action="set-density"][data-value="card"]'));
  await tick(80);
});

await check('勾选进入清单并持久化', async () => {
  const card = qs('.case-card');
  const id = card.dataset.caseId;
  click(card.querySelector('[data-action="toggle-case"]'));
  await tick(60);
  assert.equal(qs(`[data-case-id="${id}"]`).dataset.selected, 'true');
  assert.equal(qs('#header-basket-count').textContent, '1');
  assert.equal(qs('#basket-bar').hidden, false);
  const stored = JSON.parse(window.localStorage.getItem('slw.plans.v1'));
  assert.deepEqual(stored.plans[0].caseIds, [id]);
});

await check('筛选变化不丢勾选', async () => {
  click(qs('[data-action="toggle-filter"]'));
  await tick(80);
  assert.equal(qs('#header-basket-count').textContent, '1');
  click(qs('[data-action="clear-filters"]'));
  await tick(80);
});

await check('详情打开、字段与配图', async () => {
  const withImage = qsa('.case-card').find((node) => node.dataset.caseId === 'SOC-001');
  click((withImage || qs('.case-card')).querySelector('[data-action="open-case"]'));
  await tick(80);
  assert.equal(qs('#modal-root').dataset.open, 'true');
  const body = qs('.modal__body').textContent;
  assert.ok(body.includes('具体交互操作细节') || body.includes('触发契机'), '详情缺少文本字段');
  assert.ok(qs('.gallery') || qs('.empty-image'), '详情缺少配图区或空状态');
  assert.ok(window.location.hash.includes('case='));
});

await check('Esc 关闭详情并保留筛选', async () => {
  const hashBefore = window.location.hash;
  window.document.dispatchEvent(
    new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
  );
  await tick(80);
  assert.equal(qs('#modal-root').dataset.open, 'false');
  assert.ok(!window.location.hash.includes('case='));
  assert.equal(hashBefore.includes('/list'), window.location.hash.includes('/list'));
});

await check('清单弹层与方案管理', async () => {
  click(qs('[data-action="open-basket"]'));
  await tick(60);
  const body = qs('.modal__body').textContent;
  assert.ok(body.includes('清单方案'));
  assert.ok(qs('[data-action="export-plan"][data-format="md"]'));
  assert.ok(qs('[data-action="import-plan"]'));
  click(qs('[data-action="close-modal"]'));
  await tick(60);
});

await check('分享链接可被解析还原', async () => {
  const { encodePlan } = await import('../assets/js/lib/share.js');
  const payload = encodePlan({ name: '冒烟分享', caseIds: ['SOC-001', 'SOC-002', 'SOC-003'] });
  window.location.hash = `#/share?d=${payload}`;
  await tick(120);
  assert.ok(qs('.hero__title').textContent.includes('冒烟分享'));
  assert.ok(qs('[data-action="save-shared-plan"]'));
  click(qs('[data-action="save-shared-plan"]'));
  await tick(80);
  assert.equal(qs('#header-basket-count').textContent, '3');
});

await check('搜索无结果时给出空状态', async () => {
  window.location.hash = '#/list?q=%E4%B8%8D%E5%AD%98%E5%9C%A8%E7%9A%84%E5%85%B3%E9%94%AE%E8%AF%8Dzzz';
  await tick(120);
  assert.equal(qs('#result-count').textContent, '0');
  assert.ok(qs('#list-empty .empty-state'), '缺少空状态');
  click(qs('[data-action="clear-all"]'));
  await tick(80);
  assert.ok(Number(qs('#result-count').textContent) > 0);
});

console.log('DOM 自检');
console.log(results.join('\n'));
console.log(process.exitCode ? '\n存在失败项' : '\n全部通过');
