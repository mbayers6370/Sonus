/*
██████████████████████████████████████████████████████████████████████████████
STATE.JS (virtual)
- app.state defaults
- app.loadState / app.saveState
██████████████████████████████████████████████████████████████████████████████
*/

const app = {
  state: {
    selectedLanguage: null,
    currentLevel: null,
    xp: 0,
    streak: 0,
    levelProgress: {}, // { band1: 45, band2: 12, ... }
    completedLevels: [], // ['band1']
    unlockedLevels: ['intro', 'band1'], // Intro + Band 1 start unlocked

    // Lesson state
    activeLesson: null,
    lessonMode: 'intro', // intro, quiz, speak
    lessonWordIndex: 0,
    lastActiveDate: null
  }
};

// Storage key (NOTE: this name is legacy from Mandarin-only; you can rename later)
app.STORAGE_KEY = 'mandarin-hsk-state';

app.loadState = function loadState() {
  const saved = localStorage.getItem(app.STORAGE_KEY);
  if (saved) {
    this.state = { ...this.state, ...JSON.parse(saved) };
  }
};

app.saveState = function saveState() {
  localStorage.setItem(app.STORAGE_KEY, JSON.stringify(this.state));
};
