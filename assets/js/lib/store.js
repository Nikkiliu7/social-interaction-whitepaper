/** 本地持久化：清单方案与偏好。localStorage 不可用时自动降级为内存态。 */

const PLANS_KEY = 'slw.plans.v1';
const PREFS_KEY = 'slw.prefs.v1';
const PLANS_VERSION = 1;

const memory = new Map();
let persistent = null;

function probe() {
  if (persistent !== null) return persistent;
  try {
    const probeKey = '__slw_probe__';
    localStorage.setItem(probeKey, '1');
    localStorage.removeItem(probeKey);
    persistent = true;
  } catch {
    persistent = false;
  }
  return persistent;
}

export function isPersistent() {
  return probe();
}

function readRaw(key) {
  if (!probe()) return memory.get(key) ?? null;
  try {
    return localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

function writeRaw(key, value) {
  memory.set(key, value);
  if (!probe()) return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    persistent = false;
    return false;
  }
}

function readJson(key, fallback) {
  const raw = readRaw(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function createPlanId() {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function createPlan(name = '未命名清单', caseIds = []) {
  return {
    id: createPlanId(),
    name,
    caseIds: [...caseIds],
    updatedAt: new Date().toISOString()
  };
}

function normalizeBook(value) {
  const plans = Array.isArray(value?.plans)
    ? value.plans
        .filter((plan) => plan && typeof plan.id === 'string')
        .map((plan) => ({
          id: plan.id,
          name: typeof plan.name === 'string' && plan.name.trim() ? plan.name : '未命名清单',
          caseIds: Array.isArray(plan.caseIds) ? plan.caseIds.filter((id) => typeof id === 'string') : [],
          updatedAt: plan.updatedAt || new Date().toISOString()
        }))
    : [];
  if (!plans.length) plans.push(createPlan('默认清单'));
  const activePlanId = plans.some((plan) => plan.id === value?.activePlanId)
    ? value.activePlanId
    : plans[0].id;
  return { version: PLANS_VERSION, activePlanId, plans };
}

export function readPlanBook() {
  return normalizeBook(readJson(PLANS_KEY, null));
}

export function writePlanBook(book) {
  const normalized = normalizeBook(book);
  writeRaw(PLANS_KEY, JSON.stringify(normalized));
  return normalized;
}

const DEFAULT_PREFS = { particles: true, density: 'card' };

export function readPrefs() {
  const stored = readJson(PREFS_KEY, {});
  return {
    particles: typeof stored.particles === 'boolean' ? stored.particles : DEFAULT_PREFS.particles,
    density: stored.density === 'compact' ? 'compact' : DEFAULT_PREFS.density
  };
}

export function writePrefs(prefs) {
  writeRaw(PREFS_KEY, JSON.stringify(prefs));
  return prefs;
}
