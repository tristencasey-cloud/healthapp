# HealthApp

Personal health and fitness PWA built with React + Vite. Designed to feel like a native iPhone app when installed via Safari's "Add to Home Screen." Single-user, no backend, all data stored on-device, but will most likey implement backend and database later


## Tech Stack

- **Framework**: React 18 with Vite
- **Data**: IndexedDB via `idb` library (persistent data), localStorage (settings/profile)
- **PWA**: `vite-plugin-pwa` handles manifest.json and service worker generation
- **Deployment**: GitHub Pages via `gh-pages` package
- **API**: USDA FoodData Central (personal API key stored in `Diet.jsx`) for food search — SR Legacy data only
- **Styling**: Plain CSS with CSS variables, dark mode only, mobile-first

## Project Structure

```
healthapp/
├── public/
│   ├── icon-192.png          # PWA icon (placeholder)
│   └── icon-512.png          # PWA icon (placeholder)
├── src/
│   ├── components/
│   │   ├── BottomNav.jsx     # 3-tab bottom navigation
│   │   ├── icons.jsx         # SVG icon components (SettingsIcon = gear/cog)
│   │   ├── ProgressBar.jsx   # Reusable progress bar with label
│   │   └── Sparkline.jsx     # SVG sparkline chart
│   ├── pages/
│   │   ├── Overview.jsx      # Dashboard with daily summary
│   │   ├── Fitness.jsx       # Workout logging (lifts + cardio)
│   │   ├── Diet.jsx          # Food logging, search, library
│   │   └── Profile.jsx       # Settings, goals, body stats
│   ├── utils/
│   │   ├── tdee.js           # Mifflin-St Jeor TDEE calculator
│   │   └── helpers.js        # Date formatting, image compression
│   ├── db.js                 # IndexedDB setup and all CRUD operations
│   ├── storage.js            # localStorage helpers (profile, goals, settings)
│   ├── App.jsx               # App shell with routing and header
│   ├── App.css               # All styles
│   └── main.jsx              # React entry point
├── index.html
├── vite.config.js
├── package.json
└── CLAUDE.md
```

## Data Architecture

### IndexedDB (via `idb`)

Six object stores in a database called `healthapp` (current `DB_VERSION = 3`):

- **workoutLogs** (keyPath: `date` as YYYY-MM-DD)
  - `date`: string
  - `lifts`: array of `{ exercise, sets, reps, weight }`
  - `cardio`: array of `{ type, duration, distance?, calories? }`
  - `splitDay`: string | undefined — optional tag for the workout split day (e.g. `'Push'`, `'Rest'`)

- **foodLogs** (keyPath: auto-increment `id`, indexed by `date`)
  - `date`: string (YYYY-MM-DD)
  - `name`, `calories`, `protein`, `carbs`, `fat`: number
  - `source`: "api" | "manual" | "library"

- **foodLibrary** (keyPath: auto-increment `id`, indexed by `name`)
  - `name`, `calories`, `protein`, `carbs`, `fat`: number
  - `createdDate`: ISO string

- **bodyStats** (keyPath: `date` as YYYY-MM-DD)
  - `date`: string
  - `weight`: number (lbs)
  - `photo`: string (compressed base64 JPEG)

- **waterLogs** (keyPath: `date` as YYYY-MM-DD) — added in DB_VERSION 2
  - `date`: string
  - `oz`: number (running daily total in ounces)

- **workoutTemplates** (keyPath: auto-increment `id`) — added in DB_VERSION 3
  - `name`: string
  - `exercises`: array of `{ exercise, sets, reps, weight }`
  - `createdDate`: ISO string

### localStorage

- `userProfile`: `{ age, sex, heightFt, heightIn, weight, activityLevel }`
- `userGoals`: `{ calories, protein, carbs, fat, workoutsPerWeek, waterGoal, mode }`
- `appSettings`: `{ theme, split, accentColor }` — `split` is `'none' | 'ppl' | 'upper_lower' | 'bro'`; `accentColor` is a hex string (default `'#e8734a'`)

## DB Functions (`src/db.js`)

