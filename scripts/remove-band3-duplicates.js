#!/usr/bin/env node

/**
 * Remove Duplicate Words from Band 3
 *
 * Removes 9 duplicate words found in original band3.json
 */

const fs = require('fs');
const path = require('path');

const bandPath = path.join(__dirname, '../sonus-react/public/data/zh/band3.json');
const backupPath = path.join(__dirname, 'band3-original-backup.json');

console.log('📚 Reading band3.json...');
const data = JSON.parse(fs.readFileSync(bandPath, 'utf8'));

// Create backup
console.log('💾 Creating backup...');
fs.writeFileSync(backupPath, JSON.stringify(data, null, 2), 'utf8');

// Track seen words
const seen = new Set();
let duplicatesRemoved = 0;

// Remove duplicates from each unit
for (const [unitId, unit] of Object.entries(data.units)) {
  if (!unit.words) continue;

  const uniqueWords = [];
  for (const word of unit.words) {
    const key = word.simp;

    if (seen.has(key)) {
      console.log(`Removing duplicate: ${key} (${word.pinyin}) from ${unitId}`);
      duplicatesRemoved++;
    } else {
      uniqueWords.push(word);
      seen.add(key);
    }
  }

  unit.words = uniqueWords;
  unit.allocatedWords = uniqueWords.length;
}

// Update top-level counts
const totalWords = seen.size;
data.wordCount = totalWords;
data.availableWords = totalWords;

console.log(`\n✅ Removed ${duplicatesRemoved} duplicates`);
console.log(`📊 New word count: ${totalWords} (was 979)`);

// Save
fs.writeFileSync(bandPath, JSON.stringify(data, null, 2), 'utf8');
console.log('💾 Saved cleaned band3.json');
