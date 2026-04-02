import { openDB } from 'idb';

const DB_NAME = 'healthapp';
const DB_VERSION = 3;

let dbPromise = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Workout logs: keyed by date string (YYYY-MM-DD)
        if (!db.objectStoreNames.contains('workoutLogs')) {
          const workoutStore = db.createObjectStore('workoutLogs', { keyPath: 'date' });
          workoutStore.createIndex('byDate', 'date');
        }

        // Food logs: keyed by auto-increment, indexed by date
        if (!db.objectStoreNames.contains('foodLogs')) {
          const foodStore = db.createObjectStore('foodLogs', {
            keyPath: 'id',
            autoIncrement: true,
          });
          foodStore.createIndex('byDate', 'date');
        }

        // Food library: personal saved foods
        if (!db.objectStoreNames.contains('foodLibrary')) {
          const libStore = db.createObjectStore('foodLibrary', {
            keyPath: 'id',
            autoIncrement: true,
          });
          libStore.createIndex('byName', 'name');
        }

        // Body stats: keyed by date
        if (!db.objectStoreNames.contains('bodyStats')) {
          const statsStore = db.createObjectStore('bodyStats', { keyPath: 'date' });
          statsStore.createIndex('byDate', 'date');
        }

        // Water logs: keyed by date
        if (!db.objectStoreNames.contains('waterLogs')) {
          const waterStore = db.createObjectStore('waterLogs', { keyPath: 'date' });
          waterStore.createIndex('byDate', 'date');
        }

        // Workout templates
        if (!db.objectStoreNames.contains('workoutTemplates')) {
          db.createObjectStore('workoutTemplates', { keyPath: 'id', autoIncrement: true });
        }
      },
    });
  }
  return dbPromise;
}

// ─── Workout Logs ───

export async function getWorkoutLog(date) {
  const db = await getDB();
  return db.get('workoutLogs', date);
}

export async function saveWorkoutLog(log) {
  const db = await getDB();
  return db.put('workoutLogs', log);
}

export async function getWorkoutLogsRange(startDate, endDate) {
  const db = await getDB();
  const range = IDBKeyRange.bound(startDate, endDate);
  return db.getAllFromIndex('workoutLogs', 'byDate', range);
}

export async function getAllWorkoutLogs() {
  const db = await getDB();
  return db.getAll('workoutLogs');
}

export async function getAllCardioTypes() {
  const db = await getDB();
  const allLogs = await db.getAll('workoutLogs');
  const types = new Set();
  allLogs.forEach((log) => {
    if (log.cardio) {
      log.cardio.forEach((c) => {
        if (c.type && c.type.trim()) types.add(c.type.trim());
      });
    }
  });
  return Array.from(types).sort();
}

export async function getAllExerciseNames() {
  const db = await getDB();
  const allLogs = await db.getAll('workoutLogs');
  const names = new Set();
  allLogs.forEach((log) => {
    if (log.lifts) {
      log.lifts.forEach((lift) => names.add(lift.exercise));
    }
  });
  return Array.from(names).sort();
}

export async function getExerciseHistory(exerciseName) {
  const db = await getDB();
  const allLogs = await db.getAll('workoutLogs');
  const history = [];
  allLogs.forEach((log) => {
    if (log.lifts) {
      const matching = log.lifts.filter(
        (l) => l.exercise.toLowerCase() === exerciseName.toLowerCase()
      );
      if (matching.length > 0) {
        history.push({ date: log.date, lifts: matching });
      }
    }
  });
  return history.sort((a, b) => b.date.localeCompare(a.date));
}

// ─── Workout Templates ───

export async function getAllTemplates() {
  const db = await getDB();
  return db.getAll('workoutTemplates');
}

export async function saveTemplate(template) {
  const db = await getDB();
  if (template.id) {
    return db.put('workoutTemplates', template);
  }
  const { id: _id, ...rest } = template;
  return db.add('workoutTemplates', { ...rest, createdDate: new Date().toISOString() });
}

export async function deleteTemplate(id) {
  const db = await getDB();
  return db.delete('workoutTemplates', id);
}

// ─── Food Logs ───

export async function getFoodLogsByDate(date) {
  const db = await getDB();
  return db.getAllFromIndex('foodLogs', 'byDate', date);
}

export async function addFoodLog(entry) {
  const db = await getDB();
  return db.add('foodLogs', entry);
}

export async function deleteFoodLog(id) {
  const db = await getDB();
  return db.delete('foodLogs', id);
}

export async function updateFoodLog(entry) {
  const db = await getDB();
  return db.put('foodLogs', entry);
}

export async function getAllFoodLogs() {
  const db = await getDB();
  return db.getAll('foodLogs');
}

// ─── Food Library ───

export async function getAllFoodLibrary() {
  const db = await getDB();
  return db.getAll('foodLibrary');
}

export async function addToFoodLibrary(food) {
  const db = await getDB();
  return db.add('foodLibrary', { ...food, createdDate: new Date().toISOString() });
}

export async function deleteFoodLibraryItem(id) {
  const db = await getDB();
  return db.delete('foodLibrary', id);
}

// ─── Body Stats ───

export async function getBodyStat(date) {
  const db = await getDB();
  return db.get('bodyStats', date);
}

export async function saveBodyStat(stat) {
  const db = await getDB();
  return db.put('bodyStats', stat);
}

export async function getBodyStatsRange(startDate, endDate) {
  const db = await getDB();
  const range = IDBKeyRange.bound(startDate, endDate);
  return db.getAllFromIndex('bodyStats', 'byDate', range);
}

export async function getAllBodyStats() {
  const db = await getDB();
  return db.getAll('bodyStats');
}

export async function deleteBodyStat(date) {
  const db = await getDB();
  return db.delete('bodyStats', date);
}

// ─── Water Logs ───

export async function getWaterLog(date) {
  const db = await getDB();
  return db.get('waterLogs', date);
}

export async function saveWaterLog(log) {
  const db = await getDB();
  return db.put('waterLogs', log);
}
