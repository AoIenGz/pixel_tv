/* ============================
   扬声器格栅点
   ============================ */
document.getElementById('tvGrille').innerHTML =
    Array.from({length: 40}, () => '<div class="tv-speaker-dot"></div>').join('');

/* ============================
   天气常量与映射
   ============================ */
const WEATHER = { SUNNY:'sunny', RAINY:'rainy', CLOUDY:'cloudy', SNOWY:'snowy' };
const WEATHER_NAMES = { sunny:'晴天', rainy:'雨天', cloudy:'阴天', snowy:'雪天' };

function codeToState(c) {
    if (c <= 1) return WEATHER.SUNNY;
    if (c === 2 || c === 3) return WEATHER.CLOUDY;
    if (c >= 45 && c <= 48) return WEATHER.CLOUDY;
    if (c >= 51 && c <= 57) return WEATHER.RAINY;
    if (c >= 61 && c <= 67) return WEATHER.RAINY;
    if (c >= 71 && c <= 77) return WEATHER.SNOWY;
    if (c >= 80 && c <= 82) return WEATHER.RAINY;
    if (c >= 85 && c <= 86) return WEATHER.SNOWY;
    if (c >= 95) return WEATHER.RAINY;
    return WEATHER.CLOUDY;
}

/* ============================
   天气 API
   ============================ */
function getLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) { reject(new Error('浏览器不支持定位')); return; }
        navigator.geolocation.getCurrentPosition(
            pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
            err => reject(new Error('定位失败: ' + err.message)),
            { timeout: 10000, enableHighAccuracy: false }
        );
    });
}
async function fetchWeather(lat, lon) {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
    if (!res.ok) throw new Error('天气API请求失败');
    return (await res.json()).current_weather;
}
async function getCityName(lat, lon) {
    try {
        const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=zh`);
        if (res.ok) { const d = await res.json(); const n = d.city||d.locality||d.principalSubdivision; if(n) return n; }
    } catch(e) {}
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=zh&zoom=10`,{headers:{'User-Agent':'PixelWeather/1.0'}});
        if (res.ok) { const d = await res.json(); const a = d.address||{}; return a.city||a.town||a.county||a.state||'未知位置'; }
    } catch(e) {}
    return '未知位置';
}

/* ============================
   DOM
   ============================ */
const $scene = document.getElementById('sceneContainer');
const $info  = document.getElementById('infoPanel');
const $btn   = document.getElementById('refreshBtn');
const $switch= document.getElementById('switchBtn');
const $tvSet = document.getElementById('tvSet');

/* ============================
   昼夜判断
   ============================ */
function isDaytime(hour) { return hour >= 6 && hour < 18; }

/* ============================
   咖啡馆场景（4天气 × 2时段）
   ============================ */
function cafeScene(weather, daytime) {
    const key = weather + (daytime ? '_day' : '_night');
    const bg = `images/${key}.webp`;
    return `<img class="scene-bg" src="${bg}">`;
}

function switchScene(state, daytime) {
    $scene.innerHTML = cafeScene(state, daytime);
    $tvSet.classList.remove('tv-power-on');
    void $tvSet.offsetWidth;
    $tvSet.classList.add('tv-power-on');
}

/* ============================
   天气 UI
   ============================ */
function showLoading() {
    $info.innerHTML = `<div class="loading-box"><div class="loading-dots"><span></span><span></span><span></span></div><p class="loading-text">正在获取天气数据...</p></div>`;
    $btn.classList.add('hidden');
    $switch.classList.add('hidden');
}
function showError(msg) {
    $info.innerHTML = `<p class="error-msg">${msg}</p>`;
    $btn.classList.remove('hidden');
}
function showWeather(weather, city) {
    const state = codeToState(weather.weathercode);
    const name  = WEATHER_NAMES[state];
    const temp  = Math.round(weather.temperature);
    const now = new Date();
    const daytime = isDaytime(now.getHours());
    const ts = String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
    $info.innerHTML = `
        <div class="weather-row">
            <span class="weather-status">${name}</span>
            <span class="weather-temp">${temp}°C</span>
        </div>
        <div class="weather-detail">${city} | 风速 ${weather.windspeed} km/h</div>
        <p class="update-time">上次更新: ${ts}</p>`;
    switchScene(state, daytime);
    $btn.classList.remove('hidden');
    $switch.classList.remove('hidden');
}

