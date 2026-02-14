#!/usr/bin/env node

/**
 * Validate Band 3 Reorganization
 *
 * Checks:
 * - Total word count remains 979
 * - No duplicate words across units
 * - No lost words
 * - Structure matches Band 1/2 format
 * - _unallocated unit exists
 */

const fs = require('fs');
const path = require('path');

const bandPath = path.join(__dirname, '../sonus-react/public/data/zh/band3.json');
const band1Path = path.join(__dirname, '../sonus-react/public/data/zh/band1.json');

console.log('🔍 Validating band3.json...\n');

// Load data
const band3 = JSON.parse(fs.readFileSync(bandPath, 'utf8'));
const band1 = JSON.parse(fs.readFileSync(band1Path, 'utf8')); // Reference structure

let errors = 0;
let warnings = 0;

// Test 1: Check top-level structure
console.log('✓ Test 1: Top-level structure');
const requiredFields = ['language', 'source', 'bandId', 'band', 'wordCount', 'availableWords', 'unallocatedWords', 'units'];
for (const field of requiredFields) {
  if (!(field in band3)) {
    console.error(`  ❌ Missing required field: ${field}`);
    errors++;
  }
}

if (band3.language !== 'zh') {
  console.error(`  ❌ Language should be 'zh', got: ${band3.language}`);
  errors++;
}

if (band3.bandId !== 'band3') {
  console.error(`  ❌ bandId should be 'band3', got: ${band3.bandId}`);
  errors++;
}

if (band3.band !== 3) {
  console.error(`  ❌ band should be 3, got: ${band3.band}`);
  errors++;
}

// Test 2: Check _unallocated unit exists
console.log('✓ Test 2: _unallocated unit');
if (!band3.units._unallocated) {
  console.error('  ❌ Missing _unallocated unit');
  errors++;
} else {
  if (band3.units._unallocated.words.length > 0) {
    console.warn(`  ⚠️  _unallocated has ${band3.units._unallocated.words.length} words (should be empty)`);
    warnings++;
  }
}

// Test 3: Extract all words and check for duplicates
console.log('✓ Test 3: Word count and duplicates');
const allWords = [];
const simpSet = new Set();
const duplicates = [];

for (const [unitId, unit] of Object.entries(band3.units)) {
  if (!unit.words) {
    console.error(`  ❌ Unit ${unitId} has no 'words' array`);
    errors++;
    continue;
  }

  for (const word of unit.words) {
    allWords.push(word);

    if (simpSet.has(word.simp)) {
      duplicates.push(word.simp);
    }
    simpSet.add(word.simp);
  }
}

console.log(`  Total words found: ${allWords.length}`);
console.log(`  Expected: 979`);

if (allWords.length !== 979) {
  console.error(`  ❌ Word count mismatch! Expected 979, got ${allWords.length}`);
  errors++;
}

if (allWords.length !== band3.wordCount) {
  console.error(`  ❌ wordCount field mismatch! Field says ${band3.wordCount}, actually have ${allWords.length}`);
  errors++;
}

if (duplicates.length > 0) {
  console.error(`  ❌ Found ${duplicates.length} duplicate words:`);
  duplicates.forEach(d => console.error(`     - ${d}`));
  errors++;
}

// Test 4: Check unit structure
console.log('✓ Test 4: Unit structure consistency');
for (const [unitId, unit] of Object.entries(band3.units)) {
  if (!('targetWords' in unit)) {
    console.error(`  ❌ Unit ${unitId} missing 'targetWords' field`);
    errors++;
  }
  if (!('allocatedWords' in unit)) {
    console.error(`  ❌ Unit ${unitId} missing 'allocatedWords' field`);
    errors++;
  }
  if (unit.allocatedWords !== unit.words.length) {
    console.error(`  ❌ Unit ${unitId}: allocatedWords (${unit.allocatedWords}) ≠ actual words (${unit.words.length})`);
    errors++;
  }
}

// Test 5: Check word object structure
console.log('✓ Test 5: Word object structure');
const sampleWord = allWords[0];
const requiredWordFields = ['id', 'simp', 'trad', 'pinyin', 'pos', 'en', 'defs'];
let wordStructureOk = true;

for (const field of requiredWordFields) {
  if (!(field in sampleWord)) {
    console.error(`  ❌ Sample word missing field: ${field}`);
    wordStructureOk = false;
    errors++;
  }
}

if (wordStructureOk) {
  console.log('  Word structure looks good');
}

// Test 6: Compare structure to Band 1
console.log('✓ Test 6: Structure matches Band 1/2 format');
const band3Keys = Object.keys(band3).sort();
const band1Keys = Object.keys(band1).sort();

if (JSON.stringify(band3Keys) !== JSON.stringify(band1Keys)) {
  console.warn('  ⚠️  Top-level keys differ from Band 1:');
  console.warn(`     Band 1: ${band1Keys.join(', ')}`);
  console.warn(`     Band 3: ${band3Keys.join(', ')}`);
  warnings++;
}

// Test 7: Check unit distributions are reasonable
console.log('✓ Test 7: Unit distribution sanity check');
let emptyUnits = 0;
let tinyUnits = 0;
let hugeUnits = 0;

for (const [unitId, unit] of Object.entries(band3.units)) {
  if (unitId === '_unallocated') continue;
  if (unitId === 'b3-listening' || unitId === 'b3-speaking') continue; // Practice units can be empty

  if (unit.allocatedWords === 0) {
    console.warn(`  ⚠️  Unit ${unitId} is empty`);
    emptyUnits++;
    warnings++;
  } else if (unit.allocatedWords < 10) {
    console.warn(`  ⚠️  Unit ${unitId} has only ${unit.allocatedWords} words (very small)`);
    tinyUnits++;
    warnings++;
  } else if (unit.allocatedWords > 200) {
    console.warn(`  ⚠️  Unit ${unitId} has ${unit.allocatedWords} words (very large)`);
    hugeUnits++;
    warnings++;
  }
}

// Print summary
console.log('\n📊 UNIT SUMMARY:');
const contentUnits = Object.entries(band3.units)
  .filter(([id]) => !id.startsWith('_') && id !== 'b3-listening' && id !== 'b3-speaking')
  .sort((a, b) => b[1].allocatedWords - a[1].allocatedWords);

for (const [unitId, unit] of contentUnits) {
  console.log(`  ${unitId}: ${unit.allocatedWords} words`);
}

// Final result
console.log('\n' + '='.repeat(50));
if (errors === 0 && warnings === 0) {
  console.log('✅ All validation checks passed!');
  console.log('✨ Band 3 is ready to use!');
} else if (errors === 0) {
  console.log(`✅ No errors found`);
  console.log(`⚠️  ${warnings} warning(s) - review recommended but not critical`);
} else {
  console.log(`❌ Found ${errors} error(s) and ${warnings} warning(s)`);
  console.log('🔧 Please fix errors before using Band 3');
  process.exit(1);
}
