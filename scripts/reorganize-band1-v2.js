#!/usr/bin/env node

/**
 * Band 1 Reorganization v2 - Confidence-Based Categorization
 *
 * Tier 1: High-confidence auto-categorization (95%+ certain)
 * Tier 2: Medium-confidence with validation (needs quick review)
 * Tier 3: Low-confidence - manual review queue
 */

const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '../sonus-react/public/data/zh/band1.json');
const outputPath = path.join(__dirname, '../review-queue.json');

console.log('📚 Reading band1.json...');
const bandData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

// Extract all words from current units
const allWords = [];
for (const [unitId, unit] of Object.entries(bandData.units)) {
  if (unitId === '_unallocated') continue;
  for (const word of unit.words) {
    allWords.push(word);
  }
}

console.log(`Found ${allWords.length} total words to categorize\n`);

// TIER 1: Exact matches with strict POS validation
const TIER1_EXACT = {
  'b1-pronouns': {
    pos: ['Pron'],
    exact: ['我', '你', '您', '他', '她', '它', '我们', '你们', '他们', '她们', '咱们', '这', '那', '这个', '那个', '哪', '哪个', '谁', '什么', '怎么', '怎么样', '多少', '几']
  },
  'b1-numbers': {
    pos: ['Num', 'M'],
    exact: ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '零', '百', '千', '万', '第', '号', '次', '岁', '块', '元', '角', '分', '斤', '公斤', '米', '公里']
  },
  'b1-time': {
    pos: ['N', 'TW'],
    exact: ['年', '月', '日', '天', '星期', '周', '小时', '分钟', '秒', '今天', '明天', '昨天', '上午', '下午', '晚上', '早上', '中午', '现在', '以前', '以后', '时候']
  },
  'b1-family': {
    pos: ['N'],
    exact: ['爸爸', '妈妈', '父亲', '母亲', '儿子', '女儿', '哥哥', '姐姐', '弟弟', '妹妹', '爷爷', '奶奶', '外公', '外婆', '家']
  },
  'b1-politeness': {
    pos: ['V', 'Interj'],
    exact: ['请', '谢谢', '对不起', '不好意思', '没关系', '再见', '您好', '你好', '欢迎', '请问']
  },
  'b1-verbs': {
    pos: ['V'],
    keywords: [], // Will use POS only for tier 1
    exact: ['是', '有', '在', '做', '去', '来', '看', '听', '说', '读', '写', '买', '卖', '吃', '喝', '住', '穿', '给', '打', '开', '关', '上', '下', '进', '出', '会', '能', '可以', '想', '要', '爱', '喜欢', '认识', '知道', '觉得', '希望', '帮', '教', '学', '问', '告诉', '叫', '让']
  },
  'b1-adjectives': {
    pos: ['A'],
    exact: ['大', '小', '多', '少', '好', '坏', '新', '旧', '高', '矮', '长', '短', '快', '慢', '热', '冷', '贵', '便宜', '远', '近', '难', '容易', '忙', '累', '饿', '渴', '高兴', '快乐', '漂亮', '帅']
  }
};

