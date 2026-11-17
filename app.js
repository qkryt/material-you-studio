/* ==========================================================================
   Material You Studio — Perceptual OKLCH Dynamic Theme Engine & Interactivity
   ========================================================================== */

(() => {
  'use strict';

  /* ------------------------------------------------------------------------
     1. Perceptual Color Math: HEX <-> Linear RGB <-> OKLab <-> OKLCH
     ------------------------------------------------------------------------ */
  function hexToRgb(hex) {
    const clean = hex.replace('#', '').trim();
    const full = clean.length === 3
      ? clean.split('').map(c => c + c).join('')
      : clean.padEnd(6, '0').slice(0, 6);
    const num = parseInt(full, 16);
    return {
      r: ((num >> 16) & 255) / 255,
      g: ((num >> 8) & 255) / 255,
      b: (num & 255) / 255,
    };
  }

  function rgbToHex(r, g, b) {
    const toByte = v => Math.max(0, Math.min(255, Math.round(v * 255)));
    return '#' + [toByte(r), toByte(g), toByte(b)]
      .map(v => v.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }

  function srgbToLinear(c) {
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  function linearToSrgb(c) {
    const clamped = Math.max(0, Math.min(1, c));
    return clamped <= 0.0031308
      ? 12.92 * clamped
      : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  }

  function hexToOklch(hex) {
    const { r, g, b } = hexToRgb(hex);
    const lr = srgbToLinear(r);
    const lg = srgbToLinear(g);
    const lb = srgbToLinear(b);

    const l_ = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
    const m_ = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
    const s_ = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

    const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
    const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
    const bVal = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

    const C = Math.sqrt(a * a + bVal * bVal);
    let h = Math.atan2(bVal, a) * (180 / Math.PI);
    if (h < 0) h += 360;
    return { L, C, h };
  }

  function oklchToLinearRgb(L, C, hDeg) {
    const hRad = (hDeg * Math.PI) / 180;
    const a = C * Math.cos(hRad);
    const b = C * Math.sin(hRad);

    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;

    return {
      r: +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      b: -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    };
  }

  function inGamut({ r, g, b }) {
    const eps = 0.0005;
    return r >= -eps && r <= 1 + eps && g >= -eps && g <= 1 + eps && b >= -eps && b <= 1 + eps;
  }

  // Binary search chroma reduction to keep exact lightness & hue inside sRGB gamut
  function oklchToHex(L, C, h) {
    const clampedL = Math.max(0, Math.min(1, L));
    const normH = ((h % 360) + 360) % 360;
    let lo = 0;
    let hi = Math.max(0, C);
    let rgb = oklchToLinearRgb(clampedL, hi, normH);

    if (!inGamut(rgb)) {
      for (let i = 0; i < 14; i++) {
        const mid = (lo + hi) / 2;
        const test = oklchToLinearRgb(clampedL, mid, normH);
        if (inGamut(test)) {
          lo = mid;
          rgb = test;
        } else {
          hi = mid;
        }
      }
      rgb = oklchToLinearRgb(clampedL, lo, normH);
    }

    return rgbToHex(linearToSrgb(rgb.r), linearToSrgb(rgb.g), linearToSrgb(rgb.b));
  }

  /* ------------------------------------------------------------------------
     2. Material 3 Dynamic Scheme Generator
     ------------------------------------------------------------------------ */
  function generateMaterial3Scheme(seedHex, { dark = true, scheme = 'tonalSpot', highContrast = false, chromaScale = 1 }) {
    const seed = hexToOklch(seedHex);
    const baseHue = Number.isNaN(seed.h) ? 280 : seed.h;
    const baseC = Math.max(0.08, Math.min(0.22, seed.C || 0.14)) * chromaScale;

    // Scheme-specific hue shifts & chroma multipliers (faithful to M3 Dynamic Color specs)
    let pH = baseHue, sH = baseHue, tH = baseHue + 60, nH = baseHue;
    let pC = baseC, sC = baseC * 0.42, tC = baseC * 0.62, nC = 0.014 * chromaScale, nvC = 0.024 * chromaScale;

    switch (scheme) {
      case 'vibrant':
        sH = baseHue + 18;
        tH = baseHue + 52;
        pC = Math.min(0.26, baseC * 1.32);
        sC = Math.min(0.16, baseC * 0.78);
        tC = Math.min(0.19, baseC * 0.95);
        nC = 0.022 * chromaScale;
        nvC = 0.036 * chromaScale;
        break;
      case 'expressive':
        pH = baseHue + 210;
        sH = baseHue + 45;
        tH = baseHue + 125;
        pC = Math.min(0.24, baseC * 1.18);
        sC = Math.min(0.14, baseC * 0.68);
        tC = Math.min(0.17, baseC * 0.88);
        nC = 0.018 * chromaScale;
        nvC = 0.032 * chromaScale;
        break;
      case 'neutral':
        sH = baseHue;
        tH = baseHue + 24;
        pC = baseC * 0.36;
        sC = baseC * 0.24;
        tC = baseC * 0.32;
        nC = 0.008 * chromaScale;
        nvC = 0.014 * chromaScale;
        break;
      case 'monochrome':
        pC = 0; sC = 0; tC = 0; nC = 0; nvC = 0;
        break;
      case 'tonalSpot':
      default:
        break;
    }

    const boost = highContrast ? 0.07 : 0;
    const tone = (L, C, H) => oklchToHex(L, C, H);

    if (dark) {
      return {
        primary:                 tone(0.82 + boost * 0.8, pC * 0.92, pH),
        onPrimary:               tone(0.24 - boost * 0.7, pC * 0.75, pH),
        primaryContainer:        tone(0.36 + boost * 0.3, pC * 0.88, pH),
        onPrimaryContainer:      tone(0.93 + boost * 0.4, pC * 0.45, pH),

        secondary:               tone(0.81 + boost * 0.6, sC * 0.9, sH),
        onSecondary:             tone(0.25 - boost * 0.6, sC * 0.7, sH),
        secondaryContainer:      tone(0.35 + boost * 0.3, sC * 0.85, sH),
        onSecondaryContainer:    tone(0.92 + boost * 0.4, sC * 0.45, sH),

        tertiary:                tone(0.82 + boost * 0.6, tC * 0.92, tH),
        onTertiary:              tone(0.25 - boost * 0.6, tC * 0.7, tH),
        tertiaryContainer:       tone(0.36 + boost * 0.3, tC * 0.85, tH),
        onTertiaryContainer:     tone(0.93 + boost * 0.4, tC * 0.45, tH),

        error:                   tone(0.80, 0.12, 24),
        onError:                 tone(0.25, 0.10, 24),
        errorContainer:          tone(0.36, 0.12, 24),
        onErrorContainer:        tone(0.92, 0.05, 24),

        surface:                 tone(0.16 - boost * 0.3, nC, nH),
        surfaceDim:              tone(0.14 - boost * 0.2, nC, nH),
        surfaceBright:           tone(0.32, nC * 1.1, nH),
        surfaceContainerLowest:  tone(0.12 - boost * 0.2, nC, nH),
        surfaceContainerLow:     tone(0.20, nC * 1.05, nH),
        surfaceContainer:        tone(0.225, nC * 1.1, nH),
        surfaceContainerHigh:    tone(0.265, nC * 1.15, nH),
        surfaceContainerHighest: tone(0.31, nC * 1.2, nH),

        onSurface:               tone(0.91 + boost * 0.7, nC * 0.7, nH),
        onSurfaceVariant:        tone(0.79 + boost * 0.8, nvC * 0.8, nH),
        outline:                 tone(0.62 + boost * 1.0, nvC, nH),
        outlineVariant:          tone(0.36 + boost * 0.7, nvC, nH),

        inverseSurface:          tone(0.91, nC * 0.7, nH),
        inverseOnSurface:        tone(0.24, nC, nH),
        inversePrimary:          tone(0.48, pC, pH),
      };
    }

    // Light Mode M3 Tones
    return {
      primary:                 tone(0.48 - boost * 0.9, pC * 1.05, pH),
      onPrimary:               tone(0.99, pC * 0.1, pH),
      primaryContainer:        tone(0.90 - boost * 0.4, pC * 0.55, pH),
      onPrimaryContainer:      tone(0.22 - boost * 0.6, pC * 0.8, pH),

      secondary:               tone(0.49 - boost * 0.8, sC * 0.95, sH),
      onSecondary:             tone(0.99, sC * 0.1, sH),
      secondaryContainer:      tone(0.90 - boost * 0.4, sC * 0.55, sH),
      onSecondaryContainer:    tone(0.23 - boost * 0.6, sC * 0.75, sH),

      tertiary:                tone(0.50 - boost * 0.8, tC * 0.95, tH),
      onTertiary:              tone(0.99, tC * 0.1, tH),
      tertiaryContainer:       tone(0.91 - boost * 0.4, tC * 0.55, tH),
      onTertiaryContainer:     tone(0.24 - boost * 0.6, tC * 0.75, tH),

      error:                   tone(0.48, 0.17, 25),
      onError:                 tone(0.99, 0.01, 25),
      errorContainer:          tone(0.91, 0.06, 25),
      onErrorContainer:        tone(0.26, 0.12, 25),

      surface:                 tone(0.985, nC * 0.6, nH),
      surfaceDim:              tone(0.89, nC * 0.9, nH),
      surfaceBright:           tone(0.99, nC * 0.5, nH),
      surfaceContainerLowest:  tone(1.00, 0, nH),
      surfaceContainerLow:     tone(0.96, nC * 0.75, nH),
      surfaceContainer:        tone(0.94, nC * 0.85, nH),
      surfaceContainerHigh:    tone(0.915, nC * 0.95, nH),
      surfaceContainerHighest: tone(0.89, nC * 1.05, nH),

      onSurface:               tone(0.18 - boost * 0.6, nC, nH),
      onSurfaceVariant:        tone(0.38 - boost * 0.9, nvC * 0.9, nH),
      outline:                 tone(0.54 - boost * 1.0, nvC, nH),
      outlineVariant:          tone(0.81 - boost * 0.8, nvC, nH),

      inverseSurface:          tone(0.24, nC, nH),
      inverseOnSurface:        tone(0.95, nC * 0.5, nH),
      inversePrimary:          tone(0.82, pC * 0.9, pH),
    };
  }

  /* ------------------------------------------------------------------------
     3. Curated Pixel Wallpaper Presets & App State
     ------------------------------------------------------------------------ */
  const PRESETS = [
    { name: 'Pixel Iris',       seed: '#6750A4', top: '#8B74D6', left: '#D0BCFF', right: '#EFB8C8' },
    { name: 'Botanical Sage',   seed: '#386A20', top: '#5B9A3E', left: '#B8F397', right: '#BCECE0' },
    { name: 'Ocean Cobalt',     seed: '#0061A4', top: '#318CE7', left: '#9ECAFF', right: '#D6BEE4' },
    { name: 'Terracotta Dusk',  seed: '#B34B26', top: '#E0724A', left: '#FFDBCE', right: '#E5C468' },
    { name: 'Sakura Rose',      seed: '#B92C6A', top: '#E55C96', left: '#FFD8E6', right: '#F2B880' },
    { name: 'Amber Honey',      seed: '#8D6600', top: '#D4A11E', left: '#FFE08E', right: '#B7D19A' },
  ];

  const TRACKS = [
    { title: 'Dynamic Harmony', artist: 'Material Soundscapes • 2026', duration: 198 },
    { title: 'Tonal Elevation', artist: 'Pixel Ambient Collective • 2026', duration: 224 },
    { title: 'Expressive Motion', artist: 'OKLCH Synth Lab • 2026', duration: 185 },
  ];

  const state = {
    seed: '#6750A4',
    dark: true,
    scheme: 'tonalSpot',
    highContrast: false,
    chromaScale: 1.0,
    tokens: {},
    playing: true,
    trackIndex: 0,
    progressPct: 42,
    liked: true,
  };

  /* ------------------------------------------------------------------------
     4. Apply Theme Tokens to DOM
     ------------------------------------------------------------------------ */
  const TOKEN_TO_CSS = {
    primary: '--md-sys-color-primary',
    onPrimary: '--md-sys-color-on-primary',
    primaryContainer: '--md-sys-color-primary-container',
    onPrimaryContainer: '--md-sys-color-on-primary-container',
    secondary: '--md-sys-color-secondary',
    onSecondary: '--md-sys-color-on-secondary',
    secondaryContainer: '--md-sys-color-secondary-container',
    onSecondaryContainer: '--md-sys-color-on-secondary-container',
    tertiary: '--md-sys-color-tertiary',
    onTertiary: '--md-sys-color-on-tertiary',
    tertiaryContainer: '--md-sys-color-tertiary-container',
    onTertiaryContainer: '--md-sys-color-on-tertiary-container',
    error: '--md-sys-color-error',
    onError: '--md-sys-color-on-error',
    errorContainer: '--md-sys-color-error-container',
    onErrorContainer: '--md-sys-color-on-error-container',
    surface: '--md-sys-color-surface',
    surfaceDim: '--md-sys-color-surface-dim',
    surfaceBright: '--md-sys-color-surface-bright',
    surfaceContainerLowest: '--md-sys-color-surface-container-lowest',
    surfaceContainerLow: '--md-sys-color-surface-container-low',
    surfaceContainer: '--md-sys-color-surface-container',
    surfaceContainerHigh: '--md-sys-color-surface-container-high',
    surfaceContainerHighest: '--md-sys-color-surface-container-highest',
    onSurface: '--md-sys-color-on-surface',
    onSurfaceVariant: '--md-sys-color-on-surface-variant',
    outline: '--md-sys-color-outline',
    outlineVariant: '--md-sys-color-outline-variant',
    inverseSurface: '--md-sys-color-inverse-surface',
    inverseOnSurface: '--md-sys-color-inverse-on-surface',
    inversePrimary: '--md-sys-color-inverse-primary',
  };

  function applyTheme() {
    const tokens = generateMaterial3Scheme(state.seed, {
      dark: state.dark,
      scheme: state.scheme,
      highContrast: state.highContrast,
      chromaScale: state.chromaScale,
    });
    state.tokens = tokens;

    const root = document.documentElement;
    root.setAttribute('data-theme', state.dark ? 'dark' : 'light');

    for (const [key, cssVar] of Object.entries(TOKEN_TO_CSS)) {
      root.style.setProperty(cssVar, tokens[key]);
    }

    const metaTheme = document.getElementById('meta-theme-color');
    if (metaTheme) metaTheme.setAttribute('content', tokens.surface);

    // Update UI indicators
    document.getElementById('current-seed-badge').textContent = state.seed.toUpperCase();
    document.getElementById('seed-color-input').value = state.seed.toLowerCase();
    document.getElementById('color-dot-preview').style.backgroundColor = state.seed;

    const themeIcon = state.dark ? 'light_mode' : 'dark_mode';
    document.getElementById('theme-icon-top').textContent = themeIcon;
    document.getElementById('theme-icon-rail').textContent = themeIcon;
    document.getElementById('contrast-label').textContent = state.highContrast ? 'Высокий' : 'Стандарт';

    // Update all hex labels in palette studio & surface ladder
    document.querySelectorAll('[data-hex-for]').forEach(el => {
      const role = el.getAttribute('data-hex-for');
      if (tokens[role]) el.textContent = tokens[role];
    });

    // Update active wallpaper swatch highlight
    document.querySelectorAll('.swatch-btn').forEach(btn => {
      const match = btn.dataset.seed.toUpperCase() === state.seed.toUpperCase();
      btn.classList.toggle('active', match);
      btn.setAttribute('aria-checked', String(match));
    });
  }

  /* ------------------------------------------------------------------------
     5. Build Wallpaper Swatches
     ------------------------------------------------------------------------ */
  function initWallpaperSwatches() {
    const container = document.getElementById('wallpaper-swatches');
    container.innerHTML = '';

    PRESETS.forEach(preset => {
      const btn = document.createElement('button');
      btn.className = 'swatch-btn';
      btn.dataset.seed = preset.seed;
      btn.title = preset.name;
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-label', `Тема ${preset.name}`);
      btn.innerHTML = `
        <span class="swatch-pie">
          <span style="background:${preset.top}"></span>
          <span style="background:${preset.left}"></span>
          <span style="background:${preset.right}"></span>
        </span>
        <span class="swatch-check"><span class="material-symbols-rounded">check</span></span>
      `;
      btn.addEventListener('click', () => {
        state.seed = preset.seed;
        applyTheme();
        showSnackbar(`Применена палитра «${preset.name}»`);
      });
      container.appendChild(btn);
    });
  }

  /* ------------------------------------------------------------------------
     6. Snackbar Notification Helper
     ------------------------------------------------------------------------ */
  let snackTimer = null;
  function showSnackbar(message) {
    const el = document.getElementById('snackbar');
    document.getElementById('snackbar-text').textContent = message;
    el.classList.add('show');
    clearTimeout(snackTimer);
    snackTimer = setTimeout(() => el.classList.remove('show'), 2400);
  }

  async function copyToClipboard(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      showSnackbar(label || `Скопировано: ${text}`);
    } catch {
      showSnackbar(`Готово: ${text}`);
    }
  }

  /* ------------------------------------------------------------------------
     7. Material Ripple Effect
     ------------------------------------------------------------------------ */
  function initRipple() {
    document.addEventListener('pointerdown', (e) => {
      if (document.body.classList.contains('reduced-motion')) return;
      const target = e.target.closest('.ripple, .role-card');
      if (!target) return;

      const rect = target.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const wave = document.createElement('span');
      wave.className = 'ripple-wave';
      wave.style.width = `${size}px`;
      wave.style.height = `${size}px`;
      wave.style.left = `${e.clientX - rect.left - size / 2}px`;
      wave.style.top = `${e.clientY - rect.top - size / 2}px`;
      target.appendChild(wave);
      setTimeout(() => wave.remove(), 550);
    });
  }

  /* ------------------------------------------------------------------------
     8. Live Android Pixel Clock Widget
     ------------------------------------------------------------------------ */
  function initClock() {
    const timeEl = document.getElementById('clock-time');
    const dateEl = document.getElementById('clock-date');
    const widget = document.getElementById('clock-widget');

    function tick() {
      const now = new Date();
      timeEl.textContent = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      dateEl.textContent = now.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
    }
    tick();
    setInterval(tick, 1000);

    widget.addEventListener('click', () => {
      widget.classList.toggle('alt-style');
      showSnackbar('Стиль виджета часов переключён');
    });
  }

  /* ------------------------------------------------------------------------
     9. Squiggly Audio Player Widget
     ------------------------------------------------------------------------ */
  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function initMediaPlayer() {
    const playBtn = document.getElementById('btn-play-toggle');
    const playIcon = document.getElementById('play-icon');
    const squiggleSvg = document.getElementById('squiggle-svg');
    const activeBar = document.getElementById('squiggly-active');
    const thumb = document.getElementById('squiggly-thumb');
    const trackEl = document.getElementById('squiggly-track');
    const curTimeEl = document.getElementById('media-current-time');
    const titleEl = document.querySelector('.media-info .title-large');
    const artistEl = document.querySelector('.media-artist');
    const durEl = document.querySelector('.squiggly-progress-wrap .time-stamp:last-child');
    const likeIcon = document.getElementById('like-icon');

    function renderMedia() {
      const track = TRACKS[state.trackIndex];
      titleEl.textContent = track.title;
      artistEl.textContent = track.artist;
      durEl.textContent = formatTime(track.duration);
      curTimeEl.textContent = formatTime((track.duration * state.progressPct) / 100);
      activeBar.style.width = `${state.progressPct}%`;
      thumb.style.left = `${state.progressPct}%`;
      trackEl.setAttribute('aria-valuenow', String(Math.round(state.progressPct)));

      playIcon.textContent = state.playing ? 'pause' : 'play_arrow';
      playBtn.classList.toggle('paused', !state.playing);
      squiggleSvg.classList.toggle('playing', state.playing);
      squiggleSvg.classList.toggle('paused', !state.playing);
      likeIcon.classList.toggle('icon-filled', state.liked);
    }

    playBtn.addEventListener('click', () => {
      state.playing = !state.playing;
      renderMedia();
    });

    document.getElementById('btn-next-track').addEventListener('click', () => {
      state.trackIndex = (state.trackIndex + 1) % TRACKS.length;
      state.progressPct = 12;
      renderMedia();
      showSnackbar(`Трек: ${TRACKS[state.trackIndex].title}`);
    });

    document.getElementById('btn-prev-track').addEventListener('click', () => {
      state.trackIndex = (state.trackIndex - 1 + TRACKS.length) % TRACKS.length;
      state.progressPct = 12;
      renderMedia();
      showSnackbar(`Трек: ${TRACKS[state.trackIndex].title}`);
    });

    document.getElementById('btn-like-track').addEventListener('click', () => {
      state.liked = !state.liked;
      renderMedia();
      showSnackbar(state.liked ? 'Добавлено в избранное' : 'Убрано из избранного');
    });

    trackEl.addEventListener('click', (e) => {
      const rect = trackEl.getBoundingClientRect();
      const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      state.progressPct = pct;
      renderMedia();
    });

    setInterval(() => {
      if (!state.playing) return;
      state.progressPct += 0.45;
      if (state.progressPct >= 100) {
        state.progressPct = 0;
        state.trackIndex = (state.trackIndex + 1) % TRACKS.length;
      }
      renderMedia();
    }, 1000);

    renderMedia();
  }

  /* ------------------------------------------------------------------------
     10. Search Bar (Sections, Themes, Actions)
     ------------------------------------------------------------------------ */
  function initSearch() {
    const input = document.getElementById('search-input');
    const clearBtn = document.getElementById('search-clear');
    const dropdown = document.getElementById('search-dropdown');

    const INDEX = [
      { label: 'Студия динамической палитры', tag: 'Раздел', action: () => location.hash = '#palette' },
      { label: 'Интерактивный UI-кит и кнопки', tag: 'Раздел', action: () => location.hash = '#components' },
      { label: 'Экспрессивные формы и типографика', tag: 'Раздел', action: () => location.hash = '#shapes' },
      { label: 'Экспорт CSS-токенов', tag: 'Действие', action: () => openExportModal() },
      { label: 'Переключить светлую / тёмную тему', tag: 'Тема', action: () => toggleDarkMode() },
      ...PRESETS.map(p => ({
        label: `Обои: ${p.name} (${p.seed})`,
        tag: 'Палитра',
        action: () => { state.seed = p.seed; applyTheme(); showSnackbar(`Выбрана тема «${p.name}»`); }
      })),
    ];

    function renderResults(query) {
      const q = query.trim().toLowerCase();
      clearBtn.classList.toggle('hidden', q.length === 0);
      if (!q) {
        dropdown.classList.add('hidden');
        return;
      }

      const matches = INDEX.filter(item => item.label.toLowerCase().includes(q)).slice(0, 6);
      if (matches.length === 0) {
        dropdown.innerHTML = `<div style="padding:12px 14px;font-size:0.86rem;opacity:0.7;">Ничего не найдено по запросу «${query}»</div>`;
      } else {
        dropdown.innerHTML = '';
        matches.forEach(item => {
          const btn = document.createElement('button');
          btn.className = 'search-result-item';
          btn.innerHTML = `<span>${item.label}</span><span class="search-result-tag">${item.tag}</span>`;
          btn.addEventListener('click', () => {
            item.action();
            dropdown.classList.add('hidden');
            input.value = '';
            clearBtn.classList.add('hidden');
          });
          dropdown.appendChild(btn);
        });
      }
      dropdown.classList.remove('hidden');
    }

    input.addEventListener('input', () => renderResults(input.value));
    clearBtn.addEventListener('click', () => {
      input.value = '';
      renderResults('');
      input.focus();
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-bar-wrap')) dropdown.classList.add('hidden');
    });
  }

  /* ------------------------------------------------------------------------
     11. CSS Export Modal & Demo Dialog
     ------------------------------------------------------------------------ */
  function buildCssExport() {
    const lines = [
      `/* Material You Theme — Generated by Material You Studio */`,
      `/* Seed: ${state.seed.toUpperCase()} | Scheme: ${state.scheme} | Mode: ${state.dark ? 'Dark' : 'Light'} */`,
      `:root {`,
    ];
    for (const [key, cssVar] of Object.entries(TOKEN_TO_CSS)) {
      lines.push(`  ${cssVar}: ${state.tokens[key]};`);
    }
    lines.push(`}`);
    return lines.join('\n');
  }

  function openExportModal() {
    const dialog = document.getElementById('export-dialog');
    document.getElementById('css-export-code').textContent = buildCssExport();
    document.getElementById('export-meta').textContent =
      `Seed: ${state.seed.toUpperCase()} • ${state.scheme} • ${state.dark ? 'Dark' : 'Light'}${state.highContrast ? ' • High Contrast' : ''}`;
    dialog.classList.remove('hidden');
  }

  function toggleDarkMode() {
    state.dark = !state.dark;
    applyTheme();
    showSnackbar(state.dark ? 'Включена тёмная тема' : 'Включена светлая тема');
  }

  function pickRandomSeed() {
    const hue = Math.floor(Math.random() * 360);
    state.seed = oklchToHex(0.56, 0.16, hue);
    applyTheme();
    showSnackbar(`Случайный цвет: ${state.seed}`);
  }

  /* ------------------------------------------------------------------------
     12. Navigation Scroll Spy & Controls Binding
     ------------------------------------------------------------------------ */
  function initScrollSpy() {
    const sections = document.querySelectorAll('section[id]');
    const navItems = document.querySelectorAll('.nav-item[data-section]');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const id = entry.target.id;
        navItems.forEach(item => {
          item.classList.toggle('active', item.dataset.section === id);
        });
      });
    }, { rootMargin: '-30% 0px -55% 0px' });

    sections.forEach(sec => observer.observe(sec));
  }

  function bindControls() {
    // Theme Mode Toggles
    document.getElementById('btn-theme-mode-top').addEventListener('click', toggleDarkMode);
    document.getElementById('btn-theme-mode-rail').addEventListener('click', toggleDarkMode);

    // Contrast Toggle
    document.getElementById('btn-contrast-toggle').addEventListener('click', () => {
      state.highContrast = !state.highContrast;
      applyTheme();
      showSnackbar(state.highContrast ? 'Режим повышенного контраста' : 'Стандартный контраст M3');
    });

    // Random Seed Triggers
    document.getElementById('btn-random-theme').addEventListener('click', pickRandomSeed);
    document.getElementById('btn-random-seed-card').addEventListener('click', pickRandomSeed);

    // Custom Color Input
    document.getElementById('seed-color-input').addEventListener('input', (e) => {
      state.seed = e.target.value.toUpperCase();
      applyTheme();
    });

    // Scheme Segmented Buttons
    document.querySelectorAll('#scheme-segmented .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#scheme-segmented .seg-btn').forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-checked', 'true');
        state.scheme = btn.dataset.scheme;
        applyTheme();
        showSnackbar(`Алгоритм палитры: ${btn.textContent.replace('check', '').trim()}`);
      });
    });

    // Copy HEX on Role Cards & Surface Steps
    document.querySelectorAll('.role-card').forEach(card => {
      card.addEventListener('click', () => {
        const hex = card.querySelector('.role-hex')?.textContent || '';
        const name = card.querySelector('.role-name')?.textContent || '';
        copyToClipboard(hex, `${name}: ${hex} скопирован`);
      });
    });

    document.querySelectorAll('.surface-step').forEach(step => {
      step.addEventListener('click', () => {
        const role = step.dataset.role;
        const hex = state.tokens[role];
        copyToClipboard(hex, `Surface ${step.querySelector('.step-label').textContent}: ${hex}`);
      });
    });

    // Generic Snackbar buttons
    document.querySelectorAll('[data-snack]').forEach(btn => {
      btn.addEventListener('click', () => showSnackbar(btn.dataset.snack));
    });

    // Switches
    document.getElementById('sw-dynamic').addEventListener('change', (e) => {
      if (!e.target.checked) {
        state.scheme = 'monochrome';
        applyTheme();
        showSnackbar('Динамический цвет отключён (Monochrome)');
      } else {
        state.scheme = 'tonalSpot';
        applyTheme();
        showSnackbar('Динамический цвет активирован');
      }
      document.querySelectorAll('#scheme-segmented .seg-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.scheme === state.scheme);
      });
    });

    document.getElementById('sw-motion').addEventListener('change', (e) => {
      document.body.classList.toggle('reduced-motion', !e.target.checked);
      showSnackbar(e.target.checked ? 'M3 Motion включён' : 'Анимации уменьшены');
    });

    document.getElementById('sw-compact').addEventListener('change', (e) => {
      document.body.classList.toggle('compact-mode', e.target.checked);
      showSnackbar(e.target.checked ? 'Компактная плотность включена' : 'Стандартная плотность');
    });

    // Sliders
    const radiusSlider = document.getElementById('radius-slider');
    radiusSlider.addEventListener('input', (e) => {
      const val = e.target.value;
      document.documentElement.style.setProperty('--m3-card-radius', `${val}px`);
      document.getElementById('radius-value-label').textContent = `${val}px`;
    });

    const chromaSlider = document.getElementById('chroma-slider');
    chromaSlider.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      state.chromaScale = val / 100;
      document.getElementById('chroma-value-label').textContent = `${val}%`;
      applyTheme();
    });

    // Quick Settings Tiles
    document.querySelectorAll('.qs-tile').forEach(tile => {
      tile.addEventListener('click', () => {
        const isActive = tile.classList.toggle('active');
        const sub = tile.querySelector('.qs-sub');
        const name = tile.dataset.qs;
        if (name === 'Wi-Fi') sub.textContent = isActive ? '5G • Подключено' : 'Отключено';
        else if (name === 'Bluetooth') sub.textContent = isActive ? 'Pixel Buds Pro' : 'Выключено';
        else sub.textContent = isActive ? 'Включено' : 'Выключено';
      });
    });

    // Filter Chips
    document.querySelectorAll('[data-chip]').forEach(chip => {
      chip.addEventListener('click', () => chip.classList.toggle('selected'));
    });

    // Demo Dialog
    const demoDialog = document.getElementById('demo-dialog');
    document.getElementById('btn-show-dialog').addEventListener('click', () => demoDialog.classList.remove('hidden'));
    document.getElementById('dialog-close-cancel').addEventListener('click', () => demoDialog.classList.add('hidden'));
    document.getElementById('dialog-close-ok').addEventListener('click', () => {
      demoDialog.classList.add('hidden');
      showSnackbar('Действие подтверждено');
    });
    demoDialog.addEventListener('click', (e) => {
      if (e.target === demoDialog) demoDialog.classList.add('hidden');
    });

    // Export Modal
    const exportDialog = document.getElementById('export-dialog');
    document.getElementById('btn-open-export').addEventListener('click', openExportModal);
    document.getElementById('fab-export').addEventListener('click', openExportModal);
    document.getElementById('export-close-x').addEventListener('click', () => exportDialog.classList.add('hidden'));
    document.getElementById('export-close-btn').addEventListener('click', () => exportDialog.classList.add('hidden'));
    document.getElementById('export-copy-btn').addEventListener('click', () => {
      copyToClipboard(buildCssExport(), 'CSS-токены скопированы в буфер!');
    });
    exportDialog.addEventListener('click', (e) => {
      if (e.target === exportDialog) exportDialog.classList.add('hidden');
    });

    // Close dialogs with Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        demoDialog.classList.add('hidden');
        exportDialog.classList.add('hidden');
      }
    });
  }

  /* ------------------------------------------------------------------------
     Init
     ------------------------------------------------------------------------ */
  initWallpaperSwatches();
  applyTheme();
  initRipple();
  initClock();
  initMediaPlayer();
  initSearch();
  initScrollSpy();
  bindControls();
})();
