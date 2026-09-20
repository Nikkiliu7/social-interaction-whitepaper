/** 清单导出与导入：Markdown / CSV / JSON。 */

import { formatDateTime } from './dom.js';

export const EXPORT_TYPE = 'social-whitepaper-plan';
const EXPORT_VERSION = 1;

function safeFileName(name) {
  return String(name || '社交互动设计清单').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
}

function planRecords(model, plan) {
  return plan.caseIds.map((id) => model.byId.get(id)).filter(Boolean);
}

function tagPairs(model, record) {
  return model.tagFields
    .map((field) => ({ label: field.label, values: record.tags[field.key] || [] }))
    .filter((item) => item.values.length);
}

export function exportPlan(model, plan, format) {
  const records = planRecords(model, plan);
  const stamp = formatDateTime(new Date());
  const base = safeFileName(plan.name);

  if (format === 'json') {
    const content = JSON.stringify(
      {
        type: EXPORT_TYPE,
        version: EXPORT_VERSION,
        name: plan.name,
        exportedAt: new Date().toISOString(),
        schemaVersion: model.schemaVersion,
        caseIds: records.map((record) => record.id),
        cases: records.map((record) => ({
          id: record.id,
          title: record.title,
          game: record.game,
          tags: Object.fromEntries(tagPairs(model, record).map((item) => [item.label, item.values]))
        }))
      },
      null,
      2
    );
    return { filename: `${base}.json`, mime: 'application/json', content };
  }

  if (format === 'csv') {
    const columns = ['案例ID', '案例名称', ...model.tagFields.map((field) => field.label)];
    const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = records.map((record) =>
      [
        record.id,
        record.title,
        ...model.tagFields.map((field) => (record.tags[field.key] || []).join('；'))
      ]
        .map(escape)
        .join(',')
    );
    const content = `\uFEFF${[columns.map(escape).join(','), ...rows].join('\r\n')}`;
    return { filename: `${base}.csv`, mime: 'text/csv', content };
  }

  const lines = [
    `# ${plan.name}`,
    '',
    `- 导出时间：${stamp}`,
    `- 案例数量：${records.length}`,
    `- 数据版本：${model.schemaVersion}${model.build?.source_file ? `（${model.build.source_file}）` : ''}`,
    ''
  ];
  records.forEach((record, index) => {
    lines.push(`## ${index + 1}. ${record.title}　\`${record.id}\``);
    for (const item of tagPairs(model, record)) {
      lines.push(`- **${item.label}**：${item.values.join(' / ')}`);
    }
    const summary = record.text.trigger_context || record.text.use_cases || '';
    if (summary) lines.push(`- **场景**：${summary.replace(/\s+/g, ' ').slice(0, 120)}`);
    lines.push('');
  });
  return { filename: `${base}.md`, mime: 'text/markdown', content: lines.join('\n') };
}

/** 导入：接受本工具导出的 JSON；返回 {name, caseIds}，由调用方校验有效性。 */
export function parsePlanFile(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('文件不是合法的 JSON');
  }
  const caseIds = Array.isArray(data?.caseIds)
    ? data.caseIds
    : Array.isArray(data?.cases)
      ? data.cases.map((item) => item?.id)
      : null;
  if (!caseIds) throw new Error('文件缺少 caseIds 字段，不是本工具导出的清单');
  const valid = caseIds.filter((id) => typeof id === 'string' && id.trim());
  if (!valid.length) throw new Error('清单为空，没有可导入的案例');
  return {
    name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : '导入的清单',
    caseIds: valid
  };
}
