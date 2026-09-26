import { AlertTriangle, Clock, Users } from 'lucide-react';

const SEVERITY_COLOR = {
  CRITICAL: 'cp-sev-critical',
  HIGH: 'cp-sev-high',
  MEDIUM: 'cp-sev-medium',
  LOW: 'cp-sev-low',
  MONITORING: 'cp-sev-low',
  INVESTIGATING: 'cp-sev-medium',
};

const STATUS_COLOR = {
  OPEN: 'cp-status-open',
  INVESTIGATING: 'cp-status-investigating',
  MONITORING: 'cp-status-monitoring',
  RESOLVED: 'cp-status-resolved',
  APPROVED: 'cp-status-approved',
  ROLLED_BACK: 'cp-status-rolled-back',
};

/**
 * IncidentQueue — scrollable list of incidents.
 * Props:
 *   incidents       — array of incident objects (with riskScore, riskLevel)
 *   selectedId      — currently selected incident id
 *   onSelect        — callback(incident)
 *   incidentStates  — map of incidentId → overrideStatus
 */
export default function IncidentQueue({ incidents, selectedId, onSelect, incidentStates = {} }) {
  return (
    <div className="cp-panel cp-panel-queue">
      <div className="cp-panel-header">
        <AlertTriangle size={18} className="cp-panel-icon" />
        <h2>Incident Queue</h2>
        <span className="cp-badge cp-badge-info">{incidents.length} active</span>
      </div>

      <div className="cp-incident-list">
        {incidents.map((inc) => {
          const displayStatus = incidentStates[inc.id] || inc.status;
          const isSelected = selectedId === inc.id;

          return (
            <button
              key={inc.id}
              className={`cp-incident-row ${isSelected ? 'cp-incident-selected' : ''}`}
              onClick={() => onSelect(inc)}
            >
              <div className="cp-incident-main">
                <div className="cp-incident-top">
                  <span className="cp-incident-id">{inc.id}</span>
                  <span className={`cp-badge ${SEVERITY_COLOR[inc.severity]}`}>
                    {inc.severity}
                  </span>
                </div>
                <span className="cp-incident-service">{inc.service}</span>
                <div className="cp-incident-meta">
                  <Clock size={11} />
                  <span>{new Date(inc.timestamp).toLocaleTimeString()}</span>
                  <Users size={11} />
                  <span>{inc.affectedUsers?.toLocaleString()} users</span>
                </div>
              </div>
              <div className="cp-incident-right">
                <span
                  className={`cp-risk-score ${
                    inc.riskLevel === 'HIGH'
                      ? 'cp-risk-high'
                      : inc.riskLevel === 'MEDIUM'
                      ? 'cp-risk-medium'
                      : 'cp-risk-low'
                  }`}
                >
                  {inc.riskScore}
                </span>
                <span className={`cp-badge ${STATUS_COLOR[displayStatus]}`}>{displayStatus}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
