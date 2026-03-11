// ═════════════════════════════════════════════════════════════
//  KOREAN TRACK (Real-world fluency aligned to TOPIK levels)
// ═════════════════════════════════════════════════════════════

const KOREAN_LEVELS = [
  {
    id: 'topik1',
    name: 'TOPIK 1',
    title: 'Hangul & Survival',
    subtitle: 'Read, pronounce, and handle basics',
    wordRange: 'Core basics',
    color: '#10b981',
    description: 'Learn Hangul, essential particles, core verbs, and daily phrases.',
    units: [
      { id: 'kr-t1-1', icon: 'type', name: 'Hangul', nativeLabel: '한글', words: 0 },
      { id: 'kr-t1-2', icon: 'music', name: 'Sound Rules', nativeLabel: '발음', words: 0 },
      { id: 'kr-t1-3', icon: 'message-circle', name: 'Basic Sentences', nativeLabel: '문장', words: 0 },
      { id: 'kr-t1-4', icon: 'shuffle', name: 'Particles', nativeLabel: '은/는 · 이/가 · 을/를', words: 0 },
      { id: 'kr-t1-5', icon: 'repeat', name: 'Core Verbs', nativeLabel: '동사', words: 0 },
      { id: 'kr-t1-6', icon: 'clock', name: 'Daily Life', nativeLabel: '일상', words: 0 },
      { id: 'kr-t1-7', icon: 'volume-2', name: 'Listening Survival', nativeLabel: '듣기', words: 0 }
    ]
  },
  {
    id: 'topik2',
    name: 'TOPIK 2',
    title: 'Basic Fluency',
    subtitle: 'Daily conversation range',
    wordRange: 'Expanding range',
    color: '#3b82f6',
    description: 'Expand polite speech, connectors, and practical comprehension.',
    units: [
      { id: 'kr-t2-1', icon: 'message-square', name: 'Past & Experience', nativeLabel: '경험', words: 0 },
      { id: 'kr-t2-2', icon: 'git-branch', name: 'Connectors', nativeLabel: '연결어', words: 0 },
      { id: 'kr-t2-3', icon: 'calendar', name: 'Plans & Intentions', nativeLabel: '계획', words: 0 },
      { id: 'kr-t2-4', icon: 'users', name: 'Polite Speech', nativeLabel: '존댓말', words: 0 },
      { id: 'kr-t2-5', icon: 'map', name: 'Travel & Directions', nativeLabel: '길 안내', words: 0 },
      { id: 'kr-t2-6', icon: 'volume-2', name: 'Listening I', nativeLabel: '듣기', words: 0 },
      { id: 'kr-t2-7', icon: 'book-open', name: 'Reading I', nativeLabel: '읽기', words: 0 }
    ]
  },
  {
    id: 'topik3',
    name: 'TOPIK 3',
    title: 'Intermediate Bridge',
    subtitle: 'Narrative + opinion',
    wordRange: 'Contextual fluency',
    color: '#f59e0b',
    description: 'Handle connected speech and moderate reading.',
    units: [
      { id: 'kr-t3-1', icon: 'message-circle', name: 'Narratives', nativeLabel: '이야기', words: 0 },
      { id: 'kr-t3-2', icon: 'brain', name: 'Explaining Reasons', nativeLabel: '이유 설명', words: 0 },
      { id: 'kr-t3-3', icon: 'briefcase', name: 'Work Situations', nativeLabel: '직장', words: 0 },
      { id: 'kr-t3-4', icon: 'layers', name: 'Honorific Basics', nativeLabel: '존칭', words: 0 },
      { id: 'kr-t3-5', icon: 'file-text', name: 'Articles & Notices', nativeLabel: '공지', words: 0 },
      { id: 'kr-t3-6', icon: 'volume-2', name: 'Listening II', nativeLabel: '듣기', words: 0 },
      { id: 'kr-t3-7', icon: 'book-open', name: 'Reading II', nativeLabel: '읽기', words: 0 }
    ]
  },
  {
    id: 'topik4',
    name: 'TOPIK 4',
    title: 'Functional Proficiency',
    subtitle: 'Work + society',
    wordRange: 'Professional range',
    color: '#8b5cf6',
    description: 'Operate across work and social contexts with nuance.',
    units: [
      { id: 'kr-t4-1', icon: 'activity', name: 'Nuanced Grammar', nativeLabel: '고급 문법', words: 0 },
      { id: 'kr-t4-2', icon: 'users', name: 'Social Topics', nativeLabel: '사회 문제', words: 0 },
      { id: 'kr-t4-3', icon: 'briefcase', name: 'Professional Korean', nativeLabel: '비즈니스', words: 0 },
      { id: 'kr-t4-4', icon: 'file-text', name: 'Editorial Reading', nativeLabel: '기사', words: 0 },
      { id: 'kr-t4-5', icon: 'pen-tool', name: 'Structured Writing', nativeLabel: '작문', words: 0 },
      { id: 'kr-t4-6', icon: 'volume-2', name: 'Listening III', nativeLabel: '듣기', words: 0 },
      { id: 'kr-t4-7', icon: 'book-open', name: 'Reading III', nativeLabel: '읽기', words: 0 }
    ]
  },
  {
    id: 'topik5',
    name: 'TOPIK 5',
    title: 'Advanced Range',
    subtitle: 'Abstract topics',
    wordRange: 'High-level nuance',
    color: '#0f172a',
    description: 'Engage complex topics and native-speed input.',
    units: [
      { id: 'kr-t5-1', icon: 'brain', name: 'Abstract Topics', nativeLabel: '추상 주제', words: 0 },
      { id: 'kr-t5-2', icon: 'layers', name: 'Register & Tone', nativeLabel: '어조', words: 0 },
      { id: 'kr-t5-3', icon: 'messages-square', name: 'Debate & Opinion', nativeLabel: '토론', words: 0 },
      { id: 'kr-t5-4', icon: 'book', name: 'Literature', nativeLabel: '문학', words: 0 },
      { id: 'kr-t5-5', icon: 'globe', name: 'Culture & History', nativeLabel: '문화사', words: 0 },
      { id: 'kr-t5-6', icon: 'volume-2', name: 'Listening IV', nativeLabel: '듣기', words: 0 },
      { id: 'kr-t5-7', icon: 'book-open', name: 'Reading IV', nativeLabel: '읽기', words: 0 }
    ]
  },
  {
    id: 'topik6',
    name: 'TOPIK 6',
    title: 'Near-Native Comprehension',
    subtitle: 'Precision + nuance',
    wordRange: 'Mastery',
    color: '#111827',
    description: 'Handle idioms and dense listening/reading.',
    units: [
      { id: 'kr-t6-1', icon: 'sparkles', name: 'Idiomatic Mastery', nativeLabel: '관용 표현', words: 0 },
      { id: 'kr-t6-2', icon: 'award', name: 'Precision', nativeLabel: '정확성', words: 0 },
      { id: 'kr-t6-3', icon: 'file-text', name: 'Academic Texts', nativeLabel: '학술 글', words: 0 },
      { id: 'kr-t6-4', icon: 'messages-square', name: 'Advanced Debate', nativeLabel: '고급 토론', words: 0 },
      { id: 'kr-t6-5', icon: 'brain', name: 'Subtle Nuance', nativeLabel: '미묘한 뉘앙스', words: 0 },
      { id: 'kr-t6-6', icon: 'volume-2', name: 'Listening V', nativeLabel: '듣기', words: 0 },
      { id: 'kr-t6-7', icon: 'book-open', name: 'Reading V', nativeLabel: '읽기', words: 0 }
    ]
  }
];
