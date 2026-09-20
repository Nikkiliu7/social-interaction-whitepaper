/** 清单分享：把方案压缩进 URL，无需后端。 */

const SHARE_VERSION = 1;
export const MAX_SHARE_LENGTH = 1800;

function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(payload) {
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** SOC-001 → 1，连续编号压成 20-24 区间。 */
function compressIds(caseIds) {
  const numbers = [];
  const others = [];
  for (const id of caseIds) {
    const match = /^SOC-(\d{3,})$/.exec(id);
    if (match) numbers.push(Number(match[1]));
    else others.push(id);
  }
  numbers.sort((a, b) => a - b);
  const ranges = [];
  let start = null;
  let previous = null;
  for (const value of numbers) {
    if (start === null) {
      start = value;
      previous = value;
      continue;
    }
    if (value === previous + 1) {
      previous = value;
      continue;
    }
    ranges.push(start === previous ? `${start}` : `${start}-${previous}`);
    start = value;
    previous = value;
  }
  if (start !== null) ranges.push(start === previous ? `${start}` : `${start}-${previous}`);
  return { ranges: ranges.join(','), others };
}

function expandIds(ranges, others = []) {
  const ids = [];
  for (const part of String(ranges || '').split(',')) {
    if (!part) continue;
    const [from, to] = part.split('-').map((item) => Number(item));
    if (!Number.isFinite(from)) continue;
    const end = Number.isFinite(to) ? to : from;
    for (let value = from; value <= end; value += 1) {
      ids.push(`SOC-${String(value).padStart(3, '0')}`);
    }
  }
  return [...ids, ...others.filter((id) => typeof id === 'string')];
}

export function encodePlan(plan) {
  const { ranges, others } = compressIds(plan.caseIds || []);
  const payload = { v: SHARE_VERSION, n: plan.name || '分享清单', i: ranges };
  if (others.length) payload.x = others;
  return toBase64Url(JSON.stringify(payload));
}

export function decodeShare(payload) {
  const data = JSON.parse(fromBase64Url(payload));
  if (!data || typeof data !== 'object') throw new Error('分享数据格式不正确');
  return {
    name: typeof data.n === 'string' && data.n.trim() ? data.n : '分享清单',
    caseIds: expandIds(data.i, Array.isArray(data.x) ? data.x : [])
  };
}

export function buildShareUrl(plan) {
  const payload = encodePlan(plan);
  const base = `${location.origin}${location.pathname}`;
  return { url: `${base}#/share?d=${payload}`, payload };
}
