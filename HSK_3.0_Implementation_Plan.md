# HSK 3.0 Elementary I - Implementation Plan

## ✅ Completed

### 1. Unit Metadata Structure
Created `src/data/unitMetadata.ts` with:
- **21 thematic units** aligned with HSK 3.0 Elementary I curriculum
- Proper Chinese names (汉字) for each unit
- Descriptive icons and display order
- Helper functions for retrieving unit data

### 2. Updated Unit Display
Modified `UnitSelect.tsx` to:
- Display units in pedagogical order (not random)
- Show proper unit names and Chinese characters
- Include thematic icons and descriptions
- Maintain existing styling and interactions

## 📋 Current HSK 3.0 Band 1 Units (in order)

1. **🎵 Tones & Pronunciation** (声调与发音) - Master the four tones and pinyin basics
2. **👥 Personal Pronouns** (人称代词) - I, you, he, she, we, they
3. **🙏 Greetings & Politeness** (问候与礼貌) - Hello, thank you, sorry, please
4. **🔢 Numbers** (数字) - Counting, prices, quantities
5. **⏰ Time & Dates** (时间与日期) - Days, months, hours, telling time
6. **👨‍👩‍👧‍👦 Family** (家庭) - Family members and relationships
7. **🌅 Daily Routine** (日常生活) - Everyday activities and habits
8. **🍜 Food & Drinks** (食物与饮料) - Common foods, ordering, eating
9. **🛍️ Shopping** (购物) - Buying things, asking prices
10. **🏠 Places & Locations** (地点) - Home, school, restaurant, hospital
11. **🧭 Directions** (方向) - Left, right, front, back, asking for directions
12. **🚌 Transportation** (交通) - Bus, taxi, train, subway, bike
13. **📚 School & Study** (学校与学习) - Classes, homework, teachers, students
14. **❓ Question Words** (疑问词) - What, who, where, when, why, how
15. **🏃 Common Verbs** (常用动词) - Essential action words
16. **📏 Measure Words** (量词) - 个，本，只，张，etc.
17. **💭 Expressing Opinions** (表达意见) - Like, dislike, want, need
18. **✨ Ability & Permission** (能力与许可) - Can, may, able to
19. **⚖️ Comparisons** (比较) - More than, less than, same as
20. **👂 Listening Practice** (听力练习) - Audio comprehension exercises
21. **🗣️ Speaking Practice** (口语练习) - Pronunciation and conversation

---

## 🎯 Next Steps

### Phase 1: Curated Lessons (HIGH PRIORITY)
**Goal:** Replace random 10-word chunking with thematic lesson planning

#### Option A: Manual Lesson Curation (Recommended)
1. **Update BandData type** to include lesson structure:
   ```typescript
   lessons: {
     [lessonId: string]: {
       id: string;
       title: string;
       description: string;
       unitId: string;
       order: number;
       wordIds: string[];
     }
   }
   ```

2. **Create lesson plans** for each unit:
   - Group words thematically (e.g., "Greetings" lesson with 你好, 再见, 谢谢, etc.)
   - Ensure 8-12 words per lesson for optimal learning
   - Consider difficulty progression within units

3. **Update startLesson function** to use curated lessons instead of simple chunking

#### Option B: Smart Auto-Chunking
- Group by part of speech (nouns, verbs, adjectives)
- Use semantic similarity (family words together)
- Consider character complexity (simpler first)

---

### Phase 2: Missed Words Tracking (MEDIUM PRIORITY)
**Goal:** Remember which words users struggle with for spaced repetition

1. **Extend AppState** in `types/lesson.types.ts`:
   ```typescript
   missedWords: {
     [wordId: string]: {
       wordId: string;
       missedCount: number;
       lastMissed: string; // ISO date
       contexts: string[]; // Lesson IDs where missed
     }
   };
   reviewQueue: string[]; // Words needing review
   ```

2. **Track mistakes** in Quiz mode:
   - Increment `missedCount` when user gets wrong answer
   - Add to `reviewQueue` after 2+ misses
   - Store context (which lesson/unit)

3. **Create review lessons**:
   - Special "Review" unit that pulls from `reviewQueue`
   - Spaced repetition algorithm (show again after 1 day, 3 days, 7 days)
   - Mix review words with new words in regular lessons

---

### Phase 3: Band Unlock Tests (LATER)
**Goal:** Require 90% accuracy to unlock next band

1. **Create assessment structure**:
   ```typescript
   bandAssessments: {
     [bandId: string]: {
       totalQuestions: number;
       passingScore: number; // 0.9 for 90%
       questions: AssessmentQuestion[];
     }
   }
   ```

2. **Build assessment UI**:
   - "Take Band Test" button after completing all units
   - Pulls random words from entire band
   - 30-50 questions covering all units
   - Multiple choice + speaking/writing prompts

3. **Unlock logic**:
   - Track assessment scores in state
   - Only unlock Band 2 after Band 1 assessment passes
   - Allow retakes with different questions

---

## 🔧 Technical Implementation Notes

### Current Lesson Flow
1. User selects Band → loads `band1.json`
2. User selects Unit → displays unit cards
3. User clicks "Start" → `startLesson(unitId, 0)` creates lesson with first 10 words
4. User navigates lesson modes (Learn, Quiz, Speak)

### Proposed Lesson Flow
1. User selects Band → loads `band1.json` + lesson metadata
2. User selects Unit → displays **lesson cards** (not just one "Start" button)
3. User clicks specific lesson → `startLesson(unitId, lessonId)` loads curated word list
4. User completes lesson → track progress, unlock next lesson
5. After unit completion → unlock unit test
6. After all units → unlock band assessment

---

## 📚 Resources

### HSK 3.0 Official Information
- [New HSK 3.0 Changes (2026)](https://www.mandarinzone.com/new-hsk-test/)
- [HSK 3.0 Explained](https://studycli.org/hsk/the-new-hsk/)
- [HSK 3.0 Band 1 Details](https://www.chinaeducenter.com/en/hsk/newhskband1.php)
- [HSK Topics & Grammar Outline](https://www.mandarintimeschool.com/post/hsk-3-0-level-1-topics-grammar)

### Key Facts
- **Band 1 (Elementary I):** 300-500 words (updated July 2026)
- **Skills:** Listening, Speaking, Reading, Writing (100 characters handwriting)
- **CEFR Level:** A1
- **Topics:** Personal info, daily routines, food, transport, hobbies, shopping, school

---

## 🚀 Immediate Next Action

**Which would you like to tackle first?**

1. **Create curated lessons** - Design 3-5 sample lessons for the "Greetings & Politeness" unit
2. **Add missed word tracking** - Implement the state management for tracking mistakes
3. **Improve unit organization** - Verify that `band1.json` words are properly allocated to the right units
4. **Something else?**

Let me know and I'll help you build it!
