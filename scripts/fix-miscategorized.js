#!/usr/bin/env node

/**
 * Fix Miscategorized Words
 * Manually move words that are in the wrong units
 */

const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '../sonus-react/public/data/zh/band1.json');

console.log('📚 Reading band1.json...');
const bandData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

// Define word movements: { simplified: [fromUnit, toUnit] }
const movements = {
  // From b1-numbers to correct units
  '本子': ['b1-numbers', 'b1-school'],
  '电话': ['b1-numbers', 'b1-school'],
  '进': ['b1-numbers', 'b1-verbs'],
  '来': ['b1-numbers', 'b1-verbs'],
  '身体': ['b1-numbers', 'b1-routine'],
};

let totalMoved = 0;

for (const [simp, [fromUnit, toUnit]] of Object.entries(movements)) {
  const fromWords = bandData.units[fromUnit].words;
  const wordIndex = fromWords.findIndex(w => w.simp === simp);

  if (wordIndex === -1) {
    console.log(`⚠️  Word not found: ${simp} in ${fromUnit}`);
    continue;
  }

  const word = fromWords[wordIndex];

  // Remove from source
  fromWords.splice(wordIndex, 1);
  bandData.units[fromUnit].allocatedWords = fromWords.length;

  // Add to destination
  bandData.units[toUnit].words.push(word);
  bandData.units[toUnit].allocatedWords = bandData.units[toUnit].words.length;

  console.log(`✅ Moved ${simp} (${word.en}) from ${fromUnit} → ${toUnit}`);
  totalMoved++;
}

// Sort words within each unit by simplified character
for (const [unitId, unit] of Object.entries(bandData.units)) {
  if (unitId === '_unallocated') continue;
  unit.words.sort((a, b) => a.simp.localeCompare(b.simp, 'zh-CN'));
}

// Write updated data
fs.writeFileSync(inputPath, JSON.stringify(bandData, null, 2), 'utf8');

console.log(`\n✨ Complete! Moved ${totalMoved} words`);
console.log(`💾 Saved to: ${inputPath}`);
