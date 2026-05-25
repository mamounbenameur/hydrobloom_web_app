const SENSOR_META = {
    ph:     { label: 'pH',          absMin: 0,    absMax: 14,   unit: 'pH',   decimals: 1 },
    tds:    { label: 'TDS',         absMin: 0,    absMax: 2000, unit: 'ppm',  decimals: 0 },
    flow:   { label: 'Water Flow',  absMin: 0,    absMax: 10,   unit: 'L/m',  decimals: 1 },
    level:  { label: 'Water Level', absMin: 0,    absMax: 100,  unit: '%',    decimals: 0 },
    temp:   { label: 'Temperature', absMin: 0,    absMax: 50,   unit: '°C',   decimals: 1 },
    oxygene: { label: 'oxygene',      absMin: 0,    absMax: 20,   unit: 'mg/L', decimals: 1 },
};

const FIREBASE_URL = 'https://asma-6cc27-default-rtdb.europe-west1.firebasedatabase.app/data.json';

function loadPlantData() {
    try {
        const raw = localStorage.getItem('hydrobloom_plant');
        if (raw) {
            const parsed = JSON.parse(raw);

            if (parsed.sensors?.ec && !parsed.sensors?.tds) {
                parsed.sensors.tds = { min: 500, max: 1000, now: 750 };
                delete parsed.sensors.ec;
            }

            Object.keys(SENSOR_META).forEach(key => {
                const s = parsed.sensors?.[key];
                if (s && s.now === undefined) {
                    s.now = (s.min + s.max) / 2;
                }
                if (!parsed.sensors?.oxygene) {
                    parsed.sensors.oxygene = { min: 6, max: 14, now: 8 };
                }
            });
            return parsed;
        }
    } catch (_) {}

    return {
        name: 'My_plant_1',
        sensors: {
            ph:     { min: 5.5, max: 6.5,  now: 6    },
            tds:    { min: 500, max: 1000,  now: 750  },
            flow:   { min: 1.0, max: 3.0,   now: 1.2  },
            level:  { min: 20,  max: 90,    now: 55   },
            temp:   { min: 18,  max: 24,    now: 22   },
            oxygene: { min: 2,   max: 8,    now: 6    },
        }
    };
}

async function fetchNowValues() {
    const res = await fetch(FIREBASE_URL);
    if (!res.ok) throw new Error(`Firebase ${res.status}`);
    const d = await res.json();
    if (!d) return {};

    return {
        ph:     d.ph     ?? d.PH     ?? d.pH           ?? null,
        tds:    d.tds    ?? d.TDS    ?? d.ec            ?? d.EC ?? null,
        flow:   d.flow   ?? d.FLOW   ?? d.waterFlow     ?? null,
        level:  d.level  ?? d.LEVEL  ?? d.waterLevel    ?? null,
        temp:   d.temp   ?? d.TEMP   ?? d.temperature   ?? null,
        oxygene: d.oxygene ?? d.oxygene ?? d.dissolvedO2   ?? null,
    };
}

const $ = id => document.getElementById(id);
const plantImg    = $('plantImg');
const alertBanner = $('alertBanner');
const alertText   = $('alertText');

const IMG_NORMAL   = 'images/happy_nbg.png';
const IMG_STRESSED = 'images/dead_nbg.png';

let alertTimer = null;
const activeAlerts = new Set();

function renderSensor(key, data) {
    const meta = SENSOR_META[key];
    const { min, max, now } = data;
    const { absMin, absMax, decimals, unit } = meta;

    const pct    = Math.min(100, Math.max(0, ((now - absMin) / (absMax - absMin)) * 100));
    const minPct = Math.min(100, Math.max(0, ((min - absMin) / (absMax - absMin)) * 100));
    const maxPct = Math.min(100, Math.max(0, ((max - absMin) / (absMax - absMin)) * 100));

    const fmtNow = now.toFixed(decimals);
    const fmtMin = min.toFixed(decimals);
    const fmtMax = max.toFixed(decimals);

    $(`val-${key}`).textContent    = fmtNow;
    $(`min-${key}`).textContent    = `${fmtMin} ${unit}`;
    $(`max-${key}`).textContent    = `${fmtMax} ${unit}`;
    $(`bar-${key}`).style.width    = `${pct}%`;
    $(`minmark-${key}`).style.left = `${minPct}%`;
    $(`maxmark-${key}`).style.left = `${maxPct}%`;

    const tile     = $(`tile-${key}`);
    const statusEl = $(`status-${key}`);
    const isLow    = now < min;
    const isHigh   = now > max;
    const isAlert  = isLow || isHigh;

    statusEl.className = 'tile-status ' + (isAlert ? (isLow ? 'low' : 'high') : 'ok');
    statusEl.innerHTML = isAlert
        ? `<i class="ph-fill ph-warning"></i> ${isLow ? 'Too Low' : 'Too High'}`
        : `<i class="ph-fill ph-check-circle"></i> Normal`;

    tile.classList.toggle('alert-tile', isAlert);
    return { key, isAlert, isLow, isHigh, label: meta.label, now: fmtNow, unit, min: fmtMin, max: fmtMax };
}

function triggerAlert(alerts) {
    if (!alerts.length) return;
    alertText.textContent = alerts
        .map(a => {
            const dir = a.isLow
                ? `below min (${a.min} ${a.unit})`
                : `above max (${a.max} ${a.unit})`;
            return `${a.label}: ${a.now} ${a.unit} — ${dir}`;
        })
        .join('  •  ');

    alertBanner.classList.add('visible');
    plantImg.src = IMG_STRESSED;
    plantImg.classList.add('stressed');

    clearTimeout(alertTimer);
    alertTimer = setTimeout(hideAlert2, 6000);
}

function hideAlert() {
    alertBanner.classList.remove('visible');
    plantImg.src = IMG_NORMAL;
    plantImg.classList.remove('stressed');
}

function hideAlert2() {
    alertBanner.classList.remove('visible');
}

function renderAll(plantData) {
    $('plantNameLabel').textContent = plantData.name || 'My Plant';

    const newAlerts     = [];
    const prevAlertKeys = new Set(activeAlerts);

    Object.keys(SENSOR_META).forEach(key => {
        const sensor = plantData.sensors[key];
        if (!sensor) return;
        const result = renderSensor(key, sensor);
        if (result.isAlert) { newAlerts.push(result); activeAlerts.add(key); }
        else                { activeAlerts.delete(key); }
    });

    const hasNew = newAlerts.some(a => !prevAlertKeys.has(a.key));
    if (newAlerts.length > 0 && hasNew) triggerAlert(newAlerts);
    else if (newAlerts.length === 0)    hideAlert();
}

(function init() {
    const plantData = loadPlantData();
    renderAll(plantData);

    async function refresh() {
        try {
            const nowVals = await fetchNowValues();
            Object.keys(SENSOR_META).forEach(key => {
                const val = nowVals[key];
                if (val !== null && val !== undefined && !isNaN(val)) {
                    plantData.sensors[key].now = Number(val);
                }
            });
            renderAll(plantData);
        } catch (err) {
            console.warn('Live data fetch failed:', err.message);
        }
    }

    refresh();
    setInterval(refresh, 3000);
})();
