/**
 * Études en France - Background Service Worker (Manifest V3)
 */

const DEFAULT_PROFILE = {
  targetDegree: 'Master',
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
  keywords: {
    ai: [
      'intelligence artificielle',
      'artificial intelligence',
      'ia',
      'ai',
      'machine learning',
      'deep learning',
      'apprentissage automatique',
      'computer vision',
      'nlp',
      'data science',
      'data mining'
    ],
    cs: [
      'informatique',
      'computer science',
      'genie logiciel',
      'software engineering',
      'systemes d information',
      'algorithmique',
      'systemes distribues',
      'cloud',
      'big data',
      'data',
      'reseaux',
      'cybersecurite'
    ],
    negativeFields: [
      'langue etrangere',
      'francais langue etrangere',
      'droit des affaires',
      'lettres',
      'philosophie',
      'journalisme',
      'arts plastiques',
      'musique',
      'ecologie'
    ]
  }
};

chrome.runtime.onInstalled.addListener((details) => {
  chrome.storage.local.get(['profile', 'favorites', 'isEnabled'], (data) => {
    if (!data.profile) {
      chrome.storage.local.set({ profile: DEFAULT_PROFILE });
    }
    if (!data.favorites) {
      chrome.storage.local.set({ favorites: {} });
    }
    if (data.isEnabled === undefined) {
      chrome.storage.local.set({ isEnabled: true });
    }
  });
});
