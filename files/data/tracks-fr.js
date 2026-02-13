
// ═════════════════════════════════════════════════════════════
//  FRENCH TRACK (Real-world fluency aligned to CEFR levels)
// ═════════════════════════════════════════════════════════════

const FRENCH_LEVELS = [
  {
    id: 'a1',
    name: 'A1',
    title: 'Beginner',
    subtitle: 'Survival basics',
    wordRange: 'Core basics',
    color: '#10b981',
    description: 'Introduce yourself, handle daily needs, and build core grammar + pronunciation.',
    units: [
      { id: 'fr-a1-1', icon: 'message-circle', name: 'Introductions', hanzi: 'Se présenter', words: 0 },
      { id: 'fr-a1-2', icon: 'type', name: 'Pronunciation', hanzi: 'Prononciation', words: 0 },
      { id: 'fr-a1-3', icon: 'shuffle', name: 'Core Grammar', hanzi: 'Grammaire', words: 0 },
      { id: 'fr-a1-4', icon: 'clock', name: 'Daily Life', hanzi: 'Vie quotidienne', words: 0 },
      { id: 'fr-a1-5', icon: 'map-pin', name: 'Directions', hanzi: 'Directions', words: 0 },
      { id: 'fr-a1-6', icon: 'volume-2', name: 'Listening I', hanzi: 'Compréhension', words: 0 }
    ]
  },
  {
    id: 'a2',
    name: 'A2',
    title: 'Elementary',
    subtitle: 'Everyday conversations',
    wordRange: 'Expanding range',
    color: '#3b82f6',
    description: 'Talk about routines, preferences, and common situations with more flexibility.',
    units: [
      { id: 'fr-a2-1', icon: 'repeat', name: 'Tenses I', hanzi: 'Temps', words: 0 },
      { id: 'fr-a2-2', icon: 'shopping-bag', name: 'Shopping', hanzi: 'Achats', words: 0 },
      { id: 'fr-a2-3', icon: 'utensils', name: 'Dining', hanzi: 'Restaurant', words: 0 },
      { id: 'fr-a2-4', icon: 'phone', name: 'Social', hanzi: 'Social', words: 0 },
      { id: 'fr-a2-5', icon: 'volume-2', name: 'Listening II', hanzi: 'Compréhension', words: 0 }
    ]
  },
  {
    id: 'b1',
    name: 'B1',
    title: 'Intermediate',
    subtitle: 'Connected speech',
    wordRange: 'Contextual fluency',
    color: '#f59e0b',
    description: 'Handle travel, work, and longer conversations; explain plans and experiences.',
    units: [
      { id: 'fr-b1-1', icon: 'message-square', name: 'Narratives', hanzi: 'Raconter', words: 0 },
      { id: 'fr-b1-2', icon: 'git-branch', name: 'Connectors', hanzi: 'Connecteurs', words: 0 },
      { id: 'fr-b1-3', icon: 'calendar', name: 'Plans & Goals', hanzi: 'Projets', words: 0 },
      { id: 'fr-b1-4', icon: 'briefcase', name: 'Work Basics', hanzi: 'Travail', words: 0 },
      { id: 'fr-b1-5', icon: 'map', name: 'Travel & Problems', hanzi: 'Voyage', words: 0 },
      { id: 'fr-b1-6', icon: 'volume-2', name: 'Listening III', hanzi: 'Compréhension', words: 0 },
      { id: 'fr-b1-7', icon: 'book-open', name: 'Reading I', hanzi: 'Lecture', words: 0 }
    ]
  },
  {
    id: 'b2',
    name: 'B2',
    title: 'Upper Intermediate',
    subtitle: 'Opinions + nuance',
    wordRange: 'Professional range',
    color: '#8b5cf6',
    description: 'Argue a point, understand media, and operate comfortably in many settings.',
    units: [
      { id: 'fr-b2-1', icon: 'mic', name: 'Opinions', hanzi: 'Opinions', words: 0 },
      { id: 'fr-b2-2', icon: 'layers', name: 'Nuance', hanzi: 'Nuances', words: 0 },
      { id: 'fr-b2-3', icon: 'file-text', name: 'Media', hanzi: 'Presse', words: 0 },
      { id: 'fr-b2-4', icon: 'users', name: 'Social Topics', hanzi: 'Société', words: 0 },
      { id: 'fr-b2-5', icon: 'briefcase', name: 'Work & Email', hanzi: 'Professionnel', words: 0 },
      { id: 'fr-b2-6', icon: 'volume-2', name: 'Listening IV', hanzi: 'Compréhension', words: 0 },
      { id: 'fr-b2-7', icon: 'book-open', name: 'Reading II', hanzi: 'Lecture', words: 0 }
    ]
  },
  {
    id: 'c1',
    name: 'C1',
    title: 'Advanced',
    subtitle: 'Fluent comprehension',
    wordRange: 'High-level nuance',
    color: '#0f172a',
    description: 'Understand complex texts and speak fluidly with precise expression.',
    units: [
      { id: 'fr-c1-1', icon: 'brain', name: 'Abstract Ideas', hanzi: 'Idées', words: 0 },
      { id: 'fr-c1-2', icon: 'activity', name: 'Register', hanzi: 'Registre', words: 0 },
      { id: 'fr-c1-3', icon: 'pen-tool', name: 'Writing', hanzi: 'Écriture', words: 0 },
      { id: 'fr-c1-4', icon: 'file-text', name: 'Long-form Media', hanzi: 'Articles', words: 0 },
      { id: 'fr-c1-5', icon: 'book', name: 'Literature', hanzi: 'Littérature', words: 0 },
      { id: 'fr-c1-6', icon: 'volume-2', name: 'Listening V', hanzi: 'Compréhension', words: 0 },
      { id: 'fr-c1-7', icon: 'book-open', name: 'Reading III', hanzi: 'Lecture', words: 0 }
    ]
  },
  {
    id: 'c2',
    name: 'C2',
    title: 'Mastery',
    subtitle: 'Near-native range',
    wordRange: 'Mastery',
    color: '#111827',
    description: 'Handle subtle meaning, idioms, and advanced reading/listening with ease.',
    units: [
      { id: 'fr-c2-1', icon: 'sparkles', name: 'Idioms', hanzi: 'Expressions', words: 0 },
      { id: 'fr-c2-2', icon: 'award', name: 'Precision', hanzi: 'Précision', words: 0 },
      { id: 'fr-c2-3', icon: 'messages-square', name: 'Debate', hanzi: 'Débat', words: 0 },
      { id: 'fr-c2-4', icon: 'book', name: 'Literary Style', hanzi: 'Style', words: 0 },
      { id: 'fr-c2-5', icon: 'globe', name: 'Culture & History', hanzi: 'Culture', words: 0 },
      { id: 'fr-c2-6', icon: 'volume-2', name: 'Listening VI', hanzi: 'Compréhension', words: 0 },
      { id: 'fr-c2-7', icon: 'book-open', name: 'Reading IV', hanzi: 'Lecture', words: 0 }
    ]
  }
];
