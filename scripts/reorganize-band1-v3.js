#!/usr/bin/env node

/**
 * Band 1 Reorganization v3 - STRICT Rules with Manual Overrides
 *
 * This version uses:
 * 1. Manual overrides file (you can manually assign specific words)
 * 2. Strict POS + exact match rules
 * 3. Semantic matching ONLY for nouns (safest category)
 * 4. Everything else goes to review queue
 */

const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '../sonus-react/public/data/zh/band1.json');
const overridesPath = path.join(__dirname, 'manual-overrides.json');
const outputPath = path.join(__dirname, 'reorganize-results-v3.json');

console.log('📚 Reading band1.json...');
const bandData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

// Load manual overrides if they exist
let manualOverrides = {};
if (fs.existsSync(overridesPath)) {
  console.log('📝 Loading manual overrides...');
  manualOverrides = JSON.parse(fs.readFileSync(overridesPath, 'utf8'));
}

// Extract all words
const allWords = [];
for (const [unitId, unit] of Object.entries(bandData.units)) {
  if (unitId === '_unallocated') continue;
  for (const word of unit.words) {
    allWords.push(word);
  }
}

console.log(`Found ${allWords.length} total words\n`);

// STRICT CATEGORIZATION RULES
// Only categorize if we're 100% certain

const EXACT_ASSIGNMENTS = {
  // Pronouns - ONLY actual pronouns
  'b1-pronouns': ['我', '你', '您', '他', '她', '它', '我们', '你们', '他们', '她们', '咱们', '这', '那', '这个', '那个', '哪', '哪个', '谁', '什么', '哪里', '那里', '这里'],

  // Numbers - ONLY numbers and classifiers
  'b1-numbers': ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '零', '百', '千', '万', '第', '号', '次', '岁', '块', '元', '角', '分', '些', '点'],

  // Time - ONLY time words
  'b1-time': ['年', '月', '日', '天', '星期', '周', '小时', '分钟', '秒', '今天', '明天', '昨天', '上午', '下午', '晚上', '早上', '中午', '现在', '以前', '以后', '时候', '时间', '早', '晚'],

  // Family - ONLY family members
  'b1-family': ['爸爸', '妈妈', '父亲', '母亲', '儿子', '女儿', '哥哥', '姐姐', '弟弟', '妹妹', '爷爷', '奶奶', '外公', '外婆', '家人', '孩子'],

  // Politeness phrases
  'b1-politeness': ['请', '谢谢', '对不起', '不好意思', '没关系', '再见', '您好', '你好', '欢迎', '请问', '麻烦'],

  // Greetings
  'b1-greetings': ['你好', '您好', '早上好', '晚上好', '再见', '拜拜', '明天见']
};

// SEMANTIC RULES - Only for nouns with clear keywords
const NOUN_CATEGORIES = {
  'b1-food': {
    pos: ['N'],
    keywords: ['rice', 'noodle', 'meat', 'fish', 'vegetable', 'fruit', 'tea', 'coffee', 'water', 'milk', 'bread', 'egg', 'chicken', 'pork', 'beef', 'apple', 'banana', 'food', 'eat', 'drink', 'restaurant', 'dish', 'meal'],
    forbidden: []
  },
  'b1-body': {
    pos: ['N'],
    keywords: ['head', 'face', 'eye', 'nose', 'mouth', 'ear', 'hand', 'foot', 'leg', 'arm', 'hair', 'tooth', 'stomach', 'heart', 'body'],
    forbidden: ['exercise', 'sport', 'health'] // These go to routine/hobbies
  },
  'b1-colors': {
    pos: ['N', 'A'],
    keywords: ['color', 'red', 'blue', 'green', 'yellow', 'black', 'white', 'gray', 'orange', 'purple', 'pink', 'brown'],
    forbidden: []
  },
  'b1-clothing': {
    pos: ['N'],
    keywords: ['clothes', 'shirt', 'pants', 'dress', 'skirt', 'shoes', 'hat', 'jacket', 'coat', 'wear', 'socks'],
    forbidden: []
  },
  'b1-places': {
    pos: ['N'],
    keywords: ['home', 'house', 'room', 'city', 'country', 'street', 'road', 'shop', 'store', 'restaurant', 'hospital', 'park', 'hotel', 'airport', 'station', 'office', 'building', 'school', 'university', 'library', 'place'],
    forbidden: []
  },
  'b1-transport': {
    pos: ['N'],
    keywords: ['car', 'bus', 'train', 'plane', 'bike', 'bicycle', 'taxi', 'subway', 'ship', 'boat', 'vehicle'],
    forbidden: []
  },
  'b1-weather': {
    pos: ['N', 'A', 'V'],
    keywords: ['weather', 'rain', 'snow', 'wind', 'sun', 'cloud'],
    forbidden: []
  }
};

