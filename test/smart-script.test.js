/**
 * Testy jednostkowe tagu Smart Script. Uruchomienie: `npm test` (node --test, bez zależności).
 * Oczekiwane wartości v1/v2/v3 odtwarzają scenariusze z arkusza testów oryginalnego wdrożenia.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createBrowser, runPage, params } = require('./harness');

const UTM_URL =
  'https://www.example-shop.pl/?utm_source=src&utm_medium=medium&utm_campaign=test&utm_term=kwrd&utm_content=ad';
const PLAY = 'https://play.google.com/store/apps/details?id=pl.example.shop';
const APPSTORE = 'https://apps.apple.com/pl/app/example-shop/id1000000001';
const GA_COOKIE = '_ga=GA1.2.1234567890.1700000000';

function browserWithGa(opts) {
  const b = createBrowser(opts);
  b.jar.set(GA_COOKIE);
  return b;
}

/* --------------------------------------------------------------------------
 * Mapowanie parametrów v1 / v2 / v3 (zgodność z arkuszem testów)
 * ------------------------------------------------------------------------ */
test.describe('mapowanie parametrów OneLink', () => {
  const common = {
    af_ad: 'ad',
    af_keywords: 'kwrd',
    af_channel: 'af_web_smartscript',
    af_sub1: 'src',
    af_sub2: 'medium|test',
    af_sub3: 'ad|kwrd',
    af_sub4: '1234567890.1700000000',
  };

  test('v1: stałe pid i c', () => {
    const { links } = runPage(browserWithGa(), { url: UTM_URL, links: [PLAY], config: { version: '"v1"' } });
    assert.ok(links[0].startsWith('https://example-shop.onelink.me/AbCd?'));
    assert.deepEqual(params(links[0]), { pid: 'af_smartscript', c: 'af_smartscript_campaign', ...common });
  });

  test('v2: pid = source, c = medium|campaign', () => {
    const { links } = runPage(browserWithGa(), { url: UTM_URL, links: [PLAY], config: { version: '"v2"' } });
    assert.deepEqual(params(links[0]), { pid: 'src', c: 'medium|test', ...common });
  });

  test('v2: pid zostaje na pierwszej pozycji (podmiana w miejscu)', () => {
    const { links } = runPage(browserWithGa(), { url: UTM_URL, links: [PLAY] });
    assert.match(links[0], /\/AbCd\?pid=src&c=medium%7Ctest&/);
  });

  test('v3: grupowanie media source', () => {
    const { links } = runPage(browserWithGa(), { url: UTM_URL, links: [PLAY], config: { version: '"v3"' } });
    assert.deepEqual(params(links[0]), { pid: 'Pozostałe', c: 'Pozostałe', ...common });
  });

  test('v3: grupy dla znanych źródeł', () => {
    const cases = {
      retargeting_a: 'Remarketing zewnętrzny',
      retargeting_b: 'Remarketing zewnętrzny',
      display_a: 'Display',
      google: 'Organic',
      webpush_a: 'Web push',
      partner_a: 'Afiliacja',
      newsletter: 'Pozostałe',
    };
    for (const [source, group] of Object.entries(cases)) {
      const url = `https://www.example-shop.pl/?utm_source=${source}&utm_medium=x`;
      const { links } = runPage(createBrowser(), { url, links: [PLAY], config: { version: '"v3"' } });
      assert.equal(params(links[0]).pid, group, `source=${source}`);
    }
  });

  test('druga marka: wybór OneLinka po hostname', () => {
    const b = createBrowser({ hostname: 'www.example-outlet.pl' });
    const { links } = runPage(b, { url: 'https://www.example-outlet.pl/?utm_source=a&utm_medium=b', links: [PLAY] });
    assert.ok(links[0].startsWith('https://example-outlet.onelink.me/EfGh?'));
  });

  test('isRetargeting dokleja is_retargeting=true', () => {
    const { links } = runPage(createBrowser(), { url: UTM_URL, links: [PLAY], config: { isRetargeting: 'true' } });
    assert.equal(params(links[0]).is_retargeting, 'true');
  });
});

/* --------------------------------------------------------------------------
 * Parser źródła ruchu
 * ------------------------------------------------------------------------ */