// TIER 2: Semantic rules with validation
const TIER2_SEMANTIC = {
  'b1-greetings': {
    keywords: ['hello', 'hi', 'goodbye', 'bye', 'welcome', 'thank', 'sorry', 'excuse'],
    pos: ['V', 'Interj', 'N'],
    forbidden_pos: []
  },
  'b1-food': {
    keywords: ['food', 'eat', 'drink', 'rice', 'noodle', 'meat', 'fish', 'vegetable', 'fruit', 'tea', 'coffee', 'water', 'milk', 'bread', 'egg', 'chicken', 'pork', 'beef', 'apple', 'banana'],
    pos: ['N'],
    forbidden_pos: ['V', 'A', 'Pron']
  },
  'b1-school': {
    keywords: ['school', 'student', 'teacher', 'class', 'study', 'learn', 'book', 'pen', 'paper', 'desk', 'classroom', 'test', 'homework', 'lesson', 'university', 'college', 'phone', 'computer', 'notebook'],
    pos: ['N'],
    forbidden_pos: ['V', 'A', 'Pron', 'Adv']
  },
  'b1-body': {
    keywords: ['body', 'head', 'face', 'eye', 'nose', 'mouth', 'ear', 'hand', 'foot', 'leg', 'arm', 'hair', 'tooth', 'stomach', 'heart'],
    pos: ['N'],
    forbidden_pos: ['V', 'A', 'Pron']
  },
  'b1-colors': {
    keywords: ['color', 'red', 'blue', 'green', 'yellow', 'black', 'white', 'gray', 'orange', 'purple', 'pink', 'brown'],
    pos: ['A', 'N'],
    forbidden_pos: ['V', 'Pron']
  },
  'b1-clothing': {
    keywords: ['clothes', 'shirt', 'pants', 'dress', 'skirt', 'shoes', 'hat', 'jacket', 'coat', 'wear', 'socks'],
    pos: ['N'],
    forbidden_pos: ['V', 'A', 'Pron']
  },
  'b1-places': {
    keywords: ['place', 'home', 'house', 'room', 'city', 'country', 'street', 'road', 'shop', 'store', 'restaurant', 'hospital', 'park', 'hotel', 'airport', 'station', 'office', 'building', 'floor'],
    pos: ['N'],
    forbidden_pos: ['V', 'A', 'Pron', 'Adv']
  },
  'b1-transport': {
    keywords: ['car', 'bus', 'train', 'plane', 'bike', 'bicycle', 'taxi', 'subway', 'ship', 'boat', 'vehicle', 'drive', 'ride'],
    pos: ['N'],
    forbidden_pos: ['A', 'Pron']
  },
  'b1-weather': {
    keywords: ['weather', 'rain', 'snow', 'wind', 'sun', 'cloud', 'hot', 'cold', 'warm', 'cool', 'sunny', 'rainy', 'cloudy'],
    pos: ['N', 'A', 'V'],
    forbidden_pos: ['Pron']
  },
  'b1-hobbies': {
    keywords: ['hobby', 'music', 'movie', 'book', 'sport', 'game', 'swim', 'run', 'play', 'sing', 'dance', 'read', 'watch', 'listen', 'travel', 'cook'],
    pos: ['N', 'V'],
    forbidden_pos: ['Pron']
  },
  'b1-routine': {
    keywords: ['daily', 'morning', 'sleep', 'wake', 'work', 'rest', 'wash', 'shower', 'breakfast', 'lunch', 'dinner', 'clean', 'brush', 'body', 'health'],
    pos: ['N', 'V'],
    forbidden_pos: ['Pron']
  },
  'b1-questions': {
    keywords: ['question', 'ask', 'answer', 'what', 'where', 'when', 'who', 'how', 'why', 'which'],
    pos: ['V', 'Pron', 'Adv'],
    forbidden_pos: []
  }
};

// Categories for statistics
const categorized = {
  tier1: [],
  tier2: [],
  tier3: []
};

// Results
const newUnits = {};
for (const unitId of Object.keys(TIER1_EXACT).concat(Object.keys(TIER2_SEMANTIC))) {
  newUnits[unitId] = { words: [], allocatedWords: 0 };
}

// Helper: Extract POS from word
function getPOS(word) {
  return word.pos || null;
}

// Helper: Check if word matches Tier 1 criteria
function checkTier1(word) {
  const pos = getPOS(word);

  for (const [unitId, rules] of Object.entries(TIER1_EXACT)) {
    // Must have matching POS
    if (!rules.pos.includes(pos)) continue;

    // Must be in exact list
    if (rules.exact.includes(word.simp)) {
      return { unitId, confidence: 100 };
    }
  }

  return null;
}

