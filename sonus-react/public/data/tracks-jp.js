// ═════════════════════════════════════════════════════════════
//  JAPANESE TRACK (Real-world fluency aligned to JLPT levels)
// ═════════════════════════════════════════════════════════════

const JAPANESE_LEVELS = [
  {
    id: 'n5',
    band: 'N5',
    name: 'N5',
    title: 'Beginner Survival',
    subtitle: 'Foundations of daily Japanese',
    wordCount: 0,
    wordRange: 'Core basics',
    color: '#ef4444',
    description: 'Build functional daily communication: writing systems, core grammar, essential vocabulary.',
    units: [
      { id: 'jp-n5-1', icon: 'type', name: 'Hiragana', hanzi: 'ひらがな', words: 0 },
      { id: 'jp-n5-2', icon: 'type', name: 'Katakana', hanzi: 'カタカナ', words: 0 },
      { id: 'jp-n5-3', icon: 'message-circle', name: 'Basic Sentences', hanzi: '文型', words: 0 },
      { id: 'jp-n5-4', icon: 'shuffle', name: 'Particles I', hanzi: 'は・が・を', words: 0 },
      { id: 'jp-n5-5', icon: 'clock', name: 'Daily Life', hanzi: '日常', words: 0 },
      { id: 'jp-n5-6', icon: 'volume-2', name: 'Listening Survival', hanzi: '聴解', words: 0 }
    ]
  },
  {
    id: 'n4',
    band: 'N4',
    name: 'N4',
    title: 'Basic Fluency',
    subtitle: 'Conversational range',
    wordCount: 0,
    wordRange: 'Expanding range',
    color: '#f97316',
    description: 'Expand grammar control and conversational flexibility.',
    units: [
      { id: 'jp-n4-1', icon: 'message-square', name: 'Past & Experience', hanzi: '経験', words: 0 },
      { id: 'jp-n4-2', icon: 'shuffle', name: 'Particles II', hanzi: 'に・で・へ', words: 0 },
      { id: 'jp-n4-3', icon: 'calendar', name: 'Plans & Invitations', hanzi: '予定', words: 0 },
      { id: 'jp-n4-4', icon: 'users', name: 'Casual Speech', hanzi: '普通形', words: 0 },
      { id: 'jp-n4-5', icon: 'map', name: 'Directions & Travel', hanzi: '道案内', words: 0 },
      { id: 'jp-n4-6', icon: 'volume-2', name: 'Listening I', hanzi: '聴解', words: 0 },
      { id: 'jp-n4-7', icon: 'book-open', name: 'Reading I', hanzi: '読解', words: 0 }
    ]
  },
  {
    id: 'n3',
    band: 'N3',
    name: 'N3',
    title: 'Intermediate Bridge',
    subtitle: 'Narrative + opinion',
    wordCount: 0,
    wordRange: 'Contextual fluency',
    color: '#3b82f6',
    description: 'Handle connected speech, explanation, and moderate reading.',
    units: [
      { id: 'jp-n3-1', icon: 'git-branch', name: 'Connectors', hanzi: '接続詞', words: 0 },
      { id: 'jp-n3-2', icon: 'message-circle', name: 'Explaining & Reasons', hanzi: '理由', words: 0 },
      { id: 'jp-n3-3', icon: 'briefcase', name: 'Work Situations', hanzi: '仕事', words: 0 },
      { id: 'jp-n3-4', icon: 'layers', name: 'Honorific Basics', hanzi: '敬語入門', words: 0 },
      { id: 'jp-n3-5', icon: 'file-text', name: 'Articles & Notices', hanzi: '文章', words: 0 },
      { id: 'jp-n3-6', icon: 'volume-2', name: 'Listening II', hanzi: '聴解', words: 0 },
      { id: 'jp-n3-7', icon: 'book-open', name: 'Reading II', hanzi: '読解', words: 0 }
    ]
  },
  {
    id: 'n2',
    band: 'N2',
    name: 'N2',
    title: 'Functional Proficiency',
    subtitle: 'Work + society',
    wordCount: 0,
    wordRange: 'Professional range',
    color: '#8b5cf6',
    description: 'Operate in work and social environments with nuance.',
    units: [
      { id: 'jp-n2-1', icon: 'brain', name: 'Abstract Ideas', hanzi: '抽象概念', words: 0 },
      { id: 'jp-n2-2', icon: 'activity', name: 'Nuanced Grammar', hanzi: '文法強化', words: 0 },
      { id: 'jp-n2-3', icon: 'briefcase', name: 'Business Japanese', hanzi: 'ビジネス', words: 0 },
      { id: 'jp-n2-4', icon: 'file-text', name: 'Editorial Reading', hanzi: '社説', words: 0 },
      { id: 'jp-n2-5', icon: 'users', name: 'Social Issues', hanzi: '社会問題', words: 0 },
      { id: 'jp-n2-6', icon: 'volume-2', name: 'Listening III', hanzi: '聴解', words: 0 },
      { id: 'jp-n2-7', icon: 'book-open', name: 'Reading III', hanzi: '読解', words: 0 }
    ]
  },
  {
    id: 'n1',
    band: 'N1',
    name: 'N1',
    title: 'Advanced Expression',
    subtitle: 'Near-native comprehension',
    wordCount: 0,
    wordRange: 'High-level nuance',
    color: '#0f172a',
    description: 'Engage complex topics, abstract ideas, and fast native input.',
    units: [
      { id: 'jp-n1-1', icon: 'sparkles', name: 'Idiomatic Mastery', hanzi: '慣用表現', words: 0 },
      { id: 'jp-n1-2', icon: 'award', name: 'Precision & Register', hanzi: '語感', words: 0 },
      { id: 'jp-n1-3', icon: 'messages-square', name: 'Debate & Argument', hanzi: '討論', words: 0 },
      { id: 'jp-n1-4', icon: 'book', name: 'Literature & Essays', hanzi: '文学', words: 0 },
      { id: 'jp-n1-5', icon: 'globe', name: 'Culture & History', hanzi: '文化史', words: 0 },
      { id: 'jp-n1-6', icon: 'volume-2', name: 'Listening IV', hanzi: '聴解', words: 0 },
      { id: 'jp-n1-7', icon: 'book-open', name: 'Reading IV', hanzi: '読解', words: 0 }
    ]
  }
];