test.describe('parser źródła ruchu', () => {
  const host = 'https://www.example-shop.pl/';
  const cases = [
    { name: 'gclid', url: host + '?gclid=ABC', ref: '', source: 'google', medium: 'cpc', paid: true },
    { name: 'dclid', url: host + '?dclid=DC', ref: '', source: 'dfa', medium: 'cpm', paid: true },
    { name: 'fbclid', url: host + '?fbclid=FB', ref: '', source: 'facebook', medium: 'cpc', paid: true },
    { name: 'organic google', url: host, ref: 'https://www.google.com/', source: 'google', medium: 'organic', paid: false },
    { name: 'referral', url: host, ref: 'https://blog.example.com/post', source: 'blog.example.com', medium: 'referral', paid: false },
    { name: 'direct', url: host, ref: '', source: 'direct', medium: '(none)', paid: false },
    { name: 'wewnętrzny referrer', url: host + 'damskie', ref: host, source: 'direct', medium: '(none)', paid: false },
    { name: 'utm ma pierwszeństwo przed gclid', url: host + '?utm_source=x&utm_medium=y&gclid=G', ref: '', source: 'x', medium: 'y', paid: true },
  ];
  for (const c of cases) {
    test(c.name, () => {
      const { api } = runPage(createBrowser(), { url: c.url, referrer: c.ref });
      const data = api.parser.getData(c.url, c.ref);
      assert.equal(data.source, c.source);
      assert.equal(data.medium, c.medium);
      assert.equal(data.paid, c.paid);
    });
  }

  test('clickid: gclid > dclid > fbclid', () => {
    const { api } = runPage(createBrowser());
    assert.equal(api.parser.parseClickID(host + '?fbclid=F&dclid=D&gclid=G'), 'G');
    assert.equal(api.parser.parseClickID(host + '?fbclid=F&dclid=D'), 'D');
    assert.equal(api.parser.parseClickID(host), '');
  });

  test('campaign domyślnie (not set)', () => {
    const { api } = runPage(createBrowser());
    assert.equal(api.parser.parseCampaign(host), '(not set)');
  });

  test('client id z cookie _ga (GA4 i UA)', () => {
    const b = createBrowser();
    b.jar.set('_ga=GA1.1.111.222');
    const { api } = runPage(b);
    assert.equal(api.parser.getClientID(), '111.222');
  });

  test('zniekształcony %-encoding nie wywraca tagu', () => {
    const url = host + '?utm_source=%E0%A4%A&utm_medium=x';
    const { links } = runPage(createBrowser(), { url, links: [PLAY] });
    assert.ok(links[0].includes('onelink.me'));
  });

  test('+ w parametrze dekodowany jako spacja', () => {
    const { api } = runPage(createBrowser());
    assert.equal(api.helper.getParam('utm_campaign', host + '?utm_campaign=black+friday'), 'black friday');
  });
});

/* --------------------------------------------------------------------------
 * Gdzie skrypt NIE podmienia linków
 * ------------------------------------------------------------------------ */
test.describe('warunki pominięcia', () => {
  test('desktop: linki bez zmian', () => {
    const { links } = runPage(createBrowser({ mobile: false }), { url: UTM_URL, links: [PLAY, APPSTORE] });
    assert.deepEqual(links, [PLAY, APPSTORE]);
  });

  test('desktop + testing: podmiana dla testów', () => {
    const { links } = runPage(createBrowser({ mobile: false }), {
      url: UTM_URL,
      links: [PLAY],
      config: { testing: 'true' },
    });
    assert.ok(links[0].includes('onelink.me'));
  });

  test('ruch z Facebooka: linki bez zmian (regresja TypeError z oryginału)', () => {
    const { links } = runPage(createBrowser(), { url: 'https://www.example-shop.pl/?fbclid=X', links: [PLAY] });
    assert.deepEqual(links, [PLAY]);
  });

  test('wejście z OneLinka (af_redirect): linki bez zmian', () => {
    const { links } = runPage(createBrowser(), {
      url: 'https://www.example-shop.pl/?af_redirect=true&utm_source=a',
      links: [PLAY],
    });
    assert.deepEqual(links, [PLAY]);
  });

  test('podmienia tylko linki do sklepów i OneLink', () => {
    const other = 'https://www.example-shop.pl/regulamin';
    const { links } = runPage(createBrowser(), { url: UTM_URL, links: [other, APPSTORE, 'https://example-shop.onelink.me/AbCd/banner'] });
    assert.equal(links[0], other);
    assert.ok(links[1].startsWith('https://example-shop.onelink.me/AbCd?'));
    assert.ok(links[2].startsWith('https://example-shop.onelink.me/AbCd?'));
  });

  test('ponowne uruchomienie (trigger page / mobile_app_banner) jest idempotentne', () => {
    const b = browserWithGa();
    const first = runPage(b, { url: UTM_URL, links: [PLAY] }).links[0];
    const second = runPage(b, { url: UTM_URL, links: [first] }).links[0];
    assert.equal(second, first);
  });
});

