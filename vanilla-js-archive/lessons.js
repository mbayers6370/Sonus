/*
██████████████████████████████████████████████████████████████████████████████
LESSONS.JS
- Complete lesson screen implementation
- Three modes: Learn (flashcards), Quiz, Speak
- Progress tracking and XP rewards
██████████████████████████████████████████████████████████████████████████████
*/

// ══════════════════════════════════════════════════════════════
// LESSON SCREEN - Full implementation with 3 modes
// ══════════════════════════════════════════════════════════════

app.renderLesson = function renderLesson() {
  console.log('[Lesson] renderLesson() called');
  const lesson = this.state.activeLesson;

  console.log('[Lesson] Active lesson:', lesson);

  if (!lesson || !lesson.words || lesson.words.length === 0) {
    console.error('[Lesson] No lesson data available');
    alert('No lesson data available');
    return;
  }

  const mode = this.state.lessonMode || 'intro'; // intro, quiz, speak
  const words = lesson.words;
  const currentIndex = this.state.lessonWordIndex || 0;

  console.log('[Lesson] Mode:', mode, 'Words:', words.length, 'Index:', currentIndex);

  const container = document.getElementById('lesson-body');
  if (!container) {
    console.error('[Lesson] Container #lesson-body not found!');
    return;
  }

  // Mode selector at top
  const modeNav = `
    <div class="lesson-mode-nav">
      <button class="lesson-mode-btn ${mode === 'intro' ? 'active' : ''}" onclick="app.setLessonMode('intro')">
        <i data-lucide="book-open"></i>
        <span>Learn</span>
      </button>
      <button class="lesson-mode-btn ${mode === 'quiz' ? 'active' : ''}" onclick="app.setLessonMode('quiz')">
        <i data-lucide="help-circle"></i>
        <span>Quiz</span>
      </button>
      <button class="lesson-mode-btn ${mode === 'speak' ? 'active' : ''}" onclick="app.setLessonMode('speak')">
        <i data-lucide="mic"></i>
        <span>Speak</span>
      </button>
    </div>
  `;

  // Render based on mode
  if (mode === 'intro') {
    container.innerHTML = modeNav + this._renderIntroMode(words, currentIndex);
  } else if (mode === 'quiz') {
    container.innerHTML = modeNav + this._renderQuizMode(words, currentIndex);
  } else if (mode === 'speak') {
    container.innerHTML = modeNav + this._renderSpeakMode(words, currentIndex);
  }

  if (window.lucide) {
    setTimeout(() => lucide.createIcons(), 10);
  }
};

// ── INTRO MODE: Flashcard style learning ──
app._renderIntroMode = function _renderIntroMode(words, idx) {
  const word = words[idx];
  const progress = `${idx + 1} / ${words.length}`;

  return `
    <div class="lesson-progress-bar">
      <div class="lesson-progress-fill" style="width: ${((idx + 1) / words.length) * 100}%"></div>
    </div>
    <div class="lesson-progress-text">${progress}</div>

    <div class="flashcard-container">
      <div class="flashcard" id="flashcard" onclick="app.flipCard()">
        <div class="flashcard-front" id="flashcard-front">
          <div class="flashcard-hanzi">${word.simp || word.trad || ''}</div>
          ${word.pinyin ? `<div class="flashcard-pinyin">${word.pinyin}</div>` : ''}
          <div class="flashcard-hint">Tap to reveal meaning</div>
        </div>
        <div class="flashcard-back" id="flashcard-back" style="display:none">
          <div class="flashcard-en">${word.en || ''}</div>
          ${word.defs && word.defs.length > 1 ? `
            <div class="flashcard-defs">
              ${word.defs.slice(0, 3).map(d => `<div class="flashcard-def">• ${d}</div>`).join('')}
            </div>
          ` : ''}
          <div class="flashcard-pos">${word.pos || ''}</div>
        </div>
      </div>
    </div>

    <div class="lesson-audio-controls">
      <button class="lesson-btn-audio" onclick="app.speakWord('${word.simp}', '${word.pinyin}')">
        <i data-lucide="volume-2"></i>
        <span>Listen</span>
      </button>
      <button class="lesson-btn-audio secondary" onclick="app.speakWord('${word.simp}', '${word.pinyin}', true)">
        <i data-lucide="gauge"></i>
        <span>Slow</span>
      </button>
    </div>

    <div class="lesson-nav-btns">
      <button class="lesson-btn ${idx === 0 ? 'disabled' : ''}"
              onclick="app.prevWord()"
              ${idx === 0 ? 'disabled' : ''}>
        <i data-lucide="chevron-left"></i>
        <span>Previous</span>
      </button>
      <button class="lesson-btn primary" onclick="app.nextWord()">
        <span>${idx < words.length - 1 ? 'Next' : 'Finish'}</span>
        <i data-lucide="chevron-right"></i>
      </button>
    </div>
  `;
};