// Helper: Check if word matches Tier 2 criteria
function checkTier2(word) {
  const pos = getPOS(word);
  const en = (word.en || '').toLowerCase();
  const defs = (word.defs || []).map(d => d.toLowerCase()).join(' ');
  const searchText = `${en} ${defs}`;

  let bestMatch = null;
  let bestScore = 0;

  for (const [unitId, rules] of Object.entries(TIER2_SEMANTIC)) {
    // Skip if forbidden POS
    if (rules.forbidden_pos.includes(pos)) continue;

    // Skip if POS doesn't match allowed list
    if (rules.pos.length > 0 && !rules.pos.includes(pos)) continue;

    // Calculate keyword match score
    let matchCount = 0;
    for (const keyword of rules.keywords) {
      if (searchText.includes(keyword)) {
        matchCount++;
      }
    }

    if (matchCount > bestScore) {
      bestScore = matchCount;
      bestMatch = unitId;
    }
  }

  if (bestMatch && bestScore >= 1) {
    const confidence = Math.min(95, 60 + (bestScore * 10));
    return { unitId: bestMatch, confidence };
  }

  return null;
}

// Categorize all words
console.log('🔍 Categorizing words...\n');

for (const word of allWords) {
  let placement = null;

  // Try Tier 1 first
  placement = checkTier1(word);
  if (placement) {
    newUnits[placement.unitId].words.push(word);
    categorized.tier1.push({ word: word.simp, unit: placement.unitId, confidence: placement.confidence });
    continue;
  }

  // Try Tier 2
  placement = checkTier2(word);
  if (placement && placement.confidence >= 70) {
    newUnits[placement.unitId].words.push(word);
    categorized.tier2.push({ word: word.simp, unit: placement.unitId, confidence: placement.confidence });
    continue;
  }

  // Tier 3: Manual review needed
  categorized.tier3.push({
    word: word.simp,
    en: word.en,
    pinyin: word.pinyin,
    pos: getPOS(word),
    defs: word.defs,
    suggested: placement?.unitId || null,
    confidence: placement?.confidence || 0
  });
}

// Update allocatedWords count
for (const [unitId, unit] of Object.entries(newUnits)) {
  unit.allocatedWords = unit.words.length;
}

// Print statistics
console.log('📊 CATEGORIZATION RESULTS\n');
console.log(`✅ Tier 1 (High Confidence): ${categorized.tier1.length} words`);
console.log(`⚠️  Tier 2 (Medium Confidence): ${categorized.tier2.length} words`);
console.log(`❓ Tier 3 (Manual Review): ${categorized.tier3.length} words\n`);

// Show tier 1 breakdown
console.log('TIER 1 BREAKDOWN:');
const tier1Stats = {};
for (const item of categorized.tier1) {
  tier1Stats[item.unit] = (tier1Stats[item.unit] || 0) + 1;
}
for (const [unit, count] of Object.entries(tier1Stats).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${unit}: ${count} words`);
}

// Show tier 2 breakdown
console.log('\nTIER 2 BREAKDOWN:');
const tier2Stats = {};
for (const item of categorized.tier2) {
  tier2Stats[item.unit] = (tier2Stats[item.unit] || 0) + 1;
}
for (const [unit, count] of Object.entries(tier2Stats).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${unit}: ${count} words`);
}

// Write review queue
fs.writeFileSync(
  outputPath,
  JSON.stringify({
    tier3: categorized.tier3,
    tier2: categorized.tier2,
    stats: {
      total: allWords.length,
      tier1: categorized.tier1.length,
      tier2: categorized.tier2.length,
      tier3: categorized.tier3.length
    }
  }, null, 2),
  'utf8'
);

console.log(`\n💾 Review queue saved to: ${outputPath}`);
console.log(`\n⏭️  NEXT STEPS:`);
console.log(`   1. Review ${categorized.tier3.length} Tier 3 words that need manual categorization`);
console.log(`   2. Spot-check ${categorized.tier2.length} Tier 2 words for accuracy`);
console.log(`   3. Run the finalize script to update band1.json`);
