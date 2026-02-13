#!/usr/bin/env node

/**
 * Clean Numbers Unit
 * - Remove 第 (ordinal prefix)
 * - Simplify English definitions to be plain and simple
 */

const fs = require('fs');
const path = require('path');

const bandPath = path.join(__dirname, '../sonus-react/public/data/zh/band1.json');
const data = JSON.parse(fs.readFileSync(bandPath, 'utf8'));

console.log('🔢 Cleaning Numbers Unit...\n');

// Remove 第 from numbers unit
const wordsToRemove = ['第'];
const originalCount = data.units['b1-numbers'].words.length;

data.units['b1-numbers'].words = data.units['b1-numbers'].words.filter(w => {
  if (wordsToRemove.includes(w.simp)) {
    console.log(`Removing: ${w.simp} - ${w.en}`);
    // Move to _unallocated
    data.units._unallocated.words.push(w);
    return false;
  }
  return true;
});

// Update counts
data.units['b1-numbers'].allocatedWords = data.units['b1-numbers'].words.length;
data.units._unallocated.allocatedWords = data.units._unallocated.words.length;

console.log(`\nRemoved ${originalCount - data.units['b1-numbers'].allocatedWords} words\n`);

// Simplify English definitions and defs array
console.log('Simplifying English definitions:\n');

const simplifications = {
  '〇': 'zero',
  '一': 'one',
  '二': 'two',
  '三': 'three',
  '四': 'four',
  '五': 'five',
  '六': 'six',
  '七': 'seven',
  '八': 'eight',
  '九': 'nine',
  '十': 'ten',
  '百': 'hundred',
  '两': 'two (for counting objects)',
  '半': 'half',
  '一半': 'half'
};

for (const word of data.units['b1-numbers'].words) {
  if (simplifications[word.simp]) {
    const oldEn = word.en;
    const oldDefs = [...word.defs];

    // Set simple en and defs
    word.en = simplifications[word.simp];
    word.defs = [simplifications[word.simp]];

    if (oldEn !== word.en || JSON.stringify(oldDefs) !== JSON.stringify(word.defs)) {
      console.log(`${word.simp}: "${oldEn}" → "${word.en}"`);
      console.log(`  defs: ${JSON.stringify(oldDefs)} → ${JSON.stringify(word.defs)}`);
    }
  }
}

// Sort by number value (custom order)
const numberOrder = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '百', '两', '半', '一半'];
data.units['b1-numbers'].words.sort((a, b) => {
  return numberOrder.indexOf(a.simp) - numberOrder.indexOf(b.simp);
});

console.log('\n📊 Final numbers unit:\n');
data.units['b1-numbers'].words.forEach(w => {
  console.log(`  ${w.simp} - ${w.en}`);
});

// Save
fs.writeFileSync(bandPath, JSON.stringify(data, null, 2), 'utf8');
console.log('\n💾 Saved to band1.json');
