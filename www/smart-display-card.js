
/* Smart Display Card v5 — Home Assistant custom dashboard card.
 * Uses only standard browser APIs and Home Assistant's documented card interface.
 */
class SmartDisplayHomeV5 extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._forecast = [];
    this._forecastError = '';
    this._unsubscribe = null;
    this._subscribing = false;
    this._connection = null;
    this._weatherId = null;
    this._config = null;
    this._hass = null;
    this._timer = null;
    this._resize = null;
    this._width = 1648;
    this._height = 927;
    this._viewportResize = () => this._setSize();
  }

  setConfig(config) {
    if (!config || !config.weather) throw new Error('smart-display-card: weather is required');
    const prior = this._weatherId;
    this._config = {
      location: '고양시 덕양구',
      outdoor_temp: 'sensor.siloe_siloe_temperature',
      outdoor_humidity: 'sensor.siloe_siloe_humidity',
      indoor_temp: 'sensor.maihom_eeomoniteo_temperature',
      indoor_humidity: 'sensor.maihom_eeomoniteo_humidity',
      ...config
    };
    this._weatherId = this._config.weather;
    if (prior !== this._weatherId) {
      this._stopForecast();
      this._forecast = [];
      this._connection = null;
    }
    this._render();
    this._subscribeForecast();
  }

  set hass(hass) {
    const changedConnection = this._connection && this._connection !== hass.connection;
    this._hass = hass;
    if (changedConnection) {
      this._stopForecast();
      this._connection = null;
      this._forecast = [];
    }
    this._subscribeForecast();
    this._render();
  }

  connectedCallback() {
    if (!this._timer) this._timer = setInterval(() => this._render(), 30000);
    if (!this._resize && typeof ResizeObserver !== 'undefined') {
      this._resize = new ResizeObserver(entries => {
        const width = entries[0]?.contentRect?.width;
        if (width && Math.abs(width - this._width) > 0.5) {
          this._width = width;
          this._setSize();
        }
      });
      this._resize.observe(this);
    }
    window.addEventListener('resize', this._viewportResize);
    window.visualViewport?.addEventListener('resize', this._viewportResize);
    this._subscribeForecast();
    this._render();
  }

  disconnectedCallback() {
    clearInterval(this._timer); this._timer = null;
    this._resize?.disconnect(); this._resize = null;
    window.removeEventListener('resize', this._viewportResize);
    window.visualViewport?.removeEventListener('resize', this._viewportResize);
    this._stopForecast();
  }

  _stopForecast() {
    const unsubscribe = this._unsubscribe;
    this._unsubscribe = null;
    this._subscribing = false;
    if (typeof unsubscribe === 'function') {
      try { unsubscribe(); } catch (err) { console.warn('Smart Display forecast unsubscribe:', err); }
    }
  }

  async _subscribeForecast() {
    if (!this.isConnected || !this._hass?.connection || !this._config?.weather || this._subscribing || this._unsubscribe) return;
    this._subscribing = true;
    const connection = this._hass.connection;
    const weatherId = this._config.weather;
    this._connection = connection;
    try {
      const unsubscribe = await connection.subscribeMessage(event => {
        if (this._weatherId !== weatherId || this._connection !== connection) return;
        this._forecast = Array.isArray(event?.forecast) ? event.forecast : [];
        this._forecastError = '';
        this._render();
      }, { type: 'weather/subscribe_forecast', entity_id: weatherId, forecast_type: 'daily' });
      if (!this.isConnected || this._weatherId !== weatherId || this._connection !== connection) {
        unsubscribe();
      } else {
        this._unsubscribe = unsubscribe;
      }
    } catch (error) {
      if (this._weatherId === weatherId) {
        this._forecastError = '일별 예보를 가져올 수 없습니다';
        console.warn('Smart Display daily forecast:', error);
        this._render();
      }
    } finally { this._subscribing = false; }
  }

  _setSize() {
    // Fit the actual viewport rather than forcing a 16:9 card taller than a phone.
    const rect = this.getBoundingClientRect();
    const width = rect.width || this._width;
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const height = Math.max(200, viewportHeight - Math.max(0, rect.top) - 2);
    this._width = width;
    this._height = height;
    this.style.setProperty('--sd-height', `${height}px`);
    // Scale text by the limiting dimension to prevent cropping on 19.5:9.
    this.style.setProperty('--sd-unit', `${Math.min(width / 1648, height / 927)}px`);
  }

  _escape(input) {
    return String(input ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[ch]));
  }
  _state(id) { return this._hass?.states?.[id]; }
  _value(id, digits = 1) {
    const state = this._state(id)?.state;
    const number = Number(state);
    if (!state || state === 'unknown' || state === 'unavailable' || !Number.isFinite(number)) return '—';
    return number.toFixed(digits);
  }
  _number(value, digits = 0) {
    if (value === null || value === undefined || value === '') return '—';
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(digits) : '—';
  }
  _condition(code) {
    return ({'clear-night':'맑은 밤', cloudy:'흐림', exceptional:'특이 기상', fog:'안개', hail:'우박', lightning:'뇌우', 'lightning-rainy':'비와 뇌우', partlycloudy:'구름 조금', pouring:'폭우', rainy:'비', snowy:'눈', 'snowy-rainy':'진눈깨비', sunny:'맑음', windy:'바람', 'windy-variant':'바람과 구름'})[code] || (code ? String(code) : '정보 없음');
  }
  _icon(code) {
    return ({'clear-night':'🌙', cloudy:'☁️', exceptional:'⚠️', fog:'🌫️', hail:'🌨️', lightning:'⛈️', 'lightning-rainy':'⛈️', partlycloudy:'🌤️', pouring:'🌧️', rainy:'🌧️', snowy:'❄️', 'snowy-rainy':'🌨️', sunny:'☀️', windy:'🌬️', 'windy-variant':'🌥️'})[code] || '🌡️';
  }
  _status(value) {
    const raw = String(value ?? '').trim();
    if (!raw || ['unknown','unavailable'].includes(raw)) return '—';
    const key = raw.toLowerCase().replace(/[ _-]/g, '');
    const text = ({good:'좋음',verygood:'매우좋음',excellent:'매우좋음',moderate:'보통',fair:'보통',normal:'보통',poor:'나쁨',bad:'나쁨',unhealthy:'나쁨',verypoor:'매우나쁨',verybad:'매우나쁨',veryunhealthy:'매우나쁨',hazardous:'매우나쁨'})[key] || raw;
    return text.replace(/\s+/g,'');
  }
  _statusColor(text) {
    if (text.includes('나쁨')) return text.startsWith('매우') ? '#ff707e' : '#ffa56b';
    if (text.includes('보통')) return '#ffd47d';
    if (text.includes('좋음')) return '#8ae5b2';
    return '#bdd1e1';
  }
  _co2Status(id) {
    const n = Number(this._state(id)?.state);
    if (!Number.isFinite(n) || this._state(id)?.state === 'unavailable') return '—';
    return n <= 700 ? '좋음' : n <= 1000 ? '보통' : n <= 1500 ? '나쁨' : '매우나쁨';
  }
  _odorStatus(id) {
    const n = Number(this._state(id)?.state);
    return ({1:'좋음',2:'보통',3:'나쁨',4:'매우나쁨'})[n] || '—';
  }
  _caqiStatus(id) {
    const n = Number(this._state(id)?.state);
    if (!Number.isFinite(n) || n < 0 || this._state(id)?.state === 'unavailable') return '—';
    return n <= 25 ? '매우좋음' : n <= 50 ? '좋음' : n <= 75 ? '보통' : n <= 100 ? '나쁨' : '매우나쁨';
  }
  _airTile(name, id, unit, status) {
    const value = this._value(id,0);
    const text = this._status(status);
    return `<div class="air-tile"><div class="air-label">${this._escape(name)}</div><div class="air-line"><div class="air-value">${this._escape(value)}<small>${this._escape(unit)}</small></div><span class="air-status" style="color:${this._statusColor(text)}">${this._escape(text)}</span></div></div>`;
  }
  _render() {
    if (!this._config) return;
    const c = this._config;
    const now = new Date();
    const locale = 'ko-KR';
    const fmt = options => new Intl.DateTimeFormat(locale, {timeZone:'Asia/Seoul', ...options}).format(now);
    const clock = fmt({hour:'numeric', minute:'2-digit', hour12:true});
    const dateText = fmt({year:'numeric', month:'long', day:'numeric', weekday:'short'});
    const w = this._state(c.weather);
    const wa = w?.attributes || {};
    const hasWeather = w && !['unavailable', 'unknown'].includes(w.state);
    const condition = hasWeather ? w.state : null;
    const current = this._number(wa.temperature, 1);
    const today = this._forecast[0] || {};
    const max = this._number(today.temperature);
    const min = this._number(today.templow);
    const rain = this._number(today.precipitation_probability);
    const highLow = (hi,lo) => `<span class="high">${hi}°</span><span class="slash"> / </span><span class="low">${lo}°</span>`;
    const slots = Array.from({length:7}, (_, i) => {
      const day = this._forecast[i];
      if (!day) return `<div class="day"><div class="day-label">—</div><div class="day-icon">·</div><div class="day-temps">—</div></div>`;
      const dt = new Date(day.datetime);
      const label = Number.isFinite(dt.getTime()) ? new Intl.DateTimeFormat('ko-KR', {timeZone:'Asia/Seoul', weekday:'short'}).format(dt) : '—';
      return `<div class="day"><div class="day-label">${i===0 ? '오늘 ('+this._escape(label)+')' : this._escape(label)}</div><div class="day-icon" role="img">${this._icon(day.condition)}</div><div class="day-temps">${highLow(this._number(day.temperature), this._number(day.templow))}</div></div>`;
    }).join('');
    const forecastHint = !this._forecast.length ? (this._forecastError || '일별 예보 불러오는 중') : (this._forecast.length < 7 ? `예보 ${this._forecast.length}일 제공` : '');
    const air = c.air || {};
    const airQuality = this._value(air.caqi,0);
    const airMarkup = [
      this._airTile('CO₂',air.co2,'ppm',this._co2Status(air.co2)),
      this._airTile('PM10',air.pm10,'µg/m³',this._state(air.pm10_status)?.state),
      this._airTile('PM2.5',air.pm25,'µg/m³',this._state(air.pm25_status)?.state),
      this._airTile('PM1',air.pm1,'µg/m³',this._state(air.pm1_status)?.state),
      this._airTile('냄새',air.odor,'',this._odorStatus(air.odor)),
      this._airTile('공기질 지수',air.caqi,'CAQI',this._caqiStatus(air.caqi))
    ].join('');
    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; width:100%; min-width:0; --sd-unit:1px; }
        * { box-sizing:border-box; }
        ha-card { position:relative; display:block; width:100%; height:var(--sd-height, 56.25vw); border:0; overflow:hidden;
          border-radius:0; box-shadow:none; color:#f3f7ff; background: radial-gradient(ellipse at 50% 35%, #0e2842 0%, #071827 62%, #06111e 100%);
          font-family:Roboto,'Noto Sans KR',system-ui,sans-serif; }
        .header { position:absolute; top:0; left:0; right:0; height:12%; display:flex; align-items:center; padding:0 2.7%; gap:2.7%; }
        .branding { display:flex; align-items:center; gap:calc(16 * var(--sd-unit)); width:23%; }
        .ha-icon { color:#1fc1ff; font-size:calc(54 * var(--sd-unit)); line-height:1; }
        .brand-title { font-weight:750; font-size:calc(27 * var(--sd-unit)); line-height:1.2; white-space:nowrap; }
        .brand-sub { color:#a7c6de; font-size:calc(20 * var(--sd-unit)); }
        .nav { display:flex; width:51%; height:64%; border-radius:calc(21 * var(--sd-unit)); overflow:hidden; background:#142a40; border:1px solid #294158; }
        .nav-item { flex:1; display:flex; align-items:center; justify-content:center; gap:calc(8 * var(--sd-unit)); font-size:calc(25 * var(--sd-unit)); font-weight:650; white-space:nowrap; color:#e7f2ff; }
        .nav-item.active { background:linear-gradient(140deg,#086392,#0b355a); border:calc(2 * var(--sd-unit)) solid #18c0ff; border-radius:calc(20 * var(--sd-unit)); }
        .nav-item:not(.active) { opacity:.68; }
        .nav-item.link { text-decoration:none; cursor:pointer; } .nav-item.link:hover { opacity:1; background:#204563; }
        .corner-time { flex:1; text-align:right; display:flex; flex-direction:column; justify-content:center; gap:calc(1 * var(--sd-unit)); white-space:nowrap; }
        .corner-time .time {font-size:calc(34 * var(--sd-unit)); font-weight:780;}
        .corner-time .date {font-size:calc(18 * var(--sd-unit)); color:#b5d0e6;}
        .top { position:absolute; top:13.6%; left:1.2%; right:1.2%; height:42%; display:grid; grid-template-columns:30% 45% 1fr; gap:1.3%; }
        .card { background:linear-gradient(140deg,#182d43,#0e2033); border:calc(3 * var(--sd-unit)) solid #2a4560; border-radius:calc(26 * var(--sd-unit)); overflow:hidden; }
        .air { display:flex; flex-direction:column; padding:4% 4% 3%; gap:3%; min-width:0; }
        .air-head {display:flex; align-items:center; justify-content:space-between; font-size:calc(25 * var(--sd-unit)); font-weight:760; white-space:nowrap; }
        .air-head .caqi-head {color:#91e6ba; font-size:calc(22 * var(--sd-unit));}
        .air-grid {display:grid; flex:1; min-height:0; grid-template-columns:repeat(2,minmax(0,1fr)); grid-template-rows:repeat(3,minmax(0,1fr)); gap:calc(9 * var(--sd-unit));}
        .air-tile {background:#203a52; border-radius:calc(13 * var(--sd-unit)); min-width:0; min-height:0; padding:calc(10 * var(--sd-unit)) calc(11 * var(--sd-unit)); display:flex; flex-direction:column; justify-content:space-between;}
        .air-label {font-size:calc(19 * var(--sd-unit)); font-weight:650; color:#bbd3e7; white-space:nowrap;}
        .air-line {display:flex; justify-content:space-between; align-items:baseline; min-width:0; gap:calc(5 * var(--sd-unit));}
        .air-value {font-size:calc(36 * var(--sd-unit)); font-weight:780; white-space:nowrap; letter-spacing:calc(-1.5 * var(--sd-unit));}
        .air-value small {font-size:calc(12 * var(--sd-unit)); color:#abc8db; font-weight:500; letter-spacing:0; margin-left:calc(3 * var(--sd-unit));}
        .air-status {text-align:right; flex-shrink:0; font-size:calc(19 * var(--sd-unit)); font-weight:750; white-space:nowrap; letter-spacing:calc(-.5 * var(--sd-unit));}
        .weather { background:linear-gradient(165deg,#07447c,#062e5c 56%,#123b5d); padding:5% 5% 3%; display:flex; flex-direction:column; }
        .weather-place { font-size:calc(29 * var(--sd-unit)); font-weight:700; }
        .weather-center { display:flex; align-items:center; justify-content:space-between; flex:1; gap:2%; }
        .weather-icon { font-size:calc(103 * var(--sd-unit)); line-height:1; width:28%; text-align:center; }
        .weather-primary { flex:1; }
        .weather-temp { font-size:calc(86 * var(--sd-unit)); letter-spacing:calc(-4 * var(--sd-unit)); font-weight:760; white-space:nowrap; }
        .weather-cond { font-size:calc(29 * var(--sd-unit)); color:#d8ecfa; }
        .weather-extra { display:flex; flex-direction:column; gap:calc(18 * var(--sd-unit)); padding-left:3%; border-left:calc(2 * var(--sd-unit)) solid #5b7f9d; font-size:calc(25 * var(--sd-unit)); white-space:nowrap; }
        .weather-extra .low { color:#7ed1ff; } .weather-extra .high { color:#ffb0a4; }
        .sensors { display:grid; grid-template-rows:1fr 1fr; gap:5%; min-width:0; }
        .sensor { padding:6% 7%; display:flex; flex-direction:column; justify-content:center; }
        .sensor-title { font-size:calc(25 * var(--sd-unit)); font-weight:700; margin-bottom:calc(24 * var(--sd-unit)); }
        .sensor-data { display:flex; justify-content:space-between; align-items:center; gap:1%; font-size:calc(33 * var(--sd-unit)); font-weight:750; white-space:nowrap; }
        .sensor-data .temperature { color:#ff9e96; } .sensor-data .humidity { color:#70c9ff; }
        .forecast { position:absolute; top:58.7%; left:1.2%; right:1.2%; height:29.1%; display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); padding:1.6% 1%; }
        .day { display:flex; flex-direction:column; justify-content:space-between; align-items:center; text-align:center; min-width:0; border-right:calc(2 * var(--sd-unit)) solid #344f68; padding:0 2%; }
        .day:last-child { border:0; } .day-label { font-size:calc(26 * var(--sd-unit)); font-weight:650; color:#c9dff1; }
        .day-icon { font-size:calc(55 * var(--sd-unit)); line-height:1.1; }
        .day-temps { font-size:calc(34 * var(--sd-unit)); font-weight:740; white-space:nowrap; }
        .high { color:#f4f7fb; } .low { color:#87cafa; } .slash { color:#839eaf; }
        .forecast-note { position:absolute; bottom:3.2%; right:2%; font-size:calc(17 * var(--sd-unit)); color:#86a4bb; }
      </style>
      <ha-card>
        <div class="header">
          <div class="branding"><div class="ha-icon">⌂</div><div><div class="brand-title">Home Assistant</div><div class="brand-sub">Smart Display</div></div></div>
          <div class="nav"><div class="nav-item active">⌂ 홈</div><a class="nav-item link" href="/smart-display/smarthome">☼ 스마트홈</a><div class="nav-item" title="추후 구성 예정">▣ CCTV</div><div class="nav-item" title="추후 구성 예정">▤ NAS</div></div>
          <div class="corner-time"><span class="time">${this._escape(clock)}</span><span class="date">${this._escape(dateText)}</span></div>
        </div>
        <div class="top">
          <div class="air card"><div class="air-head"><span>실내 공기질</span><span class="caqi-head">CAQI ${this._escape(airQuality)}</span></div><div class="air-grid">${airMarkup}</div></div>
          <div class="weather card"><div class="weather-place">◉ ${this._escape(c.location)}</div><div class="weather-center">
            <div class="weather-icon" role="img">${this._icon(condition)}</div>
            <div class="weather-primary"><div class="weather-temp">${current}°</div><div class="weather-cond">${this._escape(this._condition(condition))}</div></div>
            <div class="weather-extra"><div><span class="high">♨</span> 최고 <b>${max}°</b></div><div><span class="low">♧</span> 최저 <b>${min}°</b></div><div>♢ 강수확률 <b>${rain === '—' ? '—' : rain+'%'}</b></div></div>
          </div></div>
          <div class="sensors">
            <div class="card sensor"><div class="sensor-title">🌳 실외</div><div class="sensor-data"><span class="temperature">🌡 ${this._value(c.outdoor_temp)}°C</span><span class="humidity">💧 ${this._value(c.outdoor_humidity,0)}%</span></div></div>
            <div class="card sensor"><div class="sensor-title">⌂ 실내</div><div class="sensor-data"><span class="temperature">🌡 ${this._value(c.indoor_temp)}°C</span><span class="humidity">💧 ${this._value(c.indoor_humidity,0)}%</span></div></div>
          </div>
        </div>
        <div class="forecast card">${slots}</div>
        <div class="forecast-note">${this._escape(forecastHint)}</div>
      </ha-card>`;
    this._setSize();
  }
  getCardSize() { return 8; }
  getGridOptions() { return {columns:12, rows:8, min_columns:12, min_rows:8}; }
  static getStubConfig() { return {weather:'weather.forecast_jib'}; }
}
if (!customElements.get('smart-display-card')) customElements.define('smart-display-card', SmartDisplayHomeV5);
window.customCards = window.customCards || [];
window.customCards.push({type:'smart-display-card',name:'Smart Display (16:9)',description:'노트3용 가로형 정보 대시보드'});


class SmartDisplayControlsV5 extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode:'open'});
    this._config = {};
    this._hass = null;
    this._busy = false;
    this._notice = '';
    this._width = 1648;
    this._height = 927;
    this._viewportResize = () => this._setSize();
    this._observer = null;
  }
  setConfig(config) {
    this._config = {...config};
    this._render();
  }
  set hass(hass) {
    this._hass = hass;
    this._render();
  }
  connectedCallback() {
    if (!this._observer && typeof ResizeObserver !== 'undefined') {
      this._observer = new ResizeObserver(entries => {
        const w = entries[0]?.contentRect?.width;
        if (w && Math.abs(w - this._width) > 0.5) { this._width = w; this._setSize(); }
      });
      this._observer.observe(this);
    }
    window.addEventListener('resize', this._viewportResize);
    window.visualViewport?.addEventListener('resize', this._viewportResize);
    this._render();
  }
  disconnectedCallback() {
    this._observer?.disconnect(); this._observer = null;
    window.removeEventListener('resize', this._viewportResize);
    window.visualViewport?.removeEventListener('resize', this._viewportResize);
  }
  _setSize() {
    const rect = this.getBoundingClientRect();
    const width = rect.width || this._width;
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const height = Math.max(200, viewportHeight - Math.max(0, rect.top) - 2);
    this._width = width;
    this._height = height;
    this.style.setProperty('--sd-height', `${height}px`);
    this.style.setProperty('--sd-unit', `${Math.min(width / 1648, height / 927)}px`);
  }
  _escape(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  _allowed(id) { return typeof id === 'string' && /^(light|switch|fan|input_boolean)\.[a-z0-9_]+$/.test(id); }
  _items() {
    return [
      ['living1','거실등 1','mdi:ceiling-light','light'],
      ['kitchen','주방등','mdi:lightbulb','light'],
      ['bathroom','화장실등','mdi:lightbulb','light'],
      ['living2','거실등 2','mdi:ceiling-light','light'],
      ['kitchen_fan','주방 환풍기','mdi:fan','fan'],
      ['bath_fan','화장실 환풍기','mdi:fan','fan']
    ];
  }
  async _toggle(key) {
    if (this._busy || !this._hass) return;
    const id = this._config[key];
    if (!this._allowed(id) || !this._hass.states[id]) return;
    this._busy = true;
    try {
      const [domain] = id.split('.');
      await this._hass.callService(domain, 'toggle', {entity_id:id});
      this._notice = '';
    } catch (err) {
      this._notice = `제어 실패: ${err?.message || 'HA에서 확인 필요'}`;
    } finally { this._busy = false; this._render(); }
  }
  async _allOff() {
    if (this._busy || !this._hass) return;
    const ids = this._items().filter(([, , ,kind]) => kind === 'light')
      .map(([key]) => this._config[key]);
    if (ids.length !== 4 || new Set(ids).size !== 4 || !ids.every(id => this._allowed(id) && this._hass.states[id] && ['on','off'].includes(this._hass.states[id].state))) return;
    if (!window.confirm('조명 4개를 모두 끄시겠습니까? 환풍기는 제외됩니다.')) return;
    this._busy = true;
    try {
      for (const id of ids) {
        const [domain] = id.split('.');
        await this._hass.callService(domain, 'turn_off', {entity_id:id});
      }
      this._notice = '';
    } catch (err) {
      this._notice = `전체등 소등 실패: ${err?.message || 'HA에서 확인 필요'}`;
    } finally { this._busy = false; this._render(); }
  }
  _render() {
    const items = this._items();
    const markup = items.map(([key,label,icon]) => {
      const id = this._config[key];
      const exists = this._allowed(id) && !!this._hass?.states[id];
      const st = exists ? this._hass.states[id].state : null;
      const on = st === 'on';
      const available = exists && !['unavailable','unknown'].includes(st);
      const state = !exists ? '미연결' : !available ? '사용 불가' : on ? '켜짐' : '꺼짐';
      return `<button class="device ${on?'on':''}" data-key="${key}" ${!available || this._busy?'disabled':''}>
        <span class="symbol"><ha-icon icon="${icon}"></ha-icon></span>
        <span class="name">${this._escape(label)}</span>
        <span class="state"><span class="dot"></span>${state}</span>
      </button>`;
    }).join('');
    const mappedLights = items.filter(([, , ,kind]) => kind==='light')
      .map(([key]) => this._config[key]);
    const allLightsReady = mappedLights.length === 4 && new Set(mappedLights).size === 4 && mappedLights.every(id => this._allowed(id) && ['on','off'].includes(this._hass?.states[id]?.state));
    this.shadowRoot.innerHTML = `<style>
      :host{display:block;width:100%;--sd-unit:1px;font-family:Roboto,'Noto Sans KR',system-ui,sans-serif}
      *{box-sizing:border-box} ha-card{display:block;position:relative;height:var(--sd-height,56.25vw);overflow:hidden;border:0;border-radius:0;color:#f3f7ff;background:radial-gradient(ellipse at 50% 35%,#0e2842 0%,#071827 62%,#06111e 100%);box-shadow:none}
      .header{position:absolute;top:0;left:0;right:0;height:12%;display:flex;align-items:center;padding:0 2.7%;gap:2.7%}
      .branding{width:23%;display:flex;align-items:center;gap:calc(16 * var(--sd-unit))}
      .logo{font-size:calc(54 * var(--sd-unit));color:#1fc1ff}
      .title{font-weight:750;font-size:calc(27 * var(--sd-unit))}.sub{font-size:calc(20 * var(--sd-unit));color:#a7c6de}
      .nav{display:flex;width:51%;height:64%;border-radius:calc(21 * var(--sd-unit));overflow:hidden;background:#142a40;border:1px solid #294158}
      .nav-item{flex:1;display:flex;justify-content:center;align-items:center;font-size:calc(25 * var(--sd-unit));font-weight:650;color:#e7f2ff;white-space:nowrap;text-decoration:none}
      .nav-item.active{background:linear-gradient(140deg,#086392,#0b355a);border:calc(2 * var(--sd-unit)) solid #18c0ff;border-radius:calc(20 * var(--sd-unit))}.nav-item:not(.active){opacity:.68}.nav-item.link{cursor:pointer}
      .head-right{flex:1;text-align:right;font-size:calc(29 * var(--sd-unit));font-weight:700}
      .grid{position:absolute;top:16%;left:2%;right:2%;height:55%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:repeat(2,1fr);gap:3% 1.5%}
      .device{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:calc(10 * var(--sd-unit));border:calc(3 * var(--sd-unit)) solid #33536d;border-radius:calc(25 * var(--sd-unit));background:linear-gradient(145deg,#182d43,#0e2033);color:#ecf4fd;font:inherit;cursor:pointer;min-width:0}
      .device.on{background:linear-gradient(145deg,#26516a,#134266);border-color:#21bded}
      .device:disabled{cursor:default;opacity:.65}.symbol{display:flex;color:#77c6f4}.on .symbol{color:#ffe390}
      ha-icon{--mdc-icon-size:calc(53 * var(--sd-unit))}.name{font-size:calc(33 * var(--sd-unit));font-weight:740}.state{font-size:calc(24 * var(--sd-unit));color:#bed1e0;display:flex;align-items:center;gap:calc(9 * var(--sd-unit))}
      .dot{display:inline-block;width:calc(13 * var(--sd-unit));height:calc(13 * var(--sd-unit));border-radius:50%;background:#6b8191}.on .dot{background:#4fe0a9}
      .footer{position:absolute;top:75%;left:2%;right:2%;height:17%;display:flex;gap:2%}
      .off{width:100%;border:calc(3 * var(--sd-unit)) solid #a35d67;border-radius:calc(25 * var(--sd-unit));background:linear-gradient(130deg,#602936,#431b2a);color:white;font-size:calc(35 * var(--sd-unit));font-weight:740;cursor:pointer}
      .off:disabled{opacity:.5;cursor:default}.notice{position:absolute;bottom:2%;left:2%;right:2%;text-align:center;color:#b8d0e2;font-size:calc(19 * var(--sd-unit))}
    </style><ha-card><div class="header"><div class="branding"><div class="logo">⌂</div><div><div class="title">Home Assistant</div><div class="sub">Smart Display</div></div></div>
      <div class="nav"><a class="nav-item link" href="/smart-display/home">⌂ 홈</a><div class="nav-item active">☼ 스마트홈</div><div class="nav-item">▣ CCTV</div><div class="nav-item">▤ NAS</div></div>
      <div class="head-right">스마트홈 제어</div></div>
      <div class="grid">${markup}</div>
      <div class="footer"><button class="off" data-alloff ${!allLightsReady || this._busy ? 'disabled':''}>⏻ 전체등 소등　·　환풍기 제외</button></div>
      <div class="notice">${this._escape(this._notice || '전체등 소등은 조명 4개만 제어하며 환풍기는 제외됩니다.')}</div>
      </ha-card>`;
    this._setSize();
    this.shadowRoot.querySelectorAll('button[data-key]').forEach(b => b.addEventListener('click',()=>this._toggle(b.dataset.key)));
    this.shadowRoot.querySelector('button[data-alloff]')?.addEventListener('click',()=>this._allOff());
  }
  getCardSize(){return 8;}
}
if (!customElements.get('smart-display-controls')) customElements.define('smart-display-controls',SmartDisplayControlsV5);
window.customCards=window.customCards||[];
window.customCards.push({type:'smart-display-controls',name:'Smart Display IoT Controls',description:'16:9 스마트홈 제어 패널'});
