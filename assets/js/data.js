/** 数据层：加载导出契约、归一化、建索引。全站唯一读取数据的地方。 */

export const DATA_DIR = 'data/';
export const LIBRARY_URL = `${DATA_DIR}social-library.json`;
export const BUILD_URL = `${DATA_DIR}build-info.json`;
export const PACKS_URL = `${DATA_DIR}scenario-packs.json`;
export const SUPPORTED_SCHEMA = '1.1';

const PLACEHOLDERS = new Set(['—', '-', '--', '－', '—', 'n/a', 'N/A', '无', '/']);

export function isEmptyValue(value) {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return false;
  const text = String(value).trim();
  return text === '' || PLACEHOLDERS.has(text);
}

export class DataLoadError extends Error {
  constructor(message, { cause, url, likelyFileProtocol = false } = {}) {
    super(message);
    this.name = 'DataLoadError';
    this.cause = cause;
    this.url = url;
    this.likelyFileProtocol = likelyFileProtocol;
  }
}

async function fetchJson(url, { optional = false } = {}) {
  try {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) {
      if (optional) return null;
      throw new DataLoadError(`加载 ${url} 失败：HTTP ${response.status}`, { url });
    }
    return await response.json();
  } catch (error) {
    if (optional) return null;
    if (error instanceof DataLoadError) throw error;
    throw new DataLoadError(`加载 ${url} 失败：${error.message}`, {
      cause: error,
      url,
      likelyFileProtocol: location.protocol === 'file:'
    });
  }
}

export async function loadLibrary() {
  const [library, build, packs] = await Promise.all([
    fetchJson(LIBRARY_URL),
    fetchJson(BUILD_URL, { optional: true }),
    fetchJson(PACKS_URL, { optional: true })
  ]);
  return buildModel(library, build, packs);
}

/** 卡片标题去掉「游戏名｜」前缀，游戏名单独以徽标呈现。 */
function stripGamePrefix(title, game) {
  if (!game) return title;
  for (const separator of ['｜', '|']) {
    const prefix = game + separator;
    if (title.startsWith(prefix)) return title.slice(prefix.length).trim() || title;
  }
  return title;
}

function buildModel(library, build, packsFile) {
  const fields = Array.isArray(library.fields) ? library.fields : [];
  const tagFields = fields.filter((field) => field.type === 'tags');
  const textFields = fields.filter((field) => field.type === 'text' && field.key !== 'case_id');
  const imageFields = fields.filter((field) => field.type === 'image');
  const primaryTagKeys = tagFields.slice(0, 4).map((field) => field.key);

  const records = (library.records || []).map((raw) => {
    const tags = {};
    for (const field of tagFields) {
      const value = raw[field.key];
      tags[field.key] = Array.isArray(value) ? value.filter((item) => !isEmptyValue(item)) : [];
    }
    const text = {};
    for (const field of textFields) {
      const value = raw[field.key];
      if (!isEmptyValue(value)) text[field.key] = String(value);
    }
    const images = imageFields
      .map((field) => raw[field.key])
      .filter((value) => value && typeof value === 'object' && value.src)
      .map((value) => ({ src: DATA_DIR + value.src, alt: value.alt || '' }));

    const searchParts = [raw.case_id, raw.reference_case];
    for (const list of Object.values(tags)) searchParts.push(...list);
    for (const value of Object.values(text)) searchParts.push(value);

    const title = raw.reference_case || raw.case_id;
    const game = tags.game_title?.[0] || '';

    return {
      id: raw.case_id,
      title,
      shortTitle: stripGamePrefix(title, game),
      game,
      tags,
      text,
      images,
      raw,
      searchText: searchParts.join(' \u0001 ').toLowerCase()
    };
  });

  const byId = new Map(records.map((record) => [record.id, record]));

  const facetIndex = new Map();
  const facets = tagFields.map((field) => {
    const index = new Map();
    for (const record of records) {
      for (const value of record.tags[field.key]) {
        if (!index.has(value)) index.set(value, new Set());
        index.get(value).add(record.id);
      }
    }
    facetIndex.set(field.key, index);
    const options = [...index.entries()]
      .map(([value, ids]) => ({ value, count: ids.size }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'zh-Hans-CN'));
    return { key: field.key, label: field.label, derived: Boolean(field.derived), options };
  });

  const sourcesById = new Map();
  for (const source of library.sources || []) {
    const id = source?.['案例ID'];
    if (id) sourcesById.set(id, source);
  }

  const dictionary = (library.dictionary || [])
    .map((row) => ({
      dimension: row?.[0] ?? '',
      term: row?.[1] ?? '',
      meaning: row?.[2] ?? '',
      note: row?.[3] ?? ''
    }))
    .filter((entry) => entry.term);
  const dictionaryIndex = new Map(
    dictionary.map((entry) => [`${entry.dimension}|${entry.term}`, entry])
  );

  return {
    schemaVersion: library.schema_version || '',
    schemaSupported: (library.schema_version || '') === SUPPORTED_SCHEMA,
    title: library.title || '社交体验列表',
    subtitle: library.subtitle || '',
    build: build || null,
    packs: Array.isArray(packsFile?.packs) ? packsFile.packs : [],
    fields,
    tagFields,
    textFields,
    imageFields,
    primaryTagKeys,
    records,
    byId,
    facets,
    facetIndex,
    sourcesById,
    dictionary,
    dictionaryIndex
  };
}

export function facetByKey(model, key) {
  return model.facets.find((facet) => facet.key === key) || null;
}

function idsForFilterEntry(model, key, values) {
  const index = model.facetIndex.get(key);
  const union = new Set();
  if (!index) return union;
  for (const value of values) {
    const ids = index.get(value);
    if (ids) for (const id of ids) union.add(id);
  }
  return union;
}

/** 同维度 OR，跨维度 AND，再叠加关键词搜索。 */
export function filterRecords(model, { filters = {}, query = '' } = {}, { skipKey = null } = {}) {
  let ids = null;
  for (const [key, values] of Object.entries(filters)) {
    if (key === skipKey || !values || !values.length) continue;
    const union = idsForFilterEntry(model, key, values);
    ids = ids === null ? union : new Set([...ids].filter((id) => union.has(id)));
    if (!ids.size) break;
  }
  let result = ids === null ? model.records : model.records.filter((record) => ids.has(record.id));
  const keyword = query.trim().toLowerCase();
  if (keyword) {
    const words = keyword.split(/\s+/).filter(Boolean);
    result = result.filter((record) => words.every((word) => record.searchText.includes(word)));
  }
  return result;
}

/** 每个维度的可用计数：排除该维度自身的已选条件，避免计数归零。 */
export function facetCounts(model, state) {
  const counts = new Map();
  for (const facet of model.facets) {
    const scoped = filterRecords(model, state, { skipKey: facet.key });
    const map = new Map();
    for (const record of scoped) {
      for (const value of record.tags[facet.key]) {
        map.set(value, (map.get(value) || 0) + 1);
      }
    }
    counts.set(facet.key, map);
  }
  return counts;
}

export function getSource(model, caseId) {
  return model.sourcesById.get(caseId) || null;
}

export function getDictionaryEntry(model, dimensionLabel, term) {
  return model.dictionaryIndex.get(`${dimensionLabel}|${term}`) || null;
}
