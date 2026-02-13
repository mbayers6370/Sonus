/*
██████████████████████████████████████████████████████████████████████████████
APP.JS (virtual)
- init
- selection/routing
- screen/nav management
██████████████████████████████████████████████████████████████████████████████
*/

// ── DATA LOADERS (Mandarin vocab by band) ──
app._cache = app._cache || { zhBands: {} };

app.loadZhBand = async function loadZhBand(bandId) {
  // bandId is expected like "band1", "band2", etc.
  if (this._cache.zhBands[bandId]) return this._cache.zhBands[bandId];

  // If the app is opened directly from disk (file://), fetch() of local files is often blocked.
  // Use a local dev server (VSCode Live Server or `python3 -m http.server`).
  if (window.location && window.location.protocol === 'file:') {
    throw new Error(
      'Local file mode detected (file://). Browser blocks fetch() for JSON files. ' +
      'Run a local server (e.g., VSCode Live Server or `python3 -m http.server` in the /files folder) ' +
      'and open http://localhost instead.'
    );
  }

  const url = `data/zh/${bandId}.json`;
  console.log('[Sonus] Loading band vocab:', bandId, '→', url);

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load Mandarin vocab (${bandId}). HTTP ${res.status}`);
  const data = await res.json();

  this._cache.zhBands[bandId] = data;
  return data;
};

app.init = function init() {
  this.loadState();

  // Always start on the homepage (language hub)
  this.renderLanguages();
  this.showScreen('language-select');

  // Pre-render Mandarin levels (safe default)
  this.renderLevels();
  this.updateNavigation('language-select');

  if (window.lucide) {
    setTimeout(() => lucide.createIcons(), 50);
  }
};

app.selectLanguage = function selectLanguage(langId) {
  const lang = LANGUAGES.find(l => l.id === langId);
  if (!lang) return;

  this.state.selectedLanguage = langId;
  this.saveState();

  if (langId === 'mandarin') {
    this.renderLevels();
    this.updateLevelSelectHeader();
    this.showScreen('level-select');
  } else if (langId === 'japanese') {
    this.renderJapaneseLevels();
    this.updateLevelSelectHeader();
    this.showScreen('level-select');
  } else if (langId === 'korean') {
    this.renderKoreanLevels();
    this.updateLevelSelectHeader();
    this.showScreen('level-select');
  } else if (langId === 'french') {
    this.renderFrenchLevels();
    this.updateLevelSelectHeader();
    this.showScreen('level-select');
  } else {
    alert('Coming soon!');
  }
};

// Mandarin level select
app.selectLevel = async function selectLevel(levelId) {
  const level = LESSON_BANDS.find(l => l.id === levelId);
  if (!level) return;

  this.state.currentLevel = level;
  this.state.activeBandId = level.id; // e.g., "band1"

  // Load vocab for this band (cached)
  try {
    const bandData = await this.loadZhBand(level.id);
    this.state.activeBandData = bandData;
    this.saveState();
  } catch (err) {
    console.error(err);
    alert('Could not load Mandarin vocab for this band. Check that data/zh/' + level.id + '.json exists.');
    return;
  }

  document.getElementById('units-title').textContent = level.name + ' - ' + level.title;
  document.getElementById('units-subtitle').textContent = level.subtitle + (level.wordRange ? (' · ' + level.wordRange) : '');

  this.renderUnits(level);
  this.showScreen('units');
};

// Japanese / Korean / French level selects
app.selectJapaneseLevel = function selectJapaneseLevel(levelId) {
  const level = JAPANESE_LEVELS.find(l => l.id === levelId);
  if (!level) return;

  document.getElementById('units-title').textContent = level.name + ' - ' + level.title;
  document.getElementById('units-subtitle').textContent = level.subtitle;

  this.renderUnits(level);
  this.showScreen('units');
};

app.selectKoreanLevel = function selectKoreanLevel(levelId) {
  const level = KOREAN_LEVELS.find(l => l.id === levelId);
  if (!level) return;

  document.getElementById('units-title').textContent = level.name + ' - ' + level.title;
  document.getElementById('units-subtitle').textContent = level.subtitle;

  this.renderUnits(level);
  this.showScreen('units');
};

app.selectFrenchLevel = function selectFrenchLevel(levelId) {
  const level = FRENCH_LEVELS.find(l => l.id === levelId);
  if (!level) return;

  document.getElementById('units-title').textContent = level.name + ' - ' + level.title;
  document.getElementById('units-subtitle').textContent = level.subtitle;

  this.renderUnits(level);
  this.showScreen('units');
};

// Unit click: show lesson list (generated from loaded band JSON)
app.startUnit = function startUnit(levelId, unitId) {
  console.log('[App] 📚 startUnit() called:', levelId, unitId);

  // Special unit: Tones & Pronunciation (foundation screen)
  if (unitId === 'tones' || unitId === 'tones-pronunciation' || unitId === 'tones_pronunciation') {
    console.log('[App] Opening tones screen');
    this.goToTones();
    return;
  }

  this.state.activeUnitId = unitId;
  this.state.unitsMode = 'lessons';
  this.saveState();

  // Update the header to reflect the unit
  const level = this.state.currentLevel;
  const unit = level && Array.isArray(level.units)
    ? level.units.find(u => u.id === unitId)
    : null;

  console.log('[App] Unit found:', unit ? unit.name : 'not found');

  if (unit) {
    document.getElementById('units-title').textContent = unit.name;
    document.getElementById('units-subtitle').textContent = unit.hanzi
      ? `${unit.hanzi}${unit.words ? ' · ' + unit.words + ' words' : ''}`
      : (unit.words ? unit.words + ' words' : '');
  }

  // Render lesson tiles into the existing units grid
  console.log('[App] renderLessonsForUnit exists?', typeof this.renderLessonsForUnit);
  if (typeof this.renderLessonsForUnit === 'function') {
    console.log('[App] Calling renderLessonsForUnit...');
    this.renderLessonsForUnit(unitId);
  } else {
    console.error('[App] renderLessonsForUnit is not a function!');
  }

  // Reuse the units screen as the "lesson list" view for now
  this.showScreen('units');
};

// Lesson click: open a lesson in the Lesson screen (new in-app page)
app.startLesson = function startLesson(unitId, lessonIndex) {
  console.log('[App] 🎓 startLesson() called:', unitId, lessonIndex);

  const bandData = this.state.activeBandData;
  console.log('[App] Band data:', bandData ? '✅ loaded' : '❌ missing');

  if (!bandData || !bandData.units || !bandData.units[unitId]) {
    console.error('[App] ❌ No vocab loaded for unit:', unitId);
    alert('No vocab loaded for this unit yet.');
    return;
  }

  const words = bandData.units[unitId].words;
  console.log('[App] Unit words count:', words ? words.length : 0);

  const chunkSize = 10;
  const start = lessonIndex * chunkSize;
  const lessonWords = words.slice(start, start + chunkSize);

  console.log('[App] Lesson words (sliced):', lessonWords.length, 'words');
  console.log('[App] First word:', lessonWords[0]);

  this.state.activeLesson = {
    unitId,
    lessonIndex,
    words: lessonWords
  };
  this.saveState();

  // Update lesson header if those elements exist
  const lessonTitleEl = document.getElementById('lesson-title');
  const lessonSubEl = document.getElementById('lesson-subtitle');
  if (lessonTitleEl) lessonTitleEl.textContent = `Lesson ${lessonIndex + 1}`;
  if (lessonSubEl) lessonSubEl.textContent = `${lessonWords.length} words · Listening · Learn · Practice`;

  // If the lesson screen doesn't exist yet, fail loudly so you can add it.
  const lessonScreen = document.getElementById('lesson');
  if (!lessonScreen) {
    console.error('[App] ❌ Lesson screen not found!');
    alert('Lesson screen (#lesson) is not in your HTML yet. Add a <div id="lesson" class="screen">...</div>.');
    return;
  }

  // Initialize lesson mode state
  if (!this.state.lessonMode) {
    this.state.lessonMode = 'intro';
    this.state.lessonWordIndex = 0;
  }

  console.log('[App] Calling renderLesson()...');
  // Render the full lesson screen with all modes
  this.renderLesson();

  console.log('[App] Showing lesson screen...');
  this.showScreen('lesson');
};

// ── TONES & PRONUNCIATION ──
app.goToTones = function goToTones() {
  // Ensure we are inside Mandarin context so nav visibility behaves
  if (!this.state.selectedLanguage) {
    this.state.selectedLanguage = 'mandarin';
    this.saveState();
  }

  // If you want tones to feel like part of Mandarin, keep nav visible
  this.showScreen('tones');

  // Refresh icons
  if (window.lucide) {
    setTimeout(() => lucide.createIcons(), 0);
    setTimeout(() => lucide.createIcons(), 50);
  }
};

app.playTone = function playTone(toneNumber) {
  // toneNumber: 1,2,3,4,0 (neutral)
  const tone = Number(toneNumber);

  // 1) Best UX: use dedicated recorded audio if you add it later.
  //    Expected paths:
  //      data/audio/zh/tones/ma1.mp3 ... ma4.mp3, ma0.mp3
  //    If those files don't exist yet, we fall back to WebAudio synthesis.
  const fileSrc = `data/audio/zh/tones/ma${Number.isFinite(tone) ? tone : 0}.mp3`;

  const tryFile = () => {
    try {
      const audio = new Audio(fileSrc);
      audio.preload = 'auto';
      audio.play().catch(() => this._playToneSynth(tone));
    } catch (e) {
      this._playToneSynth(tone);
    }
  };

  // Try the recorded file first, but if it 404s we synthesize.
  // We can detect 404 by fetching HEAD quickly (optional). If HEAD fails, synth.
  fetch(fileSrc, { method: 'HEAD', cache: 'no-store' })
    .then(res => (res.ok ? tryFile() : this._playToneSynth(tone)))
    .catch(() => this._playToneSynth(tone));
};

app._playToneSynth = function _playToneSynth(tone) {
  // WebAudio synth so tones actually sound different even without MP3s.
  // This is not a perfect Mandarin model, but it produces clear contour differences.

  if (!window.AudioContext && !window.webkitAudioContext) {
    this._speakToneFallback(tone);
    return;
  }

  // Keep one context and stop previous tone if a user taps quickly.
  this._tone = this._tone || {};

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!this._tone.ctx) this._tone.ctx = new AudioCtx();
  const ctx = this._tone.ctx;

  // Some browsers suspend until user gesture; clicking the button counts,
  // but resume defensively.
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  // Stop previous sound
  try {
    if (this._tone.osc) this._tone.osc.stop();
  } catch (_) {}
  try {
    if (this._tone.gain) this._tone.gain.disconnect();
  } catch (_) {}

  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  // Triangle is softer/less harsh than sine on small speakers.
  osc.type = 'triangle';

  // Envelope
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.12, now + 0.03);

  // Duration + contour
  // Base frequency is arbitrary; the contour is what matters.
  const dur = tone === 0 ? 0.45 : 0.95;
  const end = now + dur;

  const set = (t, f) => osc.frequency.setValueAtTime(f, t);
  const ramp = (t, f) => osc.frequency.linearRampToValueAtTime(f, t);

  // Contours (approx):
  // 1: high-level
  // 2: rising
  // 3: dip then rise
  // 4: falling
  // 0: short neutral
  if (tone === 1) {
    set(now, 230);
    ramp(end, 230);
  } else if (tone === 2) {
    set(now, 185);
    ramp(end, 260);
  } else if (tone === 3) {
    set(now, 220);
    ramp(now + dur * 0.45, 160);
    ramp(end, 240);
  } else if (tone === 4) {
    set(now, 270);
    ramp(end, 170);
  } else {
    set(now, 210);
    ramp(end, 205);
  }

  // Release
  gain.gain.linearRampToValueAtTime(0.0001, end);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(end + 0.02);

  this._tone.osc = osc;
  this._tone.gain = gain;
};

app._speakToneFallback = function _speakToneFallback(tone) {
  // Last-resort fallback: system TTS. (Many systems won't render tones clearly.)
  if (!('speechSynthesis' in window)) {
    alert('Audio playback is not available in this browser.');
    return;
  }

  const map = {
    1: 'mā',
    2: 'má',
    3: 'mǎ',
    4: 'mà',
    0: 'ma'
  };

  const utter = new SpeechSynthesisUtterance(map[tone] || 'ma');
  utter.lang = 'zh-CN';
  utter.rate = 0.9;
  utter.pitch = 1.0;

  try {
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  } catch (e) {
    console.error(e);
  }
};

app.goToLevelSelect = function goToLevelSelect() {
  // If we're currently showing a lesson list inside the Units screen, go back to unit list first.
  const unitsScreenActive = document.getElementById('units')?.classList.contains('active');
  if (unitsScreenActive && this.state.unitsMode === 'lessons' && this.state.currentLevel) {
    this.state.unitsMode = 'units';
    this.state.activeUnitId = null;
    this.saveState();

    // Restore the band header
    const level = this.state.currentLevel;
    document.getElementById('units-title').textContent = level.name + ' - ' + level.title;
    document.getElementById('units-subtitle').textContent = level.subtitle + (level.wordRange ? (' · ' + level.wordRange) : '');

    this.renderUnits(level);
    this.showScreen('units');
    return;
  }

  if (!this.state.selectedLanguage) {
    this.showScreen('language-select');
    return;
  }

  if (this.state.selectedLanguage === 'mandarin') this.renderLevels();
  if (this.state.selectedLanguage === 'japanese') this.renderJapaneseLevels();
  if (this.state.selectedLanguage === 'korean') this.renderKoreanLevels();
  if (this.state.selectedLanguage === 'french') this.renderFrenchLevels();

  this.updateLevelSelectHeader();
  this.showScreen('level-select');
};

app.goHome = function goHome() {
  // Return to the language hub (homepage)
  this.state.selectedLanguage = null;
  this.state.currentLevel = null;
  this.state.activeBandId = null;
  this.state.activeBandData = null;
  this.state.activeUnitId = null;
  this.state.unitsMode = 'units';
  this.saveState();

  // Ensure the language tiles are present
  this.renderLanguages();

  // Show homepage
  this.showScreen('language-select');
};

app.goToReview = function goToReview() {
  // Placeholder for review mode (coming soon)
  alert('Review mode coming soon! This will let you practice all your learned words with spaced repetition.');
};

// ── SCREEN MANAGEMENT ──
app.showScreen = function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');

  // Refresh icons after DOM changes
  if (window.lucide) {
    setTimeout(() => lucide.createIcons(), 0);
  }

  // Show bottom nav ONLY when inside a language
  const navBar = document.querySelector('.nav-bar');
  if (navBar) {
    if (id === 'language-select' || !this.state.selectedLanguage) {
      navBar.style.display = 'none';
    } else {
      navBar.style.display = 'flex';
    }
  }

  this.updateNavigation(id);
};

app.updateNavigation = function updateNavigation(activeScreen = 'level-select') {
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));

  // Home tab highlights only on the homepage (language hub)
  if (activeScreen === 'language-select') {
    const homeBtn = document.getElementById('nav-home');
    if (homeBtn) homeBtn.classList.add('active');
    return;
  }

  // Levels tab highlights when inside a language flow
  if (this.state.selectedLanguage && (activeScreen === 'level-select' || activeScreen === 'units')) {
    const levelsBtn = document.getElementById('nav-levels');
    if (levelsBtn) levelsBtn.classList.add('active');
  }
};


/*
██████████████████████████████████████████████████████████████████████████████
BOOTSTRAP
██████████████████████████████████████████████████████████████████████████████
*/

document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
