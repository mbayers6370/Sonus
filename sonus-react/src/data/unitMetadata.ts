// Legacy Band Unit Metadata
// Defines the thematic structure, display names, and order for each unit

import type { LucideIcon } from 'lucide-react';
import {
  Users,
  Hand,
  Hash,
  Heart,
  Clock,
  Home,
  Sun,
  Utensils,
  ShoppingBag,
  MapPin,
  Navigation,
  Bus,
  BookOpen,
  BookOpenCheck,
  HelpCircle,
  Zap,
  Ruler,
  MessageSquare,
  Sparkles,
  Scale,
  Headphones,
  Mic,
} from 'lucide-react';

export interface UnitMetadata {
  id: string;
  name: string; // English name
  nativeLabel: string; // Native-script label
  description: string;
  microUnits?: string[]; // Optional sub-focus list shown for macro units
  order: number; // Display order within the band
  icon: LucideIcon; // Lucide icon component
}

const CHECKPOINT_EVERY_UNITS = 4;
type RuntimeBandLike = { units?: unknown } | null | undefined;

export function isPracticeUnitId(unitId: string) {
  return /listening$/i.test(unitId) || /speaking$/i.test(unitId);
}

export function isCheckpointUnitId(unitId: string) {
  return /^checkpoint-\d+$/i.test(unitId);
}

export function parseCheckpointIndex(unitId: string): number | null {
  const match = /^checkpoint-(\d+)$/i.exec(unitId);
  if (!match) return null;
  const idx = Number(match[1]);
  return Number.isFinite(idx) && idx > 0 ? idx : null;
}

export function formatUnitNameForDisplay(name: string | null | undefined) {
  const source = (name || '').trim();
  if (!source) return '';
  return source.replace(/^\s*U\d{1,2}\s+/i, '').trim();
}

function withCheckpointQuizzes(units: UnitMetadata[]): UnitMetadata[] {
  const sorted = [...units].sort((a, b) => a.order - b.order);
  const coreUnits = sorted.filter((unit) => !isPracticeUnitId(unit.id) && !isCheckpointUnitId(unit.id));
  const practiceUnits = sorted.filter((unit) => isPracticeUnitId(unit.id));
  const checkpointCount = Math.ceil(coreUnits.length / CHECKPOINT_EVERY_UNITS);
  const checkpoints: UnitMetadata[] = [];

  for (let idx = 1; idx <= checkpointCount; idx += 1) {
    const end = Math.min(coreUnits.length, idx * CHECKPOINT_EVERY_UNITS);
    const start = (idx - 1) * CHECKPOINT_EVERY_UNITS + 1;
    checkpoints.push({
      id: `checkpoint-${idx}`,
      name: `Checkpoint Quiz ${idx}`,
      nativeLabel: `阶段测验 ${idx}`,
      description: `Quiz review covering Units ${start} - ${end}.`,
      order: end + 0.5,
      icon: BookOpenCheck,
    });
  }

  return [...coreUnits, ...checkpoints, ...practiceUnits].sort((a, b) => a.order - b.order);
}

