# Études en France — Formation Matcher & Filter

A Manifest V3 browser extension for Chromium-based browsers (Chrome, Edge, Brave) that classifies institutions, scores program relevance, and filters search results directly within the official French [Études en France](https://etudesenfrance.diplomatie.gouv.fr/catalogue-formations) higher-education catalogue.

---

## Why this exists

The Études en France catalogue indexes thousands of French Master's programs, but navigating it can be challenging:

- **Public vs. private status is not always obvious at a glance:** Private Catholic faculties can share university naming conventions, while prestigious public engineering networks (INP, INSA, Polytech, CentraleSupelec, IMT) are mixed together with private commercial and technical schools.
- **Filtering is coarse:** Candidates targeting specific profiles (such as Master's degrees in Computer Science, Data Science, or Artificial Intelligence) often have to open each card manually to verify entrance level, degree category, and institutional affiliation.
- **Multi-page navigation is manual:** Candidate searches often span dozens of pagination pages, requiring repetitive clicking and tracking.

This extension runs completely in the browser to parse catalogue cards in real time, classify institution types using institutional naming patterns, calculate a transparent match score, and let you navigate or export matching programs across pages.

---

## What it does

- **Institution Classification:** Identifies whether an establishment is a **Public University**, a **Public Engineering School**, a **Private Institution** (private tech school, business school, or Catholic faculty), or **Unknown**. It follows a conservative classification rule: if evidence is insufficient, it marks the status as *Unknown* rather than guessing.
- **Relevance Scoring (0–100%):** Evaluates formation title, degree type, and level against a target profile. By default, it targets Master/Bac+5 programs with a focus on Computer Science and Artificial Intelligence, while penalizing non-technical tracks (Law, Literature, Humanities, etc.).
- **Click-to-Explain Score Breakdowns:** Clicking on any score badge displays an itemized popover detailing why points were added or deducted (e.g. `+30% Master level`, `+20% Public University`, `+25% AI Specialization`, `-35% Non-technical domain`).
- **In-Page DSFR Toolbar:** Injects a lightweight toolbar styled after the French government design system (*Système de Design de l'État*). It includes real-time text search (by title, school, city, or keywords), sorting (by relevance score, formation title, establishment, or city), and a threshold visibility toggle.
- **Automated Multi-Page Auto-Scan ("Suivant" Crawler):** Automatically clicks through pagination pages, evaluates every program card, and gathers all matching formations into a single consolidated view.
- **Bookmarks & RFC 4180 CSV Export:** Star favorite formations and export visible or scanned formations to CSV. Exported files include a UTF-8 BOM (`\uFEFF`) to preserve French accented characters in Microsoft Excel.
- **Customizable Profiles & Keywords:** Configure target degree levels, score thresholds, institution type allowances, and custom keyword lists (AI, CS, and penalty lists) via the toolbar popup or the options dashboard, with JSON import/export for backups.

---

## Privacy & Permissions

- **100% Client-Side:** No external servers, no tracking, and no analytics. All parsing, classification, and scoring execute entirely within the local browser runtime.
- **Minimal Permissions:** Only requests `"storage"` to persist your filter settings and favorited formations locally.
- **Host Permissions:**
  - `https://etudesenfrance.diplomatie.gouv.fr/*` (Official catalogue)
  - `file:///*`, `http://localhost/*`, `http://127.0.0.1/*` (For testing with local mock HTML pages)
- **Non-Destructive DOM Manipulation:** Formations filtered out are hidden via CSS (`display: none !important;`). The extension does not remove elements from the DOM or automate application form submissions.

---

## Architecture

The extension consists of modular components with clean separation of concerns:

```
.
├── manifest.json              # Manifest V3 extension configuration
├── background/
│   └── service-worker.js      # Initializes default scoring profile on install
├── content/
│   ├── parser.js              # Extracts raw DOM (.fr-card) into structured formation objects
│   ├── classifier.js          # Rule-based French public/private institution classifier
│   ├── scorer.js              # Transparent relevance scoring engine (0-100%)
│   ├── content.js             # Main page orchestrator, toolbar injection, observer & crawler
│   └── content.css            # Styles for in-page badges, DSFR toolbar, and modal
├── popup/
│   ├── popup.html             # Toolbar popup for quick threshold & filter adjustments
│   ├── popup.css
│   └── popup.js
├── options/
│   ├── options.html           # Full-page dashboard for keywords, profile, & favorites
│   ├── options.css
│   └── options.js
├── icons/                     # Extension icons (16px, 32px, 48px, 128px)
├── test_pipeline.js           # Node.js unit check for parser, classifier, and scorer
├── integration_test.js        # Node.js test runner against sample catalogue data
└── extracted_cards.json       # 10 real sample card fixtures for integration checks
```

### Data Pipeline

```
Page DOM (.fr-card elements)
         │
         ▼
[ FormationParser ] (parser.js)
         │  Extracts ID, title, diploma, level, school, campus city, procedure badge
         ▼
Normalized Formation Object
         │
         ├──► [ InstitutionClassifier ] (classifier.js) ──► Public / Private / Unknown
         │
         ▼
[ FormationScorer ] (scorer.js)
         │  Calculates 0-100% score based on keywords, degree level, and institution type
         ▼
[ Content Orchestrator ] (content.js)
         │  Injects badge, applies search/filter/sort, manages favorites and CSV export
         ▼
DOM Update & Toolbar Stats
```

---

## Requirements

- **Browser:** Any modern Chromium-based browser supporting Manifest V3 (Google Chrome, Microsoft Edge, Brave, Opera, Vivaldi).
- **Node.js (Optional):** Version 16+ if you want to run the offline test scripts. No `npm install` or third-party packages are required; tests use Node's built-in modules.

---

## Installation

### Google Chrome & Brave

1. Clone or download this repository to your computer:
   ```bash
   git clone https://github.com/NouNouDz/etudes-en-france-finder.git
   ```
2. Open your browser and navigate to `chrome://extensions/`.
3. In the top-right corner, toggle **Developer mode** to **ON**.
4. In the top-left corner, click **Load unpacked**.
5. Select the cloned repository folder (the directory containing `manifest.json`).
6. The extension **Études en France — Formation Matcher & Filter** will now appear in your extensions list.

### Microsoft Edge

1. Navigate to `edge://extensions/`.
2. Turn on the **Developer mode** toggle in the left sidebar.
3. Click **Load unpacked** and select the cloned repository folder.

> **Note for Local Testing:** If you plan to test the extension against local HTML files (`file:///...`), click **Details** on the extension card in `chrome://extensions/` and enable **Allow access to file URLs**.

---

## Usage

### 1. On the Études en France Catalogue

1. Navigate to the official catalogue:  
   `https://etudesenfrance.diplomatie.gouv.fr/catalogue-formations`
2. Perform your initial search (e.g., keyword or domain).
3. Once the catalogue results load, the extension automatically:
   - Displays the **Assistant Catalogue Études en France** toolbar above the list.
   - Adds a colored relevance pill (e.g., `Match: 71%`) and institution tag (e.g., `🏛️ Université (Publique)`) to each card.
   - Hides formations below the default threshold (60%) or matching excluded categories.
4. Click on any score pill to see the full reasoning breakdown.
5. Use the toolbar to:
   - Run a live text search across titles, cities, and keywords.
   - Re-sort the cards by relevance score, program title, institution, or city.
   - Click **"Afficher tout"** to temporarily reveal all cards without resetting your filters.
   - Click **"🚀 Scanner toutes les pages (Suivant)"** to crawl all pagination pages automatically.
   - Click **"📥 Exporter CSV"** to export visible or scanned formations.

### 2. Quick Settings & Options

- **Toolbar Popup:** Click the extension icon in your browser toolbar to quickly adjust the minimum score threshold (0–100%), toggle institution types (Public Universities, Engineering Schools, Private), or switch degree targets.
- **Options Dashboard:** Click **"Favoris / Profil ⚙️"** in the toolbar or right-click the extension icon and select **Options**. From here, you can:
  - Add or remove keywords in the AI, Computer Science, and Negative penalty lists.
  - Review, filter, and export all favorited programs.
  - Export or import your settings profile via JSON.

---

## Offline Testing

The core parser, classifier, and scoring logic can be tested directly with Node.js without launching a browser:

```bash
# 1. Run pipeline unit checks on sample profiles:
node test_pipeline.js

# 2. Run integration test against real extracted catalogue cards:
node integration_test.js
```

Both test suites complete with exit code `0` and print formatted scoring breakdowns and match summaries to the console.

---

## Known Limitations

- **Tuition fees are not on catalogue cards:** The Études en France catalogue search view does not include detailed tuition fees inside the summary `.fr-card` HTML; fees are only displayed on the specific sub-page (`/formation/:id/site/:siteId`). Use the card's link to view tuition rates on the official site.
- **DOM Selector Sensitivity:** If the Études en France web team updates their CSS class names or DOM structure (away from `.fr-card` or standard DSFR layout elements), `content/parser.js` will need its CSS selectors updated.

---

## Contributing

Contributions to improve classification dictionaries or expand parsing edge cases are welcome.

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/institution-update`).
3. If adding or correcting an institution, update the corresponding keyword array in `content/classifier.js` (`PUBLIC_ENGINEERING_KEYWORDS`, `PRIVATE_ENGINEERING_SCHOOLS`, `CATHOLIC_FACULTIES`, etc.).
4. Run `node test_pipeline.js` and `node integration_test.js` to ensure existing classifications remain stable.
5. Commit your changes and submit a Pull Request.

---

## License

This project is licensed under the [MIT License](LICENSE).