// Results
const results = {
  manual: [],
  exact: [],
  semantic: [],
  needsReview: []
};

const newUnits = {};
const allUnitIds = Object.keys(EXACT_ASSIGNMENTS).concat(Object.keys(NOUN_CATEGORIES), [
  'b1-verbs', 'b1-adjectives', 'b1-school', 'b1-hobbies', 'b1-routine', 'b1-questions'
]);
for (const id of allUnitIds) {
  newUnits[id] = { words: [], allocatedWords: 0 };
}

// Helper function
function categorizeWord(word) {
  const simp = word.simp;
  const pos = word.pos || null;
  const en = (word.en || '').toLowerCase();
  const defs = (word.defs || []).map(d => d.toLowerCase()).join(' ');
  const searchText = `${en} ${defs}`;

  // 1. Check manual overrides first
  if (manualOverrides[simp]) {
    results.manual.push({ word: simp, unit: manualOverrides[simp] });
    return manualOverrides[simp];
  }

  // 2. Check exact assignments
  for (const [unitId, exactWords] of Object.entries(EXACT_ASSIGNMENTS)) {
    if (exactWords.includes(simp)) {
      results.exact.push({ word: simp, unit: unitId });
      return unitId;
    }
  }

  // 3. Try semantic matching for nouns only
  if (pos === 'N') {
    for (const [unitId, rules] of Object.entries(NOUN_CATEGORIES)) {
      // Check for forbidden keywords
      if (rules.forbidden.some(kw => searchText.includes(kw))) {
        continue;
      }

      // Check for matching keywords
      const matchCount = rules.keywords.filter(kw => searchText.includes(kw)).length;
      if (matchCount >= 1) {
        results.semantic.push({ word: simp, unit: unitId, confidence: matchCount });
        return unitId;
      }
    }
  }

  // 4. Categorize remaining by POS
  if (pos === 'V') {
    results.semantic.push({ word: simp, unit: 'b1-verbs', confidence: 100 });
    return 'b1-verbs';
  }
  if (pos === 'A') {
    results.semantic.push({ word: simp, unit: 'b1-adjectives', confidence: 100 });
    return 'b1-adjectives';
  }

  // 5. Everything else needs review
  results.needsReview.push({
    word: simp,
    en: en,
    pinyin: word.pinyin,
    pos: pos,
    defs: word.defs
  });
  return null;
}

// Categorize all words
console.log('🔍 Categorizing words...\n');
for (const word of allWords) {
  const unitId = categorizeWord(word);
  if (unitId) {
    newUnits[unitId].words.push(word);
  }
}

// Update counts
for (const [unitId, unit] of Object.entries(newUnits)) {
  unit.allocatedWords = unit.words.length;
}

// Print statistics
console.log('📊 CATEGORIZATION RESULTS\n');
console.log(`✅ Manual Overrides: ${results.manual.length} words`);
console.log(`✅ Exact Matches: ${results.exact.length} words`);
console.log(`⚠️  Semantic Matches: ${results.semantic.length} words`);
console.log(`❓ Needs Review: ${results.needsReview.length} words\n`);

// Show breakdown by unit
console.log('UNIT BREAKDOWN:');
const unitStats = {};
for (const [unit, data] of Object.entries(newUnits).sort((a, b) => b[1].allocatedWords - a[1].allocatedWords)) {
  if (data.allocatedWords > 0) {
    console.log(`  ${unit}: ${data.allocatedWords} words`);
  }
}

// Save results
fs.writeFileSync(
  outputPath,
  JSON.stringify({
    stats: {
      total: allWords.length,
      manual: results.manual.length,
      exact: results.exact.length,
      semantic: results.semantic.length,
      needsReview: results.needsReview.length
    },
    needsReview: results.needsReview,
    categorized: results
  }, null, 2),
  'utf8'
);

console.log(`\n💾 Results saved to: ${outputPath}`);
console.log(`\n📝 To manually assign words, create/edit: ${overridesPath}`);
console.log(`   Format: { "word": "unit-id", "帮": "b1-verbs", "弟": "b1-family" }`);
console.log(`\n⏭️  Review ${results.needsReview.length} words and add them to manual-overrides.json, then re-run this script.`);
