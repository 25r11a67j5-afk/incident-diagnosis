import { BarChart3 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

const METRICS = [
  { label: 'Risk Accuracy', value: 94.2, target: 90, unit: '%', color: '#22c55e' },
  { label: 'Policy Compliance', value: 100, target: 100, unit: '%', color: '#22c55e' },
  { label: 'Simulation Success', value: 96.7, target: 95, unit: '%', color: '#60a5fa' },
  { label: 'Rollback Readiness', value: 100, target: 100, unit: '%', color: '#22c55e' },
  { label: 'Approval Coverage', value: 100, target: 100, unit: '%', color: '#22c55e' },
];

const chartData = METRICS.map((m) => ({
  name: m.label.split(' ')[0],
  value: m.value,
  target: m.target,
}));

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: '#1f2937', border: '1px solid #374151', padding: '8px 12px', borderRadius: 6 }}>
        <p style={{ color: '#e5e7eb', margin: 0, fontWeight: 600 }}>{label}</p>
        <p style={{ color: '#60a5fa', margin: 0 }}>Value: {payload[0]?.value}%</p>
      </div>
    );
  }
  return null;
};

/**
 * EvaluationPanel — shows evaluation/demo metrics.
 * Values are hardcoded demo values clearly labelled as such.
 */
export default function EvaluationPanel() {
  return (
    <div className="cp-panel">
      <div className="cp-panel-header">
        <BarChart3 size={18} className="cp-panel-icon" />
        <h2>Evaluation Metrics</h2>
        <span className="cp-badge cp-badge-info">Demo Values</span>
      </div>

      <p className="cp-muted" style={{ marginBottom: 16, fontSize: 12 }}>
        ⓘ These are evaluation/prototype metrics for SIH demonstration purposes.
      </p>

      <div className="cp-eval-grid">
        {METRICS.map((m) => (
          <div key={m.label} className="cp-eval-card">
            <span className="cp-muted">{m.label}</span>
            <strong style={{ color: m.color, fontSize: 22 }}>
              {m.value}{m.unit}
            </strong>
            <div className="cp-bar-track cp-bar-sm" style={{ marginTop: 6 }}>
              <div
                className="cp-bar-fill"
                style={{ width: `${m.value}%`, background: m.color }}
              />
            </div>
            <span className="cp-muted" style={{ fontSize: 11 }}>
              Target: ≥{m.target}{m.unit}
            </span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24 }}>
        <p className="cp-muted" style={{ fontSize: 12, marginBottom: 8 }}>Performance Overview</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} />
            <YAxis domain={[80, 105]} tick={{ fill: '#6b7280', fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {chartData.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={entry.value >= entry.target ? '#22c55e' : '#f59e0b'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
