# CLAUDE.md

Kontekst projektu dla kolejnych sesji. Pełny opis mechanizmu, konfiguracji GTM i mapowania parametrów: `README.md`.

## Co to jest

`web-to-app-attribution-gtm` — tag GTM (Custom HTML), który zapamiętuje źródło ruchu na www (UTM, `gclid`/`dclid`/`fbclid`, referrer, GA client id) w cookie `_smsc` i na mobile przepisuje linki do App Store / Google Play / OneLink na AppsFlyer OneLink z parametrami kampanii. Cel: instalacja i zakup w aplikacji przypisane do kampanii, która przyprowadziła użytkownika na stronę. Rekonstrukcja wdrożenia z 2021 r., z poprawkami błędów i testami. Repozytorium prywatne na GitHubie (`pmackowka/web-to-app-attribution-gtm`).

Przewaga nad oficjalnym AppsFlyer Smart Script V2: persystencja źródła między odsłonami i modele atrybucji. Oficjalny skrypt czyta tylko bieżący URL. Porównanie: README, sekcja „Ten skrypt a oficjalny Smart Script AppsFlyer”.

## Komendy

```bash
npm test        # 45 testów, node:test, Node ≥ 20, zero zależności
```

## Struktura i zasady

- `gtm/smart-script.html` — jedyne źródło logiki. **ES5** (bez `let`/`const`/strzałek/template stringów), bo trafia 1:1 do tagu Custom HTML w GTM. Cztery obiekty: `helper`, `parser`, `saver`, `generator`; konfiguracja w sekcji `KONFIGURACJA` na górze pliku.
- `gtm/mobile-app-banner-listener.html` — wypycha `mobile_app_banner` do dataLayer, gdy baner pojawi się po DOM Ready.
- `test/harness.js` — uruchamia tag w `vm` na atrapie przeglądarki (cookie jar z domenami i public suffix, localStorage, `<a>` jako parser URL). Testy nadpisują zmienne konfiguracyjne regexem `var X = …;` — **zmiana nazwy zmiennej w KONFIGURACJI = zmiana w testach**.
- `sql/` — BigQuery na eksporcie AppsFlyer; placeholdery `your-project`, `appsflyer_brand_a/b`. **Zapytanie nie było uruchomione na danych.**
- Nazwy w przykładach: marki `brand_a` / `brand_b`, domeny `example-shop.pl` / `example-outlet.pl`, źródła `retargeting_a`, `display_a`, `webpush_a`, `partner_a…c`.
- Kod i nazwy po angielsku, komentarze i dokumentacja po polsku. Poprawki względem pierwotnej wersji oznaczone w kodzie komentarzem `FIX:`.

## Twarde ograniczenia

- **Żadnych nazw klientów, byłych pracodawców, agencji, sieci z realnych wdrożeń, domen, ID aplikacji, OneLinków, projektów BigQuery ani identyfikatorów GA** — w kodzie, README, testach, opisie repo i commitach. Przykłady zawsze fikcyjne.
- Zgoda: oba tagi tylko przy `ad_storage` i `analytics_storage` (ustawienie po stronie GTM, opis w README).
- Commity: Conventional Commits po polsku (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`).
- Push na GitHub tylko na wyraźne polecenie.

## Następna iteracja

1. Obsługa `gbraid`/`wbraid` w `parser.parseClickID`.
2. Wariant hybrydowy: `parser` + `saver` z tego repo jako źródło danych dla oficjalnego `AF_SMART_SCRIPT.generateOneLinkURL` zamiast własnego `generator`.
3. Wydzielenie logiki do `src/` z buildem do `gtm/` (wzorzec z `affiliate-last-click-gtm`), żeby testy importowały moduł zamiast parsować HTML.
