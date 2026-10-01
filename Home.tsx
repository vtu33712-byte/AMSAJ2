import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, BookOpen, CalendarClock, ClipboardList, CreditCard, GraduationCap, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiGet } from "@/features/api";

type DashboardData = {
  profile: any;
  subjects: any[];
  attendance: { overall: { percent: number | null; total: number; present: number }; subjects: any[] };
  upcomingClasses: any[];
  assignments: any[];
  assignmentDataAvailable?: boolean;
  marks: any[];
  syncLogs: any[];
  notifications: any[];
  alerts?: Array<{ kind: string; subjectId: number; subject: string; title: string; message: string; severity: "warning" | "success" | "watch" }>;
  dataSource: { available: boolean; label: string; reason?: string };
};
const empty: DashboardData = { profile: null, subjects: [], attendance: { overall: { percent: null, total: 0, present: 0 }, subjects: [] }, upcomingClasses: [], assignments: [], assignmentDataAvailable: false, marks: [], syncLogs: [], notifications: [], dataSource: { available: false, label: "No authorized live source configured" } };
const pct = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? "—" : `${value.toFixed(1)}%`;
const dateLabel = (value: string | Date | null) => value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" }) : "Date unavailable";

function Metric({ icon: Icon, label, value, note }: { icon: any; label: string; value: string; note: string }) {
  return <article className="metric-card"><div className="metric-label"><Icon size={14} />{label}</div><div className="metric-value">{value}</div><div className="metric-foot">{note}</div></article>;
}
function Risk({ value }: { value: string }) {
  const cls = value.toLowerCase().replaceAll(" ", "-");
  return <span className={`risk-badge risk-badge--${cls}`}>{value}</span>;
}

