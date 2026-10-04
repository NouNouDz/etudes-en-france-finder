/**
 * Études en France - Main Content Script
 * Orchestrates parsing, scoring, classification, DOM badging, filtering, export,
 * and automated multi-page navigation crawler ("Suivant").
 */

(function () {
  'use strict';

  // Prevent multiple injections
  if (window.__EEF_EXTENSION_LOADED__) return;
  window.__EEF_EXTENSION_LOADED__ = true;

  // Active state
  let userProfile = null;
  let favorites = {};
  let isEnabled = true;
  let showAll = false;
  let currentSearchQuery = '';
  let currentSort = 'score-desc';
  let processedFormations = new Map();
  let observer = null;
  let debounceTimer = null;

  // Multi-page Auto-Scan crawler state
  let isScanning = false;
  let scannedMatchesMap = new Map();
  let totalPagesDetected = 1;
  let currentPageDetected = 1;
  let scanStepTimer = null;

  /**
   * Safe storage getter
   */
  function loadStorage(callback) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['profile', 'favorites', 'isEnabled', 'showAll', 'scannedMatches'], function (data) {
        userProfile = data.profile || window.FormationScorer.DEFAULT_PROFILE;
        favorites = data.favorites || {};
        isEnabled = data.isEnabled !== false;
        showAll = data.showAll === true;

        if (data.scannedMatches && Array.isArray(data.scannedMatches)) {
          data.scannedMatches.forEach(function (f) {
            scannedMatchesMap.set(f.id, f);
          });
        }

        if (callback) callback();
      });
    } else {
      userProfile = window.FormationScorer.DEFAULT_PROFILE;
      favorites = {};
      if (callback) callback();
    }
  }

  /**
   * Save favorites to storage
   */
  function saveFavorites() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ favorites: favorites });
    }
  }

  /**
   * Save scanned matches to storage
   */
  function saveScannedMatches() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const matchesArray = Array.from(scannedMatchesMap.values()).map(function (f) {
        // Strip DOM element reference before serialization
        const copy = Object.assign({}, f);
        delete copy.cardElement;
        return copy;
      });
      chrome.storage.local.set({ scannedMatches: matchesArray });
    }
  }

  /**
   * Find the cards container
   */
  function getCardsContainer() {
    const cards = document.querySelectorAll('.fr-card');
    if (cards.length > 0) {
      return cards[0].closest('.flex.flex-col.gap-4') || cards[0].parentElement;
    }
    return document.querySelector('.fr-mb-6v.flex.flex-col.gap-4') || document.querySelector('main');
  }

  /**
   * Inspect current pagination state from the DOM
   */
  function getPaginationInfo() {
    const nav = document.querySelector('nav[aria-label="pagination"]') || document.querySelector('.pagination__container');
    if (!nav) {
      return { currentPage: 1, totalPages: 1, hasNext: false, nextBtn: null };
    }

    let curPage = 1;
    let totPages = 1;

    // 1. Check selected page button
    const selectedBtn =
      nav.querySelector('button[aria-current="true"]') ||
      nav.querySelector('.fr-pagination__link.selected');

    if (selectedBtn) {
      const title = selectedBtn.getAttribute('title') || selectedBtn.textContent || '';
      const m = title.match(/page\s*(\d+)\s*sur\s*(\d+)/i);
      if (m) {
        curPage = parseInt(m[1], 10);
        totPages = parseInt(m[2], 10);
      } else {
        const num = parseInt(selectedBtn.textContent.trim(), 10);
        if (!isNaN(num)) curPage = num;
      }
    }

    // 2. Check all page buttons to find highest page if total not yet parsed
    if (totPages === 1) {
      const pageBtns = nav.querySelectorAll(
        '.fr-pagination__link:not(.fr-pagination__link--prev):not(.fr-pagination__link--next)'
      );
      pageBtns.forEach(function (btn) {
        const t = btn.getAttribute('title') || '';
        const m = t.match(/page\s*(\d+)\s*sur\s*(\d+)/i);
        if (m) {
          totPages = Math.max(totPages, parseInt(m[2], 10));
        } else {
          const num = parseInt(btn.textContent.trim(), 10);
          if (!isNaN(num)) totPages = Math.max(totPages, num);
        }
      });
    }

    // 3. Find Next button ("Suivant")
    const nextBtn =
      nav.querySelector('.fr-pagination__link--next') ||
      nav.querySelector('button[title*="Suivant" i]') ||
      nav.querySelector('button[aria-label*="Suivant" i]');

    const isNextDisabled =
      !nextBtn ||
      nextBtn.hasAttribute('disabled') ||
      nextBtn.disabled === true ||
      nextBtn.getAttribute('aria-disabled') === 'true' ||
      nextBtn.classList.contains('disabled');

    const hasNext = !!(nextBtn && !isNextDisabled);

    return {
      currentPage: curPage,
      totalPages: Math.max(curPage, totPages),
      hasNext: hasNext,
      nextBtn: hasNext ? nextBtn : null
    };
  }

  /**
   * Collect all matching formations on the current page into scannedMatchesMap
   */
  function collectCurrentPageMatches() {
    processedFormations.forEach(function (formation) {
      if (doesFormationMatch(formation)) {
        scannedMatchesMap.set(formation.id, formation);
      }
    });
    saveScannedMatches();
  }

  /**
   * Start multi-page auto scan crawler
   */
  function startAutoScan() {
    if (isScanning) return;
    isScanning = true;

    // Apply filters and collect matches from current page first
    applyFiltersAndBadges();
    collectCurrentPageMatches();

    const pagInfo = getPaginationInfo();
    currentPageDetected = pagInfo.currentPage;
    totalPagesDetected = pagInfo.totalPages;

    renderToolbar(processedFormations.size, getVisibleCount());
    stepAutoScan();
  }

  /**
   * Stop auto-scan crawler
   */
  function stopAutoScan(isComplete) {
    isScanning = false;
    clearTimeout(scanStepTimer);
    saveScannedMatches();
    renderToolbar(processedFormations.size, getVisibleCount());

    if (isComplete) {
      // Immediately open the consolidated matches modal!
      showConsolidatedMatchesModal();
    }
  }

  /**
   * Single step of auto-scan crawler: processes page and clicks "Suivant"
   */
  function stepAutoScan() {
    if (!isScanning) return;

    const pagInfo = getPaginationInfo();
    currentPageDetected = pagInfo.currentPage;
    totalPagesDetected = pagInfo.totalPages;

    collectCurrentPageMatches();
    renderToolbar(processedFormations.size, getVisibleCount());

    if (!pagInfo.hasNext || pagInfo.currentPage >= pagInfo.totalPages) {
      // Reached the end of catalogue
      stopAutoScan(true);
      return;
    }

    const prevPage = pagInfo.currentPage;
    const nextBtn = pagInfo.nextBtn;

    if (nextBtn) {
      // Click Suivant
      nextBtn.click();

      // Poll until page number changes or new cards mount
      let attempts = 0;
      const maxAttempts = 35; // 35 * 250ms = ~8.7s timeout

      const interval = setInterval(function () {
        if (!isScanning) {
          clearInterval(interval);
          return;
        }

        attempts++;
        const newPag = getPaginationInfo();

        if (newPag.currentPage !== prevPage || attempts >= maxAttempts) {
          clearInterval(interval);
          // Wait 800ms settle delay for cards to re-render in React
          scanStepTimer = setTimeout(function () {
            if (!isScanning) return;
            applyFiltersAndBadges();
            collectCurrentPageMatches();
            stepAutoScan();
          }, 800);
        }
      }, 250);
    } else {
      stopAutoScan(true);
    }
  }

  /**
   * Inject or update the in-page toolbar
   */
  function renderToolbar(totalCount, visibleCount) {
    if (!isEnabled) {
      const existing = document.getElementById('eef-toolbar');
      if (existing) existing.remove();
      return;
    }

    const container = getCardsContainer();
    if (!container || !container.parentElement) return;

    let toolbar = document.getElementById('eef-toolbar');
    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.id = 'eef-toolbar';
      toolbar.className = 'eef-toolbar';
      container.parentElement.insertBefore(toolbar, container);
    }

    const favCount = Object.keys(favorites).length;
    const pagInfo = getPaginationInfo();
    currentPageDetected = pagInfo.currentPage;
    totalPagesDetected = pagInfo.totalPages;

    const totalRetenuesCount = scannedMatchesMap.size > 0 ? scannedMatchesMap.size : visibleCount;
    const progressPercent = Math.min(100, Math.round((currentPageDetected / Math.max(1, totalPagesDetected)) * 100));

    toolbar.innerHTML = `
      <div class="eef-toolbar-header">
        <div class="eef-toolbar-title-wrap">
          <svg class="eef-toolbar-logo" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="15" fill="#000091" stroke="#fff" stroke-width="2"/>
            <path d="M16 8L24 13L16 18L8 13L16 8Z" fill="#fff"/>
            <path d="M11 15.5V20.5C11 22.5 13.5 24 16 24C18.5 24 21 22.5 21 20.5V15.5" stroke="#fff" stroke-width="1.8" fill="none"/>
            <circle cx="23" cy="10" r="3" fill="#FBBF24"/>
          </svg>
          <h2 class="eef-toolbar-title">Assistant Catalogue Études en France</h2>
          <span class="eef-toolbar-badge">${showAll ? 'Mode complet' : 'Filtrage actif'}</span>
        </div>
        <div class="eef-toolbar-actions">
          <button id="eef-btn-auto-scan" class="eef-btn eef-btn-scan ${isScanning ? 'is-scanning' : ''}" title="Navigue automatiquement sur 'Suivant' et collecte toutes les formations compatibles">
            ${isScanning ? '⏹️ Arrêter le scan' : '🚀 Scanner toutes les pages (Suivant)'}
          </button>
          <button id="eef-btn-view-matches" class="eef-btn eef-btn-results" title="Afficher la liste consolidée de toutes les formations retenues">
            ✨ Formations retenues (${totalRetenuesCount})
          </button>
          <button id="eef-toggle-show-all" class="eef-btn ${showAll ? 'eef-btn-active' : ''}">
            ${showAll ? '👁️ Réactiver le filtre' : '🌐 Afficher tout'}
          </button>
          <button id="eef-export-csv" class="eef-btn eef-btn-primary" title="Exporter les résultats au format CSV">
            📥 Exporter CSV
          </button>
          <button id="eef-open-options" class="eef-btn" title="Ouvrir les réglages et favoris">
            ⭐ Favoris (${favCount}) / Profil ⚙️
          </button>
        </div>
      </div>

      ${isScanning ? `
        <div class="eef-scan-progress-bar-wrap">
          <div class="eef-scan-progress-text">
            <span>🔄 Auto-Scan en cours... Page ${currentPageDetected} sur ${totalPagesDetected} (Suivant)</span>
            <span>${scannedMatchesMap.size} formations retenues</span>
          </div>
          <div class="eef-progress-track">
            <div class="eef-progress-fill" style="width: ${progressPercent}%;"></div>
          </div>
        </div>
      ` : ''}

      <div class="eef-toolbar-controls">
        <div class="eef-controls-left">
          <input type="text" id="eef-search-input" class="eef-search-input" placeholder="🔍 Rechercher (nom, ville, mot-clé)..." value="${currentSearchQuery}">
          <select id="eef-sort-select" class="eef-sort-select">
            <option value="score-desc" ${currentSort === 'score-desc' ? 'selected' : ''}>Trier par : Pertinence ↓</option>
            <option value="score-asc" ${currentSort === 'score-asc' ? 'selected' : ''}>Trier par : Pertinence ↑</option>
            <option value="title-asc" ${currentSort === 'title-asc' ? 'selected' : ''}>Trier par : Nom de formation</option>
            <option value="school-asc" ${currentSort === 'school-asc' ? 'selected' : ''}>Trier par : Établissement</option>
            <option value="city-asc" ${currentSort === 'city-asc' ? 'selected' : ''}>Trier par : Ville</option>
          </select>
        </div>
        <p class="eef-stats-text">
          Page ${currentPageDetected}/${totalPagesDetected} • Affichées : <span class="eef-stats-highlight">${visibleCount}</span> sur ${totalCount}
          ${!showAll && totalCount > visibleCount ? `(<span style="color:#dc2626">${totalCount - visibleCount} masquées</span>)` : ''}
        </p>
      </div>
    `;

    // Bind toolbar events
    toolbar.querySelector('#eef-btn-auto-scan').addEventListener('click', function () {
      if (isScanning) {
        stopAutoScan(false);
      } else {
        startAutoScan();
      }
    });

    toolbar.querySelector('#eef-btn-view-matches').addEventListener('click', function () {
      showConsolidatedMatchesModal();
    });

    toolbar.querySelector('#eef-toggle-show-all').addEventListener('click', function () {
      showAll = !showAll;
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ showAll: showAll });
      }
      applyFiltersAndBadges();
    });

    toolbar.querySelector('#eef-export-csv').addEventListener('click', function () {
      exportVisibleFormationsCSV();
    });

    toolbar.querySelector('#eef-open-options').addEventListener('click', function () {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        alert('Veuillez ouvrir les options depuis l\'icône de l\'extension.');
      }
    });

    const searchInput = toolbar.querySelector('#eef-search-input');
    searchInput.addEventListener('input', function (e) {
      currentSearchQuery = e.target.value.trim().toLowerCase();
      applyFiltersAndBadges();
    });

    const sortSelect = toolbar.querySelector('#eef-sort-select');
    sortSelect.addEventListener('change', function (e) {
      currentSort = e.target.value;
      sortCardElements();
    });
  }

  /**
   * Displays modal breakdown for a formation's match score
   */
  function showScoreModal(formation) {
    const existing = document.getElementById('eef-score-modal');
    if (existing) existing.remove();

    const backdrop = document.createElement('div');
    backdrop.id = 'eef-score-modal';
    backdrop.className = 'eef-modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'eef-modal';

    const reasonsHtml = formation.reasons.map(function (r) {
      const cls = r.type === 'pos' ? 'is-pos' : r.type === 'neg' ? 'is-neg' : 'is-info';
      const icon = r.type === 'pos' ? '✓' : r.type === 'neg' ? '✗' : 'ℹ';
      return `<li class="eef-reason-item ${cls}"><span>${icon}</span> <span>${r.text}</span></li>`;
    }).join('');

    const keywordsHtml = formation.matchedKeywords.length > 0
      ? formation.matchedKeywords.map(function (k) { return `<span class="eef-modal-keyword-badge">${k}</span>`; }).join('')
      : '<span style="font-size:12px;color:#6b7280">Aucun mot-clé spécifique détecté</span>';

    modal.innerHTML = `
      <button class="eef-modal-close" id="eef-modal-close-btn">&times;</button>
      <h3 class="eef-modal-title">${formation.title}</h3>
      <p style="font-size:13px;color:#4b5563;margin-top:0;margin-bottom:12px;">
        🏛️ <strong>${formation.schoolRaw}</strong> • 📍 ${formation.city || 'Ville non spécifiée'}
      </p>
      <div class="eef-modal-score-banner" style="background:${formation.matchColor}">
        <div>
          <div class="eef-modal-score-val">${formation.matchScore}%</div>
          <div style="font-size:14px;font-weight:600">${formation.matchLabel}</div>
        </div>
        <div style="text-align:right">
          <div class="eef-modal-score-sub">Calculé par l'extension</div>
          <div style="font-size:12px;font-weight:600">Profil : ${userProfile.targetDegree || 'Master Informatique'}</div>
        </div>
      </div>

      <h4 style="font-size:14px;margin:12px 0 6px 0;font-weight:700;">Détail du calcul :</h4>
      <ul class="eef-modal-reasons-list">
        ${reasonsHtml}
      </ul>

      <h4 style="font-size:14px;margin:12px 0 6px 0;font-weight:700;">Mots-clés correspondants :</h4>
      <div class="eef-modal-keywords-wrap">
        ${keywordsHtml}
      </div>

      <div style="margin-top:18px;text-align:right">
        <a href="${formation.url}" target="_blank" class="eef-btn eef-btn-primary" style="text-decoration:none;">
          Consulter sur Études en France ↗
        </a>
      </div>
    `;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) backdrop.remove();
    });

    modal.querySelector('#eef-modal-close-btn').addEventListener('click', function () {
      backdrop.remove();
    });
  }

  /**
   * Consolidated Matches Modal: displays ONLY the matching formations collected across all pages
   */
  function showConsolidatedMatchesModal() {
    // If no multi-page scan was performed yet, take current page matches
    if (scannedMatchesMap.size === 0) {
      collectCurrentPageMatches();
    }

    const existing = document.getElementById('eef-consolidated-modal-wrap');
    if (existing) existing.remove();

    const backdrop = document.createElement('div');
    backdrop.id = 'eef-consolidated-modal-wrap';
    backdrop.className = 'eef-modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'eef-consolidated-modal';

    let matchesArray = Array.from(scannedMatchesMap.values());
    let modalSort = 'score-desc';
    let modalQuery = '';

    function getFilteredMatches() {
      return matchesArray.filter(function (f) {
        if (!modalQuery) return true;
        const q = modalQuery.toLowerCase();
        const str = ((f.title || '') + ' ' + (f.schoolRaw || '') + ' ' + (f.city || '') + ' ' + (f.matchedKeywords || []).join(' ')).toLowerCase();
        return str.includes(q);
      }).sort(function (a, b) {
        if (modalSort === 'score-desc') return b.matchScore - a.matchScore;
        if (modalSort === 'score-asc') return a.matchScore - b.matchScore;
        if (modalSort === 'title-asc') return (a.title || '').localeCompare(b.title || '');
        if (modalSort === 'school-asc') return (a.schoolRaw || '').localeCompare(b.schoolRaw || '');
        if (modalSort === 'city-asc') return (a.city || '').localeCompare(b.city || '');
        return 0;
      });
    }

    function renderModalContent() {
      const filtered = getFilteredMatches();

      modal.innerHTML = `
        <div class="eef-consolidated-header">
          <div>
            <h2>🎯 Formations Retenues (${matchesArray.length})</h2>
            <p>Formations correspondant strictement à vos filtres (Master / Informatique / IA / Universités & Écoles publiques)</p>
          </div>
          <button class="eef-modal-close" id="eef-cons-close-btn">&times;</button>
        </div>

        <div class="eef-consolidated-toolbar">
          <div class="flex items-center gap-2">
            <input type="text" id="eef-cons-search" class="eef-search-input" placeholder="🔍 Filtrer les résultats retenus..." value="${modalQuery}">
            <select id="eef-cons-sort" class="eef-sort-select">
              <option value="score-desc" ${modalSort === 'score-desc' ? 'selected' : ''}>Pertinence ↓</option>
              <option value="score-asc" ${modalSort === 'score-asc' ? 'selected' : ''}>Pertinence ↑</option>
              <option value="title-asc" ${modalSort === 'title-asc' ? 'selected' : ''}>Nom formation</option>
              <option value="school-asc" ${modalSort === 'school-asc' ? 'selected' : ''}>Établissement</option>
              <option value="city-asc" ${modalSort === 'city-asc' ? 'selected' : ''}>Ville</option>
            </select>
          </div>
          <div class="flex items-center gap-2">
            <button id="eef-cons-export-btn" class="eef-btn eef-btn-primary">
              📥 Exporter ces formations (CSV)
            </button>
            <button id="eef-cons-fav-all-btn" class="eef-btn">
              ⭐ Tout ajouter aux favoris
            </button>
          </div>
        </div>

        <div class="eef-consolidated-body" id="eef-cons-body">
          ${filtered.length === 0 ? `
            <div style="text-align:center;padding:40px;color:#6b7280;">
              <p style="font-size:24px;">🔍</p>
              <p>Aucune formation retenue avec les critères actuels.</p>
            </div>
          ` : filtered.map(function (f) {
            const inst = f.institutionClassification || {};
            const isFav = !!favorites[f.id];
            const tagClass = inst.status === 'Public' ? 'is-public' : inst.status === 'Private' ? 'is-private' : 'is-unknown';
            const instIcon = inst.status === 'Public' ? (inst.isEngineering ? '⚙️' : '🏛️') : (inst.status === 'Private' ? '🔒' : '❓');

            return `
              <div class="eef-match-card">
                <div class="eef-match-top">
                  <div>
                    <a href="${f.url}" target="_blank" class="eef-match-title">${f.title}</a>
                    <div class="eef-match-meta">
                      <span>🏛️ <strong>${f.schoolRaw}</strong></span>
                      <span>📍 ${f.city || 'Ville non précisée'}</span>
                      <span>🎓 ${f.level || f.diploma || ''}</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="eef-score-pill" style="background:${f.matchColor}">Match: ${f.matchScore}%</span>
                    <button class="eef-favorite-btn ${isFav ? 'is-active' : ''}" data-id="${f.id}" title="${isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}">
                      ${isFav ? '★' : '☆'}
                    </button>
                  </div>
                </div>
                <div class="eef-match-bottom">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="eef-institution-tag ${tagClass}">
                      ${instIcon} ${inst.type} (${inst.status === 'Public' ? 'Public' : inst.status === 'Private' ? 'Privé' : 'Inconnu'})
                    </span>
                    ${f.matchedKeywords && f.matchedKeywords.length > 0 ? f.matchedKeywords.map(function (k) {
                      return `<span class="eef-modal-keyword-badge">${k}</span>`;
                    }).join('') : ''}
                  </div>
                  <div>
                    <a href="${f.url}" target="_blank" class="eef-btn eef-btn-primary" style="text-decoration:none;font-size:11px;padding:4px 10px;">
                      Consulter sur le catalogue ↗
                    </a>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div class="eef-consolidated-footer">
          <span style="font-size:13px;color:#4b5563;">
            Total : <strong>${filtered.length}</strong> formation(s) retenue(s) sur l'ensemble des pages scannées
          </span>
          <button id="eef-cons-close-footer" class="eef-btn">Fermer</button>
        </div>
      `;

      // Event bindings inside modal
      modal.querySelector('#eef-cons-close-btn').addEventListener('click', function () {
        backdrop.remove();
      });
      modal.querySelector('#eef-cons-close-footer').addEventListener('click', function () {
        backdrop.remove();
      });

      const searchIn = modal.querySelector('#eef-cons-search');
      searchIn.addEventListener('input', function (e) {
        modalQuery = e.target.value;
        renderModalContent();
        const newSearchIn = modal.querySelector('#eef-cons-search');
        newSearchIn.focus();
        newSearchIn.setSelectionRange(newSearchIn.value.length, newSearchIn.value.length);
      });

      const sortIn = modal.querySelector('#eef-cons-sort');
      sortIn.addEventListener('change', function (e) {
        modalSort = e.target.value;
        renderModalContent();
      });

      modal.querySelector('#eef-cons-export-btn').addEventListener('click', function () {
        exportMatchesArrayCSV(filtered);
      });

      modal.querySelector('#eef-cons-fav-all-btn').addEventListener('click', function () {
        filtered.forEach(function (f) {
          const inst = f.institutionClassification || {};
          favorites[f.id] = {
            id: f.id,
            title: f.title,
            school: f.schoolRaw,
            city: f.city,
            type: inst.type,
            status: inst.status,
            score: f.matchScore,
            url: f.url,
            addedAt: new Date().toISOString()
          };
        });
        saveFavorites();
        renderModalContent();
        renderToolbar(processedFormations.size, getVisibleCount());
        alert(`${filtered.length} formation(s) ajoutée(s) aux favoris !`);
      });

      modal.querySelectorAll('.eef-favorite-btn').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          const fid = btn.getAttribute('data-id');
          const f = matchesArray.find(function (item) { return item.id === fid; });
          if (!f) return;

          if (favorites[fid]) {
            delete favorites[fid];
          } else {
            const inst = f.institutionClassification || {};
            favorites[fid] = {
              id: f.id,
              title: f.title,
              school: f.schoolRaw,
              city: f.city,
              type: inst.type,
              status: inst.status,
              score: f.matchScore,
              url: f.url,
              addedAt: new Date().toISOString()
            };
          }
          saveFavorites();
          renderModalContent();
          renderToolbar(processedFormations.size, getVisibleCount());
        });
      });
    }

    renderModalContent();
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) backdrop.remove();
    });
  }

  /**
   * Badging and visual injection onto a single card
   */
  function badgeCard(formation) {
    const cardEl = formation.cardElement;
    if (!cardEl) return;

    let badgeContainer = cardEl.querySelector('.eef-card-badge-container');
    if (!badgeContainer) {
      badgeContainer = document.createElement('div');
      badgeContainer.className = 'eef-card-badge-container';
      cardEl.appendChild(badgeContainer);
    }

    const isFav = !!favorites[formation.id];
    const inst = formation.institutionClassification || {};

    let tagClass = 'is-unknown';
    let instIcon = '❓';
    if (inst.status === 'Public') {
      tagClass = 'is-public';
      instIcon = inst.isEngineering ? '⚙️' : '🏛️';
    } else if (inst.status === 'Private') {
      tagClass = 'is-private';
      instIcon = '🔒';
    }

    badgeContainer.innerHTML = `
      <div class="eef-card-left">
        <div class="eef-score-pill" style="background:${formation.matchColor}" title="Cliquez pour voir le détail du score">
          <span>Match: ${formation.matchScore}%</span>
          <span style="font-size:10px;opacity:0.9">ℹ️</span>
        </div>
        <div class="eef-institution-tag ${tagClass}" title="${inst.reason || ''}">
          <span>${instIcon}</span>
          <span>${inst.type}</span>
          <span>(${inst.status === 'Public' ? 'Public' : inst.status === 'Private' ? 'Privé' : 'Inconnu'})</span>
        </div>
      </div>
      <div>
        <button class="eef-favorite-btn ${isFav ? 'is-active' : ''}" title="${isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}">
          ${isFav ? '★' : '☆'}
        </button>
      </div>
    `;

    // Stop click bubbling on the entire badge container to prevent DSFR card navigation
    badgeContainer.addEventListener('click', function (e) {
      e.stopPropagation();
    });

    // Click score pill to open modal
    const scorePill = badgeContainer.querySelector('.eef-score-pill');
    scorePill.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
      showScoreModal(formation);
    });

    // Favorite toggle button
    const favBtn = badgeContainer.querySelector('.eef-favorite-btn');
    favBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
      if (favorites[formation.id]) {
        delete favorites[formation.id];
        favBtn.classList.remove('is-active');
        favBtn.innerHTML = '☆';
        favBtn.title = 'Ajouter aux favoris';
      } else {
        favorites[formation.id] = {
          id: formation.id,
          title: formation.title,
          school: formation.schoolRaw,
          city: formation.city,
          type: inst.type,
          status: inst.status,
          score: formation.matchScore,
          url: formation.url,
          addedAt: new Date().toISOString()
        };
        favBtn.classList.add('is-active');
        favBtn.innerHTML = '★';
        favBtn.title = 'Retirer des favoris';
      }
      saveFavorites();
      renderToolbar(processedFormations.size, getVisibleCount());
    });
  }

  /**
   * Determine if a formation matches current filtering criteria
   */
  function doesFormationMatch(formation) {
    if (!isEnabled || showAll) return true;

    const inst = formation.institutionClassification || {};
    const prefs = userProfile.institutionPreferences || {};

    // 1. Institution Status Filter
    if (inst.status === 'Public') {
      if (inst.isEngineering && !prefs.allowPublicEngineering && !prefs.allowPublicUniversity) {
        return false;
      }
      if (inst.isUniversity && !prefs.allowPublicUniversity) {
        return false;
      }
    } else if (inst.status === 'Private') {
      if (!prefs.allowPrivate) return false;
    } else if (inst.status === 'Unknown') {
      if (!prefs.allowUnknown) return false;
    }

    // 2. Degree Filter
    if (userProfile.allowedDegrees && userProfile.allowedDegrees.length > 0) {
      if (!userProfile.allowedDegrees.includes(formation.degreeCategory)) {
        return false;
      }
    }

    // 3. Minimum Match Score
    const minScore = userProfile.minScore || 0;
    if (formation.matchScore < minScore) {
      return false;
    }

    // 4. Quick Search Query
    if (currentSearchQuery) {
      const q = currentSearchQuery.toLowerCase();
      const searchable = (
        (formation.title || '') + ' ' +
        (formation.schoolRaw || '') + ' ' +
        (formation.city || '') + ' ' +
        (formation.matchedKeywords || []).join(' ')
      ).toLowerCase();

      if (!searchable.includes(q)) {
        return false;
      }
    }

    return true;
  }

  function getVisibleCount() {
    let count = 0;
    processedFormations.forEach(function (formation) {
      if (doesFormationMatch(formation)) count++;
    });
    return count;
  }

  /**
   * Apply filters and badging to all cards on the current page
   */
  function applyFiltersAndBadges() {
    const cards = window.FormationParser.parseAll(document);
    let visibleCount = 0;

    cards.forEach(function (formation) {
      formation.institutionClassification = window.InstitutionClassifier.classify(formation.schoolRaw);
      const scoreData = window.FormationScorer.scoreFormation(formation, userProfile);
      formation.matchScore = scoreData.matchScore;
      formation.matchLabel = scoreData.matchLabel;
      formation.matchColor = scoreData.matchColor;
      formation.reasons = scoreData.reasons;
      formation.matchedKeywords = scoreData.matchedKeywords;

      processedFormations.set(formation.id, formation);

      // Inject badge
      badgeCard(formation);

      // Filtering visibility
      const isVisible = doesFormationMatch(formation);
      if (isVisible) {
        formation.cardElement.classList.remove('eef-formation-hidden');
        visibleCount++;
      } else {
        formation.cardElement.classList.add('eef-formation-hidden');
      }
    });

    renderToolbar(cards.length, visibleCount);
  }

  /**
   * Sort card elements in the DOM
   */
  function sortCardElements() {
    const container = getCardsContainer();
    if (!container) return;

    const cardsArray = Array.from(processedFormations.values());

    cardsArray.sort(function (a, b) {
      if (currentSort === 'score-desc') return b.matchScore - a.matchScore;
      if (currentSort === 'score-asc') return a.matchScore - b.matchScore;
      if (currentSort === 'title-asc') return (a.title || '').localeCompare(b.title || '');
      if (currentSort === 'school-asc') return (a.schoolRaw || '').localeCompare(b.schoolRaw || '');
      if (currentSort === 'city-asc') return (a.city || '').localeCompare(b.city || '');
      return 0;
    });

    cardsArray.forEach(function (formation) {
      if (formation.cardElement && formation.cardElement.parentElement === container) {
        container.appendChild(formation.cardElement);
      }
    });
  }

  /**
   * Export an arbitrary array of formations to CSV
   */
  function exportMatchesArrayCSV(formationsArray) {
    if (!formationsArray || formationsArray.length === 0) {
      alert('Aucune formation à exporter.');
      return;
    }

    const headers = [
      'ID Formation',
      'Intitulé Formation',
      'Établissement',
      'Type Établissement',
      'Statut',
      'Diplôme',
      'Niveau',
      'Ville',
      'Score de pertinence (%)',
      'Mots-clés correspondants',
      'Lien Candidature'
    ];

    function escapeCSV(val) {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    }

    const rows = [headers.map(escapeCSV).join(',')];

    formationsArray.forEach(function (f) {
      const inst = f.institutionClassification || {};
      rows.push([
        escapeCSV(f.id),
        escapeCSV(f.title),
        escapeCSV(f.schoolRaw),
        escapeCSV(inst.type || 'Inconnu'),
        escapeCSV(inst.status || 'Inconnu'),
        escapeCSV(f.diploma || ''),
        escapeCSV(f.level || ''),
        escapeCSV(f.city || ''),
        escapeCSV(f.matchScore),
        escapeCSV((f.matchedKeywords || []).join(', ')),
        escapeCSV(f.url)
      ].join(','));
    });

    const csvContent = '\uFEFF' + rows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `etudes-en-france-formations-retenues-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function exportVisibleFormationsCSV() {
    const visibleFormations = [];
    processedFormations.forEach(function (formation) {
      if (doesFormationMatch(formation)) {
        visibleFormations.push(formation);
      }
    });
    exportMatchesArrayCSV(visibleFormations);
  }

  /**
   * Dynamic Observer for SPA pagination and React re-renders
   */
  function setupObserver() {
    if (observer) observer.disconnect();

    const targetNode = document.querySelector('main') || document.body;
    observer = new MutationObserver(function (mutations) {
      let hasRelevantChange = false;
      for (let i = 0; i < mutations.length; i++) {
        const m = mutations[i];
        if (m.type === 'childList') {
          const isOurInjection = Array.from(m.addedNodes).some(function (n) {
            return (
              n.id === 'eef-toolbar' ||
              (n.classList && (n.classList.contains('eef-modal-backdrop') || n.classList.contains('eef-card-badge-container')))
            );
          });
          if (!isOurInjection) {
            hasRelevantChange = true;
            break;
          }
        }
      }

      if (hasRelevantChange) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function () {
          applyFiltersAndBadges();
        }, 200);
      }
    });

    observer.observe(targetNode, { childList: true, subtree: true });
  }

  /**
   * Listen to messages from popup or background
   */
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
      if (message.type === 'UPDATE_FILTERS') {
        loadStorage(function () {
          applyFiltersAndBadges();
          sendResponse({
            status: 'ok',
            visibleCount: getVisibleCount(),
            totalCount: processedFormations.size,
            scannedMatchesCount: scannedMatchesMap.size
          });
        });
        return true;
      }
      if (message.type === 'GET_PAGE_STATS') {
        const pag = getPaginationInfo();
        sendResponse({
          totalCount: processedFormations.size,
          visibleCount: getVisibleCount(),
          favoritesCount: Object.keys(favorites).length,
          scannedMatchesCount: scannedMatchesMap.size,
          isScanning: isScanning,
          currentPage: pag.currentPage,
          totalPages: pag.totalPages
        });
        return true;
      }
      if (message.type === 'EXPORT_CSV') {
        exportVisibleFormationsCSV();
        sendResponse({ status: 'ok' });
        return true;
      }
      if (message.type === 'START_AUTO_SCAN') {
        startAutoScan();
        sendResponse({ status: 'started' });
        return true;
      }
      if (message.type === 'STOP_AUTO_SCAN') {
        stopAutoScan(false);
        sendResponse({ status: 'stopped' });
        return true;
      }
      if (message.type === 'SHOW_CONSOLIDATED_MATCHES') {
        showConsolidatedMatchesModal();
        sendResponse({ status: 'ok' });
        return true;
      }
    });
  }

  // Storage change listener
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(function (changes, namespace) {
      if (namespace === 'local') {
        loadStorage(function () {
          applyFiltersAndBadges();
        });
      }
    });
  }

  // Initialize
  function init() {
    loadStorage(function () {
      applyFiltersAndBadges();
      setupObserver();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
