# 배포 메모 — 실외 대기질 + 중앙 구분선

대상: Home Assistant Smart Display (Storage 모드), GitHub main 최신 HEAD.
실제 NAS에는 아직 적용 전이며, 기존 UI 및 연동 설정 백업 후 작업할 것.

1. SSH는 Codex 전역 AGENTS.md의 기존 HomeDisk 접속을 재사용한다.
2. /config/www/smart-display-card.js 백업 후 GitHub 최신 파일과 바이트 단위로 맞춘다.
3. /config/configuration.yaml의 기존 rest 설정 구조와 zone.home 좌표를 확인한다.
   - zone.home 좌표가 덕양구의 원하는 위치인지 확인한다.
   - 기존 rest: 항목이 있다면 이를 덮어쓰지 않고 새 항목을 병합한다.
   - integration/open-meteo-air-quality.yaml은 예시 소스이므로 통째로 무조건 덮어쓰지 않는다.
   - 외부 API 접속과 current.pm10/current.pm2_5 값을 실제로 시험한다.
4. Home Assistant 설정 유효성을 검사한 뒤 REST 센서를 안전하게 로드한다. 필요한 경우에만 기존 서비스 운영 영향과 승인 범위를 확인해 재시작한다.
5. 생성된 엔티티가 정확히 sensor.smart_display_outdoor_pm10 / sensor.smart_display_outdoor_pm2_5인지 확인한다. 실제 ID가 다르면 운영 대시보드 매핑을 맞춘다.
6. Storage 모드의 Smart Display 홈 카드에서 outdoor_pm10/outdoor_pm25 필드를 설정한다.
   - GitHub dashboard/lovelace.smart_display.json은 참고용 안전 사본. 실행 중인 .storage 파일을 직접 덮어쓰지 않는다.
7. Lovelace 리소스의 캐시 버전을 현재 v9에서 v10으로 변경해 새 JS 로드 여부를 확인한다.
8. UI에서 세로 구분선이 카드 중앙인지, 미세먼지 데이터가 실외 소스인지 검증한다.
9. 변경한 파일/설정과 SHA 및 되돌리기 방법을 보고한다.

주의: Open-Meteo Air Quality 값은 모델 기반 대기질 데이터로 공공 측정소 실측값과 다를 수 있다.
기존 Met.no 날씨 및 SmartThings 실내 센서는 유지한다.

## 체감온도 추가 배포

- `integration/open-meteo-apparent-temperature.yaml`에 정의된 별도의 `rest:` 항목을 운영 Home Assistant의 기존 `rest:` 목록에 병합한다. 기존 Open-Meteo PM 센서나 기타 REST 센서를 덮어쓰지 않는다.
- `zone.home` 좌표 확인 후 설정 유효성 검사, 센서 실데이터 수신 확인(`sensor.smart_display_apparent_temperature`, 단위 °C).
- Storage 모드 홈 카드에 `apparent_temperature: sensor.smart_display_apparent_temperature` 매핑을 추가한다. `.storage` 파일 직접 덮어쓰기 금지.
- JS 최신 main 배포 후 Lovelace 리소스 캐시 버전을 현재 운영 버전보다 증가시켜 갱신한다. 2026-11-18 체감온도 표시 문제는 `v=10`에서 `v=11`로 갱신한 뒤 정상 표시됨.
- Open-Meteo 센서가 유효할 때 이를 우선 사용하고, 값이 없을 때는 기존 Met.no `apparent_temperature`를 사용한다.
- 미세먼지 연결도 아직 미적용이라면 위 단계와 병합하여 실제 PM10/PM2.5 수치까지 검증한다.
- 기상 서비스 두 곳 모두 값이 없거나 네트워크 장애면 체감온도 `—`가 남을 수 있다. 이 경우 서버 센서 상태/로그를 확인한다.
