import { useState } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  RotateCcw,
  Play,
  Lock,
  Activity,
  FileText,
  Gauge
} from "lucide-react";

const incidents = [
  { id: "INC-001", service: "Payment API", risk: 82, status: "HIGH" },
  { id: "INC-002", service: "Auth Service", risk: 46, status: "MEDIUM" },
  { id: "INC-003", service: "Database", risk: 21, status: "LOW" }
];

export default function App() {
  const [selected, setSelected] = useState(incidents[0]);
  const [approved, setApproved] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [rolledBack, setRolledBack] = useState(false);
  const [logs, setLogs] = useState([
    "System initialized",
    "Risk engine ready",
    "Safety policy loaded"
  ]);

  const addLog = (message) => {
    setLogs((l) => [`${new Date().toLocaleTimeString()} — ${message}`, ...l]);
  };

  const approve = () => {
    setApproved(true);
    setRolledBack(false);
    addLog(`Approval granted for ${selected.id}`);
  };

  const simulate = () => {
    setSimulating(true);
    addLog(`Sandbox simulation started for ${selected.service}`);
    setTimeout(() => {
      setSimulating(false);
      addLog("Sandbox simulation completed successfully");
    }, 1200);
  };

  const rollback = () => {
    setRolledBack(true);
    setApproved(false);
    addLog(`Rollback executed for ${selected.id}`);
  };

  return (
    <div className="app">
      <header>
        <div>
          <h1>Control Plane</h1>
          <p>Incident Diagnosis & Safe Remediation Platform</p>
        </div>
        <div className="system">
          <span className="dot"></span>
          SYSTEM ONLINE
        </div>
      </header>

      <main>
        <section className="cards">
          <div className="card">
            <Activity />
            <span>Active Incidents</span>
            <strong>03</strong>
          </div>
          <div className="card">
            <AlertTriangle />
            <span>High Risk</span>
            <strong>01</strong>
          </div>
          <div className="card">
            <ShieldCheck />
            <span>Safety Score</span>
            <strong>94%</strong>
          </div>
          <div className="card">
            <Gauge />
            <span>Engine Status</span>
            <strong>READY</strong>
          </div>
        </section>

        <div className="grid">
          <section className="panel">
            <h2>Incident Queue</h2>

            {incidents.map((incident) => (
              <button
                className={`incident ${
                  selected.id === incident.id ? "selected" : ""
                }`}
                onClick={() => setSelected(incident)}
                key={incident.id}
              >
                <div>
                  <b>{incident.id}</b>
                  <span>{incident.service}</span>
                </div>
                <div className={`risk ${incident.status.toLowerCase()}`}>
                  {incident.risk}%
                </div>
              </button>
            ))}
          </section>

          <section className="panel">
            <h2>Risk Engine</h2>

            <div className="riskScore">
              <div className="score">{selected.risk}</div>
              <div>
                <b>{selected.status} RISK</b>
                <p>{selected.service}</p>
              </div>
            </div>

            <div className="bar">
              <div style={{ width: `${selected.risk}%` }}></div>
            </div>

            <p className="explanation">
              Risk calculated from incident severity, service impact,
              historical signals and remediation confidence.
            </p>

            <div className="checks">
              <p>✓ Deterministic risk evaluation</p>
              <p>✓ Policy validation</p>
              <p>✓ Rollback capability available</p>
              <p>✓ Human approval required</p>
            </div>
          </section>
        </div>

        <section className="panel">
          <h2>Safety & Approval Gate</h2>

          <div className="actions">
            <button onClick={simulate}>
              <Play size={18} />
              {simulating ? "Simulating..." : "Sandbox Simulation"}
            </button>

            <button onClick={approve} disabled={selected.risk >= 90}>
              <CheckCircle size={18} />
              Approve Action
            </button>

            <button className="danger" onClick={rollback}>
              <RotateCcw size={18} />
              Rollback
            </button>
          </div>

          <div className="statusBox">
            <Lock size={20} />
            <div>
              <b>Approval Gate</b>
              <p>
                {rolledBack
                  ? "Action rolled back safely."
                  : approved
                  ? "Action approved and ready for execution."
                  : "Waiting for authorized human approval."}
              </p>
            </div>
          </div>
        </section>

        <section className="panel">
          <h2>
            <FileText size={20} /> Audit Trail
          </h2>

          <div className="logs">
            {logs.map((log, i) => (
              <div key={i}>{log}</div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}