/* --------------------------------------------------------------------------
 * Enkodowanie i limity długości
 * ------------------------------------------------------------------------ */
test.describe('enkodowanie i limity', () => {
  test('kampania ze spacją, % i & przechodzi bez uszkodzenia linku', () => {
    const campaign = '$ CZ DSA (ROAS 1000%) & more';
    const url = 'https://www.example-shop.pl/?utm_source=google&utm_medium=cpc&utm_campaign=' + encodeURIComponent(campaign);
    const { links } = runPage(createBrowser(), { url, links: [PLAY] });
    const p = params(links[0]);
    assert.equal(p.c, 'cpc|' + campaign);
    assert.equal(p.af_sub2, 'cpc|' + campaign);
  });

  test('c ucinane do 100 znaków, pid do 50', () => {
    const long = 'x'.repeat(300);
    const url = `https://www.example-shop.pl/?utm_source=${long}&utm_medium=m&utm_campaign=${long}`;
    const { links } = runPage(createBrowser(), { url, links: [PLAY] });
    const p = params(links[0]);
    assert.equal(p.c.length, 100);
    assert.equal(p.pid.length, 50);
    assert.equal(p.af_sub1.length, 100);
  });

  test('gclid trafia do af_sub3 (regresja brakującego return)', () => {
    const { links } = runPage(createBrowser(), { url: 'https://www.example-shop.pl/?gclid=GCLID123', links: [PLAY] });
    assert.equal(params(links[0]).af_sub3, 'GCLID123');
  });

  test('brak ad i keyword: af_sub3 pominięty zamiast "null|null"', () => {
    const { links } = runPage(createBrowser(), { url: 'https://www.example-shop.pl/?utm_source=a&utm_medium=b', links: [PLAY] });
    assert.equal(params(links[0]).af_sub3, undefined);
  });
});

/* --------------------------------------------------------------------------
 * Firebase Dynamic Links (wyłączone domyślnie)
 * ------------------------------------------------------------------------ */
test.describe('Dynamic Links', () => {
  test('af_r jest zakodowany i zawiera komplet parametrów FDL', () => {
    const { links } = runPage(createBrowser(), { url: UTM_URL, links: [PLAY], config: { useDynamicLinks: 'true' } });
    const p = params(links[0]);
    assert.equal(p.pid, 'src', 'parametry FDL nie mogą wyciec do OneLinka');
    assert.equal(p.apn, undefined);
    const fdl = params(p.af_r);
    assert.equal(fdl.utm_source, 'src');
    assert.equal(fdl.apn, 'pl.example.shop');
    assert.equal(fdl.isi, '1000000001');
    assert.equal(fdl.efr, '1');
    assert.equal(fdl.link, UTM_URL);
  });

  test('preview włączony: brak efr', () => {
    const { links } = runPage(createBrowser(), {
      url: UTM_URL,
      links: [PLAY],
      config: { useDynamicLinks: 'true', useDynamicLinksPreview: 'true' },
    });
    assert.equal(params(params(links[0]).af_r).efr, undefined);
  });

  test('domyślnie brak af_r', () => {
    const { links } = runPage(createBrowser(), { url: UTM_URL, links: [PLAY] });
    assert.equal(params(links[0]).af_r, undefined);
  });
});

/* --------------------------------------------------------------------------
 * Modele atrybucji — sekwencje odsłon w jednej „przeglądarce”
 * ------------------------------------------------------------------------ */
