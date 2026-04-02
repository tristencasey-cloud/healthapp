import { useEffect, useState } from 'react';
import { getProfile, saveProfile, getGoals, saveGoals, getSettings, saveSettings } from '../storage';
import { calculateTDEE, calculateMacros } from '../utils/tdee';
import { saveBodyStat, getAllBodyStats, deleteBodyStat } from '../db';
import { todayStr, localDateStr, formatDate, compressImage } from '../utils/helpers';
import Sparkline from '../components/Sparkline';

const SPLITS = {
  none:        { label: 'No Split',           days: [] },
  ppl:         { label: 'Push / Pull / Legs', days: ['Push', 'Pull', 'Legs'] },
  upper_lower: { label: 'Upper / Lower',       days: ['Upper', 'Lower'] },
  bro:         { label: 'Bro Split',           days: ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs'] },
};

const ACCENT_COLORS = [
  '#e8734a', // Orange (default)
  '#4a8fe8', // Blue
  '#9b6dff', // Purple
  '#52b788', // Green
  '#e84a6f', // Red
  '#38c9d4', // Teal
  '#f0b429', // Gold
  '#e879c0', // Pink
];

export default function Profile({ onClose, onAccentChange }) {
  const [profile, setProfile] = useState(getProfile());
  const [goals, setGoals] = useState(getGoals());
  const [settings, setSettings] = useState(getSettings());
  const [tdee, setTdee] = useState(null);
  const [section, setSection] = useState('profile');
  const [bodyWeight, setBodyWeight] = useState('');
  const [logDate, setLogDate] = useState(localDateStr());
  const [bodyStats, setBodyStats] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [photoViewer, setPhotoViewer] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadBodyStats();
  }, []);

  useEffect(() => {
    const t = calculateTDEE(profile);
    setTdee(t);
  }, [profile]);

  async function loadBodyStats() {
    const all = await getAllBodyStats();
    setBodyStats(all);
    const withPhotos = all.filter((s) => s.photo);
    setPhotos(withPhotos);
  }

  function updateProfile(key, value) {
    const updated = { ...profile, [key]: value };
    setProfile(updated);
    saveProfile(updated);
  }

  function updateGoals(key, value) {
    const updated = { ...goals, [key]: value };
    setGoals(updated);
    saveGoals(updated);
  }

  function applyAutoGoals() {
    if (!tdee) return;
    const macros = calculateMacros(tdee);
    const updated = {
      ...goals,
      mode: 'auto',
      calories: tdee,
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
    };
    setGoals(updated);
    saveGoals(updated);
    flashSaved();
  }

  function switchToManual() {
    const updated = { ...goals, mode: 'manual' };
    setGoals(updated);
    saveGoals(updated);
  }

  async function logBodyWeight() {
    if (!bodyWeight || !logDate) return;
    const existing = bodyStats.find((s) => s.date === logDate) || { date: logDate };
    const updated = { ...existing, weight: parseFloat(bodyWeight) };
    await saveBodyStat(updated);
    setBodyWeight('');
    setLogDate(localDateStr());
    await loadBodyStats();
    flashSaved();
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file, 400, 0.6);
    const today = todayStr();
    const existing = bodyStats.find((s) => s.date === today) || { date: today };
    const updated = { ...existing, photo: compressed };
    await saveBodyStat(updated);
    await loadBodyStats();
    flashSaved();
    e.target.value = '';
  }

  function flashSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  const weightData = bodyStats
    .filter((s) => s.weight)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => ({ date: s.date, value: s.weight }));

  return (
    <div className="page profile-page">
      <div className="profile-header">
        <h1 className="page-title">Settings</h1>
        <button className="btn-close" onClick={onClose}>
          ×
        </button>
      </div>

      {saved && <div className="toast">Saved</div>}

      <div className="tab-row">
        <button
          className={`tab-btn ${section === 'profile' ? 'active' : ''}`}
          onClick={() => setSection('profile')}
        >
          Profile
        </button>
        <button
          className={`tab-btn ${section === 'goals' ? 'active' : ''}`}
          onClick={() => setSection('goals')}
        >
          Goals
        </button>
        <button
          className={`tab-btn ${section === 'body' ? 'active' : ''}`}
          onClick={() => setSection('body')}
        >
          Body
        </button>
        <button
          className={`tab-btn ${section === 'customize' ? 'active' : ''}`}
          onClick={() => setSection('customize')}
        >
          Style
        </button>
      </div>

      {/* Profile Section */}
      {section === 'profile' && (
        <div className="section">
          <div className="form-card">
            <div className="input-group">
              <label>Age</label>
              <input
                type="number"
                value={profile.age || ''}
                onChange={(e) => updateProfile('age', parseInt(e.target.value) || null)}
              />
            </div>

            <div className="input-group">
              <label>Sex</label>
              <select value={profile.sex} onChange={(e) => updateProfile('sex', e.target.value)}>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>

            <div className="input-group">
              <label>Height</label>
              <div className="form-row">
                <input
                  type="number"
                  placeholder="ft"
                  value={profile.heightFt || ''}
                  onChange={(e) => updateProfile('heightFt', parseInt(e.target.value) || null)}
                />
                <input
                  type="number"
                  placeholder="in"
                  value={profile.heightIn || ''}
                  onChange={(e) => updateProfile('heightIn', parseInt(e.target.value) || null)}
                />
              </div>
            </div>

            <div className="input-group">
              <label>Starting Weight (lbs)</label>
              <input
                type="number"
                value={profile.weight || ''}
                onChange={(e) => updateProfile('weight', parseFloat(e.target.value) || null)}
              />
            </div>

            <div className="input-group">
              <label>Weight Goal</label>
              <select
                value={goals.weightGoal || 'maintain'}
                onChange={(e) => updateGoals('weightGoal', e.target.value)}
              >
                <option value="lose">Lose Weight</option>
                <option value="maintain">Stay the Same</option>
                <option value="gain">Gain Weight</option>
              </select>
            </div>

            <div className="input-group">
              <label>Activity Level</label>
              <select
                value={profile.activityLevel}
                onChange={(e) => updateProfile('activityLevel', e.target.value)}
              >
                <option value="sedentary">Sedentary</option>
                <option value="lightly_active">Lightly Active</option>
                <option value="moderately_active">Moderately Active</option>
                <option value="very_active">Very Active</option>
              </select>
            </div>

            {tdee && (
              <div className="tdee-result">
                <span>Estimated TDEE</span>
                <strong>{tdee} cal/day</strong>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Goals Section */}
      {section === 'goals' && (
        <div className="section">
          <div className="form-card">
            <div className="goals-mode-toggle">
              <button
                className={`tab-btn ${goals.mode === 'auto' ? 'active' : ''}`}
                onClick={applyAutoGoals}
                disabled={!tdee}
              >
                Auto (TDEE)
              </button>
              <button
                className={`tab-btn ${goals.mode === 'manual' ? 'active' : ''}`}
                onClick={switchToManual}
              >
                Manual
              </button>
            </div>

            {goals.mode === 'auto' && (
              <p className="text-muted" style={{ marginBottom: 12 }}>
                Goals calculated from your profile. Edit profile to recalculate.
              </p>
            )}

            <div className="input-group">
              <label>Daily Calories</label>
              <input
                type="number"
                value={goals.calories}
                onChange={(e) => updateGoals('calories', parseInt(e.target.value) || 0)}
                disabled={goals.mode === 'auto'}
              />
            </div>

            <div className="input-group">
              <label>Protein (g)</label>
              <input
                type="number"
                value={goals.protein}
                onChange={(e) => updateGoals('protein', parseInt(e.target.value) || 0)}
                disabled={goals.mode === 'auto'}
              />
            </div>

            <div className="input-group">
              <label>Carbs (g)</label>
              <input
                type="number"
                value={goals.carbs}
                onChange={(e) => updateGoals('carbs', parseInt(e.target.value) || 0)}
                disabled={goals.mode === 'auto'}
              />
            </div>

            <div className="input-group">
              <label>Fat (g)</label>
              <input
                type="number"
                value={goals.fat}
                onChange={(e) => updateGoals('fat', parseInt(e.target.value) || 0)}
                disabled={goals.mode === 'auto'}
              />
            </div>

            <div className="input-group">
              <label>Workouts Per Week</label>
              <input
                type="number"
                value={goals.workoutsPerWeek}
                onChange={(e) => updateGoals('workoutsPerWeek', parseInt(e.target.value) || 0)}
              />
            </div>

            <div className="input-group">
              <label>Workout Split</label>
              <select
                value={settings.split}
                onChange={(e) => {
                  const updated = { ...settings, split: e.target.value };
                  setSettings(updated);
                  saveSettings(updated);
                }}
              >
                {Object.entries(SPLITS).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Body Section */}
      {section === 'body' && (
        <div className="section">
          <div className="form-card">
            <h3 className="card-title">Log Body Weight</h3>
            <div className="input-group">
              <label>Date</label>
              <input
                type="date"
                value={logDate}
                max={localDateStr()}
                onChange={(e) => setLogDate(e.target.value)}
              />
            </div>
            <div className="form-row weight-input-row">
              <input
                className="weight-input"
                type="number"
                step="0.1"
                placeholder="Weight (lbs)"
                value={bodyWeight}
                onChange={(e) => setBodyWeight(e.target.value)}
                style={{ fontSize: '22px', fontWeight: 600, color: '#ede9e0', WebkitTextFillColor: '#ede9e0', padding: '14px 16px', textAlign: 'center' }}
              />
              <button className="btn-primary" onClick={logBodyWeight}>
                Log
              </button>
            </div>
          </div>

          <div className="card" style={{ '--i': 1 }}>
            <h3 className="card-title">Weight History</h3>
            <Sparkline
              data={(() => {
                if (!profile.weight || weightData.length === 0) return weightData;
                const d = new Date(weightData[0].date + 'T12:00:00');
                d.setDate(d.getDate() - 1);
                return [{ date: localDateStr(d), value: profile.weight }, ...weightData];
              })()}
              width={300}
              height={80}
              color="var(--accent)"
            />
            {weightData.length > 0 && (
              <div className="weight-history-list">
                {weightData
                  .slice(-10)
                  .reverse()
                  .map((d) => (
                    <div key={d.date} className="weight-history-item">
                      <span>{formatDate(d.date)}</span>
                      <span>{d.value} lbs</span>
                      <button
                        className="btn-delete-stat"
                        onClick={async () => {
                          await deleteBodyStat(d.date);
                          await loadBodyStats();
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="card" style={{ '--i': 2 }}>
            <h3 className="card-title">Progress Photos</h3>
            <label className="btn-secondary photo-upload-btn">
              + Add Photo
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoUpload}
                style={{ display: 'none' }}
              />
            </label>

            {photos.length > 0 ? (
              <div className="photo-grid">
                {[...photos]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((p) => (
                    <div key={p.date} className="photo-thumb" onClick={() => setPhotoViewer(p)}>
                      <img src={p.photo} alt={`Progress ${p.date}`} />
                      <span className="photo-date">{formatDate(p.date)}</span>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="empty-state">No progress photos yet</div>
            )}
          </div>

          {photoViewer && (
            <div className="modal-overlay" onClick={() => setPhotoViewer(null)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="btn-close" onClick={() => setPhotoViewer(null)}>
                  ×
                </button>
                <img src={photoViewer.photo} alt={`Progress ${photoViewer.date}`} />
                <p>{formatDate(photoViewer.date)}</p>
                {photoViewer.weight && <p>{photoViewer.weight} lbs</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Customization Section */}
      {section === 'customize' && (
        <div className="section">
          <div className="form-card">
            <h3 className="card-title">Accent Color</h3>
            <div className="color-swatch-grid">
              {ACCENT_COLORS.map((color) => (
                <button
                  key={color}
                  className={`color-swatch ${settings.accentColor === color ? 'active' : ''}`}
                  style={{ background: color }}
                  onClick={() => {
                    const updated = { ...settings, accentColor: color };
                    setSettings(updated);
                    saveSettings(updated);
                    onAccentChange?.(color);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