// ── QUIZ MODE: Multiple choice ──
app._renderQuizMode = function _renderQuizMode(words, idx) {
  const word = words[idx];
  const progress = `${idx + 1} / ${words.length}`;

  // Generate 3 wrong answers from other words in this lesson
  const wrongAnswers = words
    .filter(w => w.simp !== word.simp)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map(w => w.en);

  const allChoices = [word.en, ...wrongAnswers].sort(() => Math.random() - 0.5);

  return `
    <div class="lesson-progress-bar">
      <div class="lesson-progress-fill" style="width: ${((idx + 1) / words.length) * 100}%"></div>
    </div>
    <div class="lesson-progress-text">${progress}</div>

    <div class="quiz-container">
      <div class="quiz-question">
        <div class="quiz-prompt">What does this mean?</div>
        <div class="quiz-word">
          <div class="quiz-hanzi">${word.simp || word.trad || ''}</div>
          ${word.pinyin ? `<div class="quiz-pinyin">${word.pinyin}</div>` : ''}
        </div>
        <button class="quiz-audio-btn" onclick="app.speakWord('${word.simp}', '${word.pinyin}')">
          <i data-lucide="volume-2"></i>
        </button>
      </div>

      <div class="quiz-choices" id="quiz-choices">
        ${allChoices.map((choice, i) => {
          const safeChoice = choice.replace(/'/g, '&apos;').replace(/"/g, '&quot;');
          const safeCorrect = word.en.replace(/'/g, '&apos;').replace(/"/g, '&quot;');
          return `
          <button class="quiz-choice" data-choice="${safeChoice}" data-correct="${safeCorrect}" onclick="app.selectQuizAnswer('${safeChoice}', '${safeCorrect}', this)">
            ${choice}
          </button>
        `;
        }).join('')}
      </div>

      <div class="quiz-feedback" id="quiz-feedback"></div>

      <div class="lesson-nav-btns">
        <button class="lesson-btn ${idx === 0 ? 'disabled' : ''}"
                onclick="app.prevWord()"
                ${idx === 0 ? 'disabled' : ''}>
          <i data-lucide="chevron-left"></i>
          <span>Previous</span>
        </button>
        <button class="lesson-btn primary" onclick="app.nextWord()">
          <span>${idx < words.length - 1 ? 'Next' : 'Finish'}</span>
          <i data-lucide="chevron-right"></i>
        </button>
      </div>
    </div>
  `;
};

// ── SPEAK MODE: Pronunciation practice ──
app._renderSpeakMode = function _renderSpeakMode(words, idx) {
  const word = words[idx];
  const progress = `${idx + 1} / ${words.length}`;

  return `
    <div class="lesson-progress-bar">
      <div class="lesson-progress-fill" style="width: ${((idx + 1) / words.length) * 100}%"></div>
    </div>
    <div class="lesson-progress-text">${progress}</div>

    <div class="speak-container">
      <div class="speak-instruction">Listen and repeat</div>

      <div class="speak-word">
        <div class="speak-hanzi">${word.simp || word.trad || ''}</div>
        ${word.pinyin ? `<div class="speak-pinyin">${word.pinyin}</div>` : ''}
        <div class="speak-en">${word.en || ''}</div>
      </div>

      <div class="speak-controls">
        <button class="speak-btn-listen" onclick="app.speakWord('${word.simp}', '${word.pinyin}')">
          <i data-lucide="volume-2"></i>
          <span>Listen</span>
        </button>
        <button class="speak-btn-record" onclick="app.toggleRecording(this)">
          <i data-lucide="mic"></i>
          <span>Hold to record</span>
        </button>
      </div>

      <div class="speak-tips">
        <div class="speak-tip-title">Pronunciation tips:</div>
        ${word.pinyin ? `
          <div class="speak-tip">• Break it down: ${word.pinyin.split('').join(' · ')}</div>
          <div class="speak-tip">• Listen multiple times before speaking</div>
          <div class="speak-tip">• Pay attention to tone changes</div>
        ` : ''}
      </div>

      <div class="lesson-nav-btns">
        <button class="lesson-btn ${idx === 0 ? 'disabled' : ''}"
                onclick="app.prevWord()"
                ${idx === 0 ? 'disabled' : ''}>
          <i data-lucide="chevron-left"></i>
          <span>Previous</span>
        </button>
        <button class="lesson-btn primary" onclick="app.nextWord()">
          <span>${idx < words.length - 1 ? 'Next' : 'Finish'}</span>
          <i data-lucide="chevron-right"></i>
        </button>
      </div>
    </div>
  `;
};

