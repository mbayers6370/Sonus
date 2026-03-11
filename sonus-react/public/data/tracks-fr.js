
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
      { id: 'fr-a1-1', icon: 'message-circle', name: 'Introductions', nativeLabel: 'Se présenter', words: 0 },
      { id: 'fr-a1-2', icon: 'type', name: 'Pronunciation', nativeLabel: 'Prononciation', words: 0 },
      { id: 'fr-a1-3', icon: 'shuffle', name: 'Core Grammar', nativeLabel: 'Grammaire', words: 0 },
      { id: 'fr-a1-4', icon: 'clock', name: 'Daily Life', nativeLabel: 'Vie quotidienne', words: 0 },
      { id: 'fr-a1-5', icon: 'map-pin', name: 'Directions', nativeLabel: 'Directions', words: 0 },
      { id: 'fr-a1-6', icon: 'volume-2', name: 'Listening I', nativeLabel: 'Compréhension', words: 0 }
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
      { id: 'fr-a2-1', icon: 'repeat', name: 'Tenses I', nativeLabel: 'Temps', words: 0 },
      { id: 'fr-a2-2', icon: 'shopping-bag', name: 'Shopping', nativeLabel: 'Achats', words: 0 },
      { id: 'fr-a2-3', icon: 'utensils', name: 'Dining', nativeLabel: 'Restaurant', words: 0 },
      { id: 'fr-a2-4', icon: 'phone', name: 'Social', nativeLabel: 'Social', words: 0 },
      { id: 'fr-a2-5', icon: 'volume-2', name: 'Listening II', nativeLabel: 'Compréhension', words: 0 }
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
      { id: 'fr-b1-1', icon: 'message-square', name: 'Narratives', nativeLabel: 'Raconter', words: 0 },
      { id: 'fr-b1-2', icon: 'git-branch', name: 'Connectors', nativeLabel: 'Connecteurs', words: 0 },
      { id: 'fr-b1-3', icon: 'calendar', name: 'Plans & Goals', nativeLabel: 'Projets', words: 0 },
      { id: 'fr-b1-4', icon: 'briefcase', name: 'Work Basics', nativeLabel: 'Travail', words: 0 },
      { id: 'fr-b1-5', icon: 'map', name: 'Travel & Problems', nativeLabel: 'Voyage', words: 0 },
      { id: 'fr-b1-6', icon: 'volume-2', name: 'Listening III', nativeLabel: 'Compréhension', words: 0 },
      { id: 'fr-b1-7', icon: 'book-open', name: 'Reading I', nativeLabel: 'Lecture', words: 0 }
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
      { id: 'fr-b2-1', icon: 'mic', name: 'Opinions', nativeLabel: 'Opinions', words: 0 },
      { id: 'fr-b2-2', icon: 'layers', name: 'Nuance', nativeLabel: 'Nuances', words: 0 },
      { id: 'fr-b2-3', icon: 'file-text', name: 'Media', nativeLabel: 'Presse', words: 0 },
      { id: 'fr-b2-4', icon: 'users', name: 'Social Topics', nativeLabel: 'Société', words: 0 },
      { id: 'fr-b2-5', icon: 'briefcase', name: 'Work & Email', nativeLabel: 'Professionnel', words: 0 },
      { id: 'fr-b2-6', icon: 'volume-2', name: 'Listening IV', nativeLabel: 'Compréhension', words: 0 },
      { id: 'fr-b2-7', icon: 'book-open', name: 'Reading II', nativeLabel: 'Lecture', words: 0 }
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
      { id: 'fr-c1-1', icon: 'brain', name: 'Abstract Ideas', nativeLabel: 'Idées', words: 0 },
      { id: 'fr-c1-2', icon: 'activity', name: 'Register', nativeLabel: 'Registre', words: 0 },
      { id: 'fr-c1-3', icon: 'pen-tool', name: 'Writing', nativeLabel: 'Écriture', words: 0 },
      { id: 'fr-c1-4', icon: 'file-text', name: 'Long-form Media', nativeLabel: 'Articles', words: 0 },
      { id: 'fr-c1-5', icon: 'book', name: 'Literature', nativeLabel: 'Littérature', words: 0 },
      { id: 'fr-c1-6', icon: 'volume-2', name: 'Listening V', nativeLabel: 'Compréhension', words: 0 },
      { id: 'fr-c1-7', icon: 'book-open', name: 'Reading III', nativeLabel: 'Lecture', words: 0 }
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
      { id: 'fr-c2-1', icon: 'sparkles', name: 'Idioms', nativeLabel: 'Expressions', words: 0 },
      { id: 'fr-c2-2', icon: 'award', name: 'Precision', nativeLabel: 'Précision', words: 0 },
      { id: 'fr-c2-3', icon: 'messages-square', name: 'Debate', nativeLabel: 'Débat', words: 0 },
      { id: 'fr-c2-4', icon: 'book', name: 'Literary Style', nativeLabel: 'Style', words: 0 },
      { id: 'fr-c2-5', icon: 'globe', name: 'Culture & History', nativeLabel: 'Culture', words: 0 },
      { id: 'fr-c2-6', icon: 'volume-2', name: 'Listening VI', nativeLabel: 'Compréhension', words: 0 },
      { id: 'fr-c2-7', icon: 'book-open', name: 'Reading IV', nativeLabel: 'Lecture', words: 0 }
    ]
  }
];
