/**
 * Hipotetyczne ścieżki użytkownika do symulacji. Ostatni krok = odsłona, na której użytkownik klika baner aplikacji.
 *
 * Krok: { label, url, referrer?, newSession?, expireCookie? }
 * - newSession: nowa sesja przed odsłoną (usunięte cookie sesyjne `_smsess`)
 * - expireCookie: zapamiętane źródło wygasło przed odsłoną (usunięte `_smsc`)
 */
const HOST = 'https://www.example-shop.pl/';
const GOOGLE = 'https://www.google.com/';

module.exports = [
  {
    id: 'S01',
    name: 'Google Ads, klik w baner na stronie wejścia',
    steps: [{ label: 'reklama Google Ads (gclid)', url: HOST + '?gclid=G1' }],
  },
  {
    id: 'S02',
    name: 'Google Ads, baner na innej podstronie',
    steps: [
      { label: 'reklama Google Ads (gclid)', url: HOST + '?gclid=G1' },
      { label: 'podstrona kategorii', url: HOST + 'damskie', referrer: HOST },
      { label: 'karta produktu', url: HOST + 'damskie/produkt-1', referrer: HOST + 'damskie' },
    ],
  },
  {
    id: 'S03',
    name: 'Kampania UTM z pełnym zestawem parametrów',
    steps: [
      {
        label: 'kampania UTM (source, medium, campaign, term, content)',
        url: HOST + '?utm_source=newsletter&utm_medium=email&utm_campaign=jesien&utm_term=buty&utm_content=hero',
      },
    ],
  },
  {
    id: 'S04',
    name: 'Newsletter, następnego dnia wejście direct',
    steps: [
      { label: 'newsletter (UTM)', url: HOST + '?utm_source=newsletter&utm_medium=email&utm_campaign=jesien' },
      { label: 'wejście direct', url: HOST, newSession: true },
    ],
  },
  {
    id: 'S05',
    name: 'Retargeting, potem wyszukiwanie organiczne',
    steps: [
      { label: 'retargeting (UTM)', url: HOST + '?utm_source=retargeting_a&utm_medium=display&utm_campaign=porzucony_koszyk' },
      { label: 'Google organic', url: HOST, referrer: GOOGLE, newSession: true },
    ],
  },
  {
    id: 'S06',
    name: 'Google Ads, potem wejście z bloga',
    steps: [
      { label: 'reklama Google Ads (gclid)', url: HOST + '?gclid=G1' },
      { label: 'referral z bloga', url: HOST, referrer: 'https://blog.example.com/post', newSession: true },
    ],
  },
  {
    id: 'S07',
    name: 'Organic, potem płatna kampania',
    steps: [
      { label: 'Google organic', url: HOST, referrer: GOOGLE },
      { label: 'display (UTM)', url: HOST + '?utm_source=display_a&utm_medium=cpm&utm_campaign=wyprzedaz', newSession: true },
    ],
  },
  {
    id: 'S08',
    name: 'Dwie płatne kampanie po sobie',
    steps: [
      { label: 'display (UTM)', url: HOST + '?utm_source=display_a&utm_medium=cpm&utm_campaign=wyprzedaz' },
      { label: 'web push (UTM)', url: HOST + '?utm_source=webpush_a&utm_medium=push&utm_campaign=rabat', newSession: true },
    ],
  },
  {
    id: 'S09',
    name: 'Tylko wejście direct',
    steps: [{ label: 'wejście direct', url: HOST }],
  },
  {
    id: 'S10',
    name: 'Google Ads, zapamiętane źródło wygasło',
    steps: [
      { label: 'reklama Google Ads (gclid)', url: HOST + '?gclid=G1' },
      { label: 'wejście direct po wygaśnięciu cookie', url: HOST, newSession: true, expireCookie: true },
    ],
  },
  {
    id: 'S11',
    name: 'Reklama Facebook (fbclid)',
    steps: [{ label: 'reklama Facebook (fbclid)', url: HOST + '?fbclid=FB1' }],
  },
  {
    id: 'S12',
    name: 'Wejście z OneLinka (af_redirect)',
    steps: [{ label: 'przekierowanie z OneLinka', url: HOST + '?af_redirect=true&utm_source=newsletter' }],
  },
];