// ══════════════════════════════════════════════════════════════
// LESSON INTERACTION HANDLERS
// ══════════════════════════════════════════════════════════════

app.setLessonMode = function setLessonMode(mode) {
  this.state.lessonMode = mode;
  this.state.lessonWordIndex = 0; // Reset to first word when changing mode
  this.saveState();
  this.renderLesson();
};

app.flipCard = function flipCard() {
  const front = document.getElementById('flashcard-front');
  const back = document.getElementById('flashcard-back');
  if (!front || !back) return;

  if (front.style.display !== 'none') {
    front.style.display = 'none';
    back.style.display = 'block';
  } else {
    front.style.display = 'block';
    back.style.display = 'none';
  }
};

app.nextWord = function nextWord() {
  const lesson = this.state.activeLesson;
  if (!lesson) return;

  const currentIndex = this.state.lessonWordIndex || 0;

  if (currentIndex >= lesson.words.length - 1) {
    // Lesson complete
    this.completeLessonWithXP();
    return;
  }

  this.state.lessonWordIndex = currentIndex + 1;
  this.saveState();
  this.renderLesson();
};

app.prevWord = function prevWord() {
  const currentIndex = this.state.lessonWordIndex || 0;
  if (currentIndex <= 0) return;

  this.state.lessonWordIndex = currentIndex - 1;
  this.saveState();
  this.renderLesson();
};

app.selectQuizAnswer = function selectQuizAnswer(chosen, correct, buttonEl) {
  const isCorrect = chosen === correct;
  const feedback = document.getElementById('quiz-feedback');
  const choices = document.getElementById('quiz-choices');

  if (!feedback || !choices) return;

  // Disable all choices
  choices.querySelectorAll('.quiz-choice').forEach(btn => {
    btn.disabled = true;
    if (btn.textContent.trim() === correct) {
      btn.classList.add('correct');
    }
  });

  // Mark the selected answer
  buttonEl.classList.add(isCorrect ? 'correct' : 'incorrect');

  // Show feedback
  feedback.innerHTML = isCorrect
    ? '<div class="feedback-correct"><i data-lucide="check-circle"></i> Correct!</div>'
    : '<div class="feedback-incorrect"><i data-lucide="x-circle"></i> Not quite. Try again next time!</div>';

  if (window.lucide) lucide.createIcons();

  // Award XP if correct
  if (isCorrect) {
    this.state.xp = (this.state.xp || 0) + 5;
    this.saveState();
  }
};

