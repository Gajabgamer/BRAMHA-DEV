export function Sparkline({ points = [], color = "#6ee7c8", label = "trend" }) {
  const values = points.length ? points : [0, 0, 0];
  const width = 240;
  const height = 72;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(1, max - min);
  const step = width / Math.max(values.length - 1, 1);

  const path = values
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / range) * (height - 16) - 8;
      return `${index === 0 ? "M" : "L"} ${x},${y}`;
    })
    .join(" ");

  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
      {values.map((value, index) => {
        const x = index * step;
        const y = height - ((value - min) / range) * (height - 16) - 8;
        return <circle key={`${label}-${index}`} cx={x} cy={y} r="3.5" fill={color} />;
      })}
    </svg>
  );
}

export function BarChart({ items = [] }) {
  const max = Math.max(...items.map((item) => item.risk), 1);

  return (
    <div className="bar-chart">
      {items.map((item) => (
        <div key={item.filename} className="bar-row">
          <div>
            <div className="bar-title">{item.filename}</div>
            <div className="bar-meta">{item.scans} scans</div>
          </div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(item.risk / max) * 100}%` }} />
          </div>
          <div className="bar-value">{Math.round(item.risk)}%</div>
        </div>
      ))}
    </div>
  );
}
