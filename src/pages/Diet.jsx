import { useEffect, useRef, useState } from 'react';
import {
  getFoodLogsByDate,
  getAllFoodLogs,
  addFoodLog,
  deleteFoodLog,
  getAllFoodLibrary,
  addToFoodLibrary,
  deleteFoodLibraryItem,
  getWaterLog,
  saveWaterLog,
} from '../db';
import { getGoals, saveGoals } from '../storage';
import { todayStr, formatDateFull } from '../utils/helpers';
import ProgressBar from '../components/ProgressBar';
import { DietIcon, CheckIcon } from '../components/icons';

export default function Diet() {
  const [date, setDate] = useState(todayStr());
  const [foods, setFoods] = useState([]);
  const [goals, setGoals] = useState(getGoals());
  const [view, setView] = useState('log');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [recentFoods, setRecentFoods] = useState([]);

  const [manualName, setManualName] = useState('');
  const [manualCals, setManualCals] = useState('');
  const [manualProtein, setManualProtein] = useState('');
  const [manualCarbs, setManualCarbs] = useState('');
  const [manualFat, setManualFat] = useState('');
  const [manualServings, setManualServings] = useState('1');
  const [manualUnit, setManualUnit] = useState('');

  const [library, setLibrary] = useState([]);
  const [librarySavedMsg, setLibrarySavedMsg] = useState('');

  const [selectedFood, setSelectedFood] = useState(null);
  const [servingQty, setServingQty] = useState('1');
  const [servingUnitIdx, setServingUnitIdx] = useState(0);
  const [loadingMeasures, setLoadingMeasures] = useState(false);

  const [waterOz, setWaterOz] = useState(0);
  const [customWater, setCustomWater] = useState('');

  const searchInputRef = useRef(null);

  useEffect(() => {
    loadFoods(date);
    loadLibrary();
    loadRecentFoods();
    loadWaterLog(date);
  }, [date]);


  async function loadFoods(d) {
    const f = await getFoodLogsByDate(d);
    setFoods(f);
    setGoals(getGoals());
  }

  async function loadLibrary() {
    const lib = await getAllFoodLibrary();
    setLibrary(lib);
  }

  async function loadWaterLog(d) {
    const log = await getWaterLog(d);
    setWaterOz(log?.oz || 0);
  }

  async function addWater(oz) {
    if (!oz) return;
    const newTotal = Math.max(0, waterOz + oz);
    await saveWaterLog({ date, oz: newTotal });
    setWaterOz(newTotal);
  }

  function updateWaterGoal(val) {
    const updated = { ...goals, waterGoal: parseInt(val) || 64 };
    setGoals(updated);
    saveGoals(updated);
  }

  async function loadRecentFoods() {
    const all = await getAllFoodLogs();
    // Sort by date descending, deduplicate by name, take top 6
    const seen = new Set();
    const recent = all
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter((f) => {
        const key = f.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 6);
    setRecentFoods(recent);
  }

  function handleDateNav(dir) {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + dir);
    const next = d.toISOString().split('T')[0];
    if (next > todayStr()) return;
    setDate(next);
  }

  async function fetchFoodResults(query) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(
        `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&api_key=37iD5Faem85sXu7jxJsKNj0xnzRbw1ZSelpkkJAd&dataType=SR%20Legacy&pageSize=25&sortBy=score&sortOrder=desc`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);
      const data = await res.json();
      if (!res.ok || data.error) {
        const isRateLimit =
          data.error?.code === 'OVER_RATE_LIMIT' || res.status === 429 || res.status === 403;
        throw Object.assign(new Error(data.error?.message || `HTTP ${res.status}`), {
          isRateLimit,
        });
      }
      const titleCase = (s) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
      const scoreMatch = (desc, q) => {
        const d = desc.toLowerCase();
        const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
        const main = d.split(',')[0];
        const inMain = terms.filter((t) => main.includes(t)).length;
        const inFull = terms.filter((t) => d.includes(t)).length;
        return (inMain * 2 + inFull) * 100 - desc.length;
      };
      return (data.foods || [])
        .filter((f) => f.description && f.foodNutrients)
        .map((f) => {
          const get = (id) => {
            const n = f.foodNutrients.find((n) => n.nutrientId === id);
            return n ? Math.round(n.value || 0) : 0;
          };
          return {
            fdcId: f.fdcId,
            name: titleCase(f.description),
            brand: '',
            calories: get(1008),
            protein: get(1003),
            carbs: get(1005),
            fat: get(1004),
            measures: [{ label: 'g', grams: 1 }],
            _score: scoreMatch(f.description, query),
          };
        })
        .filter((r) => r.calories > 0)
        .sort((a, b) => b._score - a._score)
        .map(({ _score, ...r }) => r);
    } finally {
      clearTimeout(timeout);
    }
  }

  async function searchFood() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults([]);
    setSearchError('');
    try {
      let results = await fetchFoodResults(searchQuery);
      if (results.length === 0) {
        results = await fetchFoodResults(searchQuery);
      }
      setSearchResults(results);
    } catch (err) {
      try {
        const results = await fetchFoodResults(searchQuery);
        setSearchResults(results);
      } catch (err2) {
        if (err2.isRateLimit || err.isRateLimit) {
          setSearchError('Search limit reached — wait a minute and try again.');
        } else {
          setSearchError('Search failed. Check your connection and try again.');
        }
      }
    }
    setSearching(false);
  }

  function clearSearch() {
    setSearchQuery('');
    setSearchResults([]);
    setSearchError('');
    searchInputRef.current?.focus();
  }

  async function fetchMeasures(fdcId) {
    try {
      const res = await fetch(
        `https://api.nal.usda.gov/fdc/v1/food/${fdcId}?api_key=37iD5Faem85sXu7jxJsKNj0xnzRbw1ZSelpkkJAd`
      );
      const data = await res.json();
      const measures = [];
      (data.foodPortions || []).forEach((p) => {
        if (p.gramWeight && p.modifier)
          measures.push({ label: `${p.amount} ${p.modifier}`, grams: p.gramWeight });
      });
      measures.push({ label: 'g', grams: 1 });
      return measures;
    } catch {
      return [{ label: 'g', grams: 1 }];
    }
  }

  async function selectSearchResult(food) {
    setSelectedFood({ ...food, measures: [{ label: 'g', grams: 1 }] });
    setServingQty('1');
    setServingUnitIdx(0);
    setLoadingMeasures(true);
    const measures = await fetchMeasures(food.fdcId);
    setSelectedFood((f) => ({ ...f, measures }));
    setLoadingMeasures(false);
  }

  async function logSelectedFood() {
    if (!selectedFood) return;
    const measure = selectedFood.measures[parseInt(servingUnitIdx)] || { grams: 1 };
    const mult = ((parseFloat(servingQty) || 1) * measure.grams) / 100;
    const entry = {
      date,
      name: selectedFood.name,
      calories: Math.round(selectedFood.calories * mult),
      protein: Math.round(selectedFood.protein * mult),
      carbs: Math.round(selectedFood.carbs * mult),
      fat: Math.round(selectedFood.fat * mult),
      source: 'api',
    };
    await addFoodLog(entry);
    await loadFoods(date);
    await loadRecentFoods();
    setSelectedFood(null);
    setSearchQuery('');
    setSearchResults([]);
    setView('log');
  }

  async function saveSelectedToLibrary() {
    if (!selectedFood) return;
    const isDup = library.some((i) => i.name.toLowerCase() === selectedFood.name.toLowerCase());
    if (isDup) {
      flashLibraryMsg('Already in library');
      return;
    }
    await addToFoodLibrary({
      name: selectedFood.name,
      calories: selectedFood.calories,
      protein: selectedFood.protein,
      carbs: selectedFood.carbs,
      fat: selectedFood.fat,
    });
    await loadLibrary();
    flashLibraryMsg('Saved!');
  }

  async function logAndSaveSelected() {
    if (!selectedFood) return;
    const isDup = library.some((i) => i.name.toLowerCase() === selectedFood.name.toLowerCase());
    if (!isDup) {
      await addToFoodLibrary({
        name: selectedFood.name,
        calories: selectedFood.calories,
        protein: selectedFood.protein,
        carbs: selectedFood.carbs,
        fat: selectedFood.fat,
      });
      await loadLibrary();
    }
    await logSelectedFood();
  }

  async function logManualFood() {
    if (!manualName) return;
    const mult = parseFloat(manualServings) || 1;
    const entry = {
      date,
      name: manualName,
      calories: Math.round((parseFloat(manualCals) || 0) * mult),
      protein: Math.round((parseFloat(manualProtein) || 0) * mult),
      carbs: Math.round((parseFloat(manualCarbs) || 0) * mult),
      fat: Math.round((parseFloat(manualFat) || 0) * mult),
      source: 'manual',
    };
    await addFoodLog(entry);
    await loadFoods(date);
    await loadRecentFoods();
    resetManualForm();
    setView('log');
  }

  async function saveManualToLibrary() {
    if (!manualName) return;
    const isDup = library.some((i) => i.name.toLowerCase() === manualName.toLowerCase());
    if (isDup) {
      flashLibraryMsg('Already in library');
      return;
    }
    await addToFoodLibrary({
      name: manualName,
      calories: parseFloat(manualCals) || 0,
      protein: parseFloat(manualProtein) || 0,
      carbs: parseFloat(manualCarbs) || 0,
      fat: parseFloat(manualFat) || 0,
    });
    await loadLibrary();
    flashLibraryMsg('Saved!');
  }

  async function logAndSaveManual() {
    if (!manualName) return;
    const isDup = library.some((i) => i.name.toLowerCase() === manualName.toLowerCase());
    if (!isDup) {
      await addToFoodLibrary({
        name: manualName,
        calories: parseFloat(manualCals) || 0,
        protein: parseFloat(manualProtein) || 0,
        carbs: parseFloat(manualCarbs) || 0,
        fat: parseFloat(manualFat) || 0,
      });
      await loadLibrary();
    }
    await logManualFood();
  }

  function flashLibraryMsg(msg) {
    setLibrarySavedMsg(msg);
    setTimeout(() => setLibrarySavedMsg(''), 2000);
  }

  function resetManualForm() {
    setManualName('');
    setManualCals('');
    setManualProtein('');
    setManualCarbs('');
    setManualFat('');
    setManualServings('1');
    setManualUnit('');
  }

  async function logFromLibrary(item) {
    const entry = {
      date,
      name: item.name,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      source: 'library',
    };
    await addFoodLog(entry);
    await loadFoods(date);
    await loadRecentFoods();
    setView('log');
  }

  async function logRecentFood(food) {
    const entry = {
      date,
      name: food.name,
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      source: food.source,
    };
    await addFoodLog(entry);
    await loadFoods(date);
    await loadRecentFoods();
    setView('log');
  }

  async function removeFromLibrary(id) {
    await deleteFoodLibraryItem(id);
    await loadLibrary();
  }

  async function removeFood(id) {
    await deleteFoodLog(id);
    await loadFoods(date);
  }

  const totalCals = foods.reduce((s, f) => s + (f.calories || 0), 0);
  const totalProtein = foods.reduce((s, f) => s + (f.protein || 0), 0);
  const totalCarbs = foods.reduce((s, f) => s + (f.carbs || 0), 0);
  const totalFat = foods.reduce((s, f) => s + (f.fat || 0), 0);

  const isToday = date === todayStr();

  return (
    <div className="page diet-page">
      <div className="date-nav">
        <button className="date-btn" onClick={() => handleDateNav(-1)}>
          ‹
        </button>
        <div className="date-display">
          <span className="date-label">{isToday ? 'Today' : formatDateFull(date)}</span>
        </div>
        <button className="date-btn" onClick={() => handleDateNav(1)}>
          ›
        </button>
      </div>

      {/* Daily totals */}
      <div className="card compact" style={{ '--i': 0 }}>
        <ProgressBar
          label="Calories"
          current={totalCals}
          goal={goals.calories}
          unit="cal"
          color="var(--accent)"
        />
        <div className="macro-row">
          <span className="macro-pill" style={{ color: 'var(--protein)' }}>
            P: {totalProtein}g
          </span>
          <span className="macro-pill" style={{ color: 'var(--carbs)' }}>
            C: {totalCarbs}g
          </span>
          <span className="macro-pill" style={{ color: 'var(--fat)' }}>
            F: {totalFat}g
          </span>
        </div>
      </div>

      {/* View tabs */}
      <div className="tab-row diet-tabs">
        <button
          className={`tab-btn ${view === 'log' ? 'active' : ''}`}
          onClick={() => setView('log')}
        >
          Log
        </button>
        <button
          className={`tab-btn ${view === 'search' ? 'active' : ''}`}
          onClick={() => setView('search')}
        >
          Search
        </button>
        <button
          className={`tab-btn ${view === 'manual' ? 'active' : ''}`}
          onClick={() => setView('manual')}
        >
          Manual
        </button>
        <button
          className={`tab-btn ${view === 'library' ? 'active' : ''}`}
          onClick={() => setView('library')}
        >
          Library
        </button>
        <button
          className={`tab-btn ${view === 'water' ? 'active' : ''}`}
          onClick={() => setView('water')}
        >
          Water
        </button>
      </div>

      {/* Log View */}
      {view === 'log' && (
        <div className="section">
          {foods.length > 0 ? (
            <div className="log-list">
              {foods.map((f) => (
                <div key={f.id} className="log-item">
                  <div className="log-item-content">
                    <span className="log-exercise">{f.name}</span>
                    <span className="log-details">
                      {f.calories} cal · P:{f.protein}g C:{f.carbs}g F:{f.fat}g
                    </span>
                  </div>
                  <button className="btn-delete" onClick={() => removeFood(f.id)}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <DietIcon size={36} color="var(--text-dim)" />
              <span>Nothing logged yet</span>
              <span className="empty-state-hint">Search or add food to get started</span>
            </div>
          )}
        </div>
      )}

      {/* Search View */}
      {view === 'search' && (
        <div className="section">
          {/* Recent foods */}
          {recentFoods.length > 0 && !selectedFood && (
            <div className="recent-foods">
              {recentFoods.map((f, i) => (
                <button key={i} className="recent-food-chip" onClick={() => logRecentFood(f)}>
                  {f.name}
                </button>
              ))}
            </div>
          )}

          <div className="search-bar">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search foods..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchFood()}
            />
            {searchQuery && (
              <button className="btn-clear-search" onClick={clearSearch}>
                ×
              </button>
            )}
            <button className="btn-primary" onClick={searchFood} disabled={searching}>
              {searching ? '...' : 'Search'}
            </button>
          </div>

          {searchError && (
            <div className="empty-state" style={{ color: 'var(--danger)' }}>
              {searchError}
            </div>
          )}

          {selectedFood ? (
            <div className="form-card">
              <h3>{selectedFood.name}</h3>
              {selectedFood.brand && <p className="text-muted">{selectedFood.brand}</p>}
              <p className="text-muted">{selectedFood.servingUnit}</p>
              <div className="macro-row">
                <span>{selectedFood.calories} cal</span>
                <span style={{ color: 'var(--protein)' }}>P: {selectedFood.protein}g</span>
                <span style={{ color: 'var(--carbs)' }}>C: {selectedFood.carbs}g</span>
                <span style={{ color: 'var(--fat)' }}>F: {selectedFood.fat}g</span>
              </div>
              <div className="input-group">
                <label>Serving</label>
                <div className="serving-row">
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={servingQty}
                    onChange={(e) => setServingQty(e.target.value)}
                  />
                  <select
                    value={servingUnitIdx}
                    onChange={(e) => setServingUnitIdx(e.target.value)}
                    disabled={loadingMeasures}
                  >
                    {loadingMeasures ? (
                      <option>Loading…</option>
                    ) : (
                      selectedFood.measures.map((m, i) => (
                        <option key={i} value={i}>{m.label}</option>
                      ))
                    )}
                  </select>
                </div>
                {(() => {
                  const measure = selectedFood.measures[parseInt(servingUnitIdx)] || { grams: 1 };
                  const mult = ((parseFloat(servingQty) || 1) * measure.grams) / 100;
                  return (
                    <p className="text-muted" style={{ fontSize: 13, marginTop: 6 }}>
                      → {Math.round(selectedFood.calories * mult)} cal · P:
                      {Math.round(selectedFood.protein * mult)}g · C:
                      {Math.round(selectedFood.carbs * mult)}g · F:
                      {Math.round(selectedFood.fat * mult)}g
                    </p>
                  );
                })()}
              </div>
              {librarySavedMsg && (
                <p className="text-muted" style={{ fontSize: 13, marginBottom: 8 }}>
                  {librarySavedMsg}
                </p>
              )}
              <div className="btn-row">
                <button className="btn-primary" onClick={logAndSaveSelected}>
                  Log &amp; Save
                </button>
                <button className="btn-secondary" onClick={logSelectedFood}>
                  Just Log
                </button>
                <button className="btn-secondary" onClick={() => setSelectedFood(null)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : searchResults.length > 0 ? (
            <div
              className="log-list"
              onScroll={() => searchInputRef.current?.blur()}
            >
              {searchResults.map((r, i) => (
                <div key={i} className="log-item clickable" onClick={() => selectSearchResult(r)}>
                  <div className="log-item-content">
                    <span className="log-exercise">
                      {r.name} {r.brand && <span className="text-muted">({r.brand})</span>}
                    </span>
                    <span className="log-details">
                      {r.calories} cal/100g · P:{r.protein}g C:{r.carbs}g F:{r.fat}g
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            !searching &&
            !searchError &&
            searchQuery && (
              <div className="empty-state">
                <span>No results found</span>
                <span className="empty-state-hint">Try a different search term</span>
              </div>
            )
          )}
        </div>
      )}

      {/* Manual View */}
      {view === 'manual' && (
        <div className="section">
          <div className="form-card">
            <input
              type="text"
              placeholder="Food name"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
            />
            <div className="form-row">
              <input
                type="number"
                placeholder="Calories"
                value={manualCals}
                onChange={(e) => setManualCals(e.target.value)}
              />
              <input
                type="number"
                placeholder="Protein (g)"
                value={manualProtein}
                onChange={(e) => setManualProtein(e.target.value)}
              />
            </div>
            <div className="form-row">
              <input
                type="number"
                placeholder="Carbs (g)"
                value={manualCarbs}
                onChange={(e) => setManualCarbs(e.target.value)}
              />
              <input
                type="number"
                placeholder="Fat (g)"
                value={manualFat}
                onChange={(e) => setManualFat(e.target.value)}
              />
            </div>
            <div className="form-row">
              <div className="input-group" style={{ flex: 1 }}>
                <label>Servings</label>
                <input
                  type="number"
                  step="0.5"
                  value={manualServings}
                  onChange={(e) => setManualServings(e.target.value)}
                />
              </div>
              <div className="input-group" style={{ flex: 1 }}>
                <label>Unit (optional)</label>
                <input
                  type="text"
                  placeholder="scoop, slice…"
                  value={manualUnit}
                  onChange={(e) => setManualUnit(e.target.value)}
                />
              </div>
            </div>
            {librarySavedMsg && (
              <p className="text-muted" style={{ fontSize: 13, marginBottom: 8 }}>
                {librarySavedMsg}
              </p>
            )}
            <div className="btn-row">
              <button className="btn-primary" onClick={logAndSaveManual}>
                Log &amp; Save
              </button>
              <button className="btn-secondary" onClick={logManualFood}>
                Just Log
              </button>
              <button className="btn-secondary" onClick={saveManualToLibrary}>
                Save Only
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Water View */}
      {view === 'water' && (
        <div className="section">
          <div className="form-card">
            <div className="input-group">
              <label>Daily Goal</label>
              <div className="serving-row">
                <input
                  type="number"
                  value={goals.waterGoal}
                  onChange={(e) => updateWaterGoal(e.target.value)}
                  style={{ width: 80 }}
                />
                <span style={{ alignSelf: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                  oz / day
                </span>
              </div>
            </div>
          </div>

          <div
            className={`card ${waterOz >= goals.waterGoal && goals.waterGoal > 0 ? 'goal-met' : ''}`}
            style={{ '--i': 0 }}
          >
            <ProgressBar
              label="Water"
              current={waterOz}
              goal={goals.waterGoal}
              unit="oz"
              color="#4ab8d8"
            />
            {waterOz >= goals.waterGoal && goals.waterGoal > 0 && (
              <div className="goal-badge">
                <CheckIcon size={12} /> Goal hit!
              </div>
            )}
          </div>

          <div className="water-quick-add">
            {[8, 12, 16, 20].map((oz) => (
              <button key={oz} className="water-quick-btn" onClick={() => addWater(oz)}>
                +{oz} oz
              </button>
            ))}
          </div>

          <div className="form-card">
            <div className="input-group">
              <label>Custom Amount</label>
              <div className="serving-row">
                <input
                  type="number"
                  placeholder="oz"
                  value={customWater}
                  onChange={(e) => setCustomWater(e.target.value)}
                />
                <button
                  className="btn-primary"
                  onClick={() => {
                    addWater(parseFloat(customWater) || 0);
                    setCustomWater('');
                  }}
                  disabled={!customWater || parseFloat(customWater) <= 0}
                >
                  Add
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    addWater(-(parseFloat(customWater) || 0));
                    setCustomWater('');
                  }}
                  disabled={!customWater || parseFloat(customWater) <= 0}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Library View */}
      {view === 'library' && (
        <div className="section">
          {library.length > 0 ? (
            <div className="log-list">
              {library.map((item) => (
                <div key={item.id} className="log-item">
                  <div className="log-item-content clickable" onClick={() => logFromLibrary(item)}>
                    <span className="log-exercise">{item.name}</span>
                    <span className="log-details">
                      {item.calories} cal · P:{item.protein}g C:{item.carbs}g F:{item.fat}g
                    </span>
                  </div>
                  <button className="btn-delete" onClick={() => removeFromLibrary(item.id)}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <span>No saved foods yet</span>
              <span className="empty-state-hint">
                Search or manually add foods to save them here
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