Key functions beyond basic CRUD:
- `getAllFoodLogs()` — all food logs across all dates (used for recent foods)
- `deleteBodyStat(date)` — delete a body weight entry by date key
- `getFoodLogsByDate(date)` — food logs for a specific date
- `getAllFoodLibrary()` — all saved library items
- `getAllBodyStats()` — all body stat entries
- `getWaterLog(date)` — get water log for a specific date (`{ date, oz }`)
- `saveWaterLog(log)` — upsert water log for a date
- `getAllWorkoutLogs()` — all workout logs across all dates (used for Progress tab)
- `getAllExerciseNames()` — unique exercise names from all workout logs, sorted (used for autocomplete)
- `getAllCardioTypes()` — unique cardio type strings from all workout logs, sorted (used for autocomplete)
- `getExerciseHistory(name)` — returns `[{ date, lifts }]` sorted newest first for a given exercise name
- `getAllTemplates()` — all saved workout templates
- `saveTemplate(template)` — add new template (omit `id`) or update existing (include `id`)
- `deleteTemplate(id)` — delete a template by id

## Navigation

Three main tabs via bottom nav: Overview, Fitness, Diet. Profile/Settings accessed via gear icon in header, renders as a full page overlay.

## Conventions

- All dates stored and compared as YYYY-MM-DD strings
- Use `localDateStr()` from `helpers.js` for user-facing date inputs (timezone-safe). `todayStr()` uses UTC and can produce the wrong date for negative UTC offsets — prefer `localDateStr()` in Profile/body stat contexts
- Weight always in lbs (no unit toggle yet)
- Nutrition values are per 100g from USDA API; serving size is applied as `(qty × measure.grams) / 100` multiplier
- Progress photos compressed to max 400px and JPEG quality 0.6 before storage
- No router library; tab switching via state in App.jsx
- All DB operations are async and imported from `src/db.js`
- All localStorage reads/writes go through `src/storage.js`
- Number inputs: native spinners are hidden globally via CSS (`-webkit-appearance: none` on spin buttons). Use `-webkit-text-fill-color` alongside `color` for input text visibility in WebKit browsers

## Diet Page (`src/pages/Diet.jsx`)

### Search
- Uses USDA FoodData Central API, **SR Legacy data type only** (Foundation returns 404 on individual endpoint)
- Search endpoint: `GET /fdc/v1/foods/search?dataType=SR%20Legacy&...`
- Results are re-ranked client-side: terms matching the main food name (before the first comma) are weighted 2× vs terms anywhere in the description; shorter descriptions preferred
- 8-second timeout via `AbortController`; auto-retries once on failure before showing error
- Handle `data.error.code === 'OVER_RATE_LIMIT'` from API response body (returns 200 with error object, not a non-2xx status)

### Serving Units
- On food selection, fetches `GET /fdc/v1/food/{fdcId}` to get `foodPortions`
- `foodPortions` structure: `{ amount, modifier, gramWeight }` — label is `"${amount} ${modifier}"` (e.g. "1 large", "1 cup")
- Always appends `{ label: 'g', grams: 1 }` as final fallback option
- Serving multiplier: `(servingQty × selectedMeasure.grams) / 100`

### Search Tab UX
- Recently logged foods (last 6 unique by name, sorted by most recent date) shown as tappable chips above the search bar
- × clear button appears in search bar when query is non-empty
- "Log & Save" is the primary action; "Just Log" is secondary (skips library save)
- Duplicate detection: checks `library` state before saving to library; shows "Already in library" flash if duplicate
- Scroll on results list blurs the search input (keyboard dismiss on mobile)

## Water Tab (`src/pages/Diet.jsx` — `view === 'water'`)

- 5th tab in the Diet tab-row; tab-row gets `.diet-tabs` class to tighten padding to `9px 6px` on mobile
- **Tracking:** Running daily total (oz) — no per-drink history, no individual delete
- **Goal:** Stored as `goals.waterGoal` (default 64 oz) in localStorage; editable inline at the top of the tab
- **Quick-add buttons:** +8 / +12 / +16 / +20 oz, rendered as `.water-quick-btn` grid (4 columns)
- **Custom amount:** Number input + "Add" (primary) and "Remove" (secondary) buttons — both clamp total at 0
- **Goal-met state:** Card gets green glow + "Goal hit!" badge when `waterOz >= goals.waterGoal`
- **Water color:** `#4ab8d8` (used for progress bar fill and quick-add button text)
- **Overview card:** Water progress bar appears on the dashboard (between Macros and Workout cards), using `getWaterLog(today)` loaded in `loadData()`

## Fitness Page (`src/pages/Fitness.jsx`)

Three tabs: **Lifts**, **Cardio**, **Progress**.