test.describe('modele atrybucji', () => {
  const HOST = 'https://www.example-shop.pl/';
  const paid = HOST + '?gclid=G1';
  const newSession = (b) => b.jar.store.delete('_smsess');

  function visit(b, model, url, referrer = '') {
    return runPage(b, { url, referrer, links: [PLAY], config: { attribution: `"${model}"` } });
  }

  test('default: wejście direct w nowej sesji nie nadpisuje płatnego', () => {
    const b = createBrowser();
    visit(b, 'default', paid);
    newSession(b);
    const { links } = visit(b, 'default', HOST);
    assert.equal(params(links[0]).pid, 'google');
  });

  test('default: organic nadpisuje płatny', () => {
    const b = createBrowser();
    visit(b, 'default', paid);
    newSession(b);
    const { links } = visit(b, 'default', HOST, 'https://www.google.com/');
    assert.equal(params(links[0]).c, 'organic|(not set)');
  });

  test('lastClick: direct nadpisuje płatny', () => {
    const b = createBrowser();
    visit(b, 'lastClick', paid);
    newSession(b);
    const { links } = visit(b, 'lastClick', HOST);
    assert.equal(params(links[0]).pid, 'direct');
  });

  test('lastPaid: organic i referral nie nadpisują płatnego', () => {
    const b = createBrowser();
    visit(b, 'lastPaid', paid);
    newSession(b);
    visit(b, 'lastPaid', HOST, 'https://www.google.com/');
    newSession(b);
    const { links } = visit(b, 'lastPaid', HOST, 'https://blog.example.com/');
    assert.equal(params(links[0]).af_sub3, 'G1');
  });

  test('lastPaid: płatny nadpisuje płatny', () => {
    const b = createBrowser();
    visit(b, 'lastPaid', paid);
    newSession(b);
    const { links } = visit(b, 'lastPaid', HOST + '?utm_source=retargeting_a&utm_medium=display');
    assert.equal(params(links[0]).pid, 'retargeting_a');
  });

  test('nawigacja wewnętrzna w tej samej sesji zachowuje źródło', () => {
    const b = createBrowser();
    visit(b, 'lastClick', paid);
    const { links } = visit(b, 'lastClick', HOST + 'damskie', HOST);
    assert.equal(params(links[0]).pid, 'google');
  });

  test('pierwsza odsłona bez zapisanych danych działa w każdym modelu', () => {
    for (const model of ['default', 'lastClick', 'lastPaid']) {
      const { links } = visit(createBrowser(), model, HOST);
      assert.equal(params(links[0]).pid, 'direct', model);
    }
  });
});

/* --------------------------------------------------------------------------
 * Storage
 * ------------------------------------------------------------------------ */
test.describe('storage', () => {
  test('cookie _smsc na domenie najwyższego poziomu', () => {
    const b = createBrowser({ hostname: 'www.example-shop.pl' });
    runPage(b, { url: 'https://www.example-shop.pl/?utm_source=a&utm_medium=b' });
    assert.equal(JSON.parse(b.jar.store.get('_smsc')).source, 'a');
    assert.equal(b.jar.lastDomain, 'example-shop.pl');
  });

  test('localStorage zamiast cookie', () => {
    const b = createBrowser();
    runPage(b, { url: 'https://www.example-shop.pl/?utm_source=a&utm_medium=b', config: { storage: '"localStorage"' } });
    assert.equal(JSON.parse(b.localStorageData.get('_smsc')).source, 'a');
    assert.equal(b.jar.store.has('_smsc'), false);
  });

  test('zablokowany localStorage: fallback na cookie, bez wyjątku', () => {
    const b = createBrowser();
    b.localStorageThrows = true;
    const { links } = runPage(b, {
      url: 'https://www.example-shop.pl/?utm_source=a&utm_medium=b',
      links: [PLAY],
      config: { storage: '"localStorage"' },
    });
    assert.equal(params(links[0]).pid, 'a');
    assert.equal(JSON.parse(b.jar.store.get('_smsc')).source, 'a');
  });

  test('uszkodzony JSON w _smsc nie wywraca tagu', () => {
    const b = createBrowser();
    b.jar.set('_smsc={broken');
    b.jar.set('_smsess=true');
    const { links } = runPage(b, { url: 'https://www.example-shop.pl/', links: [PLAY] });
    assert.equal(params(links[0]).pid, 'direct');
  });

  test('produkcja nie loguje do konsoli', () => {
    const { logs } = runPage(createBrowser(), { url: UTM_URL, links: [PLAY] });
    assert.deepEqual(logs, []);
  });
});
