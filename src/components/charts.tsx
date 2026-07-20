import { useMemo } from 'react';

export interface ChartPoint {
  label: string;
  value: number;
}

export function BarChart({ data, color = '#0ea5e9', height = 200 }: { data: ChartPoint[]; color?: string; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 100;
  const barW = data.length > 0 ? (w / data.length) * 0.65 : 0;
  const gap = data.length > 0 ? (w / data.length) * 0.35 : 0;

  return (
    <div className="w-full" style={{ height }}>
      <svg viewBox={`0 0 ${w} 100`} preserveAspectRatio="none" className="w-full h-full" style={{ height }}>
        {data.map((d, i) => {
          const h = (d.value / max) * 90;
          const x = i * (barW + gap) + gap / 2;
          return (
            <g key={i}>
              <rect x={x} y={100 - h} width={barW} height={h} rx={1.5} fill={color} opacity={0.85}>
                <title>{d.label}: {d.value}</title>
              </rect>
            </g>
          );
        })}
      </svg>
      <div className="flex justify-between mt-1.5 text-[10px] text-slate-400 font-medium">
        {data.map((d, i) => (
          <span key={i} className="flex-1 text-center">{d.label}</span>
        ))}
      </div>
    </div>
  );
}

export function LineChart({ data, color = '#0ea5e9', height = 200 }: { data: ChartPoint[]; color?: string; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const points = useMemo(() => {
    if (data.length === 0) return '';
    const stepX = data.length > 1 ? 100 / (data.length - 1) : 0;
    return data.map((d, i) => `${i * stepX},${100 - (d.value / max) * 90 - 5}`).join(' ');
  }, [data, max]);

  const areaPoints = useMemo(() => {
    if (data.length === 0) return '';
    const stepX = data.length > 1 ? 100 / (data.length - 1) : 0;
    return `0,100 ${data.map((d, i) => `${i * stepX},${100 - (d.value / max) * 90 - 5}`).join(' ')} 100,100`;
  }, [data, max]);

  const gradId = `grad-${color.replace('#', '')}`;

  return (
    <div className="w-full" style={{ height }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full" style={{ height }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <polygon points={areaPoints} fill={`url(#${gradId})`} />
        <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex justify-between mt-1.5 text-[10px] text-slate-400 font-medium">
        {data.map((d, i) => (
          <span key={i} className="flex-1 text-center">{d.label}</span>
        ))}
      </div>
    </div>
  );
}

export function DonutChart({ segments, size = 140 }: { segments: { label: string; value: number; color: string }[]; size?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = 40;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox="0 0 100 100" className="-rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#e2e8f0" strokeWidth="12" className="dark:stroke-slate-800" />
        {total > 0 && segments.map((s, i) => {
          const len = (s.value / total) * c;
          const el = (
            <circle
              key={i}
              cx="50" cy="50" r={r} fill="none"
              stroke={s.color} strokeWidth="12"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="space-y-1.5">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 rounded-full" style={{ background: s.color }} />
            <span className="text-slate-600 dark:text-slate-300 font-medium">{s.label}</span>
            <span className="text-slate-900 dark:text-white font-bold">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
