(function createI18n(root) {
  'use strict';

  const fallbackLocale = 'zh-CN';
  const storageKey = 'prevision.locale';
  const packs = root.PreVisionLocalePacks || {};

  function normalizeLocale(value) {
    const candidate = String(value || '').toLowerCase();
    if (candidate.startsWith('en')) return 'en-US';
    return fallbackLocale;
  }

  function initialLocale() {
    let stored = '';
    try { stored = root.localStorage?.getItem(storageKey) || ''; } catch {}
    return normalizeLocale(stored || root.document?.documentElement?.lang || root.navigator?.language);
  }

  let locale = initialLocale();

  function format(template, variables = {}) {
    return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(variables, name) ? String(variables[name]) : match
    );
  }

  function t(key, variables = {}, localeOverride = locale) {
    const activePack = packs[normalizeLocale(localeOverride)] || {};
    const fallbackPack = packs[fallbackLocale] || {};
    const value = activePack[key] ?? fallbackPack[key];
    if (value === undefined) {
      root.console?.warn?.(`[i18n] Missing language key: ${key}`);
      return key;
    }
    return format(value, variables);
  }

  function apply(target = root.document) {
    if (!target?.querySelectorAll) return;
    const selectors = '[data-i18n],[data-i18n-title],[data-i18n-placeholder],[data-i18n-alt],[data-i18n-value],[data-i18n-aria-label],[data-i18n-tooltip]';
    const nodes = Array.from(target.querySelectorAll(selectors));
    if (target.matches?.(selectors)) nodes.unshift(target);
    for (const node of nodes) {
      if (node.dataset.i18n) node.textContent = t(node.dataset.i18n);
      if (node.dataset.i18nTitle) node.title = t(node.dataset.i18nTitle);
      if (node.dataset.i18nPlaceholder) node.placeholder = t(node.dataset.i18nPlaceholder);
      if (node.dataset.i18nAlt) node.alt = t(node.dataset.i18nAlt);
      if (node.dataset.i18nValue) node.value = t(node.dataset.i18nValue);
      if (node.dataset.i18nAriaLabel) node.setAttribute('aria-label', t(node.dataset.i18nAriaLabel));
      if (node.dataset.i18nTooltip) node.dataset.tooltip = t(node.dataset.i18nTooltip);
    }
    if (root.document?.documentElement) root.document.documentElement.lang = locale;
  }

  function setLocale(nextLocale) {
    locale = normalizeLocale(nextLocale);
    try { root.localStorage?.setItem(storageKey, locale); } catch {}
    apply(root.document);
    return locale;
  }

  root.PreVisionI18n = Object.freeze({
    apply,
    getLocale: () => locale,
    setLocale,
    t
  });

  apply(root.document);
  root.document?.addEventListener?.('DOMContentLoaded', () => apply(root.document), { once: true });
})(globalThis);
