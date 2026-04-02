import { useEffect, useState, useRef } from 'react';
import {
  getWorkoutLog,
  saveWorkoutLog,
  getAllExerciseNames,
  getExerciseHistory,
  getAllWorkoutLogs,
  getAllCardioTypes,
  getAllTemplates,
  saveTemplate,
  deleteTemplate,
} from '../db';
import { getSettings } from '../storage';
import { FitnessIcon } from '../components/icons';
import { todayStr, formatDate, formatDateFull } from '../utils/helpers';
import Sparkline from '../components/Sparkline';

const SPLITS = {
  none:        { label: 'No Split',           days: [] },
  ppl:         { label: 'Push / Pull / Legs', days: ['Push', 'Pull', 'Legs'] },
  upper_lower: { label: 'Upper / Lower',       days: ['Upper', 'Lower'] },
  bro:         { label: 'Bro Split',           days: ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs'] },
};

export default function Fitness() {
  const [date, setDate] = useState(todayStr());
  const [workout, setWorkout] = useState({ date: todayStr(), lifts: [], cardio: [] });
  const [exerciseNames, setExerciseNames] = useState([]);
  const [section, setSection] = useState('lifts');
  const [settings, setSettings] = useState(getSettings());

  // Split day
  const [splitDay, setSplitDay] = useState(null);

  // Lift add form
  const [showLiftForm, setShowLiftForm] = useState(false);
  const [liftExercise, setLiftExercise] = useState('');
  const [liftSets, setLiftSets] = useState('');
  const [liftReps, setLiftReps] = useState('');
  const [liftWeight, setLiftWeight] = useState('');
  const [filteredNames, setFilteredNames] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [exerciseHistory, setExerciseHistory] = useState(null);
  const [historyExercise, setHistoryExercise] = useState('');

  // Inline edit
  const [editingLiftIdx, setEditingLiftIdx] = useState(null);
  const [editLiftData, setEditLiftData] = useState({ sets: '', reps: '', weight: '' });

  // Cardio form
  const [showCardioForm, setShowCardioForm] = useState(false);
  const [cardioType, setCardioType] = useState('');
  const [cardioDuration, setCardioDuration] = useState('');
  const [cardioDistance, setCardioDistance] = useState('');
  const [cardioCalories, setCardioCalories] = useState('');
  const [cardioTypes, setCardioTypes] = useState([]);
  const [filteredCardioTypes, setFilteredCardioTypes] = useState([]);
  const [showCardioSuggestions, setShowCardioSuggestions] = useState(false);

  // Progress tab
  const [progressData, setProgressData] = useState([]);
  const [progressSearch, setProgressSearch] = useState('');
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [expandedExercise, setExpandedExercise] = useState(null);
  const [expandedHistory, setExpandedHistory] = useState([]);
  const [loadingExpandHistory, setLoadingExpandHistory] = useState(false);

  // Templates
  const [templates, setTemplates] = useState([]);
  const [showTemplatePanel, setShowTemplatePanel] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [templateChecks, setTemplateChecks] = useState({});
  const [templateWeights, setTemplateWeights] = useState({});
  const [loadingTemplateWeights, setLoadingTemplateWeights] = useState(false);

  // Save as template
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState('');

  // New template from scratch
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateExercises, setNewTemplateExercises] = useState([]);

  const suggestionsRef = useRef(null);
  const cardioSuggestionsRef = useRef(null);

  useEffect(() => {
    loadWorkout(date);
    loadExerciseNames();
    loadCardioTypes();
    loadTemplates();
    setSettings(getSettings());
  }, [date]);

  useEffect(() => {
    if (section === 'progress') {
      loadProgressData();
    }
  }, [section]);

  async function loadWorkout(d) {
    const log = await getWorkoutLog(d);
    const loaded = log || { date: d, lifts: [], cardio: [] };
    setWorkout(loaded);
    setSplitDay(loaded.splitDay || null);
  }

  async function loadExerciseNames() {
    const names = await getAllExerciseNames();
    setExerciseNames(names);
  }

  async function loadCardioTypes() {
    const types = await getAllCardioTypes();
    setCardioTypes(types);
  }

  async function loadTemplates() {
    const t = await getAllTemplates();
    setTemplates(t);
  }

  async function loadProgressData() {
    setLoadingProgress(true);
    try {
      const allLogs = await getAllWorkoutLogs();
      const exerciseMap = {};
      allLogs.forEach((log) => {
        (log.lifts || []).forEach((lift) => {
          if (!lift.exercise || lift.weight == null) return;
          if (!exerciseMap[lift.exercise]) exerciseMap[lift.exercise] = {};
          const cur = exerciseMap[lift.exercise][log.date];
          if (cur === undefined || lift.weight > cur) {
            exerciseMap[lift.exercise][log.date] = lift.weight;
          }
        });
      });

      const result = Object.keys(exerciseMap)
        .sort()
        .map((name) => {
          const dateMap = exerciseMap[name];
          const sortedDates = Object.keys(dateMap).sort();
          const sparklineData = sortedDates.map((d) => ({ date: d, value: dateMap[d] }));
          const pr = Math.max(...sparklineData.map((p) => p.value));
          const lastDate = sortedDates[sortedDates.length - 1];
          const prevSessionWeight =
            sortedDates.length >= 2 ? dateMap[sortedDates[sortedDates.length - 2]] : null;
          return { name, pr, prevSessionWeight, sparklineData, lastDate };
        });

      setProgressData(result);
    } finally {
      setLoadingProgress(false);
    }
  }

  async function handleToggleExercise(name) {
    if (expandedExercise === name) {
      setExpandedExercise(null);
      setExpandedHistory([]);
      return;
    }
    setExpandedExercise(name);
    setLoadingExpandHistory(true);
    const history = await getExerciseHistory(name);
    setExpandedHistory(history);
    setLoadingExpandHistory(false);
  }

  function handleDateNav(dir) {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + dir);
    setDate(d.toISOString().split('T')[0]);
  }

  // ─── Split day ───

  async function handleSplitDayChange(day) {
    const next = splitDay === day ? null : day;
    setSplitDay(next);
    const updated = { ...workout, splitDay: next || undefined };
    await saveWorkoutLog(updated);
    setWorkout(updated);
  }

  // ─── Lift form ───

  function handleExerciseInput(val) {
    setLiftExercise(val);
    if (val.length > 0) {
      const filtered = exerciseNames.filter((n) => n.toLowerCase().includes(val.toLowerCase()));
      setFilteredNames(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  }

  function selectSuggestion(name) {
    setLiftExercise(name);
    setShowSuggestions(false);
    lookupHistory(name);
  }

  async function lookupHistory(name) {
    const history = await getExerciseHistory(name);
    if (history.length > 0) {
      setExerciseHistory(history[0]);
      setHistoryExercise(name);
    } else {
      setExerciseHistory(null);
    }
  }

  async function addLift() {
    if (!liftExercise || !liftSets || !liftReps || !liftWeight) return;
    const newLift = {
      exercise: liftExercise,
      sets: parseInt(liftSets),
      reps: parseInt(liftReps),
      weight: parseFloat(liftWeight),
    };
    const updated = { ...workout, date, lifts: [...(workout.lifts || []), newLift] };
    await saveWorkoutLog(updated);
    setWorkout(updated);
    resetLiftForm();
    loadExerciseNames();
  }

  function resetLiftForm() {
    setLiftExercise('');
    setLiftSets('');
    setLiftReps('');
    setLiftWeight('');
    setShowLiftForm(false);
    setExerciseHistory(null);
    setShowSuggestions(false);
  }

  // ─── Edit lift ───

  function startEditLift(idx) {
    const lift = workout.lifts[idx];
    setEditingLiftIdx(idx);
    setEditLiftData({ sets: String(lift.sets), reps: String(lift.reps), weight: String(lift.weight) });
    setShowLiftForm(false);
  }

  async function saveEditLift() {
    const lifts = [...workout.lifts];
    lifts[editingLiftIdx] = {
      ...lifts[editingLiftIdx],
      sets: parseInt(editLiftData.sets) || lifts[editingLiftIdx].sets,
      reps: parseInt(editLiftData.reps) || lifts[editingLiftIdx].reps,
      weight: parseFloat(editLiftData.weight) || lifts[editingLiftIdx].weight,
    };
    const updated = { ...workout, lifts };
    await saveWorkoutLog(updated);
    setWorkout(updated);
    setEditingLiftIdx(null);
    setEditLiftData({ sets: '', reps: '', weight: '' });
  }

  function cancelEditLift() {
    setEditingLiftIdx(null);
    setEditLiftData({ sets: '', reps: '', weight: '' });
  }

  async function removeLift(index) {
    const lifts = [...workout.lifts];
    lifts.splice(index, 1);
    const updated = { ...workout, lifts };
    await saveWorkoutLog(updated);
    setWorkout(updated);
  }

  // ─── Cardio ───

  function handleCardioTypeInput(val) {
    setCardioType(val);
    if (val.length > 0) {
      const filtered = cardioTypes.filter((t) => t.toLowerCase().includes(val.toLowerCase()));
      setFilteredCardioTypes(filtered);
      setShowCardioSuggestions(filtered.length > 0);
    } else {
      setFilteredCardioTypes([]);
      setShowCardioSuggestions(false);
    }
  }

  function selectCardioType(type) {
    setCardioType(type);
    setShowCardioSuggestions(false);
    setFilteredCardioTypes([]);
  }

  async function addCardio() {
    if (!cardioType || !cardioDuration) return;
    const newCardio = {
      type: cardioType,
      duration: parseInt(cardioDuration),
      distance: cardioDistance ? parseFloat(cardioDistance) : null,
      calories: cardioCalories ? parseInt(cardioCalories) : null,
    };
    const updated = { ...workout, date, cardio: [...(workout.cardio || []), newCardio] };
    await saveWorkoutLog(updated);
    setWorkout(updated);
    resetCardioForm();
    loadCardioTypes();
  }

  async function removeCardio(index) {
    const cardio = [...workout.cardio];
    cardio.splice(index, 1);
    const updated = { ...workout, cardio };
    await saveWorkoutLog(updated);
    setWorkout(updated);
  }

  function resetCardioForm() {
    setCardioType('');
    setCardioDuration('');
    setCardioDistance('');
    setCardioCalories('');
    setShowCardioForm(false);
    setFilteredCardioTypes([]);
    setShowCardioSuggestions(false);
  }

  // ─── Templates ───

  async function openTemplate(template) {
    setActiveTemplate(template);
    const checks = {};
    template.exercises.forEach((ex) => { checks[ex.exercise] = true; });
    setTemplateChecks(checks);

    setLoadingTemplateWeights(true);
    const weights = {};
    await Promise.all(
      template.exercises.map(async (ex) => {
        const history = await getExerciseHistory(ex.exercise);
        const lastSession = history[0];
        const lastLift = lastSession?.lifts?.[0];
        weights[ex.exercise] = {
          sets: lastLift?.sets ?? ex.sets,
          reps: lastLift?.reps ?? ex.reps,
          weight: lastLift?.weight ?? ex.weight,
        };
      })
    );
    setTemplateWeights(weights);
    setLoadingTemplateWeights(false);
  }

  async function addTemplateToWorkout() {
    const toAdd = activeTemplate.exercises
      .filter((ex) => templateChecks[ex.exercise])
      .map((ex) => ({
        exercise: ex.exercise,
        sets: templateWeights[ex.exercise]?.sets ?? ex.sets,
        reps: templateWeights[ex.exercise]?.reps ?? ex.reps,
        weight: templateWeights[ex.exercise]?.weight ?? ex.weight,
      }));

    const updated = { ...workout, date, lifts: [...(workout.lifts || []), ...toAdd] };
    await saveWorkoutLog(updated);
    setWorkout(updated);
    setShowTemplatePanel(false);
    setActiveTemplate(null);
  }

  async function handleSaveAsTemplate() {
    if (!saveTemplateName.trim() || workout.lifts.length === 0) return;
    await saveTemplate({
      name: saveTemplateName.trim(),
      exercises: workout.lifts.map((l) => ({
        exercise: l.exercise,
        sets: l.sets,
        reps: l.reps,
        weight: l.weight,
      })),
    });
    await loadTemplates();
    setSaveTemplateName('');
    setShowSaveTemplate(false);
  }

  async function handleDeleteTemplate(id) {
    await deleteTemplate(id);
    await loadTemplates();
    if (activeTemplate?.id === id) setActiveTemplate(null);
  }

  function addExerciseToNewTemplate() {
    if (!liftExercise || !liftSets || !liftReps || !liftWeight) return;
    setNewTemplateExercises([
      ...newTemplateExercises,
      {
        exercise: liftExercise,
        sets: parseInt(liftSets),
        reps: parseInt(liftReps),
        weight: parseFloat(liftWeight),
      },
    ]);
    setLiftExercise('');
    setLiftSets('');
    setLiftReps('');
    setLiftWeight('');
    setShowSuggestions(false);
  }

  async function saveNewTemplate() {
    if (!newTemplateName.trim() || newTemplateExercises.length === 0) return;
    await saveTemplate({ name: newTemplateName.trim(), exercises: newTemplateExercises });
    await loadTemplates();
    setNewTemplateName('');
    setNewTemplateExercises([]);
    setShowNewTemplate(false);
  }

  const isToday = date === todayStr();
  const splitDays = SPLITS[settings.split]?.days || [];

  const filteredProgress = progressData.filter((ex) =>
    ex.name.toLowerCase().includes(progressSearch.toLowerCase())
  );

  const anyTemplateChecked = Object.values(templateChecks).some(Boolean);

  return (
    <div className="page fitness-page">
      {/* Date Navigation */}
      <div className="date-nav">
        <button className="date-btn" onClick={() => handleDateNav(-1)}>‹</button>
        <div className="date-display">
          <span className="date-label">{isToday ? 'Today' : formatDateFull(date)}</span>
        </div>
        <button className="date-btn" onClick={() => handleDateNav(1)}>›</button>
      </div>

      {/* Tab Bar */}
      <div className="tab-row">
        <button className={`tab-btn ${section === 'lifts' ? 'active' : ''}`} onClick={() => setSection('lifts')}>Lifts</button>
        <button className={`tab-btn ${section === 'cardio' ? 'active' : ''}`} onClick={() => setSection('cardio')}>Cardio</button>
        <button className={`tab-btn ${section === 'progress' ? 'active' : ''}`} onClick={() => setSection('progress')}>Progress</button>
      </div>

      {/* Split day row — always visible when a split is configured */}
      {settings.split !== 'none' && (
        <div className="split-day-row">
          {splitDays.map((day) => (
            <button
              key={day}
              className={`split-day-btn ${splitDay === day ? 'active' : ''}`}
              onClick={() => handleSplitDayChange(day)}
            >
              {day}
            </button>
          ))}
          <button
            className={`split-day-btn rest ${splitDay === 'Rest' ? 'active' : ''}`}
            onClick={() => handleSplitDayChange('Rest')}
          >
            Rest
          </button>
        </div>
      )}

      {/* ── Lifts Tab ── */}
      {section === 'lifts' && (
        <div className="section">
          {/* Template bar */}
          <div className="template-bar">
            <button
              className="btn-small"
              onClick={() => {
                setShowTemplatePanel(!showTemplatePanel);
                setActiveTemplate(null);
                setShowNewTemplate(false);
              }}
            >
              {showTemplatePanel ? 'Close Templates' : 'Load Template'}
            </button>
            {workout.lifts.length > 0 && !showSaveTemplate && (
              <button className="btn-small" onClick={() => setShowSaveTemplate(true)}>
                Save as Template
              </button>
            )}
          </div>

          {/* Template panel */}
          {showTemplatePanel && (
            <div className="template-panel">
              {activeTemplate ? (
                // ── Exercise checklist view ──
                <>
                  <div className="template-panel-header">
                    <button className="btn-small" onClick={() => setActiveTemplate(null)}>← Back</button>
                    <span className="template-panel-title">{activeTemplate.name}</span>
                  </div>
                  {loadingTemplateWeights ? (
                    <div className="empty-state" style={{ padding: '16px 0' }}>Loading weights…</div>
                  ) : (
                    activeTemplate.exercises.map((ex) => (
                      <div key={ex.exercise} className="template-exercise-row">
                        <input
                          type="checkbox"
                          checked={!!templateChecks[ex.exercise]}
                          onChange={(e) =>
                            setTemplateChecks({ ...templateChecks, [ex.exercise]: e.target.checked })
                          }
                          style={{ width: 18, height: 18, accentColor: 'var(--accent)', flexShrink: 0 }}
                        />
                        <div className="template-exercise-info">
                          <div className="template-exercise-name">{ex.exercise}</div>
                          <div className="template-exercise-detail">
                            {templateWeights[ex.exercise]?.sets ?? ex.sets} ×{' '}
                            {templateWeights[ex.exercise]?.reps ?? ex.reps} @{' '}
                            {templateWeights[ex.exercise]?.weight ?? ex.weight} lbs
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <button
                    className="btn-primary"
                    style={{ marginTop: 14 }}
                    onClick={addTemplateToWorkout}
                    disabled={!anyTemplateChecked || loadingTemplateWeights}
                  >
                    Add Selected to Today
                  </button>
                </>
              ) : showNewTemplate ? (
                // ── New template from scratch ──
                <>
                  <div className="template-panel-header">
                    <button className="btn-small" onClick={() => { setShowNewTemplate(false); setNewTemplateExercises([]); setNewTemplateName(''); }}>← Back</button>
                    <span className="template-panel-title">New Template</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Template name (e.g. Push Day)"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    style={{ marginBottom: 10 }}
                  />
                  {newTemplateExercises.length > 0 && (
                    <div className="new-template-exercise-list">
                      {newTemplateExercises.map((ex, i) => (
                        <div key={i} className="new-template-exercise-item">
                          {ex.exercise} — {ex.sets}×{ex.reps} @ {ex.weight} lbs
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Reuse lift form inputs for adding to new template */}
                  <div className="input-group autocomplete-wrapper">
                    <input
                      type="text"
                      placeholder="Exercise name"
                      value={liftExercise}
                      onChange={(e) => handleExerciseInput(e.target.value)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                      onFocus={() => { if (liftExercise && filteredNames.length > 0) setShowSuggestions(true); }}
                    />
                    {showSuggestions && (
                      <div className="suggestions" ref={suggestionsRef}>
                        {filteredNames.map((name) => (
                          <button key={name} className="suggestion-item" onClick={() => selectSuggestion(name)}>{name}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="form-row">
                    <input type="number" placeholder="Sets" value={liftSets} onChange={(e) => setLiftSets(e.target.value)} />
                    <input type="number" placeholder="Reps" value={liftReps} onChange={(e) => setLiftReps(e.target.value)} />
                    <input type="number" placeholder="lbs" value={liftWeight} onChange={(e) => setLiftWeight(e.target.value)} />
                  </div>
                  <div className="btn-row">
                    <button className="btn-secondary" onClick={addExerciseToNewTemplate} disabled={!liftExercise || !liftSets || !liftReps || !liftWeight}>
                      + Add Exercise
                    </button>
                    <button className="btn-primary" onClick={saveNewTemplate} disabled={!newTemplateName.trim() || newTemplateExercises.length === 0}>
                      Save Template
                    </button>
                  </div>
                </>
              ) : (
                // ── Template list ──
                <>
                  {templates.length === 0 ? (
                    <div className="empty-state" style={{ padding: '16px 0' }}>
                      <span>No templates yet</span>
                      <span className="empty-state-hint">Save a workout or create one below</span>
                    </div>
                  ) : (
                    templates.map((t) => (
                      <div key={t.id} className="template-list-item">
                        <span className="template-item-name" onClick={() => openTemplate(t)}>{t.name}</span>
                        <span className="template-item-count">{t.exercises.length} exercises</span>
                        <button className="btn-delete" onClick={() => handleDeleteTemplate(t.id)}>×</button>
                      </div>
                    ))
                  )}
                  <button className="btn-small" style={{ marginTop: 12 }} onClick={() => setShowNewTemplate(true)}>
                    + New Template
                  </button>
                </>
              )}
            </div>
          )}

          {/* Save as template form */}
          {showSaveTemplate && (
            <div className="form-card">
              <input
                type="text"
                placeholder="Template name (e.g. Push Day)"
                value={saveTemplateName}
                onChange={(e) => setSaveTemplateName(e.target.value)}
              />
              <div className="btn-row">
                <button className="btn-primary" onClick={handleSaveAsTemplate} disabled={!saveTemplateName.trim()}>
                  Save
                </button>
                <button className="btn-secondary" onClick={() => { setShowSaveTemplate(false); setSaveTemplateName(''); }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Lift add form */}
          <div className="section-header">
            <h2>Lifts</h2>
            <button
              className="btn-small"
              onClick={() => {
                if (!showLiftForm) cancelEditLift();
                setShowLiftForm(!showLiftForm);
              }}
            >
              {showLiftForm ? 'Cancel' : '+ Add'}
            </button>
          </div>

          {showLiftForm && (
            <div className="form-card">
              <div className="input-group autocomplete-wrapper">
                <input
                  type="text"
                  placeholder="Exercise name"
                  value={liftExercise}
                  onChange={(e) => handleExerciseInput(e.target.value)}
                  onBlur={() => {
                    setTimeout(() => setShowSuggestions(false), 200);
                    if (liftExercise) lookupHistory(liftExercise);
                  }}
                  onFocus={() => { if (liftExercise && filteredNames.length > 0) setShowSuggestions(true); }}
                />
                {showSuggestions && (
                  <div className="suggestions" ref={suggestionsRef}>
                    {filteredNames.map((name) => (
                      <button key={name} className="suggestion-item" onClick={() => selectSuggestion(name)}>{name}</button>
                    ))}
                  </div>
                )}
              </div>

              {exerciseHistory && historyExercise.toLowerCase() === liftExercise.toLowerCase() && (
                <div className="history-hint">
                  Last time ({exerciseHistory.date}):{' '}
                  {exerciseHistory.lifts.map((l, i) => (
                    <span key={i}>
                      {l.sets}×{l.reps} @ {l.weight} lbs{i < exerciseHistory.lifts.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </div>
              )}

              <div className="form-row">
                <input type="number" placeholder="Sets" value={liftSets} onChange={(e) => setLiftSets(e.target.value)} />
                <input type="number" placeholder="Reps" value={liftReps} onChange={(e) => setLiftReps(e.target.value)} />
                <input type="number" placeholder="Weight (lbs)" value={liftWeight} onChange={(e) => setLiftWeight(e.target.value)} />
              </div>
              <button className="btn-primary" onClick={addLift}>Log Lift</button>
            </div>
          )}

          {/* Empty / rest day states */}
          {workout.lifts.length === 0 && splitDay === 'Rest' && (
            <div className="rest-day-banner">
              <span>Rest Day</span>
              <span className="empty-state-hint">Recovery is part of the program</span>
            </div>
          )}
          {workout.lifts.length === 0 && splitDay !== 'Rest' && (
            <div className="empty-state">
              <FitnessIcon size={36} color="var(--text-dim)" />
              <span>No lifts logged</span>
              <span className="empty-state-hint">Load a template or tap + Add</span>
            </div>
          )}

          {/* Lift log list */}
          {workout.lifts.length > 0 && (
            <div className="log-list">
              {workout.lifts.map((lift, i) => (
                <div key={i} className={`log-item${editingLiftIdx === i ? ' editing' : ''}`}>
                  {editingLiftIdx === i ? (
                    <>
                      <div className="log-exercise">{lift.exercise}</div>
                      <div className="lift-edit-row">
                        <div className="edit-field">
                          <span className="edit-field-label">Sets</span>
                          <input type="number" value={editLiftData.sets} onChange={(e) => setEditLiftData({ ...editLiftData, sets: e.target.value })} />
                        </div>
                        <div className="edit-field">
                          <span className="edit-field-label">Reps</span>
                          <input type="number" value={editLiftData.reps} onChange={(e) => setEditLiftData({ ...editLiftData, reps: e.target.value })} />
                        </div>
                        <div className="edit-field">
                          <span className="edit-field-label">Weight (lbs)</span>
                          <input type="number" value={editLiftData.weight} onChange={(e) => setEditLiftData({ ...editLiftData, weight: e.target.value })} />
                        </div>
                      </div>
                      <div className="lift-edit-actions">
                        <button className="btn-primary" onClick={saveEditLift}>Save</button>
                        <button className="btn-secondary" onClick={cancelEditLift}>Cancel</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="log-item-content">
                        <span className="log-exercise">{lift.exercise}</span>
                        <span className="log-details">{lift.sets} × {lift.reps} @ {lift.weight} lbs</span>
                      </div>
                      <button className="btn-small" onClick={() => startEditLift(i)} style={{ marginRight: 4 }}>Edit</button>
                      <button className="btn-delete" onClick={() => removeLift(i)}>×</button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Cardio Tab ── */}
      {section === 'cardio' && (
        <div className="section">
          <div className="section-header">
            <h2>Cardio</h2>
            <button className="btn-small" onClick={() => setShowCardioForm(!showCardioForm)}>
              {showCardioForm ? 'Cancel' : '+ Add'}
            </button>
          </div>

          {showCardioForm && (
            <div className="form-card">
              <div className="input-group autocomplete-wrapper">
                <input
                  type="text"
                  placeholder="Type (running, cycling, etc)"
                  value={cardioType}
                  onChange={(e) => handleCardioTypeInput(e.target.value)}
                  onBlur={() => setTimeout(() => setShowCardioSuggestions(false), 200)}
                  onFocus={() => { if (cardioType && filteredCardioTypes.length > 0) setShowCardioSuggestions(true); }}
                />
                {showCardioSuggestions && (
                  <div className="suggestions" ref={cardioSuggestionsRef}>
                    {filteredCardioTypes.map((type) => (
                      <button key={type} className="suggestion-item" onClick={() => selectCardioType(type)}>{type}</button>
                    ))}
                  </div>
                )}
              </div>
              <div className="form-row">
                <input type="number" placeholder="Duration (min)" value={cardioDuration} onChange={(e) => setCardioDuration(e.target.value)} />
                <input type="number" placeholder="Distance (mi)" value={cardioDistance} onChange={(e) => setCardioDistance(e.target.value)} />
                <input type="number" placeholder="Calories" value={cardioCalories} onChange={(e) => setCardioCalories(e.target.value)} />
              </div>
              <button className="btn-primary" onClick={addCardio}>Log Cardio</button>
            </div>
          )}

          {workout.cardio && workout.cardio.length > 0 ? (
            <div className="log-list">
              {workout.cardio.map((c, i) => (
                <div key={i} className="log-item">
                  <div className="log-item-content">
                    <span className="log-exercise">{c.type}</span>
                    <span className="log-details">
                      {c.duration} min{c.distance ? ` · ${c.distance} mi` : ''}{c.calories ? ` · ${c.calories} cal` : ''}
                    </span>
                  </div>
                  <button className="btn-delete" onClick={() => removeCardio(i)}>×</button>
                </div>
              ))}
            </div>
          ) : (
            !showCardioForm && (
              <div className="empty-state">
                <span>No cardio logged</span>
                <span className="empty-state-hint">Tap + Add to log a session</span>
              </div>
            )
          )}
        </div>
      )}

      {/* ── Progress Tab ── */}
      {section === 'progress' && (
        <div className="section">
          <input
            type="text"
            placeholder="Filter exercises…"
            value={progressSearch}
            onChange={(e) => setProgressSearch(e.target.value)}
            style={{ marginBottom: 16 }}
          />

          {loadingProgress ? (
            <div className="empty-state">Loading…</div>
          ) : filteredProgress.length === 0 ? (
            <div className="empty-state">
              <span>{progressData.length === 0 ? 'No lift data yet' : 'No exercises match'}</span>
              {progressData.length === 0 && (
                <span className="empty-state-hint">Log lifts to see progress here</span>
              )}
            </div>
          ) : (
            filteredProgress.map((ex) => {
              const lastWeight = ex.sparklineData[ex.sparklineData.length - 1].value;
              const delta = ex.prevSessionWeight !== null ? lastWeight - ex.prevSessionWeight : null;
              const trendClass = delta === null ? 'neutral' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral';
              const isExpanded = expandedExercise === ex.name;

              return (
                <div
                  key={ex.name}
                  className={`progress-exercise-card${isExpanded ? ' expanded' : ''}`}
                  onClick={() => handleToggleExercise(ex.name)}
                >
                  <div className="progress-exercise-name">{ex.name}</div>
                  <div className="progress-exercise-meta">
                    <span className="pr-value">{ex.pr} lbs</span>
                    {delta !== null && delta !== 0 && (
                      <span className={`pr-trend ${trendClass}`}>
                        <span className="arrow-icon">{delta > 0 ? '↑' : '↓'}</span>
                        {delta > 0 ? ` +${delta} lbs` : ` ${delta} lbs`}
                      </span>
                    )}
                    <span className="pr-last-date">Last: {formatDate(ex.lastDate)}</span>
                  </div>
                  <Sparkline data={ex.sparklineData} width={280} height={48} color="var(--accent)" />
                  {isExpanded && (
                    <div className="exercise-history-panel">
                      {loadingExpandHistory ? (
                        <div className="empty-state" style={{ padding: '12px 0' }}>Loading…</div>
                      ) : expandedHistory.length === 0 ? (
                        <div className="empty-state" style={{ padding: '12px 0' }}>No history found</div>
                      ) : (
                        expandedHistory.slice(0, 10).map((session) => (
                          <div key={session.date} className="exercise-history-row">
                            <span className="exercise-history-date">{formatDate(session.date)}</span>
                            <span className="exercise-history-sets">
                              {session.lifts.map((l) => `${l.sets}×${l.reps} @ ${l.weight} lbs`).join('  ·  ')}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
