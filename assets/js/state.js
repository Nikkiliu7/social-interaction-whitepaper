/** 应用状态中枢：数据模型、清单方案、偏好。视图只读状态，变更一律走这里。 */

import * as store from './lib/store.js';

const listeners = new Set();

const state = {
  model: null,
  planBook: null,
  prefs: store.readPrefs(),
  persistent: store.isPersistent()
};

export function initState({ model }) {
  state.model = model;
  state.planBook = store.readPlanBook();
  state.persistent = store.isPersistent();
  return state;
}

export function getState() {
  return state;
}

export function getModel() {
  return state.model;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(type, detail = {}) {
  for (const listener of listeners) listener({ type, detail, state });
}

function persistPlans() {
  state.planBook = store.writePlanBook(state.planBook);
}

export function getPlans() {
  return state.planBook.plans;
}

export function getActivePlan() {
  const { plans, activePlanId } = state.planBook;
  return plans.find((plan) => plan.id === activePlanId) || plans[0];
}

export function getSelectedIds() {
  return getActivePlan().caseIds;
}

export function isSelected(caseId) {
  return getActivePlan().caseIds.includes(caseId);
}

function touch(plan) {
  plan.updatedAt = new Date().toISOString();
}

export function toggleCase(caseId) {
  const plan = getActivePlan();
  const index = plan.caseIds.indexOf(caseId);
  if (index >= 0) plan.caseIds.splice(index, 1);
  else plan.caseIds.push(caseId);
  touch(plan);
  persistPlans();
  emit('selection', { caseId, selected: index < 0 });
  return index < 0;
}

export function addCases(caseIds = []) {
  const plan = getActivePlan();
  const existing = new Set(plan.caseIds);
  let added = 0;
  for (const id of caseIds) {
    if (!existing.has(id)) {
      plan.caseIds.push(id);
      existing.add(id);
      added += 1;
    }
  }
  if (added) {
    touch(plan);
    persistPlans();
    emit('selection', { added });
  }
  return added;
}

export function removeCase(caseId) {
  const plan = getActivePlan();
  const index = plan.caseIds.indexOf(caseId);
  if (index < 0) return false;
  plan.caseIds.splice(index, 1);
  touch(plan);
  persistPlans();
  emit('selection', { caseId, selected: false });
  return true;
}

export function clearActivePlan() {
  const plan = getActivePlan();
  if (!plan.caseIds.length) return false;
  plan.caseIds = [];
  touch(plan);
  persistPlans();
  emit('selection', { cleared: true });
  return true;
}

export function createPlan(name, caseIds = []) {
  const plan = store.createPlan(name, caseIds);
  state.planBook.plans.push(plan);
  state.planBook.activePlanId = plan.id;
  persistPlans();
  emit('plans', { created: plan.id });
  return plan;
}

export function setActivePlan(planId) {
  if (!state.planBook.plans.some((plan) => plan.id === planId)) return false;
  state.planBook.activePlanId = planId;
  persistPlans();
  emit('plans', { activated: planId });
  return true;
}

export function renamePlan(planId, name) {
  const plan = state.planBook.plans.find((item) => item.id === planId);
  if (!plan || !name.trim()) return false;
  plan.name = name.trim();
  touch(plan);
  persistPlans();
  emit('plans', { renamed: planId });
  return true;
}

export function deletePlan(planId) {
  const index = state.planBook.plans.findIndex((plan) => plan.id === planId);
  if (index < 0) return false;
  state.planBook.plans.splice(index, 1);
  if (!state.planBook.plans.length) state.planBook.plans.push(store.createPlan('默认清单'));
  if (!state.planBook.plans.some((plan) => plan.id === state.planBook.activePlanId)) {
    state.planBook.activePlanId = state.planBook.plans[0].id;
  }
  persistPlans();
  emit('plans', { deleted: planId });
  return true;
}

export function replaceActivePlanCases(caseIds) {
  const plan = getActivePlan();
  plan.caseIds = [...new Set(caseIds)];
  touch(plan);
  persistPlans();
  emit('selection', { replaced: true });
  return plan;
}

export function setPrefs(patch) {
  state.prefs = store.writePrefs({ ...state.prefs, ...patch });
  emit('prefs', patch);
  return state.prefs;
}

export function getPrefs() {
  return state.prefs;
}

export function isPersistent() {
  return state.persistent;
}
