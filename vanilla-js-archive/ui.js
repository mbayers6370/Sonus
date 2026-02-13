/*
██████████████████████████████████████████████████████████████████████████████
UI.JS (virtual)
- renderLanguages
- renderLevels (Mandarin)
- renderJapaneseLevels / renderKoreanLevels / renderFrenchLevels
- renderUnits
- updateLevelSelectHeader
██████████████████████████████████████████████████████████████████████████████
*/

app.updateLevelSelectHeader = function updateLevelSelectHeader() {
  const titleEl = document.getElementById('level-page-title');
  const subtitleEl = document.getElementById('level-page-subtitle');
  const lang = LANGUAGES.find(l => l.id === this.state.selectedLanguage);

  if (!titleEl || !subtitleEl || !lang) return;

  titleEl.innerHTML = `Learn<br><em>${lang.name}</em>`;
  subtitleEl.textContent = `${lang.framework} · ${lang.track}`;
};

// ── LANGUAGE SELECTION SCREEN ──
app.renderLanguages = function renderLanguages() {
  const grid = document.getElementById('language-grid');
  if (!grid) return;

  grid.innerHTML = LANGUAGES.map(lang => {
    const locked = !lang.available;

    return `
      <div class="level-card ${locked ? 'locked' : ''}" style="border-left:4px solid ${locked ? 'var(--border)' : 'var(--blue)'}"
           onclick="${locked ? '' : `app.selectLanguage('${lang.id}')`}">
        <div class="level-card-header">
          <div class="level-card-badge" style="background:${locked ? 'var(--border)' : 'var(--blue)'}20;color:${locked ? 'var(--text-med)' : 'var(--blue)'}">
            <i data-lucide="${lang.icon}" style="width:12px;height:12px"></i>
            ${lang.name}
          </div>
          ${locked
            ? '<i data-lucide="lock" style="width:16px;height:16px;color:var(--text-light)"></i>'
            : '<i data-lucide="arrow-right" style="width:16px;height:16px;color:var(--text-med)"></i>'}
        </div>

        <div class="level-card-title">${lang.name}</div>
        <div class="level-card-subtitle">${lang.native}</div>
        <div class="level-card-framework">${lang.framework} · ${lang.track}</div>

        <div class="level-card-footer">
          <div style="font-size:12px;color:var(--text-med)">
            ${locked ? 'Coming soon' : 'Start learning'}
          </div>
        </div>

        <div class="level-card-footer">
          <div class="level-card-cta">
            ${locked ? 'Coming soon' : 'Choose'}
            <i data-lucide="arrow-right" style="width:14px;height:14px"></i>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) {
    setTimeout(() => lucide.createIcons(), 10);
    setTimeout(() => lucide.createIcons(), 100);
  }
};

// ── LEVEL SELECTION SCREEN (Mandarin) ──
app.renderLevels = function renderLevels() {
  const grid = document.getElementById('level-grid');
  const st = this.state;

  grid.innerHTML = LESSON_BANDS.map(level => {
    const progress = st.levelProgress[level.id] || 0;
    const completed = st.completedLevels.includes(level.id);
    const locked = (this.state.selectedLanguage === 'mandarin')
      ? false
      : !st.unlockedLevels.includes(level.id);
    const progressPct = level.wordCount > 0 ? Math.round((progress / level.wordCount) * 100) : 0;

    return `
      <div class="level-card ${locked ? 'locked' : ''}" style="border-left:4px solid ${level.color}"
           onclick="${locked ? '' : `app.selectLevel('${level.id}')`}">
        <div class="level-card-header">
          <div class="level-card-badge" style="background:${level.color}20;color:${level.color}">
            <i data-lucide="book-open" style="width:12px;height:12px"></i>
            ${level.name}
          </div>
          ${completed
            ? '<div class="level-card-progress">✓ Complete</div>'
            : locked
              ? '<i data-lucide="lock" style="width:16px;height:16px;color:var(--text-light)"></i>'
              : progress > 0
                ? `<div class="level-card-progress">${progressPct}%</div>`
                : ''}
        </div>

        <div class="level-card-title">${level.title}</div>
        <div class="level-card-subtitle">${level.subtitle}</div>

        <div class="level-card-stats">
          <div class="level-card-stat">
            <div class="level-card-stat-value">${level.wordRange}</div>
            <div class="level-card-stat-label">Vocabulary</div>
          </div>
          <div class="level-card-stat">
            <div class="level-card-stat-value">${level.units.length}</div>
            <div class="level-card-stat-label">Units</div>
          </div>
        </div>

        <div class="level-card-footer">
          <div style="font-size:12px;color:var(--text-med)">${level.description}</div>
        </div>

        <div class="level-card-footer">
          <div class="level-card-cta">
            ${locked ? 'Complete previous level' : completed ? 'Review' : progress > 0 ? 'Continue' : 'Start learning'}
            <i data-lucide="arrow-right" style="width:14px;height:14px"></i>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Update total XP
  const xpEl = document.getElementById('total-xp');
  const stEl = document.getElementById('total-streak');
  const fillEl = document.getElementById('total-xp-fill');

  if (xpEl) xpEl.textContent = st.xp;
  if (stEl) stEl.textContent = st.streak;
  if (fillEl) fillEl.style.width = Math.min(100, (st.xp % 100)) + '%';

  // Re-init icons
  if (window.lucide) {
    setTimeout(() => lucide.createIcons(), 10);
    setTimeout(() => lucide.createIcons(), 100);
  }
};

app.renderJapaneseLevels = function renderJapaneseLevels() {
  const grid = document.getElementById('level-grid');

  grid.innerHTML = JAPANESE_LEVELS.map(level => `
    <div class="level-card" style="border-left:4px solid ${level.color}"
         onclick="app.selectJapaneseLevel('${level.id}')">
      <div class="level-card-header">
        <div class="level-card-badge" style="background:${level.color}20;color:${level.color}">
          <i data-lucide="book-open" style="width:12px;height:12px"></i>
          ${level.name}
        </div>
      </div>

      <div class="level-card-title">${level.title}</div>
      <div class="level-card-subtitle">${level.subtitle}</div>

      <div class="level-card-stats">
        <div class="level-card-stat">
          <div class="level-card-stat-value">${level.wordRange}</div>
          <div class="level-card-stat-label">Focus</div>
        </div>
      </div>

      <div class="level-card-footer">
        <div style="font-size:12px;color:var(--text-med)">${level.description}</div>
      </div>

      <div class="level-card-footer">
        <div class="level-card-cta">
          Start
          <i data-lucide="arrow-right" style="width:14px;height:14px"></i>
        </div>
      </div>
    </div>
  `).join('');

  if (window.lucide) setTimeout(() => lucide.createIcons(), 10);
};

app.renderKoreanLevels = function renderKoreanLevels() {
  const grid = document.getElementById('level-grid');

  grid.innerHTML = KOREAN_LEVELS.map(level => `
    <div class="level-card" style="border-left:4px solid ${level.color}"
         onclick="app.selectKoreanLevel('${level.id}')">
      <div class="level-card-header">
        <div class="level-card-badge" style="background:${level.color}20;color:${level.color}">
          <i data-lucide="book-open" style="width:12px;height:12px"></i>
          ${level.name}
        </div>
      </div>

      <div class="level-card-title">${level.title}</div>
      <div class="level-card-subtitle">${level.subtitle}</div>

      <div class="level-card-stats">
        <div class="level-card-stat">
          <div class="level-card-stat-value">${level.wordRange}</div>
          <div class="level-card-stat-label">Focus</div>
        </div>
      </div>

      <div class="level-card-footer">
        <div style="font-size:12px;color:var(--text-med)">${level.description}</div>
      </div>

      <div class="level-card-footer">
        <div class="level-card-cta">
          Start
          <i data-lucide="arrow-right" style="width:14px;height:14px"></i>
        </div>
      </div>
    </div>
  `).join('');

  if (window.lucide) setTimeout(() => lucide.createIcons(), 10);
};

app.renderFrenchLevels = function renderFrenchLevels() {
  const grid = document.getElementById('level-grid');

  grid.innerHTML = FRENCH_LEVELS.map(level => `
    <div class="level-card" style="border-left:4px solid ${level.color}"
         onclick="app.selectFrenchLevel('${level.id}')">
      <div class="level-card-header">
        <div class="level-card-badge" style="background:${level.color}20;color:${level.color}">
          <i data-lucide="book-open" style="width:12px;height:12px"></i>
          ${level.name}
        </div>
      </div>

      <div class="level-card-title">${level.title}</div>
      <div class="level-card-subtitle">${level.subtitle}</div>

      <div class="level-card-stats">
        <div class="level-card-stat">
          <div class="level-card-stat-value">${level.wordRange}</div>
          <div class="level-card-stat-label">Focus</div>
        </div>
      </div>

      <div class="level-card-footer">
        <div style="font-size:12px;color:var(--text-med)">${level.description}</div>
      </div>

      <div class="level-card-footer">
        <div class="level-card-cta">
          Start
          <i data-lucide="arrow-right" style="width:14px;height:14px"></i>
        </div>
      </div>
    </div>
  `).join('');

  if (window.lucide) setTimeout(() => lucide.createIcons(), 10);
};

// ── UNITS SCREEN ──
app.renderUnits = function renderUnits(level) {
  const grid = document.getElementById('unit-grid');

  grid.innerHTML = level.units.map((unit, idx) => {
    const locked = (this.state.selectedLanguage === 'mandarin')
      ? false
      : (idx > 0 && !this.state.completedLevels.includes(level.id + '-unit-' + (idx - 1)));
    const completed = this.state.completedLevels.includes(level.id + '-unit-' + idx);

    return `
      <div class="unit-card ${locked ? 'locked' : ''} ${completed ? 'complete' : ''}"
           onclick="${locked ? '' : (String(unit.id).toLowerCase().includes('tone') || String(unit.id).toLowerCase().includes('pronun') || String(unit.name).toLowerCase().includes('tone') || String(unit.name).toLowerCase().includes('pronun')) ? 'app.goToTones()' : `app.startUnit('${level.id}', '${unit.id}')`}">
        <div class="unit-icon">
          <i data-lucide="${unit.icon}" style="width:32px;height:32px;stroke-width:1.5"></i>
        </div>
        <div class="unit-name">${unit.name}</div>
        <div class="unit-hanzi">${unit.hanzi}</div>
        ${
          locked
            ? '<div class="unit-progress"><i data-lucide="lock" style="width:14px;height:14px;color:var(--text-light)"></i></div>'
            : completed
              ? '<div class="unit-progress"><i data-lucide="check-circle" style="width:16px;height:16px;color:var(--blue)"></i></div>'
              : (() => {
                  const bandData = this.state.activeBandData;
                  if (!bandData || !bandData.units || !bandData.units[unit.id]) {
                    return unit.words > 0
                      ? `<div class="unit-progress">${unit.words} words</div>`
                      : '<div class="unit-progress">Reference</div>';
                  }
                  const realCount = bandData.units[unit.id].words.length;
                  return `<div class="unit-progress">${realCount} words</div>`;
                })()
        }
      </div>
    `;
  }).join('');

  if (window.lucide) {
    setTimeout(() => lucide.createIcons(), 10);
    setTimeout(() => lucide.createIcons(), 100);
  }
};

// ── LESSONS (dynamic from band JSON) ──
app.renderLessonsForUnit = function renderLessonsForUnit(unitId) {
  console.log('[UI] renderLessonsForUnit called for:', unitId);

  const bandData = this.state.activeBandData;
  if (!bandData || !bandData.units || !bandData.units[unitId]) {
    console.error('[UI] No band data for unit:', unitId);
    return;
  }

  const words = bandData.units[unitId].words;
  console.log('[UI] Unit has', words.length, 'words');

  const chunkSize = 10;
  const lessons = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    lessons.push(words.slice(i, i + chunkSize));
  }

  console.log('[UI] Created', lessons.length, 'lesson tiles');

  const grid = document.getElementById('unit-grid');
  if (!grid) {
    console.error('[UI] unit-grid not found!');
    return;
  }

  grid.innerHTML = lessons.map((lessonWords, idx) => `
    <div class="unit-card" onclick="console.log('Lesson clicked:', ${idx}); app.startLesson('${unitId}', ${idx});">
      <div class="unit-icon">
        <i data-lucide="book-open" style="width:32px;height:32px;stroke-width:1.5"></i>
      </div>
      <div class="unit-name">Lesson ${idx + 1}</div>
      <div class="unit-hanzi">${lessonWords.length} words</div>
      <div class="unit-progress">Listening · Learn · Practice</div>
    </div>
  `).join('');

  console.log('[UI] Lesson tiles rendered');

  if (window.lucide) {
    setTimeout(() => lucide.createIcons(), 10);
    setTimeout(() => lucide.createIcons(), 100);
  }

};

// ── TONES & PRONUNCIATION SCREEN ──
app.renderTones = function renderTones() {
  const tonesEl = document.getElementById('tones');
  if (!tonesEl) return;

  // Replace the screen contents so the layout is consistent and fully controlled
  tonesEl.innerHTML = `
    <div class="tones-header">
      <button class="back-btn" onclick="app.goBackFromTones()">
        <i data-lucide="arrow-left"></i>
        <span>Back</span>
      </button>

      <div class="tones-kicker">REFERENCE</div>
      <div class="tones-title">The Four <em>Tones</em></div>
      <div class="tones-subtitle">Listen • Imitate • Then test yourself</div>
    </div>

    <div class="tones-content">
      ${[
        {
          n: 1,
          name: 'First Tone',
          descTitle: 'Stay high and flat.',
          desc: 'Like holding a musical note. Think “Ahhh” at the doctor — level, sustained, and high.',
          mark: 'ā',
          ex: [
            { hanzi: '妈', pinyin: 'mā', gloss: 'mom' },
            { hanzi: '三', pinyin: 'sān', gloss: 'three' },
            { hanzi: '书', pinyin: 'shū', gloss: 'book' },
            { hanzi: '吃', pinyin: 'chī', gloss: 'eat' },
          ],
          color: 'tone-red'
        },
        {
          n: 2,
          name: 'Second Tone',
          descTitle: 'Rise like a question.',
          desc: 'Your voice naturally goes up, like saying “What?” in surprise. Start mid, end high.',
          mark: 'á',
          ex: [
            { hanzi: '来', pinyin: 'lái', gloss: 'come' },
            { hanzi: '人', pinyin: 'rén', gloss: 'person' },
            { hanzi: '年', pinyin: 'nián', gloss: 'year' },
            { hanzi: '明', pinyin: 'míng', gloss: 'bright' },
          ],
          color: 'tone-orange'
        },
        {
          n: 3,
          name: 'Third Tone',
          descTitle: 'Dip, then rise.',
          desc: 'It falls low, then comes back up. Think of a thoughtful “uhh…” — low, then returning.',
          mark: 'ǎ',
          ex: [
            { hanzi: '我', pinyin: 'wǒ', gloss: 'I / me' },
            { hanzi: '你', pinyin: 'nǐ', gloss: 'you' },
            { hanzi: '好', pinyin: 'hǎo', gloss: 'good' },
            { hanzi: '很', pinyin: 'hěn', gloss: 'very' },
          ],
          color: 'tone-green'
        },
        {
          n: 4,
          name: 'Fourth Tone',
          descTitle: 'Drop sharply.',
          desc: 'Like a firm command. Think “No!” — strong, fast, and falling.',
          mark: 'à',
          ex: [
            { hanzi: '是', pinyin: 'shì', gloss: 'to be' },
            { hanzi: '不', pinyin: 'bù', gloss: 'not' },
            { hanzi: '大', pinyin: 'dà', gloss: 'big' },
            { hanzi: '见', pinyin: 'jiàn', gloss: 'see' },
          ],
          color: 'tone-blue'
        },
      ].map(t => `
        <div class="tone-card ${t.color}">
          <div class="tone-card-top">
            <div class="tone-num">${t.n}</div>
            <div class="tone-meta">
              <div class="tone-name">${t.name}</div>
              <div class="tone-tag">${t.n === 1 ? 'HIGH • LEVEL' : t.n === 2 ? 'RISING' : t.n === 3 ? 'DIP • RISE' : 'FALLING'}</div>
            </div>
            <div class="tone-mark">${t.mark}</div>
          </div>

          <div class="tone-desc">
            <div class="tone-desc-strong">${t.descTitle}</div>
            <div class="tone-desc-text">${t.desc}</div>
          </div>

          <div class="tone-actions">
            <button class="tone-play" onclick="app.playTone(${t.n})">
              <i data-lucide="volume-2"></i>
              <span>Play tone</span>
            </button>
            <button class="tone-play secondary" onclick="app.playToneExample(${t.n})">
              <i data-lucide="sparkles"></i>
              <span>Play examples</span>
            </button>
          </div>

          <div class="tone-examples">
            ${t.ex.map(w => `
              <div class="tone-example" onclick="app.speak('${w.hanzi}','${w.pinyin}')">
                <div class="ex-hanzi">${w.hanzi}</div>
                <div class="ex-pinyin">${w.pinyin}</div>
                <div class="ex-gloss">${w.gloss}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;

  if (window.lucide) {
    setTimeout(() => lucide.createIcons(), 10);
    setTimeout(() => lucide.createIcons(), 100);
  }
};