/* ============================
   天气主流程
   ============================ */
let cachedLoc = null, cachedCity = null;

async function refreshWeather() {
    showLoading();
    try {
        if (!cachedLoc) cachedLoc = await getLocation();
        if (!cachedCity) cachedCity = await getCityName(cachedLoc.lat, cachedLoc.lon);
        const w = await fetchWeather(cachedLoc.lat, cachedLoc.lon);
        showWeather(w, cachedCity);
    } catch(e) { console.error(e); showError('出错了: '+e.message); }
}

$btn.addEventListener('click', refreshWeather);

const STATES = ['sunny','rainy','cloudy','snowy'];
let switchIdx = 0;
$switch.addEventListener('click', () => {
    switchIdx = (switchIdx + 1) % STATES.length;
    const s = STATES[switchIdx];
    const daytime = isDaytime(new Date().getHours());
    switchScene(s, daytime);
    const row = $info.querySelector('.weather-row');
    if (row) row.querySelector('.weather-status').textContent = WEATHER_NAMES[s] + ' (预览)';
});

refreshWeather();

/* 30分钟自动刷新 */
const REFRESH_MS = 30 * 60 * 1000;
let lastRefresh = Date.now(), timer = null;
function startTimer() {
    if (timer) clearInterval(timer);
    lastRefresh = Date.now();
    timer = setInterval(() => { console.log('[自动刷新]'); refreshWeather(); }, REFRESH_MS);
}
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastRefresh >= REFRESH_MS) refreshWeather();
});
const _origRefresh = refreshWeather;
refreshWeather = async function() { await _origRefresh(); startTimer(); };
startTimer();

/* ============================
   音乐播放器
   ============================ */
const audio = new Audio();
audio.volume = 0.6;
let playlist = [];
let currentIdx = -1;
let isPlaying = false;

/* DOM */
const $searchInput = document.getElementById('searchInput');
const $searchBtn   = document.getElementById('searchBtn');
const $playBtn     = document.getElementById('playBtn');
const $prevBtn     = document.getElementById('prevBtn');
const $nextBtn     = document.getElementById('nextBtn');
const $volumeSlider= document.getElementById('volumeSlider');
const $progressFill= document.getElementById('progressFill');
const $progressWrap= document.getElementById('progressWrap');
const $timeCurrent = document.getElementById('timeCurrent');
const $timeTotal   = document.getElementById('timeTotal');
const $ampDisplay  = document.getElementById('ampDisplay');
const $songList    = document.getElementById('songList');
const $listToggle  = document.getElementById('listToggle');
const $ampLed      = document.getElementById('ampLed');
const $wooferL     = document.getElementById('wooferL');
const $wooferR     = document.getElementById('wooferR');
const $ledL        = document.getElementById('ledL');
const $ledR        = document.getElementById('ledR');

function fmtTime(s) {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return m + ':' + String(sec).padStart(2, '0');
}

function updateDisplay(text) {
    $ampDisplay.innerHTML = `<span class="scroll-inner">${text}</span>`;
}

function setSpeakerActive(on) {
    $ledL.classList.toggle('active', on);
    $ledR.classList.toggle('active', on);
    $wooferL.classList.toggle('pumping', on);
    $wooferR.classList.toggle('pumping', on);
    $ampLed.classList.toggle('on', on);
}