export default function Home() {
  const [data, setData] = useState<DashboardData>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    apiGet<DashboardData>("/dashboard").then(result => { if (active) { setData(result); setError(""); } }).catch(e => { if (active) setError(e instanceof Error ? e.message : "Dashboard unavailable."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);
  const attendanceRows = data.attendance?.subjects ?? [];
  const hasAttendance = attendanceRows.some(item => item.total > 0);
  const highRisk = attendanceRows.filter(item => ["SHORTAGE", "AT RISK", "WATCH"].includes(item.risk)).length;
  const chartData = useMemo(() => attendanceRows.filter(item => item.currentPercent !== null && item.projectedIfAttendAll !== null).slice(0, 8).map(item => ({ subject: item.subject.length > 15 ? `${item.subject.slice(0, 13)}…` : item.subject, current: Number(item.currentPercent), projected: Number(item.projectedIfAttendAll), required: item.requiredPercent === null ? undefined : Number(item.requiredPercent) })), [attendanceRows]);
  const recommendations = useMemo(() => {
    if (!data.subjects.length) return ["Import your academic records to unlock attendance, marks, and schedule insights."];
    if (!attendanceRows.some(item => item.total > 0)) return ["Import current attendance records before this dashboard can assess eligibility or subject risk."];
    const below = attendanceRows.filter(item => item.requiredPercent !== null && item.currentPercent !== null && item.currentPercent < item.requiredPercent);
    if (below.length) return below.slice(0, 3).map(item => item.classesNeeded === null ? `${item.subject}: attendance is below your configured threshold; future classes are not yet projected.` : `${item.subject}: ${item.classesNeeded === 0 ? "review your attendance records" : `attend the next ${item.classesNeeded} classes`} to reach the configured threshold, based on current records.`);
    if (attendanceRows.some(item => item.requiredPercent === null)) return ["Set your personal attendance threshold to enable eligibility and risk calculations."];
    if (!data.upcomingClasses.length) return ["Upload your timetable to see remaining classes and upcoming attendance projections."];
    return ["No attendance risk is indicated by the current imported records."];
  }, [data.subjects.length, attendanceRows, data.upcomingClasses.length]);
  const lastImport = data.syncLogs.find(log => log.status === "completed");
  const latestAttempt = data.syncLogs[0];
  const latestImportFailed = latestAttempt?.status === "failed" && (!lastImport || new Date(latestAttempt.startedAt).getTime() > new Date(lastImport.startedAt).getTime());
  const alerts = data.alerts ?? [];

  return <div className="page-view">
    <div className="page-intro"><div><div className="eyebrow-accent">PERSONAL ACADEMIC COMMAND CENTER</div><h1>Your academic picture, in one place.</h1><p>Insights come from your own records. Missing data stays visible—never filled with guesses.</p></div><button className="icon-button" title="Refresh dashboard" onClick={() => setReload(n => n + 1)}><RefreshCw size={15} /></button></div>
    {error && <div className="notice-box notice-box--warning" role="alert">{error}</div>}
    <div className="data-source-ribbon"><ShieldCheck size={15} /><span><strong>Data source:</strong> {data.dataSource.label}. {lastImport ? `Last successful data import ${new Date(lastImport.completedAt ?? lastImport.startedAt).toLocaleString()}.` : "No successful data import yet."}</span></div>
    {latestImportFailed && <div className="notice-box notice-box--warning" role="status" style={{ marginTop: 10 }}><strong>Latest import failed.</strong> Showing the most recently saved academic records; no failed import replaced them.</div>}
    <div className="metric-grid" style={{ marginTop: 14 }}>
      <Metric icon={Activity} label="Overall attendance" value={loading ? "…" : pct(data.attendance?.overall?.percent)} note={hasAttendance ? `${data.attendance.overall.present} present of ${data.attendance.overall.total} recorded` : "No attendance imported"} />
      <Metric icon={GraduationCap} label="Current CGPA" value={loading ? "…" : data.profile?.cgpa == null ? "—" : Number(data.profile.cgpa).toFixed(2)} note={data.profile?.cgpa == null ? "Not present in your records" : "From your saved profile"} />
      <Metric icon={CreditCard} label="Credits earned" value={loading ? "…" : data.profile?.creditsEarned == null ? "—" : String(data.profile.creditsEarned)} note={data.profile?.creditsEarned == null ? "Not present in your records" : "From your saved profile"} />
      <Metric icon={BookOpen} label="Subjects" value={loading ? "…" : String(data.subjects.length)} note={data.subjects.length ? "In your academic record" : "No subjects added"} />
      <Metric icon={ClipboardList} label="Pending assignments" value={loading ? "…" : data.assignmentDataAvailable ? String(data.assignments.length) : "—"} note={data.assignmentDataAvailable ? "From your assignment records" : "No assignment data imported"} />
      <Metric icon={Sparkles} label="Attendance risk" value={loading ? "…" : hasRiskData(attendanceRows) ? String(highRisk) : "—"} note={hasRiskData(attendanceRows) ? "Subjects below / near your rule" : "Set a threshold and import attendance"} />
    </div>

    <div className="dashboard-grid">
      <section className="panel"><div className="panel-heading"><div><h3>Attendance overview</h3><p>Current records against your configured subject thresholds.</p></div><button className="text-link" onClick={() => { window.location.href = "/attendance"; }}>Open analysis <ArrowRight size={12} /></button></div>
        {loading ? <div className="empty-state">Loading saved attendance…</div> : !hasAttendance ? <div className="empty-state"><Activity size={20} /><strong>No attendance records yet</strong><p>Import an official export or add user-provided class records to see accurate calculations.</p><a className="text-link" href="/settings">Import records <ArrowRight size={12} /></a></div> : <>
          <div className="subject-row" style={{ borderTop: 0, paddingTop: 0, color: "var(--muted-foreground)", fontSize: 9, fontWeight: 700 }}><span>SUBJECT</span><span>ATTENDANCE</span><span>RATE</span><span>STATUS</span></div>
          {attendanceRows.filter(item => item.total > 0).slice(0, 6).map(item => <div className="subject-row" key={item.subjectId}><div className="subject-name"><strong>{item.subject}</strong><span>{item.present} present · {item.absent} absent</span></div><div className="progress-track"><div className={`progress-fill ${item.currentPercent < (item.requiredPercent ?? 0) ? "progress-fill--low" : item.risk === "WATCH" ? "progress-fill--risk" : ""}`} style={{ width: `${Math.min(100, Math.max(0, item.currentPercent ?? 0))}%` }} /></div><strong style={{ fontSize: 11 }}>{pct(item.currentPercent)}</strong><Risk value={item.risk} /></div>)}
        </>}
      </section>
      <section className="panel"><div className="panel-heading"><div><h3>Projected attendance</h3><p>Current vs. projected if you attend every dated future class.</p></div><CalendarClock size={17} color="var(--primary)" /></div>
        {chartData.length ? <div style={{ height: 220, width: "100%" }}><ResponsiveContainer><AreaChart data={chartData} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}><defs><linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity={0.24} /><stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="subject" tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: "var(--card)", borderColor: "var(--border)", borderRadius: 10, fontSize: 11 }} formatter={(v: any, name: any) => [`${Number(v).toFixed(1)}%`, name === "current" ? "Current" : name === "required" ? "Required" : "Attend all future classes"]} /><Legend wrapperStyle={{ fontSize: 10 }} /><Area type="monotone" dataKey="current" stroke="var(--primary)" strokeWidth={2.5} fill="url(#attendanceGradient)" connectNulls /><Area type="monotone" dataKey="projected" stroke="var(--chart-2)" strokeWidth={2} fill="none" connectNulls /><Area type="monotone" dataKey="required" stroke="#d39a45" strokeDasharray="4 4" strokeWidth={1.5} fill="none" connectNulls /></AreaChart></ResponsiveContainer></div> : <div className="empty-state"><CalendarClock size={20} /><strong>A projection is not available yet</strong><p>Import a timetable with future sessions and record current attendance; no schedule or attendance denominator has been assumed.</p></div>}
        <p className="small-meta" style={{ margin: "8px 0 0" }}>Projection values are mathematical estimates, not official eligibility decisions.</p>
      </section>
    </div>
    <section className="panel" style={{ marginTop: 14 }}><div className="panel-heading"><div><h3>Smart attendance alerts</h3><p>Generated from current attendance, your configured rule and dated timetable records.</p></div><Activity size={17} color="var(--primary)" /></div>
      {alerts.length ? <div className="record-list">{alerts.map((alert, index) => <div className="record-item" key={`${alert.kind}-${alert.subjectId}-${index}`}><div><strong>{alert.title} · {alert.subject}</strong><p>{alert.message}</p></div><span className={`risk-badge ${alert.severity === "warning" ? "risk-badge--at-risk" : alert.severity === "watch" ? "risk-badge--watch" : "risk-badge--safe"}`}>{alert.severity.toUpperCase()}</span></div>)}</div> : <div className="empty-state"><strong>{hasRiskData(attendanceRows) ? "No current attendance alerts" : "Not enough data to generate alerts"}</strong><p>Import dated attendance and configure your own required percentage to enable threshold and upcoming-risk notifications.</p></div>}
      <p className="small-meta" style={{ marginTop: 8 }}>Alerts reflect your saved records only; they do not represent an official university decision.</p>
    </section>
    <div className="dashboard-grid dashboard-grid--equal">
      <section className="panel"><div className="panel-heading"><div><h3>Coming up</h3><p>Scheduled classes present in your timetable.</p></div><CalendarClock size={17} color="var(--primary)" /></div>
        {data.upcomingClasses.length ? <div className="record-list">{data.upcomingClasses.slice(0, 4).map(item => <div className="record-item" key={item.id}><div><strong>{item.subjectName}</strong><p>{dateLabel(item.classDate)}{item.startTime ? ` · ${item.startTime}` : ""}{item.room ? ` · ${item.room}` : ""}</p></div><span className="risk-badge">SCHEDULED</span></div>)}</div> : <div className="empty-state"><strong>No upcoming classes recorded</strong><p>Import your schedule to reveal the next classes and remaining-session estimates.</p></div>}
      </section>
      <section className="panel"><div className="panel-heading"><div><h3>Next best steps</h3><p>Recommendations derived from your records only.</p></div><Sparkles size={17} color="var(--primary)" /></div><div className="record-list">{recommendations.map((text, index) => <div className="record-item" key={index}><div><strong>{index === 0 ? "Academic insight" : "Attention"}</strong><p>{text}</p></div><span className="risk-badge">DATA-BASED</span></div>)}</div></section>
    </div>
    <div className="dashboard-grid dashboard-grid--equal">
      <section className="panel"><div className="panel-heading"><div><h3>Assignment queue</h3><p>Open assignments and their due dates.</p></div><ClipboardList size={17} color="var(--primary)" /></div>{data.assignments.length ? <div className="record-list">{data.assignments.slice(0, 4).map(item => <div className="record-item" key={item.id}><div><strong>{item.title}</strong><p>{item.subjectName} · {item.dueAt ? `Due ${dateLabel(item.dueAt)}` : "No due date in record"}</p></div><span className="risk-badge risk-badge--watch">{item.status.replace("_", " ").toUpperCase()}</span></div>)}</div> : <div className="empty-state"><strong>{data.assignmentDataAvailable ? "No open assignments recorded" : "Assignment status unknown"}</strong><p>{data.assignmentDataAvailable ? "There are no pending assignments in the current import." : "Import assignment data to show pending work."}</p></div>}</section>
      <section className="panel"><div className="panel-heading"><div><h3>Recent marks</h3><p>Latest mark records by date.</p></div><GraduationCap size={17} color="var(--primary)" /></div>{data.marks.length ? <div className="record-list">{data.marks.slice(0, 4).map(item => <div className="record-item" key={item.id}><div><strong>{item.subjectName} · {item.title}</strong><p>{item.score ?? "—"}{item.maximumScore ? ` / ${item.maximumScore}` : ""} · {dateLabel(item.markedAt)}</p></div></div>)}</div> : <div className="empty-state"><strong>No mark records yet</strong><p>Recent marks will appear after you import them.</p></div>}</section>
    </div>
  </div>;
}
function hasRiskData(rows: any[]) { return rows.some(item => item.total > 0 && item.requiredPercent !== null); }
