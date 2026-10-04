/**
 * Options & Favorites Controller Script
 */

document.addEventListener('DOMContentLoaded', function () {
  // Navigation tabs
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const toast = document.getElementById('toast');
  const sidebarFavCount = document.getElementById('sidebar-fav-count');

  // Profile Inputs
  const currentDegree = document.getElementById('current-degree');
  const targetDegree = document.getElementById('target-degree');
  const optMinScore = document.getElementById('opt-min-score');
  const optMinScoreVal = document.getElementById('opt-min-score-val');

  // Institution Checkboxes
  const optInstUniv = document.getElementById('opt-inst-univ');
  const optInstEng = document.getElementById('opt-inst-eng');
  const optInstPubOther = document.getElementById('opt-inst-pub-other');
  const optInstPrivate = document.getElementById('opt-inst-private');
  const optInstUnknown = document.getElementById('opt-inst-unknown');

  // Keywords
  const aiTagsContainer = document.getElementById('ai-tags-container');
  const aiTagInput = document.getElementById('ai-tag-input');
  const btnAddAiTag = document.getElementById('btn-add-ai-tag');

  const csTagsContainer = document.getElementById('cs-tags-container');
  const csTagInput = document.getElementById('cs-tag-input');
  const btnAddCsTag = document.getElementById('btn-add-cs-tag');

  const negTagsContainer = document.getElementById('neg-tags-container');
  const negTagInput = document.getElementById('neg-tag-input');
  const btnAddNegTag = document.getElementById('btn-add-neg-tag');

  // Favorites
  const favoritesList = document.getElementById('favorites-list');
  const btnExportFavCSV = document.getElementById('btn-export-favorites-csv');
  const btnClearFavorites = document.getElementById('btn-clear-favorites');

  // Backup & Restore
  const btnDownloadBackup = document.getElementById('btn-download-backup');
  const inputRestoreBackup = document.getElementById('input-restore-backup');
  const btnResetDefaults = document.getElementById('btn-reset-defaults');
  const btnSaveAll = document.getElementById('btn-save-all');

  // Active state
  let profile = {};
  let favorites = {};

  // Tab switching
  navItems.forEach(function (btn) {
    btn.addEventListener('click', function () {
      navItems.forEach(function (n) { n.classList.remove('active'); });
      tabPanes.forEach(function (p) { p.classList.remove('active'); });

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // Slider update
  optMinScore.addEventListener('input', function () {
    optMinScoreVal.textContent = `${optMinScore.value}%`;
  });

  function showToast(msg) {
    toast.textContent = msg || 'Modifications enregistrées avec succès !';
    toast.hidden = false;
    setTimeout(function () { toast.hidden = true; }, 2500);
  }

  // Load from Storage
  function loadData() {
    chrome.storage.local.get(['profile', 'favorites'], function (data) {
      profile = data.profile || {
        targetDegree: 'Master',
        currentDegree: 'Licence Informatique',
        minScore: 60,
        allowedDegrees: ['Master', 'Engineering'],
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

      favorites = data.favorites || {};

      // Populate UI
      currentDegree.value = profile.currentDegree || 'Licence Informatique';
      targetDegree.value = profile.targetDegree || 'Master';
      optMinScore.value = profile.minScore !== undefined ? profile.minScore : 60;
      optMinScoreVal.textContent = `${optMinScore.value}%`;

      const inst = profile.institutionPreferences || {};
      optInstUniv.checked = inst.allowPublicUniversity !== false;
      optInstEng.checked = inst.allowPublicEngineering !== false;
      optInstPubOther.checked = inst.allowPublicOther !== false;
      optInstPrivate.checked = inst.allowPrivate === true;
      optInstUnknown.checked = inst.allowUnknown !== false;

      // Render tags
      renderTags(aiTagsContainer, (profile.keywords && profile.keywords.ai) || []);
      renderTags(csTagsContainer, (profile.keywords && profile.keywords.cs) || []);
      renderTags(negTagsContainer, (profile.keywords && profile.keywords.negativeFields) || []);

      // Render favorites
      renderFavorites();
    });
  }

  // Tag rendering
  function renderTags(container, list) {
    container.innerHTML = '';
    list.forEach(function (tag, idx) {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.innerHTML = `
        <span>${tag}</span>
        <button type="button" class="tag-remove" data-idx="${idx}">&times;</button>
      `;
      chip.querySelector('.tag-remove').addEventListener('click', function () {
        list.splice(idx, 1);
        renderTags(container, list);
      });
      container.appendChild(chip);
    });
  }

  function addTag(inputEl, list, container) {
    const val = inputEl.value.trim().toLowerCase();
    if (val && !list.includes(val)) {
      list.push(val);
      renderTags(container, list);
      inputEl.value = '';
    }
  }

  btnAddAiTag.addEventListener('click', function () {
    if (!profile.keywords) profile.keywords = {};
    if (!profile.keywords.ai) profile.keywords.ai = [];
    addTag(aiTagInput, profile.keywords.ai, aiTagsContainer);
  });
  aiTagInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      btnAddAiTag.click();
    }
  });

  btnAddCsTag.addEventListener('click', function () {
    if (!profile.keywords) profile.keywords = {};
    if (!profile.keywords.cs) profile.keywords.cs = [];
    addTag(csTagInput, profile.keywords.cs, csTagsContainer);
  });
  csTagInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      btnAddCsTag.click();
    }
  });

  btnAddNegTag.addEventListener('click', function () {
    if (!profile.keywords) profile.keywords = {};
    if (!profile.keywords.negativeFields) profile.keywords.negativeFields = [];
    addTag(negTagInput, profile.keywords.negativeFields, negTagsContainer);
  });
  negTagInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      btnAddNegTag.click();
    }
  });

  // Render favorites list
  function renderFavorites() {
    const favKeys = Object.keys(favorites);
    sidebarFavCount.textContent = favKeys.length;

    if (favKeys.length === 0) {
      favoritesList.innerHTML = `
        <div class="card" style="text-align:center;padding:40px;color:#6b7280;">
          <p style="font-size:24px;margin-bottom:8px;">☆</p>
          <p>Aucune formation favorite sauvegardée pour l'instant.</p>
          <p style="font-size:12px;">Cliquez sur l'étoile à côté d'une formation sur le catalogue pour l'enregistrer ici.</p>
        </div>
      `;
      return;
    }

    favoritesList.innerHTML = '';
    favKeys.forEach(function (k) {
      const fav = favorites[k];
      const card = document.createElement('div');
      card.className = 'fav-card';

      const scoreColor = fav.score >= 75 ? '#16a34a' : fav.score >= 50 ? '#2563eb' : '#d97706';

      card.innerHTML = `
        <div style="flex:1">
          <h4 class="fav-info-title">${fav.title}</h4>
          <p class="fav-info-meta">🏛️ <strong>${fav.school}</strong> • 📍 ${fav.city || 'Ville non précisée'}</p>
          <div class="fav-badge-row">
            <span class="fav-score-badge" style="background:${scoreColor}">Match: ${fav.score}%</span>
            <span style="font-size:12px;color:#4b5563;">${fav.type || ''}</span>
          </div>
        </div>
        <div class="fav-actions">
          <a href="${fav.url}" target="_blank" class="btn btn-secondary" style="text-decoration:none;">
            Consulter ↗
          </a>
          <button type="button" class="btn btn-secondary text-danger btn-remove-fav" data-id="${fav.id}">
            Supprimer
          </button>
        </div>
      `;

      card.querySelector('.btn-remove-fav').addEventListener('click', function () {
        delete favorites[fav.id];
        chrome.storage.local.set({ favorites: favorites }, function () {
          renderFavorites();
          showToast('Formation retirée des favoris');
        });
      });

      favoritesList.appendChild(card);
    });
  }

  // Clear all favorites
  btnClearFavorites.addEventListener('click', function () {
    if (confirm('Êtes-vous sûr de vouloir supprimer tous vos favoris ?')) {
      favorites = {};
      chrome.storage.local.set({ favorites: favorites }, function () {
        renderFavorites();
        showToast('Tous les favoris ont été effacés.');
      });
    }
  });

  // Export favorites CSV
  btnExportFavCSV.addEventListener('click', function () {
    const favKeys = Object.keys(favorites);
    if (favKeys.length === 0) {
      alert('Aucun favori à exporter.');
      return;
    }

    function escapeCSV(val) {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    }

    const headers = ['ID', 'Intitulé Formation', 'Établissement', 'Type', 'Statut', 'Ville', 'Score (%)', 'URL'];
    const rows = [headers.map(escapeCSV).join(',')];

    favKeys.forEach(function (k) {
      const f = favorites[k];
      rows.push([
        escapeCSV(f.id),
        escapeCSV(f.title),
        escapeCSV(f.school),
        escapeCSV(f.type || ''),
        escapeCSV(f.status || ''),
        escapeCSV(f.city || ''),
        escapeCSV(f.score),
        escapeCSV(f.url)
      ].join(','));
    });

    const csvContent = '\uFEFF' + rows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `etudes-en-france-favoris-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });

  // Save All Settings
  btnSaveAll.addEventListener('click', function () {
    profile.currentDegree = currentDegree.value.trim();
    profile.targetDegree = targetDegree.value;
    profile.minScore = parseInt(optMinScore.value, 10);

    profile.institutionPreferences = {
      allowPublicUniversity: optInstUniv.checked,
      allowPublicEngineering: optInstEng.checked,
      allowPublicOther: optInstPubOther.checked,
      allowPrivate: optInstPrivate.checked,
      allowUnknown: optInstUnknown.checked
    };

    chrome.storage.local.set({ profile: profile }, function () {
      showToast('Tous les réglages ont été enregistrés !');
    });
  });

  // Download Backup JSON
  btnDownloadBackup.addEventListener('click', function () {
    const backupData = {
      profile: profile,
      favorites: favorites,
      exportedAt: new Date().toISOString()
    };
    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `etudes-en-france-assistant-config-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  // Restore Backup JSON
  inputRestoreBackup.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.profile) profile = parsed.profile;
        if (parsed.favorites) favorites = parsed.favorites;
        chrome.storage.local.set({ profile: profile, favorites: favorites }, function () {
          loadData();
          showToast('Configuration restaurée avec succès !');
        });
      } catch (err) {
        alert('Erreur lors de la lecture du fichier JSON : format invalide.');
      }
    };
    reader.readAsText(file);
  });

  // Reset to Defaults
  btnResetDefaults.addEventListener('click', function () {
    if (confirm('Voulez-vous vraiment réinitialiser tous les réglages par défaut ?')) {
      chrome.storage.local.remove(['profile'], function () {
        loadData();
        showToast('Réglages réinitialisés aux valeurs d\'origine.');
      });
    }
  });

  loadData();
});
