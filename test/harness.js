/**
 * Harness: uruchamia tag GTM (gtm/smart-script.html) w Node bez przeglądarki.
 * Atrapy: document.cookie (z obsługą domeny i wygasania), <a> jako parser URL,
 * querySelectorAll dla selektorów a[href*="..."], localStorage, window.orientation.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const TAG_PATH = path.join(__dirname, '..', 'gtm', 'smart-script.html');

// Minimalna lista public suffix — przeglądarka nie pozwoli ustawić cookie na samej końcówce
const PUBLIC_SUFFIXES = new Set(['si', 'pl', 'com.pl', 'com', 'cz', 'sk', 'de']);

/**
 * Słoik cookie odwzorowujący zachowanie document.cookie.
 */
class CookieJar {
  constructor(hostname) {
    this.hostname = hostname;
    this.store = new Map();
  }

  get() {
    return [...this.store.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  set(raw) {
    const parts = raw.split(';').map((p) => p.trim());
    const [name, ...rest] = parts[0].split('=');
    const value = rest.join('=');
    const attrs = {};
    for (const p of parts.slice(1)) {
      const [k, ...v] = p.split('=');
      attrs[k.toLowerCase()] = v.join('=');
    }
    if (attrs.domain) {
      const domain = attrs.domain.replace(/^\./, '');
      const matches = this.hostname === domain || this.hostname.endsWith('.' + domain);
      if (!matches || PUBLIC_SUFFIXES.has(domain)) {
        return; // przeglądarka odrzuca takie cookie
      }
      this.lastDomain = domain;
    }
    const expired =
      (attrs['max-age'] !== undefined && Number(attrs['max-age']) <= 0) ||
      (attrs.expires !== undefined && new Date(attrs.expires).getTime() < Date.now());
    if (expired) {
      this.store.delete(name);
    } else {
      this.store.set(name, value);
    }
  }
}

function makeAnchor(href, base) {
  const a = {
    _href: href,
    setAttribute(attr, val) {
      if (attr === 'href') this._href = val;
    },
    get href() {
      return this._href;
    },
    set href(val) {
      this._href = val;
    },
    get _url() {
      try {
        return new URL(this._href, base);
      } catch (e) {
        return new URL(base);
      }
    },
    get host() {
      return this._url.host;
    },
    get search() {
      return this._url.search;
    },
  };
  return a;
}

/**
 * Prosty matcher selektorów `a[href*="x"]` rozdzielonych przecinkami.
 */
function matchSelector(selector, href) {
  return selector.split(',').some((s) => {
    const m = s.trim().match(/^a\[href\*="(.+)"\]$/);
    return m ? href.includes(m[1]) : false;
  });
}

/**
 * Podmienia wartości w sekcji KONFIGURACJA, np. {version: '"v3"', testing: 'true'}.
 */
function applyConfig(source, config) {
  let out = source;
  for (const [name, value] of Object.entries(config)) {
    const re = new RegExp(`var ${name} = [^;]+;`);
    if (!re.test(out)) throw new Error(`Brak zmiennej konfiguracyjnej: ${name}`);
    out = out.replace(re, `var ${name} = ${value};`);
  }
  return out;
}

function loadSource() {
  const html = fs.readFileSync(TAG_PATH, 'utf8');
  const m = html.match(/<script>([\s\S]*)<\/script>/);
  if (!m) throw new Error('Nie znaleziono <script> w tagu');
  return m[1];
}

/**
 * Tworzy „przeglądarkę” współdzieloną między kolejnymi odsłonami (cookie, localStorage).
 */
function createBrowser({ hostname = 'www.example-shop.pl', mobile = true } = {}) {
  return {
    hostname,
    mobile,
    jar: new CookieJar(hostname),
    localStorageData: new Map(),
    localStorageThrows: false,
  };
}

/**
 * Jedna odsłona strony: uruchamia tag i zwraca linki po podmianie + API skryptu.
 *
 * @param {object} browser wynik createBrowser
 * @param {object} opts url, referrer, links (lista href), config (nadpisania)
 */
function runPage(browser, { url, referrer = '', links = [], config = {} } = {}) {
  const pageUrl = url || `https://${browser.hostname}/`;
  const parsed = new URL(pageUrl);
  const logs = [];
  const anchors = links.map((href) => makeAnchor(href, pageUrl));

  const location = { href: pageUrl, hostname: parsed.hostname };
  const document = {
    location,
    referrer,
    createElement: () => makeAnchor('', pageUrl),
    querySelectorAll: (sel) => anchors.filter((a) => matchSelector(sel, a.href)),
  };
  Object.defineProperty(document, 'cookie', {
    get: () => browser.jar.get(),
    set: (v) => browser.jar.set(v),
  });

  const localStorage = {
    getItem(k) {
      if (browser.localStorageThrows) throw new Error('SecurityError');
      return browser.localStorageData.has(k) ? browser.localStorageData.get(k) : null;
    },
    setItem(k, v) {
      if (browser.localStorageThrows) throw new Error('SecurityError');
      browser.localStorageData.set(k, String(v));
    },
  };

  const window = { location };
  if (browser.mobile) window.orientation = 0;

  const context = {
    window,
    document,
    location,
    localStorage,
    navigator: { userAgent: browser.mobile ? 'Mozilla/5.0 (iPhone)' : 'Mozilla/5.0 (Macintosh)' },
    console: { log: (m) => logs.push(m), dir: (m) => logs.push(m) },
    JSON,
    Date,
    String,
    encodeURIComponent,
    decodeURIComponent,
  };

  const source = applyConfig(loadSource(), config);
  vm.runInNewContext(source, context, { filename: 'smart-script.html' });

  return {
    links: anchors.map((a) => a.href),
    api: window.__smartscript,
    logs,
  };
}

/**
 * Parametry query jako obiekt (zdekodowane).
 */
function params(url) {
  return Object.fromEntries(new URL(url).searchParams.entries());
}

module.exports = { createBrowser, runPage, params, loadSource, applyConfig };
