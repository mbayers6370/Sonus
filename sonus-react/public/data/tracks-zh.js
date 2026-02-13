// ═════════════════════════════════════════════════════════════
//  Mandarin TRACK
// ═════════════════════════════════════════════════════════════

const LESSON_BANDS = [
  {
    id: 'band1',
    band: 1,
    name: 'Band 1',
    title: 'Elementary I',
    subtitle: 'Foundations · Everyday Use',
    wordCount: 500,
    wordRange: '0–500',
    color: '#10b981',
    description: 'Core pronunciation, high-frequency vocabulary, and functional beginner communication.',
    units: [
      { id: 'b1-tones', icon: 'volume-2', name: 'Tones & Pronunciation', hanzi: '声调', words: 0 },

      // Tier 1 – Foundations (0–150)
      { id: 'b1-pronouns', icon: 'user', name: 'Pronouns', hanzi: '代词', words: 30 },
      { id: 'b1-verbs', icon: 'activity', name: 'Core Verbs', hanzi: '动词', words: 40 },
      { id: 'b1-questions', icon: 'help-circle', name: 'Question Words', hanzi: '疑问词', words: 20 },
      { id: 'b1-numbers', icon: 'hash', name: 'Numbers & Counting', hanzi: '数字', words: 20 },
      { id: 'b1-time', icon: 'clock', name: 'Time & Dates', hanzi: '时间', words: 20 },
      { id: 'b1-measure', icon: 'layers', name: 'Measure Words', hanzi: '量词', words: 20 },

      // Tier 2 – Everyday Life (150–300)
      { id: 'b1-family', icon: 'users', name: 'Family', hanzi: '家庭', words: 30 },
      { id: 'b1-food', icon: 'utensils', name: 'Food & Drink', hanzi: '食物', words: 30 },
      { id: 'b1-school', icon: 'book', name: 'Work & School', hanzi: '工作/学习', words: 30 },
      { id: 'b1-locations', icon: 'map-pin', name: 'Locations', hanzi: '地点', words: 30 },
      { id: 'b1-transport', icon: 'bus', name: 'Transport', hanzi: '交通', words: 20 },
      { id: 'b1-routine', icon: 'sun', name: 'Daily Routine', hanzi: '日常', words: 30 },

      // Tier 3 – Functional Communication (300–500)
      { id: 'b1-opinions', icon: 'message-circle', name: 'Opinions', hanzi: '意见', words: 30 },
      { id: 'b1-ability', icon: 'zap', name: 'Ability', hanzi: '能力', words: 20 },
      { id: 'b1-comparison', icon: 'git-compare', name: 'Comparisons', hanzi: '比较', words: 20 },
      { id: 'b1-directions', icon: 'compass', name: 'Directions', hanzi: '方向', words: 20 },
      { id: 'b1-shopping', icon: 'shopping-bag', name: 'Shopping', hanzi: '购物', words: 20 },
      { id: 'b1-politeness', icon: 'smile', name: 'Politeness', hanzi: '礼貌表达', words: 20 },

      // Practice Layer
      { id: 'b1-listening', icon: 'headphones', name: 'Listening Lab', hanzi: '听力练习', words: 0 },
      { id: 'b1-speaking', icon: 'mic', name: 'Speaking Practice', hanzi: '口语练习', words: 0 }
    ]
  },
  {
    id: 'band2',
    band: 2,
    name: 'Band 2',
    title: 'Elementary II',
    subtitle: 'Expanded daily life · Practical routines',
    wordCount: 772,
    wordRange: '500–1272',
    color: '#3b82f6',
    description: 'Expand core daily-life vocabulary and sentence patterns for real-world routines.',
    units: [
      { id: 'b2-grammar', icon: 'puzzle', name: 'Core Grammar & Particles', hanzi: '语法/助词', words: 80 },
      { id: 'b2-actions', icon: 'activity', name: 'Everyday Verbs & Actions', hanzi: '日常动词', words: 90 },
      { id: 'b2-time', icon: 'clock', name: 'Time & Scheduling', hanzi: '时间/安排', words: 60 },
      { id: 'b2-home', icon: 'home', name: 'Home & Household', hanzi: '家/家务', words: 70 },
      { id: 'b2-food', icon: 'utensils', name: 'Food & Dining', hanzi: '饮食', words: 70 },
      { id: 'b2-shopping', icon: 'shopping-bag', name: 'Shopping & Money Basics', hanzi: '购物/钱', words: 70 },
      { id: 'b2-travel', icon: 'bus', name: 'Transport & Getting Around', hanzi: '交通出行', words: 60 },
      { id: 'b2-health', icon: 'heart', name: 'Body & Health Basics', hanzi: '身体/健康', words: 60 },
      { id: 'b2-weather', icon: 'cloud', name: 'Weather & Nature', hanzi: '天气/自然', words: 50 },
      { id: 'b2-social', icon: 'users', name: 'Social Talk & Etiquette', hanzi: '社交/礼貌', words: 62 },
      { id: 'b2-directions', icon: 'compass', name: 'Directions & Locations', hanzi: '方向/地点', words: 50 },
      { id: 'b2-review', icon: 'repeat', name: 'Review & Consolidation', hanzi: '复习巩固', words: 50 },

      // 🔹 Practice Layer
      { id: 'b2-listening', icon: 'headphones', name: 'Listening Lab', hanzi: '听力练习', words: 0 },
      { id: 'b2-speaking', icon: 'mic', name: 'Speaking Practice', hanzi: '口语练习', words: 0 }
    ]
  },
  {
    id: 'band3',
    band: 3,
    name: 'Band 3',
    title: 'Elementary III',
    subtitle: 'Longer sentences · Simple narratives',
    wordCount: 973,
    wordRange: '1272–2245',
    color: '#06b6d4',
    description: 'Build the vocabulary and patterns needed for longer everyday conversations and simple storytelling.',
    units: [
      { id: 'b3-grammar', icon: 'puzzle', name: 'Grammar & Sentence Patterns', hanzi: '语法/句型', words: 90 },
      { id: 'b3-workstudy', icon: 'briefcase', name: 'Work, Study & Goals', hanzi: '工作/学习', words: 90 },
      { id: 'b3-social', icon: 'users', name: 'Relationships & Social Life', hanzi: '人际/社交', words: 80 },
      { id: 'b3-food', icon: 'utensils', name: 'Food, Cooking & Ordering', hanzi: '饮食/做饭', words: 80 },
      { id: 'b3-health', icon: 'heart', name: 'Health & Fitness', hanzi: '健康/锻炼', words: 80 },
      { id: 'b3-travel', icon: 'plane', name: 'Travel & Accommodation', hanzi: '旅行/住宿', words: 80 },
      { id: 'b3-hobbies', icon: 'coffee', name: 'Hobbies & Leisure', hanzi: '爱好/休闲', words: 80 },
      { id: 'b3-media', icon: 'smartphone', name: 'Media & Technology', hanzi: '媒体/科技', words: 80 },
      { id: 'b3-feelings', icon: 'smile', name: 'Feelings & Opinions', hanzi: '感受/意见', words: 80 },
      { id: 'b3-story', icon: 'calendar', name: 'Past Experiences & Storytelling', hanzi: '经历/叙述', words: 90 },
      { id: 'b3-problems', icon: 'alert-triangle', name: 'Problems & Solutions', hanzi: '问题/解决', words: 73 },
      { id: 'b3-review', icon: 'repeat', name: 'Review & Mixed Practice', hanzi: '复习练习', words: 70 },

      // 🔹 Practice Layer
      { id: 'b3-listening', icon: 'headphones', name: 'Listening Lab', hanzi: '听力练习', words: 0 },
      { id: 'b3-speaking', icon: 'mic', name: 'Speaking Practice', hanzi: '口语练习', words: 0 }
    ]
  },
  {
    id: 'band4',
    band: 4,
    name: 'Band 4',
    title: 'Intermediate I',
    subtitle: 'Broader topics · More structure',
    wordCount: 1000,
    wordRange: '2245–3245',
    color: '#f59e0b',
    description: 'Intermediate vocabulary and structures for services, travel, work, and clearer opinions.',
    units: [
      { id: 'b4-grammar', icon: 'puzzle', name: 'Intermediate Grammar & Structures', hanzi: '语法结构', words: 110 },
      { id: 'b4-services', icon: 'clipboard', name: 'Services & Daily Admin', hanzi: '服务/办理', words: 80 },
      { id: 'b4-work', icon: 'briefcase', name: 'Work & Professional Life', hanzi: '工作/职场', words: 90 },
      { id: 'b4-learning', icon: 'book', name: 'Education & Learning', hanzi: '教育/学习', words: 80 },
      { id: 'b4-travel', icon: 'plane', name: 'Travel & Culture', hanzi: '旅行/文化', words: 90 },
      { id: 'b4-society', icon: 'globe', name: 'Society & Current Topics', hanzi: '社会话题', words: 80 },
      { id: 'b4-environment', icon: 'leaf', name: 'Environment & Weather', hanzi: '环境/天气', words: 70 },
      { id: 'b4-tech', icon: 'wifi', name: 'Tech & Internet', hanzi: '科技/网络', words: 80 },
      { id: 'b4-health', icon: 'heart', name: 'Health & Emergencies', hanzi: '健康/紧急情况', words: 70 },
      { id: 'b4-opinion', icon: 'message-square', name: 'Opinions & Discussion', hanzi: '观点/讨论', words: 90 },
      { id: 'b4-narrative', icon: 'file-text', name: 'Narratives & Descriptions', hanzi: '叙述/描写', words: 80 },
      { id: 'b4-review', icon: 'repeat', name: 'Review & Consolidation', hanzi: '复习巩固', words: 80 },

      // 🔹 Practice Layer
      { id: 'b4-listening', icon: 'headphones', name: 'Listening Lab', hanzi: '听力练习', words: 0 },
      { id: 'b4-speaking', icon: 'mic', name: 'Speaking Practice', hanzi: '口语练习', words: 0 }
    ]
  },
  {
    id: 'band5',
    band: 5,
    name: 'Band 5',
    title: 'Intermediate II',
    subtitle: 'Richer expression · Wider range',
    wordCount: 1071,
    wordRange: '3245–4316',
    color: '#f97316',
    description: 'Richer expression for media, culture, work, and nuanced everyday topics.',
    units: [
      { id: 'b5-grammar', icon: 'puzzle', name: 'Complex Grammar & Connectors', hanzi: '复杂语法/连接词', words: 120 },
      { id: 'b5-work', icon: 'briefcase', name: 'Business & Workplace', hanzi: '职场/商务', words: 90 },
      { id: 'b5-finance', icon: 'dollar-sign', name: 'Finance & Shopping (Expanded)', hanzi: '金钱/消费', words: 80 },
      { id: 'b5-services', icon: 'clipboard', name: 'Travel & Services (Advanced)', hanzi: '旅行/服务', words: 80 },
      { id: 'b5-culture', icon: 'landmark', name: 'Culture & Traditions', hanzi: '文化/传统', words: 80 },
      { id: 'b5-media', icon: 'film', name: 'Media & Entertainment', hanzi: '媒体/娱乐', words: 80 },
      { id: 'b5-tech', icon: 'cpu', name: 'Tech & Innovation', hanzi: '科技/创新', words: 80 },
      { id: 'b5-lifestyle', icon: 'sun', name: 'Health & Lifestyle', hanzi: '健康/生活方式', words: 70 },
      { id: 'b5-relationships', icon: 'users', name: 'Relationships & Communication', hanzi: '人际/沟通', words: 80 },
      { id: 'b5-society', icon: 'globe', name: 'Society & Current Events', hanzi: '社会/时事', words: 80 },
      { id: 'b5-nuance', icon: 'message-circle', name: 'Argumentation & Nuance', hanzi: '表达/细微差别', words: 90 },
      { id: 'b5-writing', icon: 'pen-tool', name: 'Writing & Formal Messages', hanzi: '写作/正式表达', words: 71 },
      { id: 'b5-review', icon: 'repeat', name: 'Review & Synthesis', hanzi: '复习整合', words: 70 },

      // 🔹 Practice Layer
      { id: 'b5-listening', icon: 'headphones', name: 'Listening Lab', hanzi: '听力练习', words: 0 },
      { id: 'b5-speaking', icon: 'mic', name: 'Speaking Practice', hanzi: '口语练习', words: 0 }
    ]
  },
  {
    id: 'band6',
    band: 6,
    name: 'Band 6',
    title: 'Intermediate III',
    subtitle: 'Work + society · Abstract topics',
    wordCount: 1140,
    wordRange: '4316–5456',
    color: '#8b5cf6',
    description: 'Discuss work, society, and more abstract themes with stronger style and precision.',
    units: [
      { id: 'b6-grammar', icon: 'puzzle', name: 'Advanced Grammar & Style', hanzi: '高级语法/表达', words: 130 },
      { id: 'b6-academic', icon: 'book', name: 'Academic & Study Topics', hanzi: '学术/学习', words: 90 },
      { id: 'b6-work', icon: 'briefcase', name: 'Work & Projects', hanzi: '工作/项目', words: 90 },
      { id: 'b6-negotiation', icon: 'handshake', name: 'Business & Negotiation', hanzi: '商务/谈判', words: 90 },
      { id: 'b6-policy', icon: 'scale', name: 'Society & Policy', hanzi: '社会/政策', words: 90 },
      { id: 'b6-news', icon: 'newspaper', name: 'News & Media Literacy', hanzi: '新闻/媒体', words: 80 },
      { id: 'b6-science', icon: 'microscope', name: 'Environment & Science', hanzi: '环境/科学', words: 80 },
      { id: 'b6-tech', icon: 'cpu', name: 'Technology & the Future', hanzi: '科技/未来', words: 80 },
      { id: 'b6-culture', icon: 'landmark', name: 'Culture & History', hanzi: '文化/历史', words: 80 },
      { id: 'b6-health', icon: 'heart', name: 'Health & Medicine', hanzi: '健康/医疗', words: 70 },
      { id: 'b6-abstract', icon: 'brain', name: 'Abstract Concepts', hanzi: '抽象概念', words: 90 },
      { id: 'b6-idioms', icon: 'quote', name: 'Idioms & Set Phrases', hanzi: '成语/固定搭配', words: 90 },
      { id: 'b6-review', icon: 'repeat', name: 'Review & Mastery', hanzi: '复习掌握', words: 80 },

      // 🔹 Practice Layer
      { id: 'b6-listening', icon: 'headphones', name: 'Listening Lab', hanzi: '听力练习', words: 0 },
      { id: 'b6-speaking', icon: 'mic', name: 'Speaking Practice', hanzi: '口语练习', words: 0 }
    ]
  },
  {
    id: 'band7',
    band: 7,
    name: 'Band 7',
    title: 'Advanced I',
    subtitle: 'Complex topics · High range',
    wordCount: 1900,
    wordRange: '5456–7356',
    color: '#a855f7',
    description: 'Advanced vocabulary across academic, professional, and cultural domains for complex discussion.',
    units: [
      { id: 'b7-academic', icon: 'graduation-cap', name: 'Academic Vocabulary', hanzi: '学术词汇', words: 170 },
      { id: 'b7-business', icon: 'briefcase', name: 'Business & Economics', hanzi: '商务/经济', words: 160 },
      { id: 'b7-scitech', icon: 'cpu', name: 'Science & Technology', hanzi: '科学/技术', words: 160 },
      { id: 'b7-society', icon: 'globe', name: 'Society & Politics', hanzi: '社会/政治', words: 160 },
      { id: 'b7-culture', icon: 'palette', name: 'Culture & Arts', hanzi: '文化/艺术', words: 150 },
      { id: 'b7-formal', icon: 'file-text', name: 'Formal Language & Register', hanzi: '正式表达', words: 150 },
      { id: 'b7-media', icon: 'newspaper', name: 'Media & Journalism', hanzi: '媒体/新闻', words: 150 },
      { id: 'b7-rhetoric', icon: 'message-square', name: 'Argumentation & Rhetoric', hanzi: '论证/修辞', words: 170 },
      { id: 'b7-idioms', icon: 'quote', name: 'Idioms & Fixed Expressions', hanzi: '成语/搭配', words: 150 },
      { id: 'b7-reading', icon: 'book-open', name: 'Reading Themes (Advanced)', hanzi: '阅读主题', words: 150 },
      { id: 'b7-writing', icon: 'pen-tool', name: 'Writing & Presentation', hanzi: '写作/表达', words: 160 },
      { id: 'b7-review', icon: 'repeat', name: 'Review & Integration', hanzi: '复习整合', words: 170 },

      // 🔹 Practice Layer
      { id: 'b7-listening', icon: 'headphones', name: 'Listening Lab', hanzi: '听力练习', words: 0 },
      { id: 'b7-speaking', icon: 'mic', name: 'Speaking Practice', hanzi: '口语练习', words: 0 }
    ]
  },
  {
    id: 'band8',
    band: 8,
    name: 'Band 8',
    title: 'Advanced II',
    subtitle: 'Formal language · Precision',
    wordCount: 1900,
    wordRange: '7356–9256',
    color: '#64748b',
    description: 'Formal writing/speaking, higher precision, and broader vocabulary for professional and academic settings.',
    units: [
      { id: 'b8-writing', icon: 'pen-tool', name: 'Formal Writing & Style', hanzi: '正式写作', words: 180 },
      { id: 'b8-speaking', icon: 'mic', name: 'Presentations & Speaking', hanzi: '演讲/表达', words: 160 },
      { id: 'b8-business', icon: 'briefcase', name: 'Advanced Business', hanzi: '高级商务', words: 160 },
      { id: 'b8-academic', icon: 'graduation-cap', name: 'Academia & Research', hanzi: '学术/研究', words: 160 },
      { id: 'b8-law', icon: 'scale', name: 'Law & Governance', hanzi: '法律/治理', words: 150 },
      { id: 'b8-philosophy', icon: 'brain', name: 'Philosophy & Abstract Ideas', hanzi: '哲学/抽象', words: 150 },
      { id: 'b8-literature', icon: 'book-open', name: 'Literature & Narrative', hanzi: '文学/叙事', words: 160 },
      { id: 'b8-criticism', icon: 'palette', name: 'Arts & Criticism', hanzi: '艺术/评论', words: 150 },
      { id: 'b8-science', icon: 'microscope', name: 'Science & Environment', hanzi: '科学/环境', words: 150 },
      { id: 'b8-tech', icon: 'cpu', name: 'Technology & Internet Culture', hanzi: '科技/网络文化', words: 150 },
      { id: 'b8-idioms', icon: 'quote', name: 'Idioms & Chengyu', hanzi: '成语', words: 180 },
      { id: 'b8-review', icon: 'repeat', name: 'Review & Mastery', hanzi: '复习掌握', words: 150 },

      // 🔹 Practice Layer
      { id: 'b8-listening', icon: 'headphones', name: 'Listening Lab', hanzi: '听力练习', words: 0 },
      { id: 'b8-speakinglab', icon: 'mic', name: 'Speaking Practice', hanzi: '口语练习', words: 0 }
    ]
  },
  {
    id: 'band9',
    band: 9,
    name: 'Band 9',
    title: 'Advanced III',
    subtitle: 'Near-native range · Depth',
    wordCount: 1836,
    wordRange: '9256–11092',
    color: '#0f172a',
    description: 'Near-native comprehension and expression across specialized domains, nuance, and style.',
    units: [
      { id: 'b9-nuance', icon: 'sparkles', name: 'Nuance & Pragmatics', hanzi: '细微差别/语用', words: 180 },
      { id: 'b9-specialized', icon: 'grid', name: 'Specialized Domains (Mix)', hanzi: '专业领域', words: 160 },
      { id: 'b9-reading', icon: 'book-open', name: 'Advanced Reading', hanzi: '高级阅读', words: 160 },
      { id: 'b9-classical', icon: 'quote', name: 'Idioms, Allusions & Classical', hanzi: '成语/典故/文言', words: 200 },
      { id: 'b9-debate', icon: 'message-square', name: 'Debate & Persuasion', hanzi: '辩论/说服', words: 170 },
      { id: 'b9-writing', icon: 'pen-tool', name: 'Professional Writing', hanzi: '专业写作', words: 150 },
      { id: 'b9-academic', icon: 'graduation-cap', name: 'Academic Register', hanzi: '学术表达', words: 150 },
      { id: 'b9-culture', icon: 'landmark', name: 'Culture & History (Deep)', hanzi: '文化/历史', words: 150 },
      { id: 'b9-scitech', icon: 'microscope', name: 'Science & Tech (Deep)', hanzi: '科学/技术', words: 140 },
      { id: 'b9-ethics', icon: 'globe', name: 'Society & Ethics', hanzi: '社会/伦理', words: 140 },
      { id: 'b9-humor', icon: 'smile', name: 'Humor & Subtext', hanzi: '幽默/弦外之音', words: 120 },
      { id: 'b9-review', icon: 'repeat', name: 'Review & Integration', hanzi: '复习整合', words: 116 },

      // 🔹 Practice Layer
      { id: 'b9-listening', icon: 'headphones', name: 'Listening Lab', hanzi: '听力练习', words: 0 },
      { id: 'b9-speaking', icon: 'mic', name: 'Speaking Practice', hanzi: '口语练习', words: 0 }
    ]
  }
];
