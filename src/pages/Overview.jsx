import { useEffect, useState } from 'react';
import ProgressBar from '../components/ProgressBar';
import Sparkline from '../components/Sparkline';
import { CheckIcon, FitnessIcon } from '../components/icons';
import { getFoodLogsByDate, getWorkoutLog, getWorkoutLogsRange, getBodyStatsRange, getWaterLog, getAllWorkoutLogs, getAllFoodLogs } from '../db';
import { getGoals, getProfile } from '../storage';
import { todayStr, daysAgo, localDateStr, getWeekStart, formatDate } from '../utils/helpers';

export default function Overview() {
  const [goals, setGoals] = useState(getGoals());
  const [todayFood, setTodayFood] = useState([]);
  const [todayWorkout, setTodayWorkout] = useState(null);
  const [weekWorkouts, setWeekWorkouts] = useState(0);
  const [weightData, setWeightData] = useState([]);
  const [waterOz, setWaterOz] = useState(0);
  const [prDeltas, setPrDeltas] = useState([]);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setGoals(getGoals());
    const today = todayStr();
    const weekStart = getWeekStart();
    const thirtyAgo = daysAgo(30);

    const [foods, workout, weekLogs, stats, waterLog, allLogs, allFoods] = await Promise.all([
      getFoodLogsByDate(today),
      getWorkoutLog(today),
      getWorkoutLogsRange(weekStart, today),
      getBodyStatsRange(thirtyAgo, today),
      getWaterLog(today),
      getAllWorkoutLogs(),
      getAllFoodLogs(),
    ]);

    setTodayFood(foods);
    setTodayWorkout(workout);
    setWaterOz(waterLog?.oz || 0);

    const activeDays = weekLogs.filter(
      (l) => (l.lifts && l.lifts.length > 0) || (l.cardio && l.cardio.length > 0)
    );
    setWeekWorkouts(activeDays.length);

    const wData = stats.filter((s) => s.weight).map((s) => ({ date: s.date, value: s.weight }));
    setWeightData(wData);

    // Streak: consecutive days (back from today) with any food or workout activity
    const activeDates = new Set();
    allFoods.forEach((f) => activeDates.add(f.date));
    allLogs.forEach((log) => {
      if ((log.lifts?.length > 0) || (log.cardio?.length > 0)) activeDates.add(log.date);
    });
    let count = 0;
    const cursor = new Date();
    while (activeDates.has(cursor.toISOString().split('T')[0])) {
      count++;
      cursor.setDate(cursor.getDate() - 1);
    }
    setStreak(count);

    // Exercise progression deltas: compare today's max weight vs prior session
    const lifts = workout?.lifts || [];
    if (lifts.length > 0) {
      // Build exerciseMap: { name: { date: maxWeight } }
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

      const exerciseNames = [...new Set(lifts.map((l) => l.exercise))];
      const deltas = [];
      exerciseNames.forEach((name) => {
        const dateMap = exerciseMap[name];
        if (!dateMap) return;
        const todayMax = dateMap[today];
        if (todayMax == null) return;
        const priorDate = Object.keys(dateMap)
          .filter((d) => d < today)
          .sort()
          .pop();
        if (!priorDate) return;
        const delta = todayMax - dateMap[priorDate];
        if (delta > 0) deltas.push({ exercise: name, delta: Math.round(delta * 10) / 10, todayWeight: todayMax });
      });
      setPrDeltas(deltas);
    } else {
      setPrDeltas([]);
    }
  }

  const totalCals = todayFood.reduce((sum, f) => sum + (f.calories || 0), 0);
  const totalProtein = todayFood.reduce((sum, f) => sum + (f.protein || 0), 0);
  const totalCarbs = todayFood.reduce((sum, f) => sum + (f.carbs || 0), 0);
  const totalFat = todayFood.reduce((sum, f) => sum + (f.fat || 0), 0);

  const hasWorkout =
    todayWorkout &&
    ((todayWorkout.lifts && todayWorkout.lifts.length > 0) ||
      (todayWorkout.cardio && todayWorkout.cardio.length > 0));

  const calsOver = goals.calories > 0 && totalCals > goals.calories;
  const calsOverBy = calsOver ? Math.round(totalCals - goals.calories) : 0;
  const calsGoalMet =
    !calsOver && goals.calories > 0 && totalCals >= goals.calories;
  const proteinMet = goals.protein > 0 && totalProtein >= goals.protein;
  const carbsMet = goals.carbs > 0 && totalCarbs >= goals.carbs;
  const fatMet = goals.fat > 0 && totalFat >= goals.fat;
  const allMacrosMet = proteinMet && carbsMet && fatMet;
  const weekGoalMet = weekWorkouts >= goals.workoutsPerWeek && goals.workoutsPerWeek > 0;

  const todayVolume = (todayWorkout?.lifts || [])
    .reduce((sum, l) => sum + (l.sets || 0) * (l.reps || 0) * (l.weight || 0), 0);
  const splitLabel = todayWorkout?.splitDay || null;

  const currentWeightEntry = weightData.length > 0 ? weightData[weightData.length - 1] : null;
  const weekCutoff = daysAgo(7);
  const monthCutoff = daysAgo(30);
  const weekWeightEntry = currentWeightEntry
    ? [...weightData].reverse().find(d => d.date <= weekCutoff && d.date !== currentWeightEntry.date)
    : null;
  const monthWeightEntry = currentWeightEntry
    ? [...weightData].reverse().find(d => d.date <= monthCutoff && d.date !== currentWeightEntry.date)
    : null;
  const prevWeightEntry = weightData.length >= 2 ? weightData[weightData.length - 2] : null;
  const showLastWeightEntry = !weekWeightEntry && !monthWeightEntry && prevWeightEntry;

  const monthWeightDelta = (monthWeightEntry && currentWeightEntry)
    ? Math.round((currentWeightEntry.value - monthWeightEntry.value) * 10) / 10 : null;
  const weekWeightDelta = (weekWeightEntry && currentWeightEntry)
    ? Math.round((currentWeightEntry.value - weekWeightEntry.value) * 10) / 10 : null;
  const prevWeightDelta = (showLastWeightEntry && currentWeightEntry)
    ? Math.round((currentWeightEntry.value - prevWeightEntry.value) * 10) / 10 : null;

  const startingWeight = getProfile().weight || null;
  const displayWeightValue = currentWeightEntry?.value ?? startingWeight;
  const startWeightDelta = (startingWeight && currentWeightEntry && currentWeightEntry.value !== startingWeight)
    ? Math.round((currentWeightEntry.value - startingWeight) * 10) / 10 : null;
  const sparklineWeightData = (() => {
    if (!startingWeight || weightData.length === 0) return weightData;
    const d = new Date(weightData[0].date + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    return [{ date: localDateStr(d), value: startingWeight }, ...weightData];
  })();

  return (
    <div className="page overview-page">
      <h1 className="page-title">Today</h1>
      <p className="page-subtitle">{formatDate(todayStr())}</p>

      {/* Card 1 — Calories */}
      <div
        className={`card-hero ${calsGoalMet ? 'goal-met' : ''} ${calsOver ? 'danger-state' : ''}`}
        style={{ '--i': 0 }}
      >
        <span className="card-label">Calories</span>
        <div className="display-number">{Math.round(totalCals).toLocaleString()}</div>
        <div className="display-sub">of {goals.calories.toLocaleString()} cal goal</div>
        <div className="hide-progress-label">
          <ProgressBar label="" current={totalCals} goal={goals.calories} unit="cal" color="var(--accent)" />
        </div>
        {calsGoalMet && <div className="goal-badge"><CheckIcon size={12} /> Goal hit</div>}
        {calsOver && <div className="danger-badge">Over by {calsOverBy} cal</div>}
      </div>

      {/* Card 2 — Macros + Water */}
      <div
        className={`card-stat ${allMacrosMet ? 'goal-met' : ''}`}
        style={{ '--i': 1, '--stat-color': 'var(--accent)' }}
      >
        <span className="card-label">Macros</span>
        <ProgressBar label="Protein" current={totalProtein} goal={goals.protein} color="var(--protein)" />
        <ProgressBar label="Carbs" current={totalCarbs} goal={goals.carbs} color="var(--carbs)" />
        <ProgressBar label="Fat" current={totalFat} goal={goals.fat} color="var(--fat)" />
        {allMacrosMet && <div className="goal-badge"><CheckIcon size={12} /> All macros hit</div>}
        <div className="card-divider" />
        <span className="card-label">Hydration</span>
        <ProgressBar label="Water" current={waterOz} goal={goals.waterGoal} unit="oz" color="#4ab8d8" />
        {waterOz >= goals.waterGoal && goals.waterGoal > 0 && (
          <div className="goal-badge"><CheckIcon size={12} /> Hydration goal hit</div>
        )}
      </div>

      {/* Card 3 — Consistency */}
      <div className={`card ${weekGoalMet ? 'goal-met' : ''}`} style={{ '--i': 2 }}>
        <span className="card-label">Consistency</span>
        <div className="streak-row">
          <div className="streak-left">
            <div className="streak-number">{streak}</div>
            <div className="display-sub">day streak</div>
          </div>
          <div className="streak-right">
            {goals.workoutsPerWeek > 0 && (
              <div className="week-dots">
                {Array.from({ length: goals.workoutsPerWeek }, (_, i) => (
                  <div key={i} className={`week-dot ${i < weekWorkouts ? 'filled' : ''}`} />
                ))}
              </div>
            )}
            <p className="summary-line">{weekWorkouts} / {goals.workoutsPerWeek} this week</p>
          </div>
        </div>
        {weekGoalMet && <div className="goal-badge"><CheckIcon size={12} /> Week complete!</div>}
      </div>

      {/* Card 4 — Workout */}
      <div className="card" style={{ '--i': 3 }}>
        <div className="card-header-row">
          <span className="card-label">Workout</span>
          {splitLabel && <span className="split-tag">{splitLabel}</span>}
        </div>
        {hasWorkout ? (
          <>
            <div className="display-number" style={{ color: 'var(--accent)' }}>{Math.round(todayVolume).toLocaleString()}</div>
            <div className="display-sub">lbs total volume</div>
            {prDeltas.length > 0 && (
              <>
                <div className="card-divider" />
                <div className="delta-list">
                  {prDeltas.slice(0, 3).map((d, i) => (
                    <div key={i} className="delta-item">
                      <span className="delta-name">{d.exercise}</span>
                      <span className="delta-value"><span className="arrow-icon">↑</span> +{d.delta} lbs</span>
                    </div>
                  ))}
                  {prDeltas.length > 3 && (
                    <span className="summary-line">+{prDeltas.length - 3} more</span>
                  )}
                </div>
              </>
            )}
            {prDeltas.length === 0 && (
              <p className="summary-line" style={{ marginTop: 10 }}>No new PRs this session</p>
            )}
          </>
        ) : (
          <div className="empty-state">
            <FitnessIcon size={40} color="var(--text-dim)" />
            <span>Rest day?</span>
            <span className="empty-state-hint">Tap Fitness to log a workout</span>
          </div>
        )}
      </div>

      {/* Card 5 — Weight Trend */}
      <div className="card" style={{ '--i': 4 }}>
        <div className="card-header-row">
          <span className="card-label">Weight Trend</span>
          <span className="display-sub" style={{ marginBottom: 0 }}>30 days</span>
        </div>
        {displayWeightValue && (
          <>
            <div className="weight-display-row">
              <span className="weight-display">{displayWeightValue}</span>
              <span className="display-sub" style={{ marginBottom: 0 }}>lbs</span>
            </div>
            {(startWeightDelta !== null || monthWeightDelta !== null || weekWeightDelta !== null || prevWeightDelta !== null) && (
              <div className="weight-deltas">
                {startWeightDelta !== null && startWeightDelta !== 0 && (
                  <span className="weight-delta">
                    <span className="arrow-icon">{startWeightDelta > 0 ? '↑' : '↓'}</span>
                    {` ${startWeightDelta > 0 ? '+' : ''}${startWeightDelta} lb from start`}
                  </span>
                )}
                {monthWeightDelta !== null && monthWeightDelta !== 0 && (
                  <span className="weight-delta">
                    <span className="arrow-icon">{monthWeightDelta > 0 ? '↑' : '↓'}</span>
                    {` ${monthWeightDelta > 0 ? '+' : ''}${monthWeightDelta} lb last month`}
                  </span>
                )}
                {weekWeightDelta !== null && weekWeightDelta !== 0 && (
                  <span className="weight-delta">
                    <span className="arrow-icon">{weekWeightDelta > 0 ? '↑' : '↓'}</span>
                    {` ${weekWeightDelta > 0 ? '+' : ''}${weekWeightDelta} lb this week`}
                  </span>
                )}
                {prevWeightDelta !== null && prevWeightDelta !== 0 && (
                  <span className="weight-delta">
                    <span className="arrow-icon">{prevWeightDelta > 0 ? '↑' : '↓'}</span>
                    {` ${prevWeightDelta > 0 ? '+' : ''}${prevWeightDelta} lb last entry`}
                  </span>
                )}
              </div>
            )}
          </>
        )}
        <Sparkline data={sparklineWeightData} width={300} height={70} color="var(--accent)" />
      </div>
    </div>
  );
}
