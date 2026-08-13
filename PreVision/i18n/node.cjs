'use strict';

const packs = Object.freeze({
  'zh-CN': require('./locales/zh-CN.js'),
  'en-US': require('./locales/en-US.js')
});

const fallbackLocale = 'zh-CN';
let locale = normalizeLocale(process.env.PREVISION_LOCALE);

function normalizeLocale(value) {
  const candidate = String(value || '').toLowerCase();
  return candidate.startsWith('en') ? 'en-US' : fallbackLocale;
}

function format(template, variables = {}) {
  return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(variables, name) ? String(variables[name]) : match
  );
}

function t(key, variables = {}, localeOverride = locale) {
  const activePack = packs[normalizeLocale(localeOverride)] || {};
  const fallbackPack = packs[fallbackLocale];
  const value = activePack[key] ?? fallbackPack[key];
  return value === undefined ? key : format(value, variables);
}

function setLocale(nextLocale) {
  locale = normalizeLocale(nextLocale);
  return locale;
}

module.exports = Object.freeze({ getLocale: () => locale, setLocale, t });
