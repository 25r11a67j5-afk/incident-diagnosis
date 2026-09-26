/**
 * StatCard — a single KPI tile for the dashboard summary row.
 * Props:
 *   icon      — React element (lucide icon)
 *   label     — string
 *   value     — string | number
 *   accent    — 'default' | 'danger' | 'warning' | 'success' | 'info'
 *   sublabel  — optional string shown below value
 */
export default function StatCard({ icon, label, value, accent = 'default', sublabel }) {
  return (
    <div className={`cp-stat-card cp-stat-${accent}`}>
      <div className="cp-stat-icon">{icon}</div>
      <div className="cp-stat-body">
        <span className="cp-stat-label">{label}</span>
        <strong className="cp-stat-value">{value}</strong>
        {sublabel && <span className="cp-stat-sublabel">{sublabel}</span>}
      </div>
    </div>
  );
}
