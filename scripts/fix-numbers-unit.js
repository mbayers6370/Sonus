#!/usr/bin/env node

/**
 * Fix Numbers Unit
 * Moves question words about quantity (多少, 几) to numbers unit
 */

const fs = require('fs');
const path = require('path');

const bandPath = path.join(__dirname, '../sonus-react/public/data/zh/band1.json');
const data = JSON.parse(fs.readFileSync(bandPath, 'utf8'));

// Words that should be in numbers unit
const shouldBeNumbers = ['多少', '几'];

let moved = 0;

console.log('🔢 Fixing Numbers Unit...\n');

// Find and move words to numbers unit
for (const [unitId, unit] of Object.entries(data.units)) {
  if (unitId === 'b1-numbers' || unitId === '_unallocated') continue;

  const wordsToMove = [];
  const remainingWords = [];

  for (const word of unit.words) {
    if (shouldBeNumbers.includes(word.simp)) {
      console.log(`Moving ${word.simp} (${word.en}) from ${unitId} to b1-numbers`);
      wordsToMove.push(word);
      moved++;
    } else {
      remainingWords.push(word);
    }
  }

  // Update source unit
  data.units[unitId].words = remainingWords;
  data.units[unitId].allocatedWords = remainingWords.length;

  // Add to numbers unit
  if (wordsToMove.length > 0) {
    data.units['b1-numbers'].words.push(...wordsToMove);
  }
}

// Update numbers unit count
data.units['b1-numbers'].allocatedWords = data.units['b1-numbers'].words.length;

// Sort numbers unit by simplified character
data.units['b1-numbers'].words.sort((a, b) => {
  return a.simp.localeCompare(b.simp, 'zh-CN');
});

console.log(`\n✅ Moved ${moved} words to numbers unit`);
console.log(`📊 Numbers unit now has ${data.units['b1-numbers'].allocatedWords} words\n`);

// Show final numbers unit
console.log('Final numbers unit:');
data.units['b1-numbers'].words.forEach(w => {
  console.log(`  ${w.simp} - ${w.en}`);
});

// Save
fs.writeFileSync(bandPath, JSON.stringify(data, null, 2), 'utf8');
console.log('\n💾 Saved to band1.json');
