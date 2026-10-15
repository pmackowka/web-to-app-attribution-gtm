/**
 * Symulacja: przepuszcza ścieżki z scenarios.js przez tag Smart Script (harness z testów)
 * i zapisuje, jakie parametry OneLink trafiłyby do AppsFlyer, do simulation/simulation.csv.
 * Uruchomienie: `npm run simulate`.
 *
 * Kolumny AppsFlyer nazwane jak w raw data / Data Locker: pid → media_source, c → campaign.
 */
const fs = require('node:fs');
const path = require('node:path');
const { createBrowser, runPage, params } = require('../test/harness');
const scenarios = require('./scenarios');

const OUTPUT = path.join(__dirname, 'simulation.csv');
const BANNER_LINK = 'https://play.google.com/store/apps/details?id=pl.example.shop';
const GA_COOKIE = '_ga=GA1.2.1234567890.1700000000';
const MODELS = ['default', 'lastClick', 'lastPaid'];
const VERSIONS = ['v1', 'v2', 'v3'];
const CAMPAIGN_PARAMS = /[?&](utm_[a-z]+|gclid|dclid|fbclid)=/;

const COLUMNS = [
  'scenario_id',
  'scenario',
  'journey',
  'attribution_model',
  'mapping_version',
  'link_rewritten',
  'campaign_params_on_click_page',
  'media_source',
  'campaign',
  'af_channel',
  'af_ad',
  'af_keywords',
  'af_sub1',
  'af_sub2',
  'af_sub3',
  'af_sub4',
  'is_retargeting',
  'onelink_url',
];

/**
 * Jedna ścieżka w jednej konfiguracji → wiersz CSV (obiekt).
 */
function simulate(scenario, model, version) {
  const browser = createBrowser();
  browser.jar.set(GA_COOKIE);
  const config = { attribution: `"${model}"`, version: `"${version}"` };

  let result;
  for (const step of scenario.steps) {
    if (step.newSession) browser.jar.store.delete('_smsess');
    if (step.expireCookie) browser.jar.store.delete('_smsc');
    result = runPage(browser, { url: step.url, referrer: step.referrer || '', links: [BANNER_LINK], config });
  }

  const link = result.links[0];
  const rewritten = link !== BANNER_LINK;
  const p = rewritten ? params(link) : {};
  const clickPage = scenario.steps[scenario.steps.length - 1].url;

  return {
    scenario_id: scenario.id,
    scenario: scenario.name,
    journey: scenario.steps.map((s) => s.label).join(' → '),
    attribution_model: model,
    mapping_version: version,
    link_rewritten: rewritten ? 'yes' : 'no',
    campaign_params_on_click_page: CAMPAIGN_PARAMS.test(clickPage) ? 'yes' : 'no',
    media_source: p.pid,
    campaign: p.c,
    af_channel: p.af_channel,
    af_ad: p.af_ad,
    af_keywords: p.af_keywords,
    af_sub1: p.af_sub1,
    af_sub2: p.af_sub2,
    af_sub3: p.af_sub3,
    af_sub4: p.af_sub4,
    is_retargeting: p.is_retargeting,
    onelink_url: rewritten ? link : '',
  };
}

function csvCell(value) {
  const s = value === undefined || value === null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Pełna treść CSV: każda ścieżka × model atrybucji × wersja mapowania.
 */
function buildCsv() {
  const rows = [COLUMNS.join(',')];
  for (const scenario of scenarios) {
    for (const model of MODELS) {
      for (const version of VERSIONS) {
        const row = simulate(scenario, model, version);
        rows.push(COLUMNS.map((c) => csvCell(row[c])).join(','));
      }
    }
  }
  return rows.join('\n') + '\n';
}

if (require.main === module) {
  const csv = buildCsv();
  fs.writeFileSync(OUTPUT, csv);
  console.log(`Zapisano ${csv.trim().split('\n').length - 1} wierszy → ${path.relative(process.cwd(), OUTPUT)}`);
}

module.exports = { buildCsv, simulate, OUTPUT };
