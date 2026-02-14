#!/usr/bin/env node

/**
 * Finalize Band 3 Reorganization
 *
 * Merges:
 * - Tier 1 + Tier 2 auto-categorizations
 * - Manual overrides from manual-overrides-band3.json
 * - Remaining words go to b3-review
 *
 * Outputs final band3.json with proper structure matching Band 1/2
 */

const fs = require('fs');
const path = require('path');

const bandPath = path.join(__dirname, '../sonus-react/public/data/zh/band3.json');
const resultsPath = path.join(__dirname, 'band3-reorganize-results.json');
const overridesPath = path.join(__dirname, 'manual-overrides-band3.json');
const backupPath = path.join(__dirname, 'band3-backup.json');

console.log('📚 Loading data...\n');

// Load original data
const originalData = JSON.parse(fs.readFileSync(bandPath, 'utf8'));

// Load reorganization results
const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));

// Load manual overrides if they exist
let manualOverrides = {};
if (fs.existsSync(overridesPath)) {
  console.log('✅ Found manual overrides file');
  manualOverrides = JSON.parse(fs.readFileSync(overridesPath, 'utf8'));
} else {
  console.log('⚠️  No manual overrides found - Tier 3 words will go to b3-review');
}

// Extract all words from original data
const allWords = [];
const wordMap = new Map(); // Map simp -> word object

for (const [unitId, unit] of Object.entries(originalData.units)) {
  if (!unit.words) continue;
  for (const word of unit.words) {
    allWords.push(word);
    wordMap.set(word.simp, word);
  }
}

console.log(`Total words: ${allWords.length}`);
console.log(`Manual overrides: ${Object.keys(manualOverrides).length}`);
console.log(`Tier 1 auto: ${results.tier1.length}`);
console.log(`Tier 2 auto: ${results.tier2.length}`);
console.log(`Tier 3 (manual/review): ${results.tier3.length}\n`);

// Initialize new units structure
const newUnits = {
  _unallocated: {
    targetWords: 0,
    allocatedWords: 0,
    words: []
  },
  'b3-grammar': { targetWords: 0, allocatedWords: 0, words: [] },
  'b3-workstudy': { targetWords: 0, allocatedWords: 0, words: [] },
  'b3-social': { targetWords: 0, allocatedWords: 0, words: [] },
  'b3-food': { targetWords: 0, allocatedWords: 0, words: [] },
  'b3-health': { targetWords: 0, allocatedWords: 0, words: [] },
  'b3-travel': { targetWords: 0, allocatedWords: 0, words: [] },
  'b3-hobbies': { targetWords: 0, allocatedWords: 0, words: [] },
  'b3-media': { targetWords: 0, allocatedWords: 0, words: [] },
  'b3-feelings': { targetWords: 0, allocatedWords: 0, words: [] },
  'b3-story': { targetWords: 0, allocatedWords: 0, words: [] },
  'b3-problems': { targetWords: 0, allocatedWords: 0, words: [] },
  'b3-review': { targetWords: 0, allocatedWords: 0, words: [] },
  'b3-listening': { targetWords: 0, allocatedWords: 0, words: [] },
  'b3-speaking': { targetWords: 0, allocatedWords: 0, words: [] }
};

// Track which words have been assigned
const assigned = new Set();

// 1. Apply Tier 1 assignments
console.log('Applying Tier 1 assignments...');
for (const item of results.tier1) {
  const word = wordMap.get(item.word);
  if (word && newUnits[item.unit]) {
    newUnits[item.unit].words.push(word);
    assigned.add(item.word);
  }
}

// 2. Apply Tier 2 assignments
console.log('Applying Tier 2 assignments...');
for (const item of results.tier2) {
  const word = wordMap.get(item.word);
  if (word && newUnits[item.unit] && !assigned.has(item.word)) {
    newUnits[item.unit].words.push(word);
    assigned.add(item.word);
  }
}

// 3. Apply manual overrides (highest priority)
console.log('Applying manual overrides...');
let overrideCount = 0;
for (const [wordSimp, unitId] of Object.entries(manualOverrides)) {
  const word = wordMap.get(wordSimp);
  if (word && newUnits[unitId]) {
    // Remove from current unit if already assigned
    if (assigned.has(wordSimp)) {
      for (const unit of Object.values(newUnits)) {
        unit.words = unit.words.filter(w => w.simp !== wordSimp);
      }
    }

    newUnits[unitId].words.push(word);
    assigned.add(wordSimp);
    overrideCount++;
  }
}
console.log(`  Applied ${overrideCount} manual overrides`);

// 4. Assign remaining Tier 3 words to b3-review
console.log('Assigning remaining words to b3-review...');
let reviewCount = 0;
for (const word of allWords) {
  if (!assigned.has(word.simp)) {
    newUnits['b3-review'].words.push(word);
    assigned.add(word.simp);
    reviewCount++;
  }
}
console.log(`  ${reviewCount} words assigned to b3-review`);

// Update allocated counts
for (const [unitId, unit] of Object.entries(newUnits)) {
  unit.allocatedWords = unit.words.length;
}

// Verify all words accounted for
const totalAssigned = Array.from(assigned).length;
if (totalAssigned !== allWords.length) {
  console.error(`\n❌ ERROR: Word count mismatch!`);
  console.error(`   Original: ${allWords.length}`);
  console.error(`   Assigned: ${totalAssigned}`);
  console.error(`   Missing: ${allWords.length - totalAssigned}`);
  process.exit(1);
}

console.log(`\n✅ All ${allWords.length} words accounted for!`);

// Create backup
console.log('\n💾 Creating backup...');
fs.writeFileSync(backupPath, JSON.stringify(originalData, null, 2), 'utf8');
console.log(`   Backup saved to: ${backupPath}`);

// Build final data structure
const finalData = {
  language: originalData.language,
  source: originalData.source,
  bandId: originalData.bandId,
  band: originalData.band,
  wordCount: allWords.length,
  availableWords: allWords.length,
  unallocatedWords: newUnits._unallocated.words.length,
  units: newUnits
};

// Save final band3.json
console.log('\n💾 Writing final band3.json...');
fs.writeFileSync(bandPath, JSON.stringify(finalData, null, 2), 'utf8');

// Print final statistics
console.log('\n📊 FINAL UNIT DISTRIBUTION:\n');
const sortedUnits = Object.entries(newUnits)
  .filter(([id]) => !id.startsWith('_') && id !== 'b3-listening' && id !== 'b3-speaking')
  .sort((a, b) => b[1].allocatedWords - a[1].allocatedWords);

for (const [unitId, unit] of sortedUnits) {
  console.log(`  ${unitId}: ${unit.allocatedWords} words`);
}

console.log(`\n  b3-listening: ${newUnits['b3-listening'].allocatedWords} words`);
console.log(`  b3-speaking: ${newUnits['b3-speaking'].allocatedWords} words`);
console.log(`  _unallocated: ${newUnits._unallocated.allocatedWords} words`);

console.log('\n✨ Band 3 reorganization complete!');
console.log('\n⏭️  NEXT STEPS:');
console.log('   1. Run: node scripts/validate-band3.js');
console.log('   2. Test in app: npm run dev:all');
console.log('   3. Navigate to Band 3 and verify units');
