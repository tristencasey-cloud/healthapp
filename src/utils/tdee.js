/**
 * Mifflin-St Jeor TDEE Calculator
 *
 * BMR formula:
 *   Male:   10 * weight_kg + 6.25 * height_cm - 5 * age + 5
 *   Female: 10 * weight_kg + 6.25 * height_cm - 5 * age - 161
 *
 * TDEE = BMR * activity multiplier
 */

const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
};

function lbsToKg(lbs) {
  return lbs * 0.453592;
}

function feetInchesToCm(feet, inches) {
  return (feet * 12 + inches) * 2.54;
}

export function calculateTDEE(profile) {
  const { age, sex, heightFt, heightIn, weight, activityLevel } = profile;

  if (!age || !heightFt || !weight) return null;

  const weightKg = lbsToKg(weight);
  const heightCm = feetInchesToCm(heightFt, heightIn || 0);

  let bmr;
  if (sex === 'female') {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  } else {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  }

  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] || 1.2;
  const tdee = Math.round(bmr * multiplier);

  return tdee;
}

export function calculateMacros(calories) {
  // Standard split: 30% protein, 40% carbs, 30% fat
  const protein = Math.round((calories * 0.3) / 4); // 4 cal per gram
  const carbs = Math.round((calories * 0.4) / 4);
  const fat = Math.round((calories * 0.3) / 9); // 9 cal per gram

  return { protein, carbs, fat };
}
