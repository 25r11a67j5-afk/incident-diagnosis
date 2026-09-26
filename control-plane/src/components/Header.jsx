import { Shield, Activity, Clock, Wifi } from 'lucide-react';

/**
 * Header — top navigation bar with system status indicator.
 */
export default function Header({ systemOnline, onReset }) {
  const now = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <header className="cp-header">
      <div className="cp-header-left">
        <div className="cp-header-logo">
          <Shield size={28} className="cp-logo-icon" />
          <div>
            <h1 className="cp-header-title">Control Plane</h1>
            <p className="cp-header-sub">
              Incident Diagnosis &amp; Safe Remediation Platform — SIH 2026
            </p>
          </div>
        </div>
      </div>

      <div className="cp-header-right">
        <div className="cp-header-time">
          <Clock size={14} />
          <span>{now}</span>
        </div>

        <div className={`cp-status-badge ${systemOnline ? 'online' : 'offline'}`}>
          <Wifi size={14} />
          <span className="cp-status-dot" />
          {systemOnline ? 'SYSTEM ONLINE' : 'SYSTEM OFFLINE'}
        </div>

        <button className="cp-btn cp-btn-ghost cp-btn-sm" onClick={onReset}>
          ↺ Reset Demo
        </button>
      </div>
    </header>
  );
}
