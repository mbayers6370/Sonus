#!/usr/bin/env node

/**
 * Band 1 Data Cleanup Script
 *
 * Fixes:
 * - Removes duplicate words
 * - Removes "surname" definitions
 * - Fills blank English definitions
 * - Validates word categorization
 */

const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '../sonus-react/public/data/zh/band1.json');

console.log('📚 Reading band1.json...');
const bandData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

let totalCleaned = 0;
let totalDuplicatesRemoved = 0;

// Track all words by ID to detect duplicates
const seenIds = new Set();
const seenSimp = new Map(); // Track by simplified + pinyin

for (const [unitId, unit] of Object.entries(bandData.units)) {
  if (unitId === '_unallocated') continue;

  console.log(`\n🔍 Processing ${unitId}...`);

  const cleanedWords = [];
  const duplicates = [];

  for (const word of unit.words) {
    // Check for duplicates
    const key = `${word.simp}-${word.pinyin}`;
    if (seenIds.has(word.id) || seenSimp.has(key)) {
      duplicates.push(word.simp);
      totalDuplicatesRemoved++;
      continue;
    }

    seenIds.add(word.id);
    seenSimp.set(key, unitId);

    let modified = false;

    // Fix blank English definitions
    if (!word.en || word.en.trim() === '') {
      if (word.defs && word.defs.length > 0) {
        word.en = word.defs[0];
        modified = true;
      }
    }

    // Remove "surname" from English definitions
    if (word.en && word.en.toLowerCase().includes('surname')) {
      // If it's ONLY "surname X", use the first real definition
      if (/^surname\s+\w+$/i.test(word.en.trim()) && word.defs && word.defs.length > 1) {
        word.en = word.defs.find(d => !d.toLowerCase().includes('surname')) || word.defs[1];
        modified = true;
      } else {
        // Just remove the surname part
        word.en = word.en.replace(/surname\s+\w+[;,\s]*/gi, '').trim();
        if (!word.en && word.defs && word.defs.length > 0) {
          word.en = word.defs.find(d => !d.toLowerCase().includes('surname')) || word.defs[0];
        }
        modified = true;
      }
    }

    // Remove "surname" from definitions array
    if (word.defs && word.defs.length > 0) {
      const originalLength = word.defs.length;
      word.defs = word.defs.filter(def => {
        // Remove pure surname definitions
        if (/^surname\s+\w+$/i.test(def.trim())) return false;
        return true;
      });

      // Clean up remaining defs that have surname mentions
      word.defs = word.defs.map(def => {
        return def.replace(/surname\s+\w+[;,\s]*/gi, '').trim();
      }).filter(def => def.length > 0);

      if (word.defs.length !== originalLength) {
        modified = true;
      }
    }

    if (modified) {
      totalCleaned++;
    }

    cleanedWords.push(word);
  }

  unit.words = cleanedWords;
  unit.allocatedWords = cleanedWords.length;

  if (duplicates.length > 0) {
    console.log(`  ⚠️  Removed ${duplicates.length} duplicates: ${duplicates.slice(0, 5).join(', ')}${duplicates.length > 5 ? '...' : ''}`);
  }

  console.log(`  ✅ ${cleanedWords.length} words (cleaned: ${totalCleaned})`);
}

// Write cleaned data
fs.writeFileSync(inputPath, JSON.stringify(bandData, null, 2), 'utf8');

console.log('\n✨ Cleanup complete!');
console.log(`📊 Total words cleaned: ${totalCleaned}`);
console.log(`🗑️  Total duplicates removed: ${totalDuplicatesRemoved}`);
console.log(`💾 Saved to: ${inputPath}`);