app.speakWord = function speakWord(hanzi, pinyin, slow = false) {
  console.log('[Audio] Speaking:', hanzi, 'Pinyin:', pinyin);

  if (!('speechSynthesis' in window)) {
    alert('Text-to-speech not supported in this browser');
    return;
  }

  // Safari fix: Cancel any pending speech first
  window.speechSynthesis.cancel();

  // Get available voices
  const voices = window.speechSynthesis.getVoices();
  console.log('[Audio] Available voices:', voices.length);

  // Try to find a GOOD Chinese voice (Ting-Ting, Sin-Ji, Meijia)
  const goodChineseVoice = voices.find(v =>
    v.lang.includes('zh') && (
      v.name.includes('Ting-Ting') ||
      v.name.includes('Sin-Ji') ||
      v.name.includes('Meijia')
    )
  );

  // Fallback to any Chinese voice
  const anyChineseVoice = voices.find(v => v.lang.includes('zh'));

  // If we have a good Chinese voice OR any Chinese voice that's not Eddy, use Chinese
  // Otherwise, use pinyin with English voice
  const useChineseVoice = goodChineseVoice || (anyChineseVoice && !anyChineseVoice.name.includes('Eddy'));

  let textToSpeak, lang, voice;

  if (useChineseVoice) {
    textToSpeak = hanzi;
    lang = 'zh-CN';
    voice = useChineseVoice;
    console.log('[Audio] Using Chinese voice:', voice.name);
  } else {
    // Fallback: Use pinyin with English voice (more reliable)
    textToSpeak = pinyin || hanzi;
    lang = 'en-US';
    voice = voices.find(v => v.lang.includes('en'));
    console.log('[Audio] 🔄 Using pinyin fallback with English voice');
  }

  const utterance = new SpeechSynthesisUtterance(textToSpeak);
  utterance.lang = lang;
  utterance.rate = slow ? 0.6 : 0.9;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;
  if (voice) utterance.voice = voice;

  utterance.onerror = (e) => {
    console.error('[Audio] Speech error:', e.error);
  };

  utterance.onstart = () => {
    console.log('[Audio] ✅ Started speaking:', textToSpeak);
  };

  utterance.onend = () => {
    console.log('[Audio] ✅ Finished speaking');
  };

  try {
    // Safari requires a short delay
    setTimeout(() => {
      console.log('[Audio] Speaking now...');
      window.speechSynthesis.speak(utterance);
    }, 100);

  } catch (e) {
    console.error('[Audio] Speech synthesis error:', e);
    alert('Audio error: ' + e.message);
  }
};

// Alias for compatibility with tones screen
app.speak = function speak(text, pinyin) {
  app.speakWord(text, pinyin, false);
};

app.toggleRecording = function toggleRecording(btn) {
  // Simple placeholder for recording functionality
  // In a full implementation, you'd use MediaRecorder API
  btn.classList.toggle('recording');

  if (btn.classList.contains('recording')) {
    btn.innerHTML = '<i data-lucide="square"></i><span>Stop recording</span>';
    if (window.lucide) lucide.createIcons();

    // Simulate recording
    setTimeout(() => {
      btn.classList.remove('recording');
      btn.innerHTML = '<i data-lucide="mic"></i><span>Hold to record</span>';
      if (window.lucide) lucide.createIcons();
      alert('Recording feature coming soon!');
    }, 2000);
  }
};

app.completeLessonWithXP = function completeLessonWithXP() {
  const lesson = this.state.activeLesson;
  if (!lesson) return;

  // Award XP based on lesson completion
  const xpEarned = lesson.words.length * 10;
  this.state.xp = (this.state.xp || 0) + xpEarned;

  // Update streak
  const today = new Date().toDateString();
  const lastActive = this.state.lastActiveDate;
  if (lastActive !== today) {
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (lastActive === yesterday) {
      this.state.streak = (this.state.streak || 0) + 1;
    } else {
      this.state.streak = 1;
    }
    this.state.lastActiveDate = today;
  }

  this.saveState();

  // Show completion screen
  const container = document.getElementById('lesson-body');
  if (container) {
    container.innerHTML = `
      <div class="lesson-complete">
        <div class="complete-icon">
          <i data-lucide="trophy"></i>
        </div>
        <div class="complete-title">Lesson Complete!</div>
        <div class="complete-stats">
          <div class="complete-stat">
            <div class="complete-stat-value">+${xpEarned}</div>
            <div class="complete-stat-label">XP Earned</div>
          </div>
          <div class="complete-stat">
            <div class="complete-stat-value">${lesson.words.length}</div>
            <div class="complete-stat-label">Words Learned</div>
          </div>
          <div class="complete-stat">
            <div class="complete-stat-value">${this.state.streak || 1}</div>
            <div class="complete-stat-label">Day Streak 🔥</div>
          </div>
        </div>
        <div class="complete-actions">
          <button class="lesson-btn" onclick="app.showScreen('units')">
            <i data-lucide="arrow-left"></i>
            <span>Back to Units</span>
          </button>
          <button class="lesson-btn primary" onclick="app.restartLesson()">
            <i data-lucide="refresh-cw"></i>
            <span>Practice Again</span>
          </button>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
  }
};

app.restartLesson = function restartLesson() {
  this.state.lessonWordIndex = 0;
  this.state.lessonMode = 'intro';
  this.saveState();
  this.renderLesson();
};
