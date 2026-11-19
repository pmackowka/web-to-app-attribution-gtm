# Diagram sekwencji UML: źródło z www → instalacja w aplikacji

Jak źródło ruchu ze strony trafia do atrybucji instalacji i zakupu w aplikacji. Opis mechanizmu i konfiguracji: [README](README.md).

```mermaid
sequenceDiagram
    autonumber
    actor U as Użytkownik (mobile)
    participant W as Strona www
    participant GTM as GTM: Smart Script
    participant C as Cookie _smsc
    participant OL as AppsFlyer OneLink
    participant ST as App Store / Google Play
    participant APP as Aplikacja (SDK AppsFlyer)
    participant AF as AppsFlyer
    participant BQ as BigQuery (raw data AppsFlyer)

    U->>W: wejście z reklamy (UTM, gclid) albo z referrera
    W->>GTM: DOM Ready / page / mobile_app_banner
    Note over GTM: tylko przy zgodzie ad_storage i analytics_storage
    GTM->>GTM: parser: UTM, click id, referrer, GA client id
    GTM->>C: saver: zapis źródła wg modelu atrybucji (30 dni)
    Note over U,C: kolejne wizyty, także direct po kilku dniach — model decyduje, czy źródło się zmienia
    GTM->>C: odczyt zapisanego źródła
    GTM->>W: generator: href banera → OneLink z pid, c, af_sub1–4
    U->>OL: klik w baner „Pobierz aplikację”
    OL->>AF: kliknięcie z parametrami kampanii web
    OL->>ST: przekierowanie do sklepu
    U->>APP: instalacja i pierwsze otwarcie
    APP->>AF: install
    AF->>AF: atrybucja instalacji do kliknięcia OneLink
    APP->>AF: zakup w aplikacji
    AF->>BQ: eksport raw data: media_source, campaign, af_sub1–4
    Note over BQ: af_sub4 = GA client id → zszycie ścieżki web i app (sql/smartscript_installs_check.sql)
```

| Krok | Kto | Po co |
|---|---|---|
| 1–4 | tag GTM | źródło zapisane w pierwszej wizycie przetrwa powrót direct |
| 5–6 | tag GTM | link do sklepu niesie kampanię, której nie widzi SDK aplikacji |
| 7–13 | AppsFlyer | instalacja i zakup trafiają do kampanii web zamiast „organic” |
| 14 | data engineer / analityk | kontrola instalacji z `af_channel = af_web_smartscript` w BigQuery |
