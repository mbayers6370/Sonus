#!/usr/bin/env node

/**
 * Band 3 Reorganization - Categorize by English Definition
 *
 * Reorganizes 979 Band 3 words into thematic units based on English definitions
 * Similar approach to Band 1/2 reorganization
 */

const fs = require('fs');
const path = require('path');

const bandPath = path.join(__dirname, '../sonus-react/public/data/zh/band3.json');
const outputPath = path.join(__dirname, 'band3-reorganize-results.json');

console.log('📚 Reading band3.json...');
const data = JSON.parse(fs.readFileSync(bandPath, 'utf8'));

// Extract all words from current units
const allWords = [];
for (const [unitId, unit] of Object.entries(data.units)) {
  if (!unit.words) continue;
  for (const word of unit.words) {
    allWords.push(word);
  }
}

console.log(`Found ${allWords.length} total words\n`);

// Categorization rules based on English definitions
const UNIT_RULES = {
  'b3-grammar': {
    keywords: ['particle', 'grammar', 'connector', 'preposition', 'conjunction', 'modal', 'auxiliary', 'measure word', 'classifier', 'suffix', 'prefix', 'aspect marker'],
    pos: ['Part', 'Conj', 'Prep', 'Aux'],
    exact: ['的', '了', '着', '过', '得', '地', '吗', '呢', '吧', '啊']
  },

  'b3-workstudy': {
    keywords: ['work', 'job', 'study', 'school', 'university', 'college', 'office', 'business', 'company', 'career', 'education', 'learn', 'teach', 'professor', 'student', 'class', 'exam', 'homework', 'research', 'degree', 'graduate', 'professional', 'employee', 'boss', 'manager'],
    pos: ['N', 'V'],
    exact: []
  },

  'b3-social': {
    keywords: ['friend', 'social', 'party', 'meet', 'visit', 'chat', 'relationship', 'communicate', 'conversation', 'gather', 'introduce', 'greet', 'invite', 'guest', 'neighbor', 'community', 'group', 'club', 'member'],
    pos: ['N', 'V', 'A'],
    exact: []
  },

  'b3-food': {
    keywords: ['food', 'eat', 'drink', 'cook', 'restaurant', 'meal', 'breakfast', 'lunch', 'dinner', 'dish', 'cuisine', 'flavor', 'taste', 'menu', 'order', 'waiter', 'kitchen', 'ingredients', 'recipe', 'beverage', 'tea', 'coffee', 'rice', 'noodle', 'meat', 'vegetable', 'fruit', 'delicious'],
    pos: ['N', 'V', 'A'],
    exact: []
  },

  'b3-health': {
    keywords: ['health', 'medical', 'doctor', 'hospital', 'medicine', 'illness', 'disease', 'sick', 'pain', 'hurt', 'treatment', 'cure', 'patient', 'nurse', 'clinic', 'symptom', 'fever', 'cold', 'cough', 'exercise', 'fitness', 'body', 'healthy', 'pharmacy'],
    pos: ['N', 'V', 'A'],
    exact: []
  },

  'b3-travel': {
    keywords: ['travel', 'trip', 'journey', 'tour', 'tourist', 'hotel', 'airport', 'flight', 'ticket', 'passport', 'visa', 'luggage', 'suitcase', 'destination', 'vacation', 'holiday', 'transportation', 'train', 'bus', 'taxi', 'subway', 'station', 'navigate', 'map', 'direction', 'route'],
    pos: ['N', 'V'],
    exact: []
  },

  'b3-hobbies': {
    keywords: ['hobby', 'sport', 'game', 'play', 'entertainment', 'leisure', 'activity', 'music', 'sing', 'dance', 'movie', 'film', 'concert', 'theater', 'art', 'paint', 'draw', 'photograph', 'read', 'book', 'novel', 'swim', 'run', 'basketball', 'football', 'tennis', 'exercise', 'fun', 'enjoy'],
    pos: ['N', 'V'],
    exact: []
  },

  'b3-media': {
    keywords: ['internet', 'computer', 'phone', 'technology', 'website', 'email', 'message', 'text', 'chat', 'online', 'digital', 'app', 'software', 'screen', 'news', 'newspaper', 'TV', 'television', 'radio', 'media', 'broadcast', 'information', 'data', 'network', 'wifi', 'video', 'social media'],
    pos: ['N', 'V'],
    exact: []
  },

  'b3-feelings': {
    keywords: ['feel', 'emotion', 'mood', 'happy', 'sad', 'angry', 'excited', 'nervous', 'worried', 'afraid', 'love', 'hate', 'like', 'dislike', 'enjoy', 'prefer', 'opinion', 'think', 'believe', 'attitude', 'proud', 'ashamed', 'grateful', 'disappointed', 'surprised', 'bored', 'interested', 'tired', 'energetic'],
    pos: ['V', 'A', 'N'],
    exact: []
  },

  'b3-story': {
    keywords: ['story', 'narrative', 'tell', 'describe', 'explain', 'report', 'sequence', 'first', 'then', 'next', 'finally', 'before', 'after', 'while', 'during', 'past', 'happened', 'event', 'experience', 'remember', 'forget', 'recall', 'once', 'suddenly', 'gradually'],
    pos: ['V', 'Adv', 'Conj'],
    exact: []
  },

  'b3-problems': {
    keywords: ['problem', 'issue', 'difficult', 'trouble', 'challenge', 'solve', 'solution', 'fix', 'repair', 'broken', 'damage', 'mistake', 'error', 'wrong', 'conflict', 'argue', 'disagree', 'complain', 'improve', 'help', 'assist', 'support', 'advice', 'suggestion'],
    pos: ['N', 'V', 'A'],
    exact: []
  },

  'b3-review': {
    keywords: [], // Catch-all for uncategorized words
    pos: [],
    exact: []
  }
};

