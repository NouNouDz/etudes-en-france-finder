/**
 * Études en France - Formation Relevance Scorer
 * Computes transparent, explainable match scores (0% - 100%)
 * based on user profile, degree, domain, AI/CS keywords, and institution type.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FormationScorer = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function normalizeText(str) {
    if (!str) return '';
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Default User Profile
  const DEFAULT_PROFILE = {
    targetDegree: 'Master', // 'Master', 'Engineering', 'Licence', 'Doctorate', 'Any'
    allowedDegrees: ['Master', 'Engineering'],
    minScore: 60,
    institutionPreferences: {
      allowPublicUniversity: true,
      allowPublicEngineering: true,
      allowPublicOther: true,
      allowPrivate: false,
      allowUnknown: true
    },
    preferredFields: {
      artificialIntelligence: true,
      computerScience: true,
      dataScience: true,
      machineLearning: true,
      softwareEngineering: true,
      cybersecurity: false,
      networks: false
    },
    // Configurable keyword dictionaries
    keywords: {
      ai: [
        'intelligence artificielle',
        'artificial intelligence',
        'ia',
        'ai',
        'machine learning',
        'deep learning',
        'apprentissage automatique',
        'apprentissage profond',
        'computer vision',
        'vision par ordinateur',
        'nlp',
        'traitement automatique du langage',
        'data science',
        'data mining',
        'science des donnees',
        'fouille de donnees',
        'modele de langue',
        'llm'
      ],
      cs: [
        'informatique',
        'computer science',
        'sciences informatiques',
        'genie logiciel',
        'software engineering',
        'systemes d information',
        'systeme d information',
        'algorithmique',
        'algorithmes',
        'systemes distribues',
        'cloud',
        'cloud computing',
        'big data',
        'donnees massives',
        'data',
        'reseaux',
        'cybersecurite',
        'securite informatique',
        'programmation',
        'systemes d information et du numerique',
        'sciences et technologies du logiciel',
        'business intelligence'
      ],
      negativeFields: [
        'langue etrangere',
        'francais langue etrangere',
        'droit des affaires',
        'droit international',
        'lettres',
        'philosophie',
        'journalisme',
        'arts plastiques',
        'musique',
        'ecologie',
        'tourisme',
        'agronomie'
      ]
    }
  };

  /**
   * Safe keyword check supporting abbreviations (whole word matching)
   */
  function containsKeyword(normalizedText, keyword) {
    if (!normalizedText || !keyword) return false;
    const cleanKw = normalizeText(keyword);
    // For short abbreviations like 'ia', 'ai', 'ml', 'nlp', match whole word only
    if (cleanKw.length <= 3) {
      const regex = new RegExp('(?:^|\\s)' + cleanKw + '(?:$|\\s)', 'i');
      return regex.test(normalizedText);
    }
    return normalizedText.includes(cleanKw);
  }

  /**
   * Calculate score for a normalized formation object
   */
  function scoreFormation(formation, userProfile) {
    const profile = Object.assign({}, DEFAULT_PROFILE, userProfile || {});
    const combinedText = normalizeText(
      (formation.title || '') +
      ' ' +
      (formation.diploma || '') +
      ' ' +
      (formation.level || '') +
      ' ' +
      (formation.schoolRaw || '')
    );

    let score = 0;
    const reasons = [];
    const matchedKeywords = [];

    // --- 1. Degree & Level Evaluation (Max ~30 pts) ---
    const isMasterLevel =
      formation.degreeCategory === 'Master' ||
      formation.degreeCategory === 'Engineering' ||
      /bac\s*\+\s*[45]/i.test(formation.level || '') ||
      /master/i.test(formation.diploma || '');

    if (isMasterLevel) {
      score += 30;
      reasons.push({ type: 'pos', text: 'Niveau Master / Bac+4-Bac+5 recherché (+30%)' });
    } else if (formation.degreeCategory === 'Licence') {
      if (profile.targetDegree === 'Licence') {
        score += 25;
        reasons.push({ type: 'pos', text: 'Niveau Licence / Bac+3 (+25%)' });
      } else {
        score -= 20;
        reasons.push({ type: 'neg', text: 'Niveau Licence/Bachelor alors que cible = Master (-20%)' });
      }
    } else if (formation.degreeCategory === 'Doctorate') {
      score += 15;
      reasons.push({ type: 'info', text: 'Niveau Doctorat (+15%)' });
    }

    // --- 2. Field & AI / CS Keywords Evaluation (Max ~45 pts) ---
    let aiMatchCount = 0;
    let csMatchCount = 0;

    // Check AI keywords
    const aiKeywords = (profile.keywords && profile.keywords.ai) || DEFAULT_PROFILE.keywords.ai;
    for (let i = 0; i < aiKeywords.length; i++) {
      const kw = aiKeywords[i];
      if (containsKeyword(combinedText, kw)) {
        aiMatchCount++;
        matchedKeywords.push(kw);
      }
    }

    // Check CS keywords
    const csKeywords = (profile.keywords && profile.keywords.cs) || DEFAULT_PROFILE.keywords.cs;
    for (let i = 0; i < csKeywords.length; i++) {
      const kw = csKeywords[i];
      if (containsKeyword(combinedText, kw)) {
        csMatchCount++;
        if (!matchedKeywords.includes(kw)) {
          matchedKeywords.push(kw);
        }
      }
    }

    if (aiMatchCount > 0) {
      const aiScore = Math.min(30, 20 + aiMatchCount * 5);
      score += aiScore;
      reasons.push({
        type: 'pos',
        text: `Spécialité Cible : Intelligence Artificielle / Data Science (+${aiScore}%)`
      });
    }

    if (csMatchCount > 0) {
      const csScore = Math.min(25, 15 + csMatchCount * 3);
      score += csScore;
      reasons.push({
        type: 'pos',
        text: `Domaine : Informatique / Génie Logiciel (+${csScore}%)`
      });
    }

    // Check Negative / Irrelevant fields penalty
    const negKeywords = (profile.keywords && profile.keywords.negativeFields) || DEFAULT_PROFILE.keywords.negativeFields;
    let negCount = 0;
    for (let i = 0; i < negKeywords.length; i++) {
      const kw = negKeywords[i];
      if (containsKeyword(combinedText, kw)) {
        negCount++;
      }
    }

    // If completely unrelated domain and no CS/AI match
    if (negCount > 0 && csMatchCount === 0 && aiMatchCount === 0) {
      score -= 35;
      reasons.push({
        type: 'neg',
        text: 'Domaine sans lien avec l\'informatique (Droit, Lettres, FLE...) (-35%)'
      });
    } else if (negCount > 0 && (csMatchCount > 0 || aiMatchCount > 0)) {
      // Interdisciplinary or minor penalty
      score -= 10;
      reasons.push({
        type: 'info',
        text: 'Parcours pluridisciplinaire (-10%)'
      });
    }

    // --- 3. Institution Type & Status Evaluation (Max ~25 pts) ---
    const inst = formation.institutionClassification || {};

    if (inst.status === 'Public') {
      if (inst.isUniversity) {
        score += 20;
        reasons.push({ type: 'pos', text: 'Université publique reconnue (+20%)' });
      } else if (inst.isEngineering) {
        score += 20;
        reasons.push({ type: 'pos', text: 'Grande école d\'ingénieurs publique (+20%)' });
      } else {
        score += 15;
        reasons.push({ type: 'pos', text: 'Établissement public (+15%)' });
      }
    } else if (inst.status === 'Private') {
      if (profile.institutionPreferences && profile.institutionPreferences.allowPrivate) {
        score += 5;
        reasons.push({ type: 'info', text: 'Établissement privé autorisé (+5%)' });
      } else {
        score -= 25;
        reasons.push({ type: 'neg', text: 'Établissement privé exclu du profil (-25%)' });
      }
    } else {
      // Unknown status
      if (profile.institutionPreferences && profile.institutionPreferences.allowUnknown) {
        score += 5;
        reasons.push({ type: 'info', text: 'Statut de l\'établissement inconnu' });
      }
    }

    // Normalize final score between 0 and 100
    const finalScore = Math.max(0, Math.min(100, Math.round(score)));

    // Categorize
    let matchLabel = 'Peu pertinent';
    let matchColor = '#6b7280'; // gray

    if (finalScore >= 80) {
      matchLabel = 'Très pertinent';
      matchColor = '#16a34a'; // green
    } else if (finalScore >= 65) {
      matchLabel = 'Pertinent';
      matchColor = '#2563eb'; // blue
    } else if (finalScore >= 45) {
      matchLabel = 'Moyennement pertinent';
      matchColor = '#d97706'; // amber
    } else {
      matchLabel = 'Non pertinent';
      matchColor = '#dc2626'; // red
    }

    return {
      matchScore: finalScore,
      matchLabel: matchLabel,
      matchColor: matchColor,
      reasons: reasons,
      matchedKeywords: matchedKeywords
    };
  }

  return {
    DEFAULT_PROFILE: DEFAULT_PROFILE,
    scoreFormation: scoreFormation,
    containsKeyword: containsKeyword,
    normalizeText: normalizeText
  };
});
