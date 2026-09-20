// 开发期自检：数据层、筛选、分享编码、导出/导入的行为测试（无需浏览器）。
// 用法：node web/tools/smoke.mjs
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(here, '..');

globalThis.location = { protocol: 'http:', origin: 'http://localhost:8000', pathname: '/' };
globalThis.fetch = async (url) => {
  const file = path.join(webRoot, url);
  try {
    const text = readFileSync(file, 'utf8');
    return { ok: true, json: async () => JSON.parse(text) };
  } catch {
    return { ok: false, status: 404, json: async () => null };
  }
};

const { loadLibrary, filterRecords, facetCounts, isEmptyValue } = await import('../assets/js/data.js');
const { encodePlan, decodeShare } = await import('../assets/js/lib/share.js');
const { exportPlan, parsePlanFile } = await import('../assets/js/lib/export.js');
const { toggleFilterValue, buildHash, parseHash } = await import('../assets/js/router.js');

const model = await loadLibrary();
const checks = [];
const check = (name, fn) => {
  try {
    fn();
    checks.push(`  ✓ ${name}`);
  } catch (error) {
    checks.push(`  ✗ ${name}\n    ${error.message}`);
    process.exitCode = 1;
  }
};

check('数据契约加载', () => {
  assert.equal(model.schemaSupported, true);
  assert.equal(model.records.length, 149);
  assert.ok(model.facets.length >= 7);
  assert.ok(model.build?.source_file);
});

check('派生游戏维度', () => {
  const facet = model.facets.find((item) => item.key === 'game_title');
  assert.ok(facet, '缺少 game_title 维度');
  assert.equal(model.records.every((record) => record.game), true);
  assert.equal(model.byId.get('SOC-001').game, '蛋仔派对');
});

check('空值归一化', () => {
  assert.equal(isEmptyValue('—'), true);
  assert.equal(isEmptyValue(''), true);
  assert.equal(isEmptyValue('轮盘'), false);
  assert.equal('image_2' in model.byId.get('SOC-001').text, false);
});

check('图片路径指向 data 目录', () => {
  const record = model.records.find((item) => item.images.length);
  assert.ok(record.images[0].src.startsWith('data/assets/'));
  readFileSync(path.join(webRoot, record.images[0].src));
});

check('同维度 OR', () => {
  const facet = model.facets.find((item) => item.key === 'social_motives');
  const [a, b] = facet.options.slice(0, 2).map((option) => option.value);
  const onlyA = filterRecords(model, { filters: { social_motives: [a] } }).length;
  const both = filterRecords(model, { filters: { social_motives: [a, b] } }).length;
  assert.ok(both >= onlyA);
});

check('跨维度 AND', () => {
  const motive = model.facets.find((item) => item.key === 'social_motives').options[0].value;
  const stage = model.facets.find((item) => item.key === 'play_stages').options[0].value;
  const combined = filterRecords(model, {
    filters: { social_motives: [motive], play_stages: [stage] }
  });
  const manual = model.records.filter(
    (record) =>
      record.tags.social_motives.includes(motive) && record.tags.play_stages.includes(stage)
  );
  assert.equal(combined.length, manual.length);
});

check('搜索叠加筛选', () => {
  const hits = filterRecords(model, { query: '轮盘' });
  assert.ok(hits.length > 0);
  assert.equal(
    hits.every((record) => record.searchText.includes('轮盘')),
    true
  );
  assert.equal(filterRecords(model, { query: '这个关键词肯定不存在xyz' }).length, 0);
});

check('维度计数不因自身选择归零', () => {
  const key = 'play_stages';
  const value = model.facets.find((item) => item.key === key).options[0].value;
  const counts = facetCounts(model, { filters: { [key]: [value] }, query: '' });
  const map = counts.get(key);
  assert.ok([...map.values()].filter((count) => count > 0).length > 1);
});

check('路由编解码', () => {
  const filters = toggleFilterValue({}, 'play_stages', '局内/赛中');
  const hash = buildHash({ name: 'list', filters, query: 'ping', caseId: 'SOC-001' });
  const parsed = parseHash(hash);
  assert.equal(parsed.name, 'list');
  assert.deepEqual(parsed.filters, filters);
  assert.equal(parsed.query, 'ping');
  assert.equal(parsed.caseId, 'SOC-001');
});

check('分享链接压缩与还原', () => {
  const caseIds = ['SOC-001', 'SOC-005', 'SOC-020', 'SOC-021', 'SOC-022', 'SOC-023'];
  const payload = encodePlan({ name: '搜打撤局内', caseIds });
  const decoded = decodeShare(payload);
  assert.equal(decoded.name, '搜打撤局内');
  assert.deepEqual(decoded.caseIds, caseIds);
  assert.ok(payload.length < 120, `载荷过长：${payload.length}`);
});

check('导出三种格式', () => {
  const plan = { name: '测试清单', caseIds: ['SOC-001', 'SOC-002'] };
  const md = exportPlan(model, plan, 'md');
  assert.ok(md.content.includes('# 测试清单'));
  assert.ok(md.content.includes('SOC-001'));
  const csv = exportPlan(model, plan, 'csv');
  assert.ok(csv.content.startsWith('\uFEFF"案例ID"'));
  const json = exportPlan(model, plan, 'json');
  const parsed = JSON.parse(json.content);
  assert.equal(parsed.caseIds.length, 2);
  assert.equal(parsed.cases[0].game, '蛋仔派对');
});

check('导入校验', () => {
  const ok = parsePlanFile(JSON.stringify({ name: '导入', caseIds: ['SOC-001', 'SOC-999'] }));
  assert.deepEqual(ok.caseIds, ['SOC-001', 'SOC-999']);
  assert.equal(ok.caseIds.filter((id) => model.byId.has(id)).length, 1);
  assert.throws(() => parsePlanFile('not json'), /合法/);
  assert.throws(() => parsePlanFile('{"foo":1}'), /caseIds/);
});

const { homeHtml } = await import('../assets/js/views/home.js');

check('场景包：空则隐藏，有则渲染', () => {
  assert.equal(model.packs.length, 0, '当前 scenario-packs.json 应为空');
  assert.equal(homeHtml(model, { query: '' }).includes('推荐场景包'), false);
  const withPack = {
    ...model,
    packs: [{ id: 'demo', title: '搜打撤 · 局内高压社交', desc: '测试用场景包', filters: {} }]
  };
  const html = homeHtml(withPack, { query: '' });
  assert.ok(html.includes('推荐场景包'));
  assert.ok(html.includes('data-action="open-pack"'));
});

check('入口卡在维度缺失时自动隐藏', () => {
  const stripped = { ...model, facets: model.facets.filter((facet) => facet.key !== 'play_stages') };
  const html = homeHtml(stripped, { query: '' });
  assert.equal(html.includes('data-entry="stage"'), false);
  assert.ok(homeHtml(model, { query: '' }).includes('data-entry="stage"'));
});

console.log(`数据自检（${model.build?.source_file ?? '未知来源'}）`);
console.log(checks.join('\n'));
if (process.exitCode) console.error('\n存在失败项');
else console.log('\n全部通过');