// Results tracking
const results = {
  tier1: [], // Exact matches
  tier2: [], // Keyword matches
  tier3: []  // Needs manual review
};

const newUnits = {};
for (const unitId of Object.keys(UNIT_RULES)) {
  newUnits[unitId] = { words: [], allocatedWords: 0 };
}

// Helper: Get POS from word
function getPOS(word) {
  return word.pos || null;
}

// Helper: Check if word is exact match (Tier 1)
function checkTier1(word) {
  const simp = word.simp;

  for (const [unitId, rules] of Object.entries(UNIT_RULES)) {
    if (rules.exact.includes(simp)) {
      return { unitId, confidence: 100 };
    }
  }

  return null;
}

// Helper: Check keyword match (Tier 2)
function checkTier2(word) {
  const pos = getPOS(word);
  const en = (word.en || '').toLowerCase();
  const defs = (word.defs || []).map(d => d.toLowerCase()).join(' ');
  const searchText = `${en} ${defs}`;

  let bestMatch = null;
  let bestScore = 0;

  for (const [unitId, rules] of Object.entries(UNIT_RULES)) {
    if (unitId === 'b3-review') continue; // Skip catch-all for now

    // Check POS match if specified
    if (rules.pos.length > 0 && pos && !rules.pos.includes(pos)) {
      continue;
    }

    // Count keyword matches
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

  // Try Tier 1 (exact matches)
  placement = checkTier1(word);
  if (placement) {
    newUnits[placement.unitId].words.push(word);
    results.tier1.push({ word: word.simp, unit: placement.unitId, confidence: placement.confidence });
    continue;
  }

  // Try Tier 2 (keyword matches)
  placement = checkTier2(word);
  if (placement && placement.confidence >= 60) {
    newUnits[placement.unitId].words.push(word);
    results.tier2.push({ word: word.simp, unit: placement.unitId, confidence: placement.confidence });
    continue;
  }

  // Tier 3: Needs manual review (or goes to b3-review catch-all)
  results.tier3.push({
    word: word.simp,
    en: word.en,
    pinyin: word.pinyin,
    pos: getPOS(word),
    defs: word.defs,
    suggested: placement?.unitId || 'b3-review',
    confidence: placement?.confidence || 0
  });
}

// Update counts
for (const [unitId, unit] of Object.entries(newUnits)) {
  unit.allocatedWords = unit.words.length;
}

// Print statistics
console.log('📊 CATEGORIZATION RESULTS\n');
console.log(`✅ Tier 1 (Exact Matches): ${results.tier1.length} words`);
console.log(`⚠️  Tier 2 (Keyword Matches): ${results.tier2.length} words`);
console.log(`❓ Tier 3 (Manual Review): ${results.tier3.length} words\n`);

// Show unit breakdown
console.log('UNIT BREAKDOWN:');
const unitStats = {};
for (const [unitId, unit] of Object.entries(newUnits)) {
  if (unit.allocatedWords > 0) {
    console.log(`  ${unitId}: ${unit.allocatedWords} words`);
  }
}

// Save results
const output = {
  stats: {
    total: allWords.length,
    tier1: results.tier1.length,
    tier2: results.tier2.length,
    tier3: results.tier3.length
  },
  tier1: results.tier1,
  tier2: results.tier2,
  tier3: results.tier3,
  unitDistributions: Object.fromEntries(
    Object.entries(newUnits).map(([id, unit]) => [id, unit.allocatedWords])
  )
};

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');

console.log(`\n💾 Results saved to: ${outputPath}`);
console.log(`\n⏭️  NEXT STEPS:`);
console.log(`   1. Review ${results.tier3.length} Tier 3 words in band3-reorganize-results.json`);
console.log(`   2. Create manual-overrides-band3.json if needed`);
console.log(`   3. Run finalize-band3.js to apply changes`);
