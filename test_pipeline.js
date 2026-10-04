const fs = require('fs');
const path = require('path');

// We can use a lightweight regex DOM mock or cheerio/jsdom, or test parser logic
const Parser = require('./content/parser.js');
const Classifier = require('./content/classifier.js');
const Scorer = require('./content/scorer.js');

console.log('Parser, Classifier, Scorer loaded successfully.');

// Test cards data (derived from the actual HTML inspect script)
const sampleCards = [
  {
    title: "Master indifférencié (recherche et professionnel) Sciences, technologies, santé mention informatique parcours Programmation sûreté et sécurité",
    diploma: "Master indifférencié (recherche et professionnel)",
    degreeCategory: "Master",
    level: "Bac +5",
    schoolRaw: "Université Sorbonne Paris Nord / Institut Galilée",
    city: "Villetaneuse"
  },
  {
    title: "Mastère Spécialisé Business Intelligence",
    diploma: "Mastère spécialisé",
    degreeCategory: "Master",
    level: "Bac +5",
    schoolRaw: "CY Cergy Paris Université / CY Tech école d'ingénieur",
    city: "Saint-Germain-en-Laye"
  },
  {
    title: "Master Droit, économie, gestion mention management des systèmes d'information",
    diploma: "Master indifférencié (recherche et professionnel)",
    degreeCategory: "Master",
    level: "Bac +4",
    schoolRaw: "Université de Bretagne Occidentale / Ecole universitaire de management de l'UBO",
    city: "Brest"
  },
  {
    title: "Master pro Sciences, technologies, santé mention écologie, environnement",
    diploma: "Master professionnel",
    degreeCategory: "Master",
    level: "Bac +4",
    schoolRaw: "Université catholique de l'Ouest / Faculté des sciences - UCO",
    city: "Angers"
  },
  {
    title: "Master Arts, lettres, langues mention français langue étrangère",
    diploma: "Master indifférencié (recherche et professionnel)",
    degreeCategory: "Master",
    level: "Bac +4",
    schoolRaw: "Université Lumière - Lyon 2 / UFR des lettres, sciences du langage et arts",
    city: "Bron"
  }
];

console.log('=== TEST CLASSIFICATION & SCORING ===\n');
sampleCards.forEach((c, idx) => {
  const classification = Classifier.classify(c.schoolRaw);
  c.institutionClassification = classification;
  const scoreResult = Scorer.scoreFormation(c, Scorer.DEFAULT_PROFILE);

  console.log(`[#${idx + 1}] ${c.title.substring(0, 65)}...`);
  console.log(`     School: ${c.schoolRaw}`);
  console.log(`     Type: ${classification.type} | Status: ${classification.status}`);
  console.log(`     MATCH SCORE: ${scoreResult.matchScore}% (${scoreResult.matchLabel})`);
  console.log(`     Keywords: ${scoreResult.matchedKeywords.join(', ') || 'None'}`);
  console.log('     Reasons:');
  scoreResult.reasons.forEach(r => console.log(`       [${r.type}] ${r.text}`));
  console.log('');
});
