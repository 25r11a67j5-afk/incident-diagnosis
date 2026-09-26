import { Info, MapPin, Users, Clock } from 'lucide-react';

/**
 * IncidentDetails — detailed view of the selected incident.
 * Props:
 *   incident — selected incident object
 */
export default function IncidentDetails({ incident }) {
  if (!incident) return null;

  return (
    <div className="cp-panel">
      <div className="cp-panel-header">
        <Info size={18} className="cp-panel-icon" />
        <h2>Incident Details</h2>
        <span className="cp-badge cp-badge-info">{incident.id}</span>
      </div>

      <div className="cp-detail-grid">
        <div className="cp-detail-row">
          <span className="cp-muted">Service</span>
          <strong className="cp-text">{incident.service}</strong>
        </div>
        <div className="cp-detail-row">
          <span className="cp-muted">Severity</span>
          <strong className="cp-text">{incident.severity}</strong>
        </div>
        <div className="cp-detail-row">
          <span className="cp-muted">Status</span>
          <strong className="cp-text">{incident.status}</strong>
        </div>
        <div className="cp-detail-row">
          <span className="cp-muted">Region</span>
          <strong className="cp-text">
            <MapPin size={12} style={{ verticalAlign: 'middle' }} /> {incident.region}
          </strong>
        </div>
        <div className="cp-detail-row">
          <span className="cp-muted">
            <Users size={12} style={{ verticalAlign: 'middle' }} /> Affected Users
          </span>
          <strong className="cp-text">{incident.affectedUsers?.toLocaleString()}</strong>
        </div>
        <div className="cp-detail-row">
          <span className="cp-muted">
            <Clock size={12} style={{ verticalAlign: 'middle' }} /> Detected
          </span>
          <strong className="cp-text">{new Date(incident.timestamp).toLocaleString('en-IN')}</strong>
        </div>
      </div>

      <div className="cp-detail-desc">
        <span className="cp-muted" style={{ fontSize: 12 }}>Description</span>
        <p className="cp-text" style={{ lineHeight: 1.6, marginTop: 6 }}>{incident.description}</p>
      </div>
    </div>
  );
}
