-- Weryfikacja działania Smart Script na danych AppsFlyer (Data Locker / Push API → BigQuery).
-- Instalacje z linków przepisanych przez skrypt mają af_channel = 'af_web_smartscript'.
-- Placeholdery: `your-project`, `appsflyer_brand_a`, `appsflyer_brand_b` — podmień na własne.
-- Zapytanie nie było uruchomione na danych — przy pierwszym użyciu zrób dry-run.
--
-- Mapowanie (wersja v2):
--   media_source / pid → utm_source
--   campaign / c       → utm_medium|utm_campaign
--   af_sub1            → utm_source
--   af_sub2            → utm_medium|utm_campaign
--   af_sub3            → gclid / dclid albo utm_content|utm_term
--   af_sub4            → GA client id (cookie _ga)

DECLARE date_from DATE DEFAULT DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY);

WITH installs AS (
  SELECT 'brand_a' AS brand, *
  FROM `your-project.appsflyer_brand_a.mobile_devices_events`
  WHERE partition_time >= TIMESTAMP(date_from)
    AND event_name = 'install'

  UNION ALL

  SELECT 'brand_b' AS brand, *
  FROM `your-project.appsflyer_brand_b.mobile_devices_events`
  WHERE partition_time >= TIMESTAMP(date_from)
    AND event_name = 'install'
)

SELECT
  DATE(event_time) AS install_date,
  brand,
  af_channel,
  COALESCE(media_source, af_prt) AS media_source,
  campaign,
  af_sub1,
  af_sub2,
  af_sub3,
  af_sub4,
  COUNT(*) AS installs,
  -- odsetek instalacji z GA client id: miara, ile da się zszyć z sesją webową w GA
  SAFE_DIVIDE(COUNTIF(af_sub4 IS NOT NULL), COUNT(*)) AS share_with_ga_cid
FROM installs
WHERE af_channel IN ('af_web_smartscript', 'af_web_banner')
GROUP BY ALL
ORDER BY install_date DESC, installs DESC;