function displayNameFromUnitId(unitId: string) {
  return unitId
    .replace(/^[a-z]\d+-/i, '')
    .replace(/^u\d+-/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function normalizeRuntimeUnits(bandData: RuntimeBandLike) {
  const units = bandData?.units;
  if (!units) return [] as Array<{ id: string; title?: string; description?: string }>;
  if (Array.isArray(units)) {
    return units
      .filter(
        (unit): unit is { id: string; title?: string; description?: string } =>
          Boolean((unit as { id?: unknown } | null)?.id && typeof (unit as { id?: unknown }).id === 'string')
      )
      .map((unit) => ({ id: unit.id, title: unit.title, description: unit.description }));
  }
  if (!units || typeof units !== 'object') return [];
  return Object.entries(units as Record<string, unknown>).map(([id, unit]) => ({
    id,
    title: typeof (unit as { title?: unknown } | null)?.title === 'string' ? (unit as { title?: string }).title : undefined,
    description:
      typeof (unit as { description?: unknown } | null)?.description === 'string'
        ? (unit as { description?: string }).description
        : undefined,
  }));
}

function getStaticUnitsForBand(bandId: string): UnitMetadata[] {
  if (bandId === 'band1') return withCheckpointQuizzes(band1Units);
  if (bandId === 'band2') return withCheckpointQuizzes(band2Units);
  if (bandId === 'band3') return withCheckpointQuizzes(band3Units);
  if (bandId === 'band4') return withCheckpointQuizzes(band4Units);
  if (bandId === 'band5') return withCheckpointQuizzes(band5Units);
  if (bandId === 'band6') return withCheckpointQuizzes(band6Units);
  if (bandId === 'band7' || bandId === 'band8' || bandId === 'band9' || bandId === 'advanced') {
    return withCheckpointQuizzes(band79Units);
  }
  return [];
}

function buildRuntimeUnitsForBand(bandId: string, bandData: RuntimeBandLike) {
  const staticUnits = getStaticUnitsForBand(bandId);
  const runtimeUnits = normalizeRuntimeUnits(bandData).filter((unit) => unit.id !== '_unallocated');
  if (!runtimeUnits.length) return staticUnits;

  const staticById = new Map(staticUnits.map((unit) => [unit.id, unit]));
  const runtimeCore = runtimeUnits.filter((unit) => !isPracticeUnitId(unit.id) && !isCheckpointUnitId(unit.id));
  if (!runtimeCore.length) return staticUnits;

  const coreUnits: UnitMetadata[] = runtimeCore.map((unit, index) => {
    const staticMatch = staticById.get(unit.id);
    return {
      id: unit.id,
      name: (unit.title || staticMatch?.name || displayNameFromUnitId(unit.id)).trim(),
      nativeLabel: staticMatch?.nativeLabel || '',
      description: (unit.description || staticMatch?.description || 'Core vocabulary.').trim(),
      microUnits: staticMatch?.microUnits,
      order: index + 1,
      icon: staticMatch?.icon || BookOpen,
    };
  });

  const checkpointTemplates = staticUnits
    .filter((unit) => isCheckpointUnitId(unit.id))
    .sort((a, b) => a.order - b.order);
  const checkpointCount = Math.ceil(coreUnits.length / CHECKPOINT_EVERY_UNITS);
  const checkpoints: UnitMetadata[] = Array.from({ length: checkpointCount }, (_, idx) => {
    const checkpointIndex = idx + 1;
    const template = checkpointTemplates[idx];
    return {
      id: `checkpoint-${checkpointIndex}`,
      name: template?.name || `Checkpoint Quiz ${checkpointIndex}`,
      nativeLabel: template?.nativeLabel || `阶段测验 ${checkpointIndex}`,
      description:
        template?.description ||
        `Quiz review covering Units ${Math.max(1, idx * CHECKPOINT_EVERY_UNITS + 1)} - ${Math.min(coreUnits.length, checkpointIndex * CHECKPOINT_EVERY_UNITS)}.`,
      order: coreUnits.length + checkpointIndex,
      icon: template?.icon || BookOpenCheck,
    };
  });

  const interleaved: UnitMetadata[] = [];
  for (let idx = 0; idx < coreUnits.length; idx += 1) {
    interleaved.push(coreUnits[idx]);
    if ((idx + 1) % CHECKPOINT_EVERY_UNITS === 0) {
      const checkpointIdx = Math.floor((idx + 1) / CHECKPOINT_EVERY_UNITS) - 1;
      if (checkpoints[checkpointIdx]) interleaved.push(checkpoints[checkpointIdx]);
    }
  }
  if (coreUnits.length % CHECKPOINT_EVERY_UNITS !== 0 && checkpoints.length > Math.floor(coreUnits.length / CHECKPOINT_EVERY_UNITS)) {
    const finalCheckpoint = checkpoints[checkpoints.length - 1];
    if (finalCheckpoint) interleaved.push(finalCheckpoint);
  }

  const runtimePractice = runtimeUnits
    .filter((unit) => isPracticeUnitId(unit.id))
    .map((unit, index) => {
      const staticMatch = staticById.get(unit.id);
      return {
        id: unit.id,
        name: (unit.title || staticMatch?.name || displayNameFromUnitId(unit.id)).trim(),
        nativeLabel: staticMatch?.nativeLabel || '',
        description: (unit.description || staticMatch?.description || 'Skill practice.').trim(),
        order: interleaved.length + index + 1,
        icon: staticMatch?.icon || BookOpen,
      } as UnitMetadata;
    });
  const runtimePracticeIds = new Set(runtimePractice.map((unit) => unit.id));
  const staticPractice = staticUnits
    .filter((unit) => isPracticeUnitId(unit.id))
    .filter((unit) => !runtimePracticeIds.has(unit.id))
    .map((unit, index) => ({ ...unit, order: interleaved.length + runtimePractice.length + index + 1 }));

  return [...interleaved, ...runtimePractice, ...staticPractice];
}

// Elementary I (Band 1) - Aligned Units
export const band1Units: UnitMetadata[] = [
  {
    id: 'b1-pronouns',
    name: 'Personal Pronouns',
    nativeLabel: '人称代词',
    description: 'Core pronouns and reference words',
    order: 1,
    icon: Users,
  },
  {
    id: 'b1-politeness',
    name: 'Greetings & Politeness',
    nativeLabel: '问候与礼貌',
    description: 'Polite everyday phrases and responses',
    order: 2,
    icon: Hand,
  },
  {
    id: 'b1-numbers',
    name: 'Numbers',
    nativeLabel: '数字',
    description: 'Basic counting and number words',
    order: 3,
    icon: Hash,
  },
  {
    id: 'b1-time',
    name: 'Time & Dates',
    nativeLabel: '时间与日期',
    description: 'Time words, dates, and daily timing',
    order: 4,
    icon: Clock,
  },
  {
    id: 'b1-verbs-1',
    name: 'Verbs I',
    nativeLabel: '动词一',
    description: 'Core action verbs (foundation set)',
    order: 5,
    icon: Zap,
  },
  {
    id: 'b1-family',
    name: 'Family',
    nativeLabel: '家庭',
    description: 'Family members and people words',
    order: 6,
    icon: Home,
  },
  {
    id: 'b1-routine',
    name: 'Daily Life & Routine',
    nativeLabel: '日常生活',
    description: 'Daily actions, habits, and routine life',
    order: 7,
    icon: Sun,
  },
  {
    id: 'b1-food',
    name: 'Food & Drinks',
    nativeLabel: '食物与饮料',
    description: 'Food, drinks, and meal vocabulary',
    order: 8,
    icon: Utensils,
  },
  {
    id: 'b1-shopping',
    name: 'Shopping',
    nativeLabel: '购物',
    description: 'Money, prices, and shopping basics',
    order: 9,
    icon: ShoppingBag,
  },
  {
    id: 'b1-locations',
    name: 'Places & Locations',
    nativeLabel: '地点',
    description: 'Common places and location words',
    order: 10,
    icon: MapPin,
  },
  {
    id: 'b1-directions',
    name: 'Directions',
    nativeLabel: '方向',
    description: 'Direction words and spatial positions',
    order: 11,
    icon: Navigation,
  },
  {
    id: 'b1-transport',
    name: 'Transportation',
    nativeLabel: '交通',
    description: 'Transport words and travel terms',
    order: 12,
    icon: Bus,
  },
  {
    id: 'b1-school',
    name: 'School & Study',
    nativeLabel: '学校与学习',
    description: 'School people, places, and study words',
    order: 13,
    icon: BookOpen,
  },
  {
    id: 'b1-questions',
    name: 'Question Words',
    nativeLabel: '疑问词',
    description: 'Question words and key particles',
    order: 14,
    icon: HelpCircle,
  },
  {
    id: 'b1-verbs-2',
    name: 'Verbs II',
    nativeLabel: '动词二',
    description: 'Core action verbs (practice set)',
    order: 15,
    icon: Zap,
  },
  {
    id: 'b1-measure',
    name: 'Measure Words',
    nativeLabel: '量词',
    description: 'High-frequency classifiers and counters',
    order: 16,
    icon: Ruler,
  },
  {
    id: 'b1-opinions',
    name: 'Expressing Opinions',
    nativeLabel: '表达意见',
    description: 'Preference, feelings, and opinion words',
    order: 17,
    icon: MessageSquare,
  },
  {
    id: 'b1-ability',
    name: 'Ability & Permission',
    nativeLabel: '能力与许可',
    description: 'Ability and modal helper words',
    order: 18,
    icon: Sparkles,
  },
  {
    id: 'b1-verbs-3',
    name: 'Verbs III',
    nativeLabel: '动词三',
    description: 'Core action verbs (advanced set)',
    order: 19,
    icon: Zap,
  },
  {
    id: 'b1-comparison',
    name: 'Comparisons',
    nativeLabel: '比较',
    description: 'Basic comparison patterns (比, 一样)',
    order: 20,
    icon: Scale,
  },
  {
    id: 'b1-listening',
    name: 'Listening Practice',
    nativeLabel: '听力练习',
    description: 'Audio comprehension exercises',
    order: 21,
    icon: Headphones,
  },
  {
    id: 'b1-speaking',
    name: 'Speaking Practice',
    nativeLabel: '口语练习',
    description: 'Pronunciation and conversation',
    order: 22,
    icon: Mic,
  },
  // Note: b1-tones is handled separately in legacy foundation content.
];

// Elementary II (Band 2) - Aligned Units
export const band2Units: UnitMetadata[] = [
  {
    id: 'b2-grammar',
    name: 'Core Patterns',
    nativeLabel: '语法与句型',
    description: 'High-frequency sentence patterns and connectors',
    order: 1,
    icon: BookOpen,
  },
  {
    id: 'b2-quantifiers',
    name: 'Quantifiers',
    nativeLabel: '数量表达',
    description: 'Amount words and quantity-focused expressions',
    order: 2,
    icon: Scale,
  },
  {
    id: 'b2-classifiers',
    name: 'Classifiers',
    nativeLabel: '量词',
    description: 'Common measure words used with nouns',
    order: 3,
    icon: Ruler,
  },
  {
    id: 'b2-verbs-1',
    name: 'Verbs & Verb Phrases I',
    nativeLabel: '动词与动词短语一',
    description: 'Core daily verbs and high-frequency action phrases',
    order: 4,
    icon: Zap,
  },
  {
    id: 'b2-verbs-2',
    name: 'Verbs & Verb Phrases II',
    nativeLabel: '动词与动词短语二',
    description: 'Expanded action verbs for routines and communication',
    order: 5,
    icon: Zap,
  },
  {
    id: 'b2-verbs-3',
    name: 'Verbs & Verb Phrases III',
    nativeLabel: '动词与动词短语三',
    description: 'Advanced Band 2 verb usage and mixed verb phrases',
    order: 6,
    icon: Zap,
  },
  {
    id: 'b2-time',
    name: 'Time & Scheduling',
    nativeLabel: '时间安排',
    description: 'Planning, frequency, and time references',
    order: 7,
    icon: Clock,
  },
  {
    id: 'b2-home',
    name: 'Home & Community',
    nativeLabel: '家庭与社区',
    description: 'Home life, neighbors, and local context',
    order: 8,
    icon: Home,
  },
  {
    id: 'b2-food',
    name: 'Food & Eating Out',
    nativeLabel: '饮食与点餐',
    description: 'Meals, restaurants, and food preferences',
    order: 9,
    icon: Utensils,
  },
  {
    id: 'b2-shopping',
    name: 'Money & Shopping',
    nativeLabel: '购物与消费',
    description: 'Prices, payment, and shopping situations',
    order: 10,
    icon: ShoppingBag,
  },
  {
    id: 'b2-travel',
    name: 'Travel & Mobility',
    nativeLabel: '出行与交通',
    description: 'Transportation and travel communication',
    order: 11,
    icon: Bus,
  },
  {
    id: 'b2-health',
    name: 'Health & Body',
    nativeLabel: '健康与身体',
    description: 'Symptoms, care, and body-related vocabulary',
    order: 12,
    icon: Hand,
  },
  {
    id: 'b2-weather',
    name: 'Weather & Seasons',
    nativeLabel: '天气与季节',
    description: 'Weather talk and seasonal expressions',
    order: 13,
    icon: Sun,
  },
  {
    id: 'b2-social',
    name: 'Social Interaction',
    nativeLabel: '社交表达',
    description: 'Interpersonal language and social usage',
    order: 14,
    icon: Users,
  },
  {
    id: 'b2-people-social',
    name: 'People & Social Terms',
    nativeLabel: '人物与社交词汇',
    description: 'Relationships, people labels, and social references',
    order: 16,
    icon: Users,
  },
  {
    id: 'b2-places',
    name: 'Places & Nature',
    nativeLabel: '地点、方位与机构',
    description: 'Locations, directions, and institutional/place vocabulary in one unit',
    order: 15,
    icon: MapPin,
  },
  {
    id: 'b2-objects-tech',
    name: 'Objects & Tech',
    nativeLabel: '日常物品与科技',
    description: 'Everyday objects, tools, and basic technology nouns',
    order: 18,
    icon: Sparkles,
  },
  {
    id: 'b2-adjectives-feelings',
    name: 'Adjectives & Feelings',
    nativeLabel: '形容词与感受',
    description: 'Descriptive quality words and emotional states',
    order: 19,
    icon: HelpCircle,
  },
  {
    id: 'b2-general',
    name: 'General Vocabulary',
    nativeLabel: '通用词汇',
    description: 'Useful mixed vocabulary that does not belong to a tighter thematic unit',
    order: 20,
    icon: Scale,
  },
  {
    id: 'b2-listening',
    name: 'Listening Practice',
    nativeLabel: '听力练习',
    description: 'Band 2 listening drills using Band 2 vocabulary',
    order: 21,
    icon: Headphones,
  },
  {
    id: 'b2-speaking',
    name: 'Speaking Practice',
    nativeLabel: '口语练习',
    description: 'Band 2 pronunciation drills using Band 2 vocabulary',
    order: 22,
    icon: Mic,
  },
];

// Pre-Intermediate (Band 3) - Aligned Units
export const band3Units: UnitMetadata[] = [
  {
    id: 'b3-grammar',
    name: 'Grammar Expansion',
    nativeLabel: '语法进阶',
    description: 'Expanded structures and connective expressions',
    order: 1,
    icon: BookOpen,
  },
  {
    id: 'b3-workstudy',
    name: 'Work & Study',
    nativeLabel: '工作与学习',
    description: 'Academic and workplace communication',
    order: 2,
    icon: Ruler,
  },
  {
    id: 'b3-social',
    name: 'Social Life',
    nativeLabel: '社交生活',
    description: 'Daily social interaction and expression',
    order: 3,
    icon: Users,
  },
  {
    id: 'b3-food',
    name: 'Food & Lifestyle',
    nativeLabel: '饮食与生活',
    description: 'Food, habits, and lifestyle scenarios',
    order: 4,
    icon: Utensils,
  },
  {
    id: 'b3-health',
    name: 'Health & Wellbeing',
    nativeLabel: '健康与状态',
    description: 'Physical condition and health vocabulary',
    order: 5,
    icon: Hand,
  },
  {
    id: 'b3-travel',
    name: 'Travel & Navigation',
    nativeLabel: '旅行与路线',
    description: 'Travel planning and route communication',
    order: 6,
    icon: MapPin,
  },
  {
    id: 'b3-hobbies',
    name: 'Hobbies & Leisure',
    nativeLabel: '兴趣与休闲',
    description: 'Leisure activities and personal interests',
    order: 7,
    icon: Sparkles,
  },
  {
    id: 'b3-media',
    name: 'Media & Information',
    nativeLabel: '媒体与信息',
    description: 'News, content, and information language',
    order: 8,
    icon: MessageSquare,
  },
  {
    id: 'b3-feelings',
    name: 'Feelings & Opinions',
    nativeLabel: '感受与观点',
    description: 'Describing emotions and viewpoints',
    order: 9,
    icon: HelpCircle,
  },
  {
    id: 'b3-story',
    name: 'Narration & Sequence',
    nativeLabel: '叙事与顺序',
    description: 'Storytelling and sequencing expressions',
    order: 10,
    icon: Clock,
  },
  {
    id: 'b3-problems',
    name: 'Problems & Solutions',
    nativeLabel: '问题与解决',
    description: 'Challenges, causes, and response language',
    order: 11,
    icon: Scale,
  },
  {
    id: 'b3-review',
    name: 'Consolidation',
    nativeLabel: '综合复习',
    description: 'Mixed review set across Pre-Intermediate',
    order: 12,
    icon: Zap,
  },
  {
    id: 'b3-listening',
    name: 'Listening Practice',
    nativeLabel: '听力练习',
    description: 'Band 3 listening drills using Band 3 vocabulary',
    order: 13,
    icon: Headphones,
  },
  {
    id: 'b3-speaking',
    name: 'Speaking Practice',
    nativeLabel: '口语练习',
    description: 'Band 3 pronunciation drills using Band 3 vocabulary',
    order: 14,
    icon: Mic,
  },
];

// Intermediate I (Band 4) - Aligned Units
export const band4Units: UnitMetadata[] = [
  { id: 'b4-grammar', name: 'Grammar Systems', nativeLabel: '语法系统', description: 'Complex sentence patterns and grammar usage', order: 1, icon: BookOpen },
  { id: 'b4-services', name: 'Public Services', nativeLabel: '公共服务', description: 'Service encounters and formal requests', order: 2, icon: Hand },
  { id: 'b4-work', name: 'Workplace Communication', nativeLabel: '职场沟通', description: 'Professional vocabulary and collaboration language', order: 3, icon: Ruler },
  { id: 'b4-learning', name: 'Learning & Education', nativeLabel: '学习与教育', description: 'Study systems, teaching, and academic language', order: 4, icon: BookOpen },
  { id: 'b4-travel', name: 'Travel Scenarios', nativeLabel: '出行场景', description: 'Real-world travel and transportation situations', order: 5, icon: Bus },
  { id: 'b4-society', name: 'Society & Daily Affairs', nativeLabel: '社会与事务', description: 'Civic and social context vocabulary', order: 6, icon: Users },
  { id: 'b4-environment', name: 'Environment', nativeLabel: '环境', description: 'Nature, environment, and sustainability themes', order: 7, icon: Sun },
  { id: 'b4-tech', name: 'Technology', nativeLabel: '科技', description: 'Digital life and practical tech language', order: 8, icon: Zap },
  { id: 'b4-health', name: 'Health & Care', nativeLabel: '健康与护理', description: 'Health status, treatment, and wellbeing language', order: 9, icon: Home },
  { id: 'b4-opinion', name: 'Opinion & Argument', nativeLabel: '观点与论证', description: 'Opinion framing and structured expression', order: 10, icon: MessageSquare },
  { id: 'b4-narrative', name: 'Narrative Skills', nativeLabel: '叙述能力', description: 'Sequencing, explanation, and storytelling', order: 11, icon: Clock },
  { id: 'b4-review', name: 'Consolidation', nativeLabel: '综合复习', description: 'Mixed review set across Intermediate I', order: 12, icon: Scale },
  { id: 'b4-listening', name: 'Listening Practice', nativeLabel: '听力练习', description: 'Band 4 listening drills using Band 4 vocabulary', order: 13, icon: Headphones },
  { id: 'b4-speaking', name: 'Speaking Practice', nativeLabel: '口语练习', description: 'Band 4 pronunciation drills using Band 4 vocabulary', order: 14, icon: Mic },
];

// Intermediate II (Band 5) - Aligned Units
export const band5Units: UnitMetadata[] = [
  { id: 'b5-grammar', name: 'Grammar Precision', nativeLabel: '语法精炼', description: 'Nuanced grammar and high-control sentence patterns', order: 1, icon: BookOpen },
  { id: 'b5-work', name: 'Work & Projects', nativeLabel: '工作与项目', description: 'Project-oriented workplace communication', order: 2, icon: Ruler },
  { id: 'b5-finance', name: 'Finance & Economy', nativeLabel: '金融与经济', description: 'Money, business, and economic vocabulary', order: 3, icon: ShoppingBag },
  { id: 'b5-culture', name: 'Culture & Heritage', nativeLabel: '文化与传统', description: 'Cultural literacy and heritage topics', order: 4, icon: Sparkles },
  { id: 'b5-media', name: 'Media & Communication', nativeLabel: '媒体与传播', description: 'Media interpretation and communication language', order: 5, icon: MessageSquare },
  { id: 'b5-tech', name: 'Technology & Systems', nativeLabel: '科技与系统', description: 'Technical systems and digital language', order: 6, icon: Zap },
  { id: 'b5-lifestyle', name: 'Lifestyle & Habits', nativeLabel: '生活方式', description: 'Lifestyle choices and personal routines', order: 7, icon: Sun },
  { id: 'b5-relationships', name: 'Relationships', nativeLabel: '人际关系', description: 'Interpersonal nuance and social interaction', order: 8, icon: Users },
  { id: 'b5-society', name: 'Societal Topics', nativeLabel: '社会议题', description: 'Public issues and social discussion', order: 9, icon: Scale },
  { id: 'b5-nuance', name: 'Nuanced Expression', nativeLabel: '细微表达', description: 'Subtle distinctions and precise wording', order: 10, icon: HelpCircle },
  { id: 'b5-academic', name: 'Academic Language', nativeLabel: '学术语言', description: 'School, exams, and formal study contexts', order: 11, icon: BookOpen },
  { id: 'b5-news', name: 'News & Current Events', nativeLabel: '新闻时事', description: 'Reporting, headlines, and public events', order: 12, icon: MessageSquare },
  { id: 'b5-science', name: 'Science & Nature', nativeLabel: '科学与自然', description: 'Natural phenomena and scientific concepts', order: 13, icon: Zap },
  { id: 'b5-health', name: 'Health & Medicine', nativeLabel: '健康与医疗', description: 'Medical, wellness, and care vocabulary', order: 14, icon: Heart },
  { id: 'b5-abstract', name: 'Human Experience', nativeLabel: '人类经验', description: 'States, qualities, outcomes, and lived experiences', order: 15, icon: HelpCircle },
  { id: 'b5-policy', name: 'Policy & Governance', nativeLabel: '政策治理', description: 'Government, law, and institutional language', order: 16, icon: Scale },
  { id: 'b5-writing', name: 'Writing & Structure', nativeLabel: '写作与结构', description: 'Structured writing and formal composition', order: 17, icon: BookOpen },
  { id: 'b5-review', name: 'Consolidation', nativeLabel: '综合复习', description: 'Mixed review set across Intermediate II', order: 18, icon: Scale },
  { id: 'b5-listening', name: 'Listening Practice', nativeLabel: '听力练习', description: 'Band 5 listening drills using Band 5 vocabulary', order: 19, icon: Headphones },
  { id: 'b5-speaking', name: 'Speaking Practice', nativeLabel: '口语练习', description: 'Band 5 pronunciation drills using Band 5 vocabulary', order: 20, icon: Mic },
];

// Upper-Intermediate (Band 6) - Aligned Units
export const band6Units: UnitMetadata[] = [
  { id: 'b6-grammar', name: 'Advanced Grammar', nativeLabel: '高级语法', description: 'High-level grammar control and syntax', order: 1, icon: BookOpen },
  { id: 'b6-academic', name: 'Academic Language', nativeLabel: '学术语言', description: 'Academic discourse and formal explanation', order: 2, icon: Ruler },
  { id: 'b6-work', name: 'Professional Contexts', nativeLabel: '职业场景', description: 'Advanced workplace communication', order: 3, icon: Users },
  { id: 'b6-negotiation', name: 'Negotiation & Persuasion', nativeLabel: '谈判与说服', description: 'Persuasive language and negotiation strategy', order: 4, icon: MessageSquare },
  { id: 'b6-policy', name: 'Policy & Governance', nativeLabel: '政策与治理', description: 'Institutional and policy-level topics', order: 5, icon: Scale },
  { id: 'b6-news', name: 'News & Current Affairs', nativeLabel: '新闻与时事', description: 'Current events and analysis vocabulary', order: 6, icon: Clock },
  { id: 'b6-science', name: 'Science Topics', nativeLabel: '科学主题', description: 'Scientific concepts and formal terminology', order: 7, icon: Sparkles },
  { id: 'b6-tech', name: 'Technology Topics', nativeLabel: '技术主题', description: 'Technical concepts and systems language', order: 8, icon: Zap },
  { id: 'b6-culture', name: 'Culture & Thought', nativeLabel: '文化与思想', description: 'Cultural analysis and conceptual discussion', order: 9, icon: Home },
  { id: 'b6-health', name: 'Health & Society', nativeLabel: '健康与社会', description: 'Health issues in broader social context', order: 10, icon: Hand },
  { id: 'b6-human-experience', name: 'Human Experience', nativeLabel: '人类经验', description: 'Emotions, traits, outcomes, and lived experiences', order: 11, icon: HelpCircle },
  { id: 'b6-idioms', name: 'Idioms & Set Phrases', nativeLabel: '成语与固定搭配', description: 'Idiomatic expression and advanced phraseology', order: 12, icon: Hash },
  { id: 'b6-review', name: 'Consolidation', nativeLabel: '综合复习', description: 'Mixed review set across Upper-Intermediate', order: 13, icon: Scale },
  { id: 'b6-listening', name: 'Listening Practice', nativeLabel: '听力练习', description: 'Band 6 listening drills using Band 6 vocabulary', order: 14, icon: Headphones },
  { id: 'b6-speaking', name: 'Speaking Practice', nativeLabel: '口语练习', description: 'Band 6 pronunciation drills using Band 6 vocabulary', order: 15, icon: Mic },
];

// Advanced (Bands 7-9) - Shared 24-Unit Track + Practice
export const band79Units: UnitMetadata[] = [
  {
    id: 'b79-m1-cause-effect',
    name: 'Academic Thought I: Cause & Effect',
    nativeLabel: '学术思维一：因果关系',
    description: '因此、由此、导致、促成 and causal framing.',
    order: 1,
    icon: BookOpen,
  },
  {
    id: 'b79-m1-comparison-evaluation',
    name: 'Academic Thought II: Comparison & Evaluation',
    nativeLabel: '学术思维二：比较与评估',
    description: '优于、相较于、显著、值得 and evaluative language.',
    order: 2,
    icon: Scale,
  },
  {
    id: 'b79-m1-hypothesis-speculation',
    name: 'Academic Thought III: Hypothesis & Speculation',
    nativeLabel: '学术思维三：假设与推测',
    description: '假设、倘若、或许、未必 and speculative structures.',
    order: 3,
    icon: HelpCircle,
  },
  {
    id: 'b79-m2-agreement-concession',
    name: 'Argumentation I: Agreement & Concession',
    nativeLabel: '论证一：认同与让步',
    description: '固然、诚然、尽管如此 and concession language.',
    order: 4,
    icon: MessageSquare,
  },
  {
    id: 'b79-m2-emphasis-reinforcement',
    name: 'Argumentation II: Emphasis & Reinforcement',
    nativeLabel: '论证二：强调与强化',
    description: '的确、无疑、毫无疑问 and emphasis patterns.',
    order: 5,
    icon: Zap,
  },
  {
    id: 'b79-m2-counterargument',
    name: 'Argumentation III: Critique & Counterargument',
    nativeLabel: '论证三：质疑与反驳',
    description: '质疑、反驳、指出 and structured rebuttal language.',
    order: 6,
    icon: Scale,
  },
  {
    id: 'b79-m3-politics-policy',
    name: 'News & Media I: Politics & Policy',
    nativeLabel: '新闻媒体一：政治与政策',
    description: 'Government, policy, and institutional reporting vocabulary.',
    order: 7,
    icon: Users,
  },
  {
    id: 'b79-m3-economy-finance',
    name: 'News & Media II: Economy & Finance',
    nativeLabel: '新闻媒体二：经济与金融',
    description: 'Economic indicators, markets, and finance language.',
    order: 8,
    icon: ShoppingBag,
  },
  {
    id: 'b79-m3-tech-innovation',
    name: 'News & Media III: Technology & Innovation',
    nativeLabel: '新闻媒体三：科技与创新',
    description: 'Technology trends and innovation reporting language.',
    order: 9,
    icon: Sparkles,
  },
  {
    id: 'b79-m4-meetings-discussion',
    name: 'Workplace I: Meetings & Discussion',
    nativeLabel: '职场一：会议与讨论',
    description: 'Managing agendas, discussion flow, and decisions.',
    order: 10,
    icon: Ruler,
  },
  {
    id: 'b79-m4-negotiation',
    name: 'Workplace II: Negotiation Language',
    nativeLabel: '职场二：谈判表达',
    description: 'Negotiation terms, tradeoffs, and alignment language.',
    order: 11,
    icon: MessageSquare,
  },
  {
    id: 'b79-m4-formal-writing',
    name: 'Workplace III: Formal Writing Tone',
    nativeLabel: '职场三：正式书面语',
    description: 'Formal emails, reports, and written register control.',
    order: 12,
    icon: BookOpen,
  },
  {
    id: 'b79-m5-idiomatic-social',
    name: 'Social Nuance I: Idiomatic Social Expressions',
    nativeLabel: '语用一：社交习语',
    description: 'Natural social idioms and everyday advanced phrasing.',
    order: 13,
    icon: Users,
  },
  {
    id: 'b79-m5-register-shift',
    name: 'Social Nuance II: Politeness & Register Shift',
    nativeLabel: '语用二：礼貌与语域转换',
    description: 'Switching between formal and informal style accurately.',
    order: 14,
    icon: Hand,
  },
  {
    id: 'b79-m5-emotional-subtlety',
    name: 'Social Nuance III: Emotional Subtlety',
    nativeLabel: '语用三：情感细微表达',
    description: 'Fine-grained emotional and interpersonal vocabulary.',
    order: 15,
    icon: Heart,
  },
  {
    id: 'b79-m6-chengyu',
    name: 'Idioms & Literary I: High-Frequency Chengyu',
    nativeLabel: '成语一：高频成语',
    description: 'Practical high-frequency chengyu for modern contexts.',
    order: 16,
    icon: Hash,
  },
  {
    id: 'b79-m6-literary-connectors',
    name: 'Idioms & Literary II: Literary Connectors',
    nativeLabel: '成语二：书面连接表达',
    description: 'Written discourse connectors and rhetorical flow.',
    order: 17,
    icon: BookOpen,
  },
  {
    id: 'b79-m6-cultural-references',
    name: 'Idioms & Literary III: Cultural References',
    nativeLabel: '成语三：文化典故',
    description: 'Cultural/historical references used in advanced media.',
    order: 18,
    icon: Sparkles,
  },
  {
    id: 'b79-m7-nominalization',
    name: 'Advanced Grammar I: Nominalization',
    nativeLabel: '语法一：名词化结构',
    description: 'Nominalization patterns for dense formal writing.',
    order: 19,
    icon: Scale,
  },
  {
    id: 'b79-m7-passive-causative',
    name: 'Advanced Grammar II: Passive/Causative Nuance',
    nativeLabel: '语法二：被动与使动细微差异',
    description: 'Precision with passive and causative structures.',
    order: 20,
    icon: HelpCircle,
  },
  {
    id: 'b79-m7-discourse-chaining',
    name: 'Advanced Grammar III: Discourse Chaining',
    nativeLabel: '语法三：复杂句链与篇章衔接',
    description: 'Complex sentence chaining and topic-comment sophistication.',
    order: 21,
    icon: MessageSquare,
  },
  {
    id: 'b79-m8-legal',
    name: 'Specialized I: Legal Language',
    nativeLabel: '专业一：法律语汇',
    description: 'Core legal domain vocabulary and framing.',
    order: 22,
    icon: Scale,
  },
  {
    id: 'b79-m8-medical',
    name: 'Specialized II: Medical Language',
    nativeLabel: '专业二：医疗语汇',
    description: 'Medical communication and healthcare terminology.',
    order: 23,
    icon: Hand,
  },
  {
    id: 'b79-m8-business-analytics',
    name: 'Specialized III: Business Analytics',
    nativeLabel: '专业三：商业分析语汇',
    description: 'Business metrics, analysis, and strategic reporting.',
    order: 24,
    icon: Ruler,
  },
  {
    id: 'b79-listening',
    name: 'Listening Practice',
    nativeLabel: '听力练习',
    description: 'Bands 7-9 listening drills using advanced vocabulary.',
    order: 25,
    icon: Headphones,
  },
  {
    id: 'b79-speaking',
    name: 'Speaking Practice',
    nativeLabel: '口语练习',
    description: 'Bands 7-9 pronunciation drills using advanced vocabulary.',
    order: 26,
    icon: Mic,
  },
];

// Helper function to get unit metadata by ID
export function getUnitMetadata(bandId: string, unitId: string, bandData?: RuntimeBandLike): UnitMetadata | undefined {
  return getUnitsForBand(bandId, bandData).find((u) => u.id === unitId);
}

// Helper function to get all units for a band, sorted by order
export function getUnitsForBand(bandId: string, bandData?: RuntimeBandLike): UnitMetadata[] {
  if (bandData) {
    return buildRuntimeUnitsForBand(bandId, bandData);
  }
  return getStaticUnitsForBand(bandId);
}
