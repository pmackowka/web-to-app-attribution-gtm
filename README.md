# web-to-app-attribution-gtm

Smart Script w Google Tag Manager: zapamiętuje źródło ruchu na stronie www i przekazuje je do aplikacji mobilnej przez AppsFlyer OneLink. Dzięki temu instalacja i zakup w aplikacji trafiają do kampanii, która przyprowadziła użytkownika na stronę.

**Problem:** część użytkowników trafia na stronę z reklamy (Google Ads, retargeting, newsletter), a potem klika baner „Pobierz aplikację”, instaluje ją i kupuje już w aplikacji. AppsFlyer widzi taką instalację jako ruch „z www” albo organic. Informacja, że użytkownika przyprowadziła kampania, ginie na granicy web → app.

## Ten skrypt a oficjalny Smart Script AppsFlyer

AppsFlyer ma własny [OneLink Smart Script V2](https://dev.appsflyer.com/hc/docs/dl_smart_script_v2) (`AF_SMART_SCRIPT.generateOneLinkURL`). Rozwiązuje część tego samego problemu, ale **czyta tylko bieżący URL**. Ten projekt zapamiętuje źródło ruchu między odsłonami i sesjami, a to jest jego właściwa wartość.

| | Ten projekt | Oficjalny Smart Script V2 |
|---|---|---|
| Źródło danych | wejście zapisane w cookie `_smsc` (30 dni) | tylko parametry bieżącego URL |
| Scenariusz: reklama → strona A → strona C → klik w baner | atrybucja do reklamy | brak UTM na stronie C → atrybucja utracona |
| Modele atrybucji | `default` (last non-direct), `lastClick`, `lastPaid` | brak — ostatni URL |
| Wnioskowanie źródła bez UTM (referrer, organic) | tak, logika Universal Analytics | nie — opcja `webReferrer` kopiuje tylko surowy `document.referrer` |
| GA client id w `af_sub4` (zszycie web + app w BigQuery) | tak | nie (możliwe ręcznie przez parametry własne) |
| Click id | `gclid`, `dclid`, `fbclid` | `gclid`, `fbclid` (od 2.8.1), `ttclid`, `twclid`, `ScCid` (od 2.10.0) |
| QR kod dla desktopu, impressions | nie | tak |
| Utrzymanie | własny kod | biblioteka AppsFlyer |

Rekomendacja dla nowego wdrożenia: oficjalny Smart Script V2 do budowy linku i warstwa persystencji z tego repo (`parser` + `saver`), która podaje mu zapamiętane źródło. Własny generator linków (`generator`) warto utrzymywać tylko wtedy, gdy oficjalny skrypt nie wchodzi w grę.

## Jak to działa

1. Przy każdym wejściu skrypt odczytuje źródło ruchu: UTM, `gclid`/`dclid`/`fbclid`, referrer, GA client id.
2. Zapisuje je w cookie `_smsc` zgodnie z wybranym modelem atrybucji.
3. Na urządzeniach mobilnych przepisuje linki do App Store, Google Play i OneLink na OneLink z parametrami kampanii (`pid`, `c`, `af_sub1–4`, `af_channel=af_web_smartscript`).
4. AppsFlyer przypisuje instalację i późniejsze zakupy w aplikacji do kampanii webowej. `af_sub4` (GA client id) pozwala zszyć ścieżkę web i app w BigQuery.

```
 reklama ──► www (mobile) ──────────────────────► klik w baner ──► OneLink ──► sklep ──► instalacja ──► zakup w app
             │                                     ▲                  │
             │ Smart Script (DOM Ready / page)     │ href przepisany  │ pid, c, af_sub1-4,
             │  parser: UTM, click id, referrer    │ na OneLink       │ af_channel=af_web_smartscript
             │  saver:  _smsc (30 dni) + model     │                  ▼
             │  generator: buduje OneLink ─────────┘              AppsFlyer: atrybucja do kampanii web
             │
             └ Mobile App Banner Listener: baner wyrenderował się później → event mobile_app_banner → Smart Script jeszcze raz
```

| Obiekt | Odpowiada za | Publiczne API |
|---|---|---|
| `helper` | parametry URL, cookie, domena najwyższego poziomu | — |
| `parser` | źródło ruchu bieżącej sesji (logika jak w Universal Analytics) | — |
| `saver` | zapis i wybór źródła wg modelu atrybucji | `saver.getTrafficData(url, referrer, storage, attribution, testing)` |
| `generator` | budowa finalnego linku OneLink / Dynamic Link | `generator.generateUrl(currentURL, appData, trafficData, additionalParams, overwriteParams, testing)` |

Do debugowania obiekty są dostępne w konsoli jako `window.__smartscript`.

## Struktura repozytorium

```
gtm/smart-script.html                  tag główny (Custom HTML)
gtm/mobile-app-banner-listener.html    tag nasłuchujący na baner
sql/smartscript_installs_check.sql     weryfikacja instalacji w BigQuery
test/harness.js                        atrapa przeglądarki do uruchamiania tagu w Node
test/smart-script.test.js              testy jednostkowe (45)
test/simulation.test.js                kontrola aktualności CSV z symulacji
simulation/scenarios.js                hipotetyczne ścieżki użytkownika
simulation/simulate.js                 symulator: ścieżka → parametry w AppsFlyer
simulation/simulation.csv              wynik symulacji (podgląd jako tabela na GitHubie)
```

## Wdrożenie w GTM

1. **Tag `Smart Script`** — Custom HTML, treść z `gtm/smart-script.html`.
   Triggery: `DOM Ready` (All Pages), Custom Event `page` (wirtualne odsłony SPA), Custom Event `mobile_app_banner`.
2. **Tag `Mobile App Banner Listener`** — Custom HTML, treść z `gtm/mobile-app-banner-listener.html`.
   Trigger: `DOM Ready`. Tag ma wewnętrzną flagę, więc drugi obserwator się nie uruchomi.
3. **Zgody.** Oba tagi: *Consent Settings → Require additional consent* → `ad_storage` i `analytics_storage`. Skrypt ustawia cookie i czyta `_ga`, więc bez zgody nie może się odpalić.
4. **Konfiguracja.** Uzupełnij `APPS`, `BRAND_HOSTS` i wzorce w `getGroupedPID` — w repo są wartości przykładowe.
5. **Test na stage.** Ustaw `testing = true`: skrypt loguje do konsoli i przepisuje linki także na desktopie. Wejdź na stronę z `?utm_source=src&utm_medium=medium&utm_campaign=test&utm_term=kwrd&utm_content=ad` i sprawdź `href` linku do sklepu.
6. **Publikacja.** Przywróć `testing = false`.

## Konfiguracja

Wszystko w sekcji `KONFIGURACJA` na górze `gtm/smart-script.html`.

| Zmienna | Domyślnie | Znaczenie |
|---|---|---|
| `testing` | `false` | logi w konsoli i podmiana linków także na desktopie |
| `storage` | `"cookie"` | `"cookie"` albo `"localStorage"` (przy blokadzie localStorage skrypt wraca do cookie) |
| `cookieDays` | `30` | czas życia `_smsc`; `90` = bliżej okna atrybucji GA |
| `attribution` | `"lastClick"` | model atrybucji, opis niżej |
| `version` | `"v2"` | wariant mapowania parametrów, tabela niżej |
| `useDynamicLinks` | `false` | Firebase Dynamic Links w `af_r` — usługa wyłączona, zostaw `false` |
| `useDynamicLinksPreview` | `false` | `false` dokleja `efr=1` (pomija planszę preview FDL) |
| `isRetargeting` | `false` | `true` = ruch web→app raportowany jako retargeting |
| `APPS` | `brand_a`, `brand_b` | OneLink, Dynamic Link, ID aplikacji per marka |
| `BRAND_HOSTS`, `DEFAULT_BRAND` | `example-outlet.` → `brand_b` | wybór marki po hostname |

| Cookie | Czas życia | Zawartość |
|---|---|---|
| `_smsc` | 30 dni | JSON ze źródłem ruchu |
| `_smsess` | sesja przeglądarki | flaga „źródło tej sesji już odczytane” |

## Mapowanie parametrów

| Parametr OneLink | v1 | v2 (domyślnie) | v3 |
|---|---|---|---|
| `pid` | `af_smartscript` | `{source}` | grupa media source |
| `c` | `af_smartscript_campaign` | `{medium}\|{campaign}` | grupa media source |
| `af_ad` | `{ad}` | `{ad}` | `{ad}` |
| `af_keywords` | `{keyword}` | `{keyword}` | `{keyword}` |
| `af_channel` | `af_web_smartscript` | `af_web_smartscript` | `af_web_smartscript` |
| `af_sub1` | `{source}` | `{source}` | `{source}` |
| `af_sub2` | `{medium}\|{campaign}` | `{medium}\|{campaign}` | `{medium}\|{campaign}` |
| `af_sub3` | `{clickid}` albo `{ad}\|{keyword}` | j.w. | j.w. |
| `af_sub4` | `{cid}` (GA client id) | `{cid}` | `{cid}` |

Źródła danych: `{source}` = `utm_source`, `{medium}` = `utm_medium`, `{campaign}` = `utm_campaign`, `{ad}` = `utm_content`, `{keyword}` = `utm_term`, `{clickid}` = `gclid` > `dclid` > `fbclid`.

Bez UTM skrypt odtwarza logikę Universal Analytics: `gclid` → `google / cpc`, `dclid` → `dfa / cpm`, `fbclid` → `facebook / cpc`, referrer z Google → `google / organic`, inny referrer → `{host} / referral`, brak referrera → `direct / (none)`.

Grupy w v3 (`getGroupedPID`, wzorce przykładowe):

| Wzorzec `utm_source` | Grupa |
|---|---|
| `retargeting_a`, `retargeting_b` | Remarketing zewnętrzny |
| `display_a`, `display_b`, `dfa` | Display |
| `google`, `bing`, `yahoo`, `duckduckgo` | Organic |
| `webpush_a` | Web push |
| `partner_a`, `partner_b`, `partner_c` | Afiliacja |
| pozostałe | Pozostałe |

W v3 grupa trafia też do `c` — tak zachowywał się skrypt w scenariuszach testowych oryginalnego wdrożenia.

## Modele atrybucji

| Model | Kiedy nowe źródło nadpisuje zapisane |
|---|---|
| `default` | zawsze, poza wejściem direct (last non-direct click, jak GA) |
| `lastClick` | zawsze |
| `lastPaid` | gdy nowe źródło jest płatne albo zapisane było bezpłatne (jak Campaign Manager) |

„Bezpłatne” = medium `(none)`, `organic` albo `referral`. Każde inne medium skrypt traktuje jako płatne — także `email`, co ma znaczenie przy `lastPaid`.

Nowe źródło jest odczytywane tylko przy wejściu z zewnątrz: ruch płatny i z UTM zawsze, ruch bez oznaczeń raz na sesję przeglądarki (`_smsess`). Nawigacja wewnętrzna i wirtualne odsłony SPA nie zmieniają źródła.

## Weryfikacja

**Testy jednostkowe** — tag uruchamiany w Node na atrapie przeglądarki (cookie z domenami, localStorage, `<a>` jako parser URL). Bez zależności, Node ≥ 20.

```bash
npm test
```

Pokrycie: mapowanie v1/v2/v3, parser źródeł, warunki pominięcia (desktop, Facebook, `af_redirect`), enkodowanie i limity długości, Dynamic Links, trzy modele atrybucji na sekwencjach odsłon, storage i odporność na uszkodzone dane. Testy sprawdzono mutacyjnie: przywrócenie błędów z pierwotnej wersji (brak `return` w `af_sub3`, wywołanie `parser.getSource()`) wywraca odpowiednio 2 i 28 testów.

**Debug w przeglądarce:**

```js
window.__smartscript.saver.getTrafficData(location.href, document.referrer, "cookie", "lastClick", true)
```

**Symulacja ścieżek** — [`simulation/simulation.csv`](simulation/simulation.csv) pokazuje, jakie parametry trafiłyby do AppsFlyer dla hipotetycznych ścieżek użytkownika (`simulation/scenarios.js`). Każda ścieżka jest liczona dla 3 modeli atrybucji × 3 wersji mapowania. Kolumny mają nazwy jak w raw data AppsFlyer: `pid` → `media_source`, `c` → `campaign`, dalej `af_sub1–4`. `campaign_params_on_click_page = no` oznacza ścieżkę, w której oficjalny Smart Script nie miałby czego przeczytać, bo na stronie z banerem nie ma parametrów kampanii.

```bash
npm run simulate   # po zmianie tagu albo scenariuszy; test pilnuje, żeby CSV był aktualny
```

Symulacja pokazuje tylko link, który wyjdzie ze strony. Tego, czy AppsFlyer przypisze instalację (okno lookback, inne kliknięcia, SRN), nie symuluje. Ruch z `fbclid` celowo nie jest przepisywany: Meta jest SRN i atrybuuje instalacje sama.

**Dane w BigQuery** — `sql/smartscript_installs_check.sql`: instalacje z `af_channel = 'af_web_smartscript'` per marka, z rozbiciem na `af_sub1–4` i odsetkiem instalacji z GA client id. Zapytanie nie było uruchomione na danych — przy pierwszym użyciu zrób dry-run.


## Stan zależności (październik 2026)

1. **Firebase Dynamic Links nie działają** — Google wyłączył usługę 25.08.2025. Ścieżka `useDynamicLinks` zostaje wyłącznie dla zgodności wstecznej.
2. **iOS i click id** — Google Ads na iOS przekazuje często `gbraid`/`wbraid` zamiast `gclid`. Skrypt ich nie obsługuje, więc część ruchu z iOS ląduje jako `google / cpc` bez identyfikatora. Do dopisania w `parseClickID`.
3. **Limit `pid`** — skrypt ucina do 50 znaków. Aktualna dokumentacja AppsFlyer podaje 150; niezweryfikowane na stronie źródłowej, więc zostaje bezpieczne 50.
4. **`window.orientation`** jako detekcja mobile jest przestarzałe w specyfikacji, ale nadal obecne w mobilnych Safari i Chrome. Zamiennik: `matchMedia('(pointer: coarse)')` albo `navigator.userAgentData.mobile`.

## Dokumentacja zewnętrzna

- [OneLink Smart Script V2 — dokumentacja deweloperska AppsFlyer](https://dev.appsflyer.com/hc/docs/dl_smart_script_v2)
- [OneLink Smart Script — przegląd](https://support.appsflyer.com/hc/en-us/articles/360000677217)
- [Struktura linków i parametry atrybucji AppsFlyer](https://support.appsflyer.com/hc/en-us/articles/207447163)
- [appsflyer-onelink-smart-script (GitHub)](https://github.com/AppsFlyerSDK/appsflyer-onelink-smart-script)
