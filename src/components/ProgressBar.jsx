const COLOR_MAP = {
  'var(--accent)': { color: 'var(--accent)', bright: 'var(--accent)', glow: 'var(--accent-glow)' },
  'var(--protein)': { color: '#b0923e', bright: '#c4a46e', glow: 'rgba(196,164,110,0.3)' },
  'var(--carbs)': { color: '#5a8fb5', bright: '#6ea5c8', glow: 'rgba(110,165,200,0.3)' },
  'var(--fat)': { color: '#b55a8f', bright: '#c86ea5', glow: 'rgba(200,110,165,0.3)' },
};

function getGradient(color) {
  if (COLOR_MAP[color]) return COLOR_MAP[color];
  return { color, bright: color, glow: 'transparent' };
}

export default function ProgressBar({ label, current, goal, unit = 'g', color = 'var(--accent)' }) {
  const pct = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
  const over = current > goal;
  const complete = !over && goal > 0 && current >= goal;
  const gradient = over
    ? { color: '#b53a3a', bright: '#d44a4a', glow: 'rgba(212,74,74,0.3)' }
    : getGradient(color);

  return (
    <div className="progress-bar-container">
      <div className="progress-bar-header">
        <span className="progress-label">{label}</span>
        <span className={`progress-value ${over ? 'over' : ''}`}>
          {Math.round(current)} / {goal}
          {unit !== '' ? ` ${unit}` : ''}
        </span>
      </div>
      <div className="progress-bar-track">
        <div
          className={`progress-bar-fill ${complete ? 'complete' : ''}`}
          style={{
            width: `${pct}%`,
            '--fill-color': gradient.color,
            '--fill-color-bright': gradient.bright,
            '--fill-glow': gradient.glow,
          }}
        />
      </div>
    </div>
  );
}
