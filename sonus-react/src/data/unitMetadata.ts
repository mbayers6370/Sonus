// HSK 3.0 Unit Metadata
// Defines the thematic structure, display names, and order for each unit

import type { LucideIcon } from 'lucide-react';
import {
  Users,
  Hand,
  Hash,
  Clock,
  Home,
  Sun,
  Utensils,
  ShoppingBag,
  MapPin,
  Navigation,
  Bus,
  BookOpen,
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
  hanzi: string; // Chinese name
  description: string;
  order: number; // Display order within the band
  icon: LucideIcon; // Lucide icon component
}

// Elementary I (Band 1) - HSK 3.0 Aligned Units
export const band1Units: UnitMetadata[] = [
  {
    id: 'b1-pronouns',
    name: 'Personal Pronouns',
    hanzi: '人称代词',
    description: 'I, you, he, she, we, they',
    order: 1,
    icon: Users,
  },
  {
    id: 'b1-politeness',
    name: 'Greetings & Politeness',
    hanzi: '问候与礼貌',
    description: 'Hello, thank you, sorry, please',
    order: 2,
    icon: Hand,
  },
  {
    id: 'b1-numbers',
    name: 'Numbers',
    hanzi: '数字',
    description: 'Counting, prices, quantities',
    order: 3,
    icon: Hash,
  },
  {
    id: 'b1-time',
    name: 'Time & Dates',
    hanzi: '时间与日期',
    description: 'Days, months, hours, telling time',
    order: 4,
    icon: Clock,
  },
  {
    id: 'b1-family',
    name: 'Family',
    hanzi: '家庭',
    description: 'Family members and relationships',
    order: 5,
    icon: Home,
  },
  {
    id: 'b1-routine',
    name: 'Daily Routine',
    hanzi: '日常生活',
    description: 'Everyday activities and habits',
    order: 6,
    icon: Sun,
  },
  {
    id: 'b1-food',
    name: 'Food & Drinks',
    hanzi: '食物与饮料',
    description: 'Common foods, ordering, eating',
    order: 7,
    icon: Utensils,
  },
  {
    id: 'b1-shopping',
    name: 'Shopping',
    hanzi: '购物',
    description: 'Buying things, asking prices',
    order: 8,
    icon: ShoppingBag,
  },
  {
    id: 'b1-locations',
    name: 'Places & Locations',
    hanzi: '地点',
    description: 'Home, school, restaurant, hospital',
    order: 9,
    icon: MapPin,
  },
  {
    id: 'b1-directions',
    name: 'Directions',
    hanzi: '方向',
    description: 'Left, right, front, back, asking for directions',
    order: 10,
    icon: Navigation,
  },
  {
    id: 'b1-transport',
    name: 'Transportation',
    hanzi: '交通',
    description: 'Bus, taxi, train, subway, bike',
    order: 11,
    icon: Bus,
  },
  {
    id: 'b1-school',
    name: 'School & Study',
    hanzi: '学校与学习',
    description: 'Classes, homework, teachers, students',
    order: 12,
    icon: BookOpen,
  },
  {
    id: 'b1-questions',
    name: 'Question Words',
    hanzi: '疑问词',
    description: 'What, who, where, when, why, how',
    order: 13,
    icon: HelpCircle,
  },
  {
    id: 'b1-verbs',
    name: 'Common Verbs',
    hanzi: '常用动词',
    description: 'Essential action words',
    order: 14,
    icon: Zap,
  },
  {
    id: 'b1-measure',
    name: 'Measure Words',
    hanzi: '量词',
    description: '个，本，只，张，etc.',
    order: 15,
    icon: Ruler,
  },
  {
    id: 'b1-opinions',
    name: 'Expressing Opinions',
    hanzi: '表达意见',
    description: 'Like, dislike, want, need',
    order: 16,
    icon: MessageSquare,
  },
  {
    id: 'b1-ability',
    name: 'Ability & Permission',
    hanzi: '能力与许可',
    description: 'Can, may, able to',
    order: 17,
    icon: Sparkles,
  },
  {
    id: 'b1-comparison',
    name: 'Comparisons',
    hanzi: '比较',
    description: 'More than, less than, same as',
    order: 18,
    icon: Scale,
  },
  {
    id: 'b1-listening',
    name: 'Listening Practice',
    hanzi: '听力练习',
    description: 'Audio comprehension exercises',
    order: 19,
    icon: Headphones,
  },
  {
    id: 'b1-speaking',
    name: 'Speaking Practice',
    hanzi: '口语练习',
    description: 'Pronunciation and conversation',
    order: 20,
    icon: Mic,
  },
  // Note: b1-tones is handled separately (Mandarin Tones fundamentals screen)
];

// Helper function to get unit metadata by ID
export function getUnitMetadata(bandId: string, unitId: string): UnitMetadata | undefined {
  if (bandId === 'band1') {
    return band1Units.find(u => u.id === unitId);
  }
  // Add other bands as needed
  return undefined;
}

// Helper function to get all units for a band, sorted by order
export function getUnitsForBand(bandId: string): UnitMetadata[] {
  if (bandId === 'band1') {
    return [...band1Units].sort((a, b) => a.order - b.order);
  }
  // Add other bands as needed
  return [];
}