### Split Day Row
- Shown below the tab bar when `settings.split !== 'none'`
- The `SPLITS` constant (defined at top of both `Fitness.jsx` and `Profile.jsx`) maps split key → `{ label, days[] }`:
  - `none`: no split
  - `ppl`: Push / Pull / Legs
  - `upper_lower`: Upper / Lower
  - `bro`: Chest / Back / Shoulders / Arms / Legs
- Each split day renders as a pill button (`.split-day-btn`); active day highlighted with accent color
- A "Rest" button always appended at the end; active rest highlighted green (`.split-day-btn.rest.active`)
- Tapping an already-active day clears it (toggles off)
- Selection saved to `workoutLog.splitDay` in IndexedDB
- When `splitDay === 'Rest'` and no lifts logged: shows `.rest-day-banner` instead of empty state

### Templates
- **Load Template** button in Lifts tab opens the template panel (`.template-panel`)
- Template panel has 3 views:
  1. **List view** — shows saved templates; tap name to open, × to delete; "+ New Template" at bottom
  2. **Checklist view** — shows template exercises with last-logged weights pre-filled (fetched via `getExerciseHistory`); checkboxes to select which to add; "Add Selected to Today" button
  3. **New from scratch** — text input for template name; reuses `liftExercise/liftSets/liftReps/liftWeight` state to add exercises one at a time; "Save Template" when done
- **Save as Template** button appears in template bar when lifts are already logged today
- Template shape: `{ id, name, exercises: [{ exercise, sets, reps, weight }], createdDate }`
- Last-logged weights loaded in parallel via `Promise.all` + `getExerciseHistory`; falls back to template's saved values if no history

### Progress Tab
- Loads on every tab switch (no stale-data guard) via `useEffect([section])`
- Single `getAllWorkoutLogs()` scan; builds per-exercise date→maxWeight map client-side
- Each exercise card shows: name, PR (all-time max weight), trend delta vs previous session (↑/↓), last logged date, sparkline
- Filter input at top searches exercise names

## Profile Page (`src/pages/Profile.jsx`)

### Goals Section
- Workout Split `<select>` below Workouts Per Week — saves to `appSettings.split` via `saveSettings()`
- Changing the split type here controls which pill buttons appear on the Fitness page

### Style Section (Customization tab)
- 8 preset accent color swatches (circles, no labels): Orange `#e8734a`, Blue `#4a8fe8`, Purple `#9b6dff`, Green `#52b788`, Red `#e84a6f`, Teal `#38c9d4`, Gold `#f0b429`, Pink `#e879c0`
- Tapping a swatch saves `accentColor` to `appSettings` and immediately calls `applyAccent(hex)` passed down as `onAccentChange` prop from `App.jsx`
- `applyAccent` (defined in `App.jsx`) sets `--accent`, `--accent-soft` (12% opacity), and `--accent-glow` (25% opacity) on `:root` — every element using those variables updates instantly
- `App.jsx` also calls `applyAccent` on mount so the saved color is applied before first render (no flash of default orange)
- Active swatch shown with a white ring (`border-color: var(--text)` + double box-shadow)

### Body Weight Log
- Date picker (defaults to today via `localDateStr()`, capped at today via `max` attribute)
- Weight input styled with `.weight-input` class — 20px bold, centered
- `.weight-input-row .btn-primary { width: auto }` overrides the global `btn-primary` width: 100% that would otherwise collapse the input
- Weight history items have delete buttons (calls `deleteBodyStat(date)`)

## Development

```bash
npm install
npm start       # dev server at localhost:5173 (or 5174 if 5173 is in use)
npm run build   # production build to dist/
npm run deploy  # deploy to GitHub Pages
```

## Deployment Notes

- `base` in vite.config.js is set to `/healthapp/` — change this to match your GitHub repo name
- PWA manifest start_url and scope also reference this base path
- After deploy, visit `https://<username>.github.io/healthapp/` in Safari, tap Share → Add to Home Screen

## Known Limitations / Future Work

- No data export/import yet
- No unit toggle (metric vs imperial)
- Exercise autocomplete is basic substring matching
- No swipe gestures for date navigation
- Progress photo storage uses base64 in IndexedDB which can get heavy over time
- USDA SR Legacy doesn't include branded/packaged foods — consider adding a branded food search toggle
- Gram presets (100g, 150g, 200g, 1oz quick-fill buttons) not yet implemented on the serving input
- Template exercises load "last logged" weight from most recent session's first lift only — could be smarter (e.g. best set, or let user edit weights inline in the checklist)
- Accent color palette is hardcoded in `Profile.jsx` (`ACCENT_COLORS` array) — no custom color picker yet
