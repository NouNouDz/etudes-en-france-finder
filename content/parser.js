/**
 * Études en France - Formation Catalogue Parser
 * Extracts structured, normalized formation objects directly from the DOM.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FormationParser = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Helper to normalize text: removes accents, lowers case, trims extra spaces.
   */
  function normalizeText(str) {
    if (!str) return '';
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Detect degree category from diploma string or title
   */
  function detectDegreeCategory(diplomaStr, titleStr) {
    const combined = normalizeText((diplomaStr || '') + ' ' + (titleStr || ''));

    if (combined.includes('doctorat') || combined.includes('phd')) {
      return 'Doctorate';
    }
    if (combined.includes("ingenieur") || combined.includes("diplome d'ingenieur")) {
      return 'Engineering';
    }
    if (
      combined.includes('master') ||
      combined.includes('mastere') ||
      combined.includes('msc') ||
      combined.includes('master of science') ||
      combined.includes('cmi')
    ) {
      return 'Master';
    }
    if (
      combined.includes('licence') ||
      combined.includes('bachelor') ||
      combined.includes('but') ||
      combined.includes('dut')
    ) {
      return 'Licence';
    }
    return 'Other';
  }

  /**
   * Parse a single card element into a normalized formation object
   */
  function parseCard(cardEl) {
    if (!cardEl) return null;

    // 1. Primary link & formation title
    const linkEl =
      cardEl.querySelector('a[href*="/formation/"]') ||
      cardEl.querySelector('a[href*="catalogue-formations"]') ||
      cardEl.querySelector('a');

    if (!linkEl) return null;

    const href = linkEl.getAttribute('href') || linkEl.href || '';
    const rawTitle = (linkEl.textContent || '').replace(/\s+/g, ' ').trim();

    // Extract formationId and siteId
    const idMatch = href.match(/\/formation\/(\d+)(?:\/site\/(\d+))?/i);
    const formationId = idMatch ? idMatch[1] : '';
    const siteId = idMatch && idMatch[2] ? idMatch[2] : 'default';
    const compositeId = formationId ? `${formationId}-${siteId}` : `card-${Math.random().toString(36).substr(2, 9)}`;

    // 2. Tags: Diploma & Catalogue
    const tagEls = cardEl.querySelectorAll('.fr-tag');
    let rawDiploma = '';
    let catalogue = 'Général';

    tagEls.forEach(function (tag) {
      const txt = (tag.textContent || '').trim();
      if (/^dipl[ôo]me\s*:/i.test(txt)) {
        rawDiploma = txt.replace(/^dipl[ôo]me\s*:\s*/i, '').trim();
      } else if (/taught in english/i.test(txt)) {
        catalogue = 'Taught In English';
      } else if (/fran[çc]ais langue [ée]trang[èe]re/i.test(txt)) {
        catalogue = 'FLE';
      } else if (/g[ée]n[ée]ral/i.test(txt)) {
        catalogue = 'Général';
      }
    });

    // Fallback for diploma from title if tag missing
    if (!rawDiploma) {
      if (/master/i.test(rawTitle)) rawDiploma = 'Master';
      else if (/mast[èe]re/i.test(rawTitle)) rawDiploma = 'Mastère';
      else if (/ing[ée]nieur/i.test(rawTitle)) rawDiploma = "Diplôme d'ingénieur";
      else if (/licence/i.test(rawTitle)) rawDiploma = 'Licence';
    }

    const degreeCategory = detectDegreeCategory(rawDiploma, rawTitle);

    // 3. School / Institution (.fr-icon-school-line)
    const schoolIcon = cardEl.querySelector('.fr-icon-school-line');
    let schoolRaw = '';
    let schoolParent = '';
    let schoolComponent = '';

    if (schoolIcon) {
      const parentLi = schoolIcon.closest('li') || schoolIcon.parentElement;
      if (parentLi) {
        // Clone and remove the icon to get clean text
        const clone = parentLi.cloneNode(true);
        const iconClone = clone.querySelector('.fr-icon-school-line');
        if (iconClone) iconClone.remove();
        schoolRaw = (clone.textContent || '').replace(/\s+/g, ' ').trim();

        if (schoolRaw.includes('/')) {
          const parts = schoolRaw.split('/').map(function (s) { return s.trim(); });
          schoolParent = parts[0];
          schoolComponent = parts.slice(1).join(' / ');
        } else {
          schoolParent = schoolRaw;
          schoolComponent = '';
        }
      }
    }

    // 4. Campus / City (.fr-icon-map-pin-2-line)
    const pinIcon = cardEl.querySelector('.fr-icon-map-pin-2-line');
    let siteRaw = '';
    let city = '';

    if (pinIcon) {
      const parentLi = pinIcon.closest('li') || pinIcon.parentElement;
      if (parentLi) {
        const clone = parentLi.cloneNode(true);
        const iconClone = clone.querySelector('.fr-icon-map-pin-2-line');
        if (iconClone) iconClone.remove();
        siteRaw = (clone.textContent || '').replace(/\s+/g, ' ').trim();
        city = siteRaw.replace(/^site\s+de\s+/i, '').replace(/^site\s+/i, '').trim();
      }
    }

    // 5. Entrance Level (.fr-icon-flag-line)
    const flagIcon = cardEl.querySelector('.fr-icon-flag-line');
    let levelRaw = '';
    let level = '';

    if (flagIcon) {
      const parentLi = flagIcon.closest('li') || flagIcon.parentElement;
      if (parentLi) {
        const clone = parentLi.cloneNode(true);
        const iconClone = clone.querySelector('.fr-icon-flag-line');
        if (iconClone) iconClone.remove();
        levelRaw = (clone.textContent || '').replace(/\s+/g, ' ').trim();
        const levelMatch = levelRaw.match(/bac\s*\+\s*\d+/i);
        level = levelMatch ? levelMatch[0].toUpperCase() : levelRaw.replace(/^niveau\s*d'entr[ée]e\s*:\s*/i, '').trim();
      }
    }

    // 6. Procedure Badge (.fr-badge)
    const badgeEl = cardEl.querySelector('.fr-badge');
    const procedure = badgeEl ? (badgeEl.textContent || '').replace(/\s+/g, ' ').trim() : '';

    // 7. Bienvenue en France Label
    const befImg = cardEl.querySelector('img[alt*="Bienvenue en France" i]');
    const befLabel = befImg ? (befImg.getAttribute('alt') || '').trim() : '';

    return {
      id: compositeId,
      formationId: formationId,
      siteId: siteId,
      url: href,
      title: rawTitle,
      diploma: rawDiploma,
      degreeCategory: degreeCategory,
      catalogue: catalogue,
      schoolRaw: schoolRaw,
      schoolParent: schoolParent,
      schoolComponent: schoolComponent,
      siteRaw: siteRaw,
      city: city,
      levelRaw: levelRaw,
      level: level,
      procedure: procedure,
      befLabel: befLabel,
      cardElement: cardEl
    };
  }

  /**
   * Find and parse all formation cards currently in the DOM
   */
  function parseAll(rootDoc) {
    const doc = rootDoc || document;
    // Find all cards: cards in DSFR have class .fr-card
    const cardEls = doc.querySelectorAll('.fr-card');
    const formations = [];

    cardEls.forEach(function (cardEl) {
      // Ensure it's a formation card (has school icon, link to formation, or info-site-niveau)
      if (
        cardEl.querySelector('.fr-icon-school-line') ||
        cardEl.querySelector('a[href*="/formation/"]') ||
        cardEl.querySelector('[data-testid="info-site-niveau"]')
      ) {
        const parsed = parseCard(cardEl);
        if (parsed) {
          formations.push(parsed);
        }
      }
    });

    return formations;
  }

  return {
    normalizeText: normalizeText,
    detectDegreeCategory: detectDegreeCategory,
    parseCard: parseCard,
    parseAll: parseAll
  };
});
