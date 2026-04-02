import { useId } from 'react';

export default function Sparkline({ data, width = 280, height = 60, color = 'var(--accent)' }) {
  const gradientId = useId();

  if (!data || data.length < 2) {
    return (
      <div className="sparkline-empty" style={{ height }}>
        <span>Not enough data yet</span>
      </div>
    );
  }

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const padding = 4;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;

  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * chartW;
    const y = padding + chartH - ((v - min) / range) * chartH;
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;

  const firstX = padding;
  const lastX = padding + chartW;
  const fillD = `${pathD} L ${lastX},${height - padding} L ${firstX},${height - padding} Z`;

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="sparkline"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={fillD} fill={`url(#${gradientId})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      {values.length > 0 && (
        <circle
          cx={padding + chartW}
          cy={padding + chartH - ((values[values.length - 1] - min) / range) * chartH}
          r="3"
          fill={color}
        />
      )}
    </svg>
  );
}
