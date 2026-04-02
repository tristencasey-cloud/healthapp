const KEYS = {
  PROFILE: 'userProfile',
  GOALS: 'userGoals',
  SETTINGS: 'appSettings',
};

function getJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ─── User Profile ───

const DEFAULT_PROFILE = {
  age: null,
  sex: 'male',
  heightFt: null,
  heightIn: null,
  weight: null,
  activityLevel: 'sedentary',
};

export function getProfile() {
  return getJSON(KEYS.PROFILE, DEFAULT_PROFILE);
}

export function saveProfile(profile) {
  setJSON(KEYS.PROFILE, profile);
}

// ─── User Goals ───

const DEFAULT_GOALS = {
  calories: 2000,
  protein: 150,
  carbs: 200,
  fat: 65,
  workoutsPerWeek: 4,
  waterGoal: 64,
  mode: 'manual', // 'manual' or 'auto'
  weightGoal: 'maintain', // 'lose' | 'maintain' | 'gain'
};

export function getGoals() {
  return getJSON(KEYS.GOALS, DEFAULT_GOALS);
}

export function saveGoals(goals) {
  setJSON(KEYS.GOALS, goals);
}

// ─── App Settings ───

const DEFAULT_SETTINGS = {
  theme: 'dark',
  split: 'none', // 'none' | 'ppl' | 'upper_lower' | 'bro'
  accentColor: '#e8734a',
};

export function getSettings() {
  return getJSON(KEYS.SETTINGS, DEFAULT_SETTINGS);
}

export function saveSettings(settings) {
  setJSON(KEYS.SETTINGS, settings);
}
