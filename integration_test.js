const fs = require('fs');
const path = require('path');

const Parser = require('./content/parser.js');
const Classifier = require('./content/classifier.js');
const Scorer = require('./content/scorer.js');

const cards = JSON.parse(fs.readFileSync(path.join(__dirname, 'extracted_cards.json'), 'utf-8'));

console.log(`=== RUNNING INTEGRATION TEST ON ${cards.length} REAL FORMATIONS ===\n`);

const profile = Scorer.DEFAULT_PROFILE;
// Let's test with default profile: Master, CS & AI targeted, Public University & Engineering preferred

let visibleCount = 0;
const scoredCards = [];

cards.forEach((c, idx) => {
  c.degreeCategory = Parser.detectDegreeCategory(c.diploma, c.title);
  c.institutionClassification = Classifier.classify(c.schoolRaw);
  
  const scoreData = Scorer.scoreFormation(c, profile);
  c.matchScore = scoreData.matchScore;
  c.matchLabel = scoreData.matchLabel;
  c.reasons = scoreData.reasons;
  c.matchedKeywords = scoreData.matchedKeywords;
  
  // Filtering check
  const inst = c.institutionClassification;
  const prefs = profile.institutionPreferences;
  let matches = true;

  // Status check
  if (inst.status === 'Public' && !prefs.allowPublicUniversity && !prefs.allowPublicEngineering) matches = false;
  if (inst.status === 'Private' && !prefs.allowPrivate) matches = false;
  if (inst.status === 'Unknown' && !prefs.allowUnknown) matches = false;
  
  // Degree check
  if (!profile.allowedDegrees.includes(c.degreeCategory)) matches = false;

  // Score threshold check
  if (c.matchScore < profile.minScore) matches = false;

  if (matches) visibleCount++;
  scoredCards.push(c);

  console.log(`[Card #${idx + 1}]`);
  console.log(`  Title: ${c.title.substring(0, 70)}...`);
  console.log(`  Diploma: ${c.diploma} (Category: ${c.degreeCategory})`);
  console.log(`  School: ${c.schoolRaw}`);
  console.log(`  Institution: ${inst.type} | Status: ${inst.status} (Public: ${inst.isPublic})`);
  console.log(`  City: ${c.city} | Level: ${c.level}`);
  console.log(`  SCORE: ${c.matchScore}% [${c.matchLabel}]`);
  console.log(`  Keywords: [${c.matchedKeywords.join(', ')}]`);
  console.log(`  Passes filter (Threshold >= ${profile.minScore}%): ${matches ? 'YES (VISIBLE)' : 'NO (HIDDEN)'}`);
  console.log('');
});

console.log(`=== TEST SUMMARY ===`);
console.log(`Total formations analyzed: ${cards.length}`);
console.log(`Formations matching profile (>= ${profile.minScore}%): ${visibleCount}`);
console.log(`Formations filtered out: ${cards.length - visibleCount}`);