/* 搜索音乐 - iTunes Music API (CORS友好, 免费) */
async function searchMusic(keyword) {
    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(keyword)}&media=music&limit=15&country=CN`);
    if (!res.ok) throw new Error('搜索请求失败');
    const data = await res.json();
    if (!data.results || data.results.length === 0) return null;
    return data.results
        .filter(r => r.previewUrl)
        .map(r => ({
            id: r.trackId,
            name: r.trackName || '未知',
            artist: r.artistName || '未知歌手',
            album: r.collectionName || '',
            url: r.previewUrl,
            artwork: (r.artworkUrl100 || '').replace('100x100', '200x200'),
            duration: r.trackTimeMillis ? r.trackTimeMillis / 1000 : 30,
        }));
}

/* 渲染列表 */
function renderList() {
    if (playlist.length === 0) {
        $songList.innerHTML = '<div style="padding:12px 16px;font-size:7px;color:#444;text-align:center">暂无歌曲，请搜索添加</div>';
        return;
    }
    $songList.innerHTML = playlist.map((s, i) =>
        `<div class="song-item${i === currentIdx ? ' active' : ''}" data-idx="${i}">
            <span class="song-item-idx">${i + 1}</span>
            <span class="song-item-name">${s.name}</span>
            <span class="song-item-artist">${s.artist}</span>
        </div>`
    ).join('');
    $songList.querySelectorAll('.song-item').forEach(el => {
        el.addEventListener('click', () => playSong(parseInt(el.dataset.idx)));
    });
}

/* 播放歌曲 */
async function playSong(idx) {
    if (idx < 0 || idx >= playlist.length) return;
    currentIdx = idx;
    const song = playlist[idx];
    updateDisplay(`加载中: ${song.name}...`);
    audio.src = song.url;
    try {
        await audio.play();
        isPlaying = true;
        $playBtn.textContent = '❚❚';
        $playBtn.classList.add('playing');
        updateDisplay(`♪ ${song.name} — ${song.artist}`);
        setSpeakerActive(true);
    } catch(e) {
        console.warn('播放失败:', e);
        updateDisplay(`播放失败: ${song.name}`);
        setSpeakerActive(false);
    }
    renderList();
}

/* 控件事件 */
$playBtn.addEventListener('click', () => {
    if (playlist.length === 0) return;
    if (isPlaying) {
        audio.pause();
        isPlaying = false;
        $playBtn.textContent = '▶';
        $playBtn.classList.remove('playing');
        setSpeakerActive(false);
    } else {
        if (currentIdx === -1) currentIdx = 0;
        if (!audio.src || audio.src === location.href) {
            playSong(currentIdx);
        } else {
            audio.play();
            isPlaying = true;
            $playBtn.textContent = '❚❚';
            $playBtn.classList.add('playing');
            setSpeakerActive(true);
        }
    }
});

$prevBtn.addEventListener('click', () => {
    if (playlist.length === 0) return;
    playSong((currentIdx - 1 + playlist.length) % playlist.length);
});
$nextBtn.addEventListener('click', () => {
    if (playlist.length === 0) return;
    playSong((currentIdx + 1) % playlist.length);
});

$volumeSlider.addEventListener('input', () => {
    audio.volume = $volumeSlider.value / 100;
});

audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    $progressFill.style.width = pct + '%';
    $timeCurrent.textContent = fmtTime(audio.currentTime);
    $timeTotal.textContent = fmtTime(audio.duration);
});

audio.addEventListener('ended', () => {
    if (playlist.length > 1) {
        playSong((currentIdx + 1) % playlist.length);
    } else {
        isPlaying = false;
        $playBtn.textContent = '▶';
        $playBtn.classList.remove('playing');
        setSpeakerActive(false);
    }
});

audio.addEventListener('error', () => {
    updateDisplay('播放出错，可能为付费歌曲');
    setSpeakerActive(false);
    isPlaying = false;
    $playBtn.textContent = '▶';
    $playBtn.classList.remove('playing');
});

$progressWrap.addEventListener('click', (e) => {
    if (!audio.duration) return;
    const rect = $progressWrap.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pct * audio.duration;
});

$listToggle.addEventListener('click', () => {
    $songList.classList.toggle('open');
    $listToggle.textContent = $songList.classList.contains('open') ? '播放列表 ▲' : '播放列表 ▼';
});

/* 搜索 */
async function doSearch() {
    const kw = $searchInput.value.trim();
    if (!kw) return;
    updateDisplay('搜索中...');
    $searchBtn.textContent = '...';
    const results = await searchMusic(kw);
    $searchBtn.textContent = '搜索';
    if (!results || results.length === 0) {
        updateDisplay('未找到结果，换个关键词试试');
        return;
    }
    playlist = results;
    currentIdx = -1;
    renderList();
    $songList.classList.add('open');
    $listToggle.textContent = '播放列表 ▲';
    updateDisplay(`找到 ${results.length} 首歌曲，点击播放`);
}

$searchBtn.addEventListener('click', doSearch);
$searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
