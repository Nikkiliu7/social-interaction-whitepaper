/** hash 路由：筛选、搜索、当前案例、分享载荷都编码在 URL 里，便于分享与还原。 */

const FILTER_PREFIX = 'f.';
let onChange = () => {};
let suppress = false;

function parseQueryString(text) {
  const params = new URLSearchParams(text || '');
  const filters = {};
  let query = '';
  let caseId = null;
  let share = null;
  let entry = null;

  for (const [rawKey, rawValue] of params.entries()) {
    if (rawKey.startsWith(FILTER_PREFIX)) {
      const key = rawKey.slice(FILTER_PREFIX.length);
      const values = rawValue
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      if (key && values.length) filters[key] = values;
    } else if (rawKey === 'q') {
      query = rawValue;
    } else if (rawKey === 'case') {
      caseId = rawValue || null;
    } else if (rawKey === 'd') {
      share = rawValue || null;
    } else if (rawKey === 'entry') {
      entry = rawValue || null;
    }
  }
  return { filters, query, caseId, share, entry };
}

export function parseHash(hash = location.hash) {
  const raw = String(hash || '').replace(/^#/, '');
  const [pathPart, queryPart] = raw.split('?');
  const path = (pathPart || '/').replace(/^\/+/, '');
  const parsed = parseQueryString(queryPart);
  const name = path === 'list' ? 'list' : path === 'share' ? 'share' : 'home';
  return { name, ...parsed };
}

export function buildHash(route) {
  const name = route.name || 'home';
  const params = new URLSearchParams();
  for (const [key, values] of Object.entries(route.filters || {})) {
    const list = (values || []).filter(Boolean);
    if (list.length) params.set(`${FILTER_PREFIX}${key}`, list.join(','));
  }
  if (route.query) params.set('q', route.query);
  if (route.entry) params.set('entry', route.entry);
  if (route.caseId) params.set('case', route.caseId);
  if (route.share) params.set('d', route.share);
  const qs = params.toString();
  const path = name === 'home' ? '/' : `/${name}`;
  return `#${path}${qs ? `?${qs}` : ''}`;
}

export function getRoute() {
  return parseHash();
}

/** patch 与当前路由浅合并；silent 只改地址栏、不触发重渲染（搜索输入用）。 */
export function navigate(patch = {}, { replace = false, silent = false } = {}) {
  const current = getRoute();
  const next = { ...current, ...patch };
  if (patch.filters) next.filters = patch.filters;
  const hash = buildHash(next);
  if (hash === location.hash) return;
  if (silent) suppress = true;
  if (replace || silent) {
    history.replaceState(null, '', `${location.pathname}${location.search}${hash}`);
    if (silent) suppress = false;
  } else {
    location.hash = hash;
  }
}

export function initRouter(handler) {
  onChange = typeof handler === 'function' ? handler : () => {};
  window.addEventListener('hashchange', () => {
    if (suppress) {
      suppress = false;
      return;
    }
    onChange(getRoute());
  });
  onChange(getRoute());
}

export function toggleFilterValue(filters, key, value) {
  const next = { ...filters };
  const list = new Set(next[key] || []);
  if (list.has(value)) list.delete(value);
  else list.add(value);
  if (list.size) next[key] = [...list];
  else delete next[key];
  return next;
}

export function removeFilterValue(filters, key, value) {
  const next = { ...filters };
  const list = (next[key] || []).filter((item) => item !== value);
  if (list.length) next[key] = list;
  else delete next[key];
  return next;
}

export function countFilters(filters) {
  return Object.values(filters || {}).reduce((total, values) => total + (values?.length || 0), 0);
}
