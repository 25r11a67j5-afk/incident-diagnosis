import { Brain, Zap, Database, Terminal, CheckCircle2, AlertOctagon, BarChart2 } from "lucide-react";

const SOURCE_ICON = {
  Prometheus:           <Zap size={12} />,
  prometheus:           <Zap size={12} />,
  Elasticsearch:        <Database size={12} />,
  elasticsearch_logs:   <Database size={12} />,
  elasticsearch_traces: <Database size={12} />,
  deployment_metadata:  <Terminal size={12} />,
};

const SOURCE_COLOR = {
  Prometheus:           "#f59e0b",
  prometheus:           "#f59e0b",
  Elasticsearch:        "#60a5fa",
  elasticsearch_logs:   "#60a5fa",
  elasticsearch_traces: "#38bdf8",
  deployment_metadata:  "#a78bfa",
};

/**
 * Hypotheses — Root-cause hypotheses panel.
 * Props:
 *   hypotheses — array from scenario.hypotheses
 */
export default function Hypotheses({ hypotheses = [] }) {
  if (!hypotheses.length) {
    return (
      <div className="cp-panel">
        <div className="cp-panel-header">
          <Brain size={18} className="cp-panel-icon" />
          <h2>Root-Cause Hypotheses</h2>
        </div>
        <p className="cp-muted" style={{ padding: "12px 0" }}>No hypotheses loaded. Run diagnosis first.</p>
      </div>
    );
  }

  return (
    <div className="cp-panel">
      <div className="cp-panel-header">
        <Brain size={18} className="cp-panel-icon" />
        <h2>Root-Cause Hypotheses</h2>
        <span className="cp-badge cp-badge-info">{hypotheses.length} evaluated</span>
      </div>

      <div className="hyp-list">
        {hypotheses.map((h, i) => {
          const pct = Math.round(h.confidence * 100);
          const barColor = pct >= 70 ? "#22c55e" : pct >= 40 ? "#f59e0b" : "#ef4444";
          const isTop = i === 0;
          const suppEvidence = h.supporting_evidence || [];
          const contraEvidence = h.contradicting_evidence || [];

          return (
            <div key={h.hypothesis_id || h.id || i} className={`hyp-card ${isTop ? "hyp-top" : ""}`}>
              <div className="hyp-header">
                <div className="hyp-title-row">
                  {isTop ? (
                    <span className="cp-badge cp-sev-low" style={{ marginRight: 6 }}>PRIMARY ROOT CAUSE</span>
                  ) : (
                    <span className="cp-badge" style={{ marginRight: 6, background: "rgba(255,255,255,0.06)", color: "#9ca3af" }}>
                      ALT HYPOTHESIS
                    </span>
                  )}
                  <span className="hyp-cause">{h.cause}</span>
                </div>
                <div style={{ textAlign: "right", minWidth: 60 }}>
                  <span className="hyp-conf" style={{ color: barColor, fontSize: 16, fontWeight: 700 }}>{pct}%</span>
                  <div className="cp-muted" style={{ fontSize: 10 }}>confidence</div>
                </div>
              </div>

              {/* Confidence bar */}
              <div className="cp-bar-track cp-bar-sm" style={{ margin: "10px 0" }}>
                <div className="cp-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
              </div>

              {/* Supporting Evidence */}
              <div className="hyp-evidence-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Supporting Evidence ({suppEvidence.length || (h.evidence ? h.evidence.length : 0)})</span>
                {h.id && <span className="cp-muted" style={{ fontSize: 10 }}>ID: {h.id}</span>}
              </div>
              <div className="hyp-evidence-list">
                {suppEvidence.length > 0 ? (
                  suppEvidence.map((ev, j) => {
                    const srcColor = SOURCE_COLOR[ev.source] ?? "#6b7280";
                    return (
                      <div key={ev.id || j} className="hyp-ev-row" style={{ alignItems: "flex-start", marginBottom: 6 }}>
                        <span className="hyp-ev-dot" style={{ background: srcColor, marginTop: 5 }} />
                        <div style={{ flex: 1 }}>
                          <div className="hyp-ev-text" style={{ fontSize: 12.5, lineHeight: 1.4 }}>
                            {ev.observation || ev.description || ev.type}
                          </div>
                          {ev.raw_value !== undefined && ev.baseline_value !== undefined && (
                            <div className="cp-muted" style={{ fontSize: 11, marginTop: 2 }}>
                              Observed: <strong style={{ color: "#f87171" }}>{ev.raw_value}</strong> | Baseline: {ev.baseline_value}
                              {ev.deviation_factor ? ` (${ev.deviation_factor}x deviation)` : ""}
                            </div>
                          )}
                          {ev.query_used && (
                            <div className="cp-muted" style={{ fontSize: 10, fontFamily: "monospace", marginTop: 2, opacity: 0.8 }}>
                              query: {ev.query_used}
                            </div>
                          )}
                        </div>
                        <span className="hyp-ev-src" style={{ color: srcColor, whiteSpace: "nowrap" }}>
                          {SOURCE_ICON[ev.source]}
                          {ev.source?.replace("_", " ")}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  (h.evidence || []).map((ev, j) => {
                    const srcColor = SOURCE_COLOR[ev.source] ?? "#6b7280";
                    return (
                      <div key={j} className="hyp-ev-row">
                        <span className="hyp-ev-dot" style={{ background: srcColor }} />
                        <span className="hyp-ev-text">{ev.description}</span>
                        <span className="hyp-ev-src" style={{ color: srcColor }}>
                          {SOURCE_ICON[ev.source]}
                          {ev.source}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Contradicting Evidence */}
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px dashed rgba(255,255,255,0.08)" }}>
                {contraEvidence.length > 0 ? (
                  <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6, padding: "8px 10px" }}>
                    <div style={{ color: "#ef4444", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                      <AlertOctagon size={13} /> Contradicting Evidence Detected ({contraEvidence.length})
                    </div>
                    {contraEvidence.map((ce, k) => (
                      <div key={k} className="cp-muted" style={{ fontSize: 11 }}>
                        • {ce.observation || ce.description} ({ce.source})
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#22c55e", opacity: 0.9 }}>
                    <CheckCircle2 size={12} />
                    <span>Contradicting Evidence: None detected (all correlated signals consistent)</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
