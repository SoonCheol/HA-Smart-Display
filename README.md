# HA Smart Display

2026-11-18에 HomeDisk의 Home Assistant 2026.10.1에서 확인한 Smart Display 운영 소스입니다.

| 파일 | 운영 원본 |
|---|---|
| `www/smart-display-card.js` | HA의 `/config/www/smart-display-card.js`. 날씨·공기질 화면과 스마트홈 제어 카드가 이 파일에 함께 들어 있습니다. |
| `www/smart-display.yaml` | HA의 `/config/www/smart-display.yaml`. 대시보드 구성 YAML입니다. |
| `dashboard/lovelace.smart_display.json` | HA의 `/config/.storage/lovelace.smart_display`. 운영 중인 Storage 모드 대시보드 구성입니다. |

운영 대시보드 경로는 `smart-display`입니다. Lovelace 리소스는 2026-11-18 체감온도 표시 정상화 후 `/local/smart-display-card.js?v=11`과 HACS의 `/hacsfiles/kiosk-mode/kiosk-mode.js`를 참조합니다. `www/새 폴더`의 카드 사본은 운영 리소스에 연결되지 않아 제외했습니다. 별도 `mini_display` 통합도 이 대시보드 구성에서 참조하지 않습니다.

## 날씨와 실외 미세먼지

| 항목 | 제공자와 엔티티 | 결과 |
|---|---|---|
| 날씨와 일별 예보 | Meteorologisk institutt (Met.no), `weather.forecast_jib` | 레지스트리에서 활성 설정을 확인했습니다. 카드는 `weather/subscribe_forecast`로 일별 예보를 구독합니다. |
| 실외 온도·습도 | SmartThings, `sensor.siloe_siloe_temperature`, `sensor.siloe_siloe_humidity` | 운영 대시보드에 연결돼 있습니다. |
| 실내 PM10·PM2.5 | SmartThings, `sensor.maihom_eeomoniteo_pm10`, `sensor.maihom_eeomoniteo_pm2_5` | 카드의 ‘실내 공기질’에 연결돼 있습니다. |
| 실외 PM10·PM2.5 | 현재 연결된 엔티티 없음 | 설치된 Met.no 날씨 통합은 PM 값을 제공하지 않습니다. 조사한 레지스트리와 대시보드에서 실외 PM 공급원을 확인하지 못했습니다. |

레지스트리 및 설치 코드 조사이며 센서의 실시간 값은 조회하지 않았습니다. [Home Assistant Met.no 통합 문서](https://www.home-assistant.io/integrations/met/)

## 실행 명령 및 조사 기록

기존 SSH 키로 HomeDisk에 연결한 뒤 아래 명령을 실행했습니다.

```sh
docker ps --format '{{.Names}} {{.Image}}' | grep -Ei 'display|homeassistant|dashboard'
docker inspect -f '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{println}}{{end}}' homeassistant
docker exec homeassistant python -m homeassistant --version
cd /volume3/docker3/homeassistant
grep -inE 'weather|pm10|pm2.?5|air.?quality|미세먼지|초미세먼지' www/smart-display* .storage/lovelace.smart_display | cut -c1-240 | head -100
grep -oE '/(local|hacsfiles)/[^" ]+' .storage/lovelace_resources | grep -Ei 'smart|kiosk'
docker exec homeassistant sh -c 'cat /usr/src/homeassistant/homeassistant/components/met/manifest.json; grep -nE "PM10|PM25|ATTR_|class Met" /usr/src/homeassistant/homeassistant/components/met/weather.py | head -25'
sha256sum www/smart-display-card.js www/smart-display.yaml .storage/lovelace.smart_display
```

SSH에서 `python3 -c "import sys; exec(bytes.fromhex(sys.stdin.read()))"`로 읽기 전용 조사 스크립트를 실행했습니다. `.storage/core.config_entries`에서 통합 도메인만 추출하고, `core.entity_registry`의 엔티티 ID·플랫폼·비활성화 상태와 대조했습니다. `lovelace_dashboards`에서 대시보드 경로와 모드를 확인했습니다. 통합 설정 원문, 인증 저장소 및 비밀 설정은 저장소에서 제외했습니다.

| 원본 | SHA-256 |
|---|---|
| 카드 JS | `ec7b912646f59b67822f9f23f5102c143a3580cb433609ee1a93960a2b2dae89` |
| 구성 YAML | `c99c835bdc8cd16eaec3665d47a8e9868d4f511055332daadb2293c9c3033acf` |
| 운영 대시보드 JSON | `5efac973f116fa3d80801a31754d2f2cfb2f3bfc386b916d503c8d18eb68ada3` |
