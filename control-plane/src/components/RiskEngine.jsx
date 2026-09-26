import { Cpu, TrendingUp } from 'lucide-react';
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts';

const LEVEL_COLOR = { HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#22c55e' };

/**
 * RiskEngine — displays deterministic risk score, gauge, and contributing factors.
 * Props:
 *   incident   — selected incident
 *   riskResult — { score, level, factors } from evaluateRisk()
 *   loading    — boolean
 */
export default function RiskEngine({ incident, riskResult, loading }) {
  if (!incident) return null;

  const { score = 0, level = 'LOW', factors = [] } = riskResult || {};
  const color = LEVEL_COLOR[level] || '#22c55e';

  const gaugeData = [{ name: 'risk', value: score, fill: color }];

  return (
    <div className="cp-panel">
      <div className="cp-panel-header">
        <Cpu size={18} className="cp-panel-icon" />
        <h2>Deterministic Risk Engine</h2>
        <span className={`cp-badge ${level === 'HIGH' ? 'cp-sev-critical' : level === 'MEDIUM' ? 'cp-sev-medium' : 'cp-sev-low'}`}>
          {level} RISK
        </span>
      </div>

      {loading ? (
        <div className="cp-loading-row">
          <span className="cp-spinner" /> Evaluating risk…
        </div>
      ) : (
        <>
          <div className="cp-risk-layout">
            {/* Gauge */}
            <div className="cp-gauge-wrap">
              <ResponsiveContainer width={160} height={160}>
                <RadialBarChart
                  cx="50%"
                  cy="50%"
                  innerRadius="65%"
                  outerRadius="100%"
                  startAngle={210}
                  endAngle={-30}
                  data={gaugeData}
                >
                  <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                  <RadialBar
                    dataKey="value"
                    cornerRadius={6}
                    background={{ fill: '#1f2937' }}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="cp-gauge-overlay" style={{ color }}>
                <span className="cp-gauge-score">{score}</span>
                <span className="cp-gauge-label">/ 100</span>
              </div>
            </div>

            {/* Score details */}
            <div className="cp-risk-detail">
              <div className="cp-risk-level" style={{ color }}>
                {level} RISK
              </div>
              <p className="cp-muted">Service: <strong className="cp-text">{incident.service}</strong></p>
              <p className="cp-muted">Severity: <strong className="cp-text">{incident.severity}</strong></p>
              <p className="cp-muted">Affected users: <strong className="cp-text">{incident.affectedUsers?.toLocaleString()}</strong></p>

              {/* Progress bar */}
              <div className="cp-bar-track" style={{ marginTop: 12 }}>
                <div
                  className="cp-bar-fill"
                  style={{ width: `${score}%`, background: color }}
                />
              </div>
              <p className="cp-muted" style={{ fontSize: 11, marginTop: 4 }}>
                Risk thresholds: LOW &lt;40 · MEDIUM 40–69 · HIGH ≥70
              </p>
            </div>
          </div>

          {/* Factor breakdown */}
          <div className="cp-factors-header">
            <TrendingUp size={14} /> Contributing Factors
          </div>
          <div className="cp-factors-list">
            {factors.map((f) => (
              <div key={f.label} className="cp-factor-row">
                <div className="cp-factor-top">
                  <span className="cp-factor-label">{f.label}</span>
                  <span className="cp-factor-weight">weight {f.weight}%</span>
                  <span className="cp-factor-val">{f.value}/100</span>
                </div>
                <div className="cp-bar-track cp-bar-sm">
                  <div
                    className="cp-bar-fill"
                    style={{
                      width: `${f.value}%`,
                      background: f.value >= 70 ? '#ef4444' : f.value >= 40 ? '#f59e0b' : '#22c55e',
                    }}
                  />
                </div>
                <p className="cp-muted" style={{ fontSize: 11 }}>{f.description}</p>
              </div>
            ))}
          </div>

          <p className="cp-muted" style={{ marginTop: 10, fontSize: 12 }}>
            ⓘ Score is deterministic — same inputs always produce the same result. Formula: Severity×0.35 + ServiceImpact×0.30 + HistoricalRisk×0.20 + RemediationUncertainty×0.15
          </p>
        </>
      )}
    </div>
  );
}
