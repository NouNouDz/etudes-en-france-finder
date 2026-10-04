/**
 * Formation Finder Popup Script
 */

document.addEventListener('DOMContentLoaded', function () {
  // Elements
  const masterToggle = document.getElementById('master-toggle');
  const pageStatsInfo = document.getElementById('page-stats-info');
  const filterForm = document.getElementById('filter-form');
  const minScoreSlider = document.getElementById('min-score-slider');
  const scoreDisplay = document.getElementById('score-display');
  const btnApply = document.getElementById('btn-apply');
  const btnExportCSV = document.getElementById('btn-export-csv');
  const btnFavorites = document.getElementById('btn-favorites');
  const btnOptions = document.getElementById('btn-options');
  const favCount = document.getElementById('fav-count');

  // Crawler Elements
  const btnPopupScan = document.getElementById('btn-popup-scan');
  const btnPopupViewMatches = document.getElementById('btn-popup-view-matches');
  const popupMatchesCount = document.getElementById('popup-matches-count');

  // Checkbox inputs
  const instUniversity = document.getElementById('inst-university');
  const instPublic = document.getElementById('inst-public');
  const instEngineering = document.getElementById('inst-engineering');
  const instPrivate = document.getElementById('inst-private');
  const instUnknown = document.getElementById('inst-unknown');

  const degMaster = document.getElementById('degree-master');
  const degEngineering = document.getElementById('degree-engineering');
  const degLicence = document.getElementById('degree-licence');
  const degDoctorate = document.getElementById('degree-doctorate');

  const fieldAI = document.getElementById('field-ai');
  const fieldCS = document.getElementById('field-cs');
  const fieldData = document.getElementById('field-data');
  const fieldML = document.getElementById('field-ml');
  const fieldSE = document.getElementById('field-se');
  const fieldCyber = document.getElementById('field-cyber');

  let currentProfile = null;

  // 1. Update slider display
  minScoreSlider.addEventListener('input', function () {
    scoreDisplay.textContent = `${minScoreSlider.value}%`;
  });

  // 2. Load storage and initialize UI
  chrome.storage.local.get(['profile', 'favorites', 'isEnabled', 'scannedMatches'], function (data) {
    const isEnabled = data.isEnabled !== false;
    masterToggle.checked = isEnabled;

    const favorites = data.favorites || {};
    favCount.textContent = Object.keys(favorites).length;

    const scannedMatches = data.scannedMatches || [];
    popupMatchesCount.textContent = scannedMatches.length;

    currentProfile = data.profile || {
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
        cybersecurity: false
      }
    };

    // Populate UI from profile
    const inst = currentProfile.institutionPreferences || {};
    instUniversity.checked = inst.allowPublicUniversity !== false;
    instPublic.checked = inst.allowPublicOther !== false;
    instEngineering.checked = inst.allowPublicEngineering !== false;
    instPrivate.checked = inst.allowPrivate === true;
    instUnknown.checked = inst.allowUnknown !== false;

    const degs = currentProfile.allowedDegrees || ['Master', 'Engineering'];
    degMaster.checked = degs.includes('Master');
    degEngineering.checked = degs.includes('Engineering');
    degLicence.checked = degs.includes('Licence');
    degDoctorate.checked = degs.includes('Doctorate');

    const fields = currentProfile.preferredFields || {};
    fieldAI.checked = fields.artificialIntelligence !== false;
    fieldCS.checked = fields.computerScience !== false;
    fieldData.checked = fields.dataScience !== false;
    fieldML.checked = fields.machineLearning !== false;
    fieldSE.checked = fields.softwareEngineering !== false;
    fieldCyber.checked = fields.cybersecurity === true;

    const minScore = currentProfile.minScore !== undefined ? currentProfile.minScore : 60;
    minScoreSlider.value = minScore;
    scoreDisplay.textContent = `${minScore}%`;

    // Fetch stats from active tab
    queryActiveTabStats();
  });

  // Query tab for page stats
  function queryActiveTabStats() {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (!tabs || !tabs[0]) {
        pageStatsInfo.textContent = 'Aucun onglet actif';
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_PAGE_STATS' }, function (response) {
        if (chrome.runtime.lastError || !response) {
          pageStatsInfo.textContent = 'Hors catalogue';
        } else {
          pageStatsInfo.textContent = `Page ${response.currentPage}/${response.totalPages} • ${response.visibleCount} affichées / ${response.totalCount}`;
          const totalMatches = response.scannedMatchesCount > 0 ? response.scannedMatchesCount : response.visibleCount;
          popupMatchesCount.textContent = totalMatches;

          if (response.isScanning) {
            btnPopupScan.textContent = '⏹️ Arrêter';
            btnPopupScan.classList.add('is-scanning');
          } else {
            btnPopupScan.textContent = 'Scanner tout (Suivant)';
            btnPopupScan.classList.remove('is-scanning');
          }
        }
      });
    });
  }

  // Multi-page auto-scan button
  btnPopupScan.addEventListener('click', function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs && tabs[0]) {
        const isScanning = btnPopupScan.classList.contains('is-scanning');
        const actionType = isScanning ? 'STOP_AUTO_SCAN' : 'START_AUTO_SCAN';
        chrome.tabs.sendMessage(tabs[0].id, { type: actionType }, function () {
          queryActiveTabStats();
        });
      }
    });
  });

  // View consolidated matches button
  btnPopupViewMatches.addEventListener('click', function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs && tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'SHOW_CONSOLIDATED_MATCHES' });
        window.close();
      }
    });
  });

  // 3. Save & Apply Filters
  filterForm.addEventListener('submit', function (e) {
    e.preventDefault();

    // Construct allowed degrees list
    const allowedDegrees = [];
    if (degMaster.checked) allowedDegrees.push('Master');
    if (degEngineering.checked) allowedDegrees.push('Engineering');
    if (degLicence.checked) allowedDegrees.push('Licence');
    if (degDoctorate.checked) allowedDegrees.push('Doctorate');

    const updatedProfile = Object.assign({}, currentProfile, {
      minScore: parseInt(minScoreSlider.value, 10),
      allowedDegrees: allowedDegrees,
      institutionPreferences: {
        allowPublicUniversity: instUniversity.checked,
        allowPublicEngineering: instEngineering.checked,
        allowPublicOther: instPublic.checked,
        allowPrivate: instPrivate.checked,
        allowUnknown: instUnknown.checked
      },
      preferredFields: {
        artificialIntelligence: fieldAI.checked,
        computerScience: fieldCS.checked,
        dataScience: fieldData.checked,
        machineLearning: fieldML.checked,
        softwareEngineering: fieldSE.checked,
        cybersecurity: fieldCyber.checked
      }
    });

    currentProfile = updatedProfile;

    chrome.storage.local.set({ profile: updatedProfile }, function () {
      btnApply.textContent = '✓ Filtres appliqués !';
      btnApply.style.background = '#16a34a';

      // Notify content script
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs && tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'UPDATE_FILTERS' }, function (res) {
            if (res) {
              pageStatsInfo.textContent = `${res.visibleCount} affichées / ${res.totalCount}`;
            }
          });
        }
      });

      setTimeout(function () {
        btnApply.textContent = '✓ Appliquer les filtres';
        btnApply.style.background = '';
      }, 1500);
    });
  });

  // 4. Master toggle switch
  masterToggle.addEventListener('change', function () {
    const enabled = masterToggle.checked;
    chrome.storage.local.set({ isEnabled: enabled }, function () {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs && tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'UPDATE_FILTERS' });
        }
      });
    });
  });

  // 5. Export CSV
  btnExportCSV.addEventListener('click', function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs && tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'EXPORT_CSV' });
      }
    });
  });

  // 6. Favorites button
  btnFavorites.addEventListener('click', function () {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    }
  });

  // 7. Options / Settings button
  btnOptions.addEventListener('click', function () {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    }
  });
});
