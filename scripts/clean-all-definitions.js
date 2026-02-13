#!/usr/bin/env node

/**
 * Clean ALL definitions in band1.json
 * - Keep only the primary, simplest definition
 * - Remove redundant translations, numbers, parentheticals
 * - Make defs array match the en field (single clean definition)
 */

const fs = require('fs');
const path = require('path');

const bandPath = path.join(__dirname, '../sonus-react/public/data/zh/band1.json');
const data = JSON.parse(fs.readFileSync(bandPath, 'utf8'));

console.log('🧹 Cleaning ALL definitions in band1.json...\n');

let totalCleaned = 0;

// Process all units
for (const [unitId, unit] of Object.entries(data.units)) {
  if (unit.words.length === 0) continue;

  console.log(`\n📦 Processing ${unitId} (${unit.words.length} words)...`);

  for (const word of unit.words) {
    if (!word.defs || word.defs.length === 0) continue;

    const oldDefs = [...word.defs];
    const oldEn = word.en;

    // Strategy: Use the en field as the canonical definition
    // Clean it up if needed, then set defs to just that one definition

    let cleanEn = word.en;

    // Remove common noise patterns
    cleanEn = cleanEn
      .replace(/\s*\(.*?\)\s*/g, '') // Remove parentheticals
      .replace(/;\s*.*$/, '')         // Remove everything after semicolon
      .replace(/,\s*etc\.?$/, '')     // Remove ", etc"
      .replace(/\s+/g, ' ')           // Normalize whitespace
      .trim();

    // If en field is empty or weird, try to get first clean def
    if (!cleanEn || cleanEn.length < 2) {
      for (const def of word.defs) {
        let candidate = def
          .replace(/\s*\(.*?\)\s*/g, '')
          .replace(/;\s*.*$/, '')
          .replace(/,\s*etc\.?$/, '')
          .replace(/\s+/g, ' ')
          .trim();

        if (candidate && candidate.length >= 2) {
          cleanEn = candidate;
          break;
        }
      }
    }

    // Update word
    if (cleanEn && cleanEn !== oldEn) {
      word.en = cleanEn;
    }

    // Set defs to single clean definition
    word.defs = [word.en];

    if (JSON.stringify(oldDefs) !== JSON.stringify(word.defs)) {
      totalCleaned++;
      if (totalCleaned <= 20) { // Show first 20 examples
        console.log(`  ${word.simp}: ${JSON.stringify(oldDefs)} → ["${word.en}"]`);
      }
    }
  }
}

console.log(`\n✅ Cleaned ${totalCleaned} words total\n`);

// Save
fs.writeFileSync(bandPath, JSON.stringify(data, null, 2), 'utf8');
console.log('💾 Saved to band1.json');
