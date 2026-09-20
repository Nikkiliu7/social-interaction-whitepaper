/** 通用 UI：标签、Toast、弹层（含确认/输入框）、图片灯箱。 */

import { escapeHtml, qs } from '../lib/dom.js';

const modalRoot = () => qs('#modal-root');
const toastRoot = () => qs('#toast-root');
const lightboxRoot = () => qs('#lightbox');

const stack = [];

export function tagHtml(value, { variant = '', title = '' } = {}) {
  const cls = variant ? `tag tag--${variant}` : 'tag';
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
  return `<span class="${cls}"${titleAttr}>${escapeHtml(value)}</span>`;
}

export function showToast(message, type = '') {
  const root = toastRoot();
  if (!root) return;
  const node = document.createElement('div');
  node.className = type ? `toast toast--${type}` : 'toast';
  node.textContent = message;
  root.appendChild(node);
  setTimeout(() => node.remove(), 3200);
}

function renderTop() {
  const root = modalRoot();
  if (!stack.length) {
    root.dataset.open = 'false';
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML = '';
    document.body.classList.remove('is-locked');
    return;
  }
  const top = stack[stack.length - 1];
  root.dataset.open = 'true';
  root.setAttribute('aria-hidden', 'false');
  root.innerHTML = `
    <div class="modal__scrim" data-action="close-modal"></div>
    <div class="modal__panel ${top.size === 'narrow' ? 'modal__panel--narrow' : ''}" role="dialog" aria-modal="true" aria-label="${escapeHtml(
      top.title || '对话框'
    )}">
      <div class="modal__head">
        <h2 class="modal__title">${top.title || ''}</h2>
        <button class="btn btn--icon btn--ghost" type="button" data-action="close-modal" title="关闭（Esc）">
          <span aria-hidden="true">✕</span><span class="sr-only">关闭</span>
        </button>
      </div>
      <div class="modal__body">${top.body || ''}</div>
      ${top.footer ? `<div class="modal__foot">${top.footer}</div>` : ''}
    </div>`;
  document.body.classList.add('is-locked');
  const panel = root.querySelector('.modal__panel');
  if (top.onMount) top.onMount(panel);
  const focusTarget = panel.querySelector('[data-autofocus]') || panel;
  focusTarget.focus?.();
}

export function openModal(options) {
  stack.push({ ...options, returnFocus: document.activeElement });
  renderTop();
}

export function closeModal(result) {
  const top = stack.pop();
  renderTop();
  if (top?.returnFocus?.focus) top.returnFocus.focus();
  if (top?.onClose) top.onClose(result);
}

export function closeAllModals() {
  while (stack.length) closeModal();
}

export function isModalOpen() {
  return stack.length > 0;
}

export function confirmDialog({ title = '请确认', message = '', confirmText = '确认', danger = false }) {
  return new Promise((resolve) => {
    openModal({
      title: escapeHtml(title),
      size: 'narrow',
      body: `<p class="text-muted">${escapeHtml(message)}</p>`,
      footer: `
        <button class="btn" type="button" data-modal-cancel>取消</button>
        <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" type="button" data-modal-ok data-autofocus>${escapeHtml(
          confirmText
        )}</button>`,
      onMount(panel) {
        panel.querySelector('[data-modal-cancel]')?.addEventListener('click', () => closeModal(false));
        panel.querySelector('[data-modal-ok]')?.addEventListener('click', () => closeModal(true));
      },
      onClose: (result) => resolve(result === true)
    });
  });
}

export function promptDialog({ title = '输入', label = '', value = '', confirmText = '保存' }) {
  return new Promise((resolve) => {
    openModal({
      title: escapeHtml(title),
      size: 'narrow',
      body: `
        <label class="detail-tags__label" for="prompt-input">${escapeHtml(label)}</label>
        <input class="input-plain" id="prompt-input" type="text" value="${escapeHtml(value)}" data-autofocus />`,
      footer: `
        <button class="btn" type="button" data-modal-cancel>取消</button>
        <button class="btn btn--primary" type="button" data-modal-ok>${escapeHtml(confirmText)}</button>`,
      onMount(panel) {
        const input = panel.querySelector('#prompt-input');
        input?.select();
        const submit = () => closeModal(input?.value ?? '');
        panel.querySelector('[data-modal-cancel]')?.addEventListener('click', () => closeModal(null));
        panel.querySelector('[data-modal-ok]')?.addEventListener('click', submit);
        input?.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') submit();
        });
      },
      onClose: (result) => resolve(typeof result === 'string' ? result.trim() : null)
    });
  });
}

export function openLightbox(src, alt = '') {
  const root = lightboxRoot();
  root.innerHTML = `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" />`;
  root.dataset.open = 'true';
  root.setAttribute('aria-hidden', 'false');
}

export function closeLightbox() {
  const root = lightboxRoot();
  root.dataset.open = 'false';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = '';
}

export function isLightboxOpen() {
  return lightboxRoot()?.dataset.open === 'true';
}

export function emptyImageHtml(text = '配图待补充') {
  return `
    <div class="empty-image">
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="3"></rect>
        <circle cx="8.5" cy="9.5" r="1.6"></circle>
        <path d="M21 16l-5-5-5.5 5.5L8 14l-5 5"></path>
      </svg>
      <span>${escapeHtml(text)}</span>
    </div>`;
}
