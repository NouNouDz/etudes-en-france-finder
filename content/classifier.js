/**
 * Études en France - Institution Classifier
 * Classifies French higher education institutions into Public/Private/Unknown and specific types.
 * Based on the French Ministry of Higher Education & Research directory and Études en France groupements.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.InstitutionClassifier = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function normalize(str) {
    if (!str) return '';
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // 1. Known Catholic / Private University networks
  const CATHOLIC_FACULTIES = [
    'catholique de louest',
    'catholique de lille',
    'catholique de paris',
    'catholique de lyon',
    'catholique de vendee',
    'institut catholique',
    'universite catholique',
    'facultes catholiques',
    'ices'
  ];

  // 2. Known Private Engineering / Tech schools
  const PRIVATE_ENGINEERING_SCHOOLS = [
    'cesi',
    'epf',
    'esiea',
    'efrei',
    'epita',
    'epitech',
    'ece',
    'isen',
    'supinfo',
    'esme sudria',
    'ipsa',
    '3il',
    'iia',
    'estia',
    'eisti', // historic name of CY Tech before merger, CY Tech now public
    'junia',
    'hei',
    'isep'
  ];

  // 3. Known Private Business / Commercial / Management schools
  const PRIVATE_BUSINESS_SCHOOLS = [
    'edhec',
    'essec',
    'emlyon',
    'kedge',
    'neoma',
    'skema',
    'ipag',
    'omnes education',
    'ieseg',
    'estice',
    'espas',
    'icm',
    'audencia',
    'tbs education',
    'montpellier business school',
    'icn business school',
    'rennes school of business',
    'inseec',
    'isc paris',
    'psb paris school of business',
    'em strasbourg' // Note: EM Strasbourg is university affiliated, but private business stream
  ];

  // 4. Known Public Engineering Networks & Grandes Écoles
  const PUBLIC_ENGINEERING_KEYWORDS = [
    'polytech',
    'centrale lille',
    'centralesupelec',
    'centrale lyon',
    'centrale nantes',
    'centrale marseille',
    'grenoble inp',
    'bordeaux inp',
    'toulouse inp',
    'inp',
    'insa',
    'imt atlantique',
    'imt lille',
    'imt nord europe',
    'mines ales',
    'mines albi',
    'mines paris',
    'mines saint etienne',
    'telecom paris',
    'telecom sudparis',
    'institut polytechnique de paris',
    'ensam',
    'arts et metiers',
    'ensae',
    'ensai',
    'ensimag',
    'enseirb',
    'enseeiht',
    'ensea',
    'esiee',
    'cy tech',
    'ecole polytechnique',
    'ecole nationale des ponts et chaussees',
    'ensta',
    'supaero',
    'isae',
    'enac',
    'utc',
    'utt',
    'utbm',
    'universite de technologie'
  ];

  // 5. Public University indicators (excluding Catholic faculties checked earlier)
  const PUBLIC_UNIVERSITY_INDICATORS = [
    'universite',
    'sorbonne',
    'pantheon',
    'dauphine',
    'sciences po',
    'inalco',
    'ehess',
    'ens uln',
    'ens lyon',
    'ens rennes',
    'ens paris saclay'
  ];

  /**
   * Classify an institution string into structured metadata
   */
  function classify(institutionName) {
    if (!institutionName) {
      return {
        status: 'Unknown',
        type: 'Unknown',
        isPublic: null,
        isPrivate: null,
        isUniversity: false,
        isEngineering: false,
        reason: 'Nom d\'établissement manquant'
      };
    }

    const norm = normalize(institutionName);

    // Rule 1: Check Private Catholic Universities/Institutes first
    for (let i = 0; i < CATHOLIC_FACULTIES.length; i++) {
      if (norm.includes(CATHOLIC_FACULTIES[i])) {
        return {
          status: 'Private',
          type: 'Université catholique (Privée)',
          isPublic: false,
          isPrivate: true,
          isUniversity: true,
          isEngineering: false,
          reason: 'Établissement d\'enseignement supérieur privé catholique'
        };
      }
    }

    // Rule 2: Check Private Engineering / Tech Schools
    for (let i = 0; i < PRIVATE_ENGINEERING_SCHOOLS.length; i++) {
      const kw = PRIVATE_ENGINEERING_SCHOOLS[i];
      // Match as whole word or part of school name
      const regex = new RegExp('(?:^|\\s|/)' + kw + '(?:$|\\s|/)', 'i');
      if (regex.test(norm) || norm.includes(kw)) {
        return {
          status: 'Private',
          type: 'École d\'ingénieurs (Privée)',
          isPublic: false,
          isPrivate: true,
          isUniversity: false,
          isEngineering: true,
          reason: 'École d\'ingénieurs / informatique privée'
        };
      }
    }

    // Rule 3: Check Private Business Schools
    for (let i = 0; i < PRIVATE_BUSINESS_SCHOOLS.length; i++) {
      const kw = PRIVATE_BUSINESS_SCHOOLS[i];
      const regex = new RegExp('(?:^|\\s|/)' + kw + '(?:$|\\s|/)', 'i');
      if (regex.test(norm) || norm.includes(kw)) {
        return {
          status: 'Private',
          type: 'École de commerce (Privée)',
          isPublic: false,
          isPrivate: true,
          isUniversity: false,
          isEngineering: false,
          reason: 'Grande école de commerce / management privée'
        };
      }
    }

    // Rule 4: Check Public Engineering Networks & Schools
    for (let i = 0; i < PUBLIC_ENGINEERING_KEYWORDS.length; i++) {
      const kw = PUBLIC_ENGINEERING_KEYWORDS[i];
      if (norm.includes(kw)) {
        const isUniv = norm.includes('universite') || norm.includes('inp');
        return {
          status: 'Public',
          type: 'École d\'ingénieurs (Publique)',
          isPublic: true,
          isPrivate: false,
          isUniversity: isUniv,
          isEngineering: true,
          reason: 'Grande école d\'ingénieurs publique habilitée CTI'
        };
      }
    }

    // Rule 5: IUT / Public University Institutes
    if (norm.includes('iut') || norm.includes('institut universitaire de technologie')) {
      return {
        status: 'Public',
        type: 'IUT / Institut public',
        isPublic: true,
        isPrivate: false,
        isUniversity: true,
        isEngineering: false,
        reason: 'Institut Universitaire de Technologie public (composante universitaire)'
      };
    }

    // Rule 6: Public Universities
    for (let i = 0; i < PUBLIC_UNIVERSITY_INDICATORS.length; i++) {
      const kw = PUBLIC_UNIVERSITY_INDICATORS[i];
      if (norm.includes(kw)) {
        const isEng = norm.includes('ingenieur') || norm.includes('ufr sciences') || norm.includes('faculte des sciences');
        return {
          status: 'Public',
          type: isEng ? 'Université (Publique) — Pôle Sciences/Ingénierie' : 'Université (Publique)',
          isPublic: true,
          isPrivate: false,
          isUniversity: true,
          isEngineering: isEng,
          reason: 'Université publique française sous tutelle du Ministère'
        };
      }
    }

    // Rule 7: Other Public Institutes (e.g. INALCO, Institut Agro, Champollion)
    if (norm.includes('institut national') || norm.includes('institut public') || norm.includes('ecole nationale')) {
      return {
        status: 'Public',
        type: 'Grand Établissement (Public)',
        isPublic: true,
        isPrivate: false,
        isUniversity: false,
        isEngineering: norm.includes('ingenieur'),
        reason: 'Établissement public d\'enseignement supérieur et de recherche'
      };
    }

    // Rule 8: If uncertain, return Unknown (NEVER GUESS)
    return {
      status: 'Unknown',
      type: 'Autre / Statut inconnu',
      isPublic: null,
      isPrivate: null,
      isUniversity: false,
      isEngineering: false,
      reason: 'Statut public/privé non identifiable avec certitude d\'après les données'
    };
  }

  return {
    normalize: normalize,
    classify: classify
  };
});
