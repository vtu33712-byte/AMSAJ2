import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Calculator, CalendarDays, CheckCircle2, Info, Settings2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiGet } from "@/features/api";

type SubjectAttendance = { subjectId: number; subject: string; code: string | null; present: number; absent: number; total: number; currentPercent: number | null; requiredPercent: number | null; remainingScheduledClasses: number | null; classesNeeded: number | null; classesMissable: number | null; projectedIfAttendAll: number | null; risk: string; extraClasses: { total: number; present: number; countsIncluded: number; eligibleUpcoming: number; officialRuleConfigured: boolean }; projectionIncludingEligibleExtras: number | null };
type ExtraClassRecord = { id: number; subjectId: number; subject: string; classDate: string | null; faculty: string | null; status: string; countsTowardAttendance: boolean; separateCategory: boolean };
type Data = { overall: { present: number; total: number; percent: number | null }; requiredAttendance: number | null; subjects: SubjectAttendance[]; extraClasses: ExtraClassRecord[]; scenarios: Array<{ subjectId: number; subject: string; scenarios: Array<{ name: string; projectedPercent: number | null; attend: number; miss: number }> | null }>; upcomingClassCountAvailable: boolean };
const pct = (n: number | null) => n == null ? "—" : `${n.toFixed(2)}%`;
function Badge({ value }: { value: string }) { return <span className={`risk-badge risk-badge--${value.toLowerCase().replaceAll(" ", "-")}`}>{value}</span>; }

export default function Attendance() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [present, setPresent] = useState("");
  const [absent, setAbsent] = useState("");
  const [currentTotal, setCurrentTotal] = useState("");
  const [required, setRequired] = useState("");
  const [remaining, setRemaining] = useState("");
  useEffect(() => { apiGet<Data>("/attendance").then(result => { setData(result); setSelected(result.subjects[0]?.subjectId ?? null); }).finally(() => setLoading(false)); }, []);
  const selectedSubject = data?.subjects.find(row => row.subjectId === selected) ?? data?.subjects[0];
  const calc = useMemo(() => {
    const p = Number(present), a = Number(absent), total = Number(currentTotal), r = Number(required), future = Number(remaining);
    if ([p, a, total, r, future].some(n => !Number.isFinite(n) || n < 0) || !Number.isInteger(p) || !Number.isInteger(a) || !Number.isInteger(total) || !Number.isInteger(future) || r > 100 || total === 0 || p + a !== total) return null;
    const current = (p / total) * 100;
    let needed: number | null = 0;
    if (current < r) needed = r === 100 ? (a > 0 ? null : 0) : Math.max(0, Math.ceil(((r / 100) * total - p) / (1 - r / 100) - 1e-10));
    const canMiss = current < r ? 0 : r === 0 ? null : Math.max(0, Math.floor((p * 100) / r - total + 1e-9));
    const projected = future === 0 ? current : ((p + future) / (total + future)) * 100;
    return { current, needed, canMiss, projected };
  }, [present, absent, currentTotal, required, remaining]);
  const chartData = useMemo(() => selectedSubject ? (data?.scenarios.find(item => item.subjectId === selectedSubject.subjectId)?.scenarios ?? []).map(item => ({ scenario: item.name.replace("remaining class", "class"), attendance: item.projectedPercent })) : [], [data, selectedSubject]);

  return <div>
    <div className="page-intro"><div><div className="eyebrow-accent">ATTENDANCE INTELLIGENCE</div><h1>Know where you stand.</h1><p>Every percentage is calculated from records you imported or entered, with your own threshold rules.</p></div></div>
    <div className="data-source-ribbon"><Info size={15} /><span><strong>Projection notice:</strong> Eligibility estimates are mathematical projections only, not official university decisions. Required attendance is configurable; it is not assumed universal.</span></div>
    <div className="metric-grid" style={{ marginTop: 14, gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
      <div className="metric-card"><div className="metric-label"><Activity size={14} />Overall attendance</div><div className="metric-value">{loading ? "…" : pct(data?.overall.percent ?? null)}</div><div className="metric-foot">{data?.overall.present ?? 0} present / {data?.overall.total ?? 0} recorded classes</div></div>
      <div className="metric-card"><div className="metric-label"><Settings2 size={14} />Required threshold</div><div className="metric-value">{data?.requiredAttendance == null ? "Not set" : pct(data.requiredAttendance)}</div><div className="metric-foot">Personal rule · change in Profile & Settings</div></div>
      <div className="metric-card"><div className="metric-label"><CalendarDays size={14} />Remaining sessions</div><div className="metric-value">{selectedSubject?.remainingScheduledClasses == null ? "—" : selectedSubject.remainingScheduledClasses}</div><div className="metric-foot">For this subject · imported timetable only</div></div>
    </div>
    <div className="dashboard-grid" style={{ gridTemplateColumns: "minmax(0,1.1fr) minmax(300px,.9fr)" }}>
      <section className="panel"><div className="panel-heading"><div><h3>Subject attendance</h3><p>Regular attendance and institution-specific extra-class rules.</p></div></div>
        {loading ? <div className="empty-state">Loading attendance records…</div> : !data?.subjects.length ? <div className="empty-state"><Activity size={20} /><strong>No subjects are in your record</strong><p>Import attendance and subject data to calculate current percentages. Nothing is filled in as a sample.</p><a href="/settings" className="text-link">Open imports and settings →</a></div> : data.subjects.map(row => <button key={row.subjectId} className="record-item" style={{ width: "100%", background: "transparent", border: 0, borderTop: "1px solid var(--border)", textAlign: "left", padding: "14px 2px", cursor: "pointer" }} onClick={() => setSelected(row.subjectId)} aria-pressed={selected === row.subjectId}>
          <div style={{ width: "100%" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}><div><strong>{row.subject}</strong><p>{row.code ?? "No subject code"} · {row.present} present, {row.absent} absent of {row.total} recorded</p></div><Badge value={row.risk} /></div><div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}><div className="progress-track" style={{ flex: 1 }}><div className={`progress-fill ${row.requiredPercent !== null && row.currentPercent !== null && row.currentPercent < row.requiredPercent ? "progress-fill--low" : ""}`} style={{ width: `${Math.max(0, Math.min(100, row.currentPercent ?? 0))}%` }} /></div><span style={{ fontSize: 11, fontWeight: 700 }}>{pct(row.currentPercent)}</span><span className="small-meta">Required {pct(row.requiredPercent)}</span></div></div>
        </button>)}
        {selectedSubject && <div className="notice-box" style={{ marginTop: 9 }}><strong>Extra classes · {selectedSubject.subject}</strong><br />{selectedSubject.extraClasses.total ? `${selectedSubject.extraClasses.present} attended · ${selectedSubject.extraClasses.eligibleUpcoming} upcoming and eligible under your saved rule.` : "No extra-class records."} {selectedSubject.extraClasses.total > 0 && !selectedSubject.extraClasses.officialRuleConfigured ? "Counting policy has not been configured; no extra classes are included." : "Official counting is based only on your configured rule."}</div>}
      </section>
      <section className="panel"><div className="panel-heading"><div><h3>Semester projection</h3><p>{selectedSubject ? `${selectedSubject.subject} · based on imported future sessions` : "Choose a subject"}</p></div></div>
        {chartData.length ? <div style={{ height: 235 }}><ResponsiveContainer><BarChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 40 }}><CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 3" /><XAxis dataKey="scenario" tick={{ fontSize: 8, fill: "var(--muted-foreground)" }} angle={-17} textAnchor="end" interval={0} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} /><Tooltip formatter={(value: any) => [value == null ? "Unavailable" : `${Number(value).toFixed(1)}%`, "Projected attendance"]} contentStyle={{ background: "var(--card)", borderColor: "var(--border)", borderRadius: 9, fontSize: 10 }} /><Legend wrapperStyle={{ fontSize: 10 }} /><Bar dataKey="attendance" name="Projected attendance" fill="var(--primary)" radius={[5,5,0,0]} /></BarChart></ResponsiveContainer></div> : <div className="empty-state"><CalendarDays size={20} /><strong>Future schedule unavailable</strong><p>Import dated timetable sessions to calculate the four semester scenarios.</p></div>}
        <div className="notice-box notice-box--warning" style={{ marginTop: 9 }}><strong>Projection scenarios</strong><br />Attend all; miss 1 class per week; miss 2 classes per week; attend regular plus eligible extra classes. Scenarios are unavailable when there is no future timetable data.</div>
      </section>
    </div>
    <div className="dashboard-grid dashboard-grid--equal">
      <section className="panel"><div className="panel-heading"><div><h3>Attendance eligibility calculator</h3><p>Test supplied class counts independently of your saved record.</p></div><Calculator size={17} color="var(--primary)" /></div>
        <div className="form-grid"><Field label="Current classes (total)" value={currentTotal} onChange={setCurrentTotal} /><Field label="Present classes" value={present} onChange={setPresent} /><Field label="Absent classes" value={absent} onChange={setAbsent} /><Field label="Required attendance %" value={required} onChange={setRequired} /><Field label="Expected remaining classes" value={remaining} onChange={setRemaining} /></div>
        {calc ? <div className="notice-box" style={{ marginTop: 14 }}><strong>Current: {calc.current.toFixed(2)}%</strong> · {calc.needed === null ? "The threshold cannot be reached by attending future classes alone." : calc.needed === 0 ? "Already at or above your configured threshold." : `Attend ${calc.needed} consecutive classes to reach the threshold.`}<br />{calc.canMiss === null ? "At a 0% threshold, no finite miss limit applies." : `At most ${calc.canMiss} additional class${calc.canMiss === 1 ? "" : "es"} can be missed while staying at or above the threshold.`}<br />If you attend every entered remaining class: <strong>{calc.projected.toFixed(2)}%</strong>.</div> : <div className="notice-box notice-box--warning" style={{ marginTop: 14 }}>Enter whole class counts and a required percentage from 0 to 100. Current total must be greater than zero and equal present plus absent classes.</div>}
      </section>
      <section className="panel"><div className="panel-heading"><div><h3>How the projection works</h3><p>Simple, transparent calculation.</p></div><CheckCircle2 size={17} color="var(--primary)" /></div>
        <div className="record-list"><div className="record-item"><div><strong>Attendance percentage</strong><p>Present classes ÷ total recorded classes × 100. A zero denominator returns unavailable.</p></div></div><div className="record-item"><div><strong>Classes needed</strong><p>Minimum x satisfying (present + x) ÷ (total + x) ≥ required threshold.</p></div></div><div className="record-item"><div><strong>Classes missable</strong><p>Maximum future absences that keep present ÷ (total + missed classes) at or above your rule.</p></div></div><div className="record-item"><div><strong>Extra classes</strong><p>Count only if you explicitly configure them to count; separate-category sessions never silently merge with regular attendance.</p></div></div></div>
        <div className="notice-box notice-box--warning" style={{ marginTop: 12 }}><AlertTriangle size={13} style={{ display: "inline", verticalAlign: "-2px" }} /> These are mathematical estimates, not official university eligibility decisions.</div>
      </section>
    </div>
    <section className="panel" style={{ marginTop: 14 }}><div className="panel-heading"><div><h3>Extra-class register</h3><p>Counting follows only the rule you saved; university policy is not presumed.</p></div><CalendarDays size={17} color="var(--primary)" /></div>
      {data?.extraClasses?.length ? <div className="record-list">{data.extraClasses.map(item => <div className="record-item" key={item.id}><div><strong>{item.subject} · Extra class</strong><p>{item.classDate ? new Date(item.classDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "Date not recorded"} · {item.faculty ?? "Faculty not recorded"} · {item.status.replaceAll("_", " ").toUpperCase()}</p><p>{item.separateCategory ? "Separate attendance category" : item.countsTowardAttendance ? "Configured to count with regular attendance" : "Not counted with regular attendance"}</p></div><Badge value={item.status === "upcoming" ? "SCHEDULED" : item.countsTowardAttendance && !item.separateCategory ? "COUNTED BY YOUR RULE" : "SEPARATE / EXCLUDED"} /></div>)}</div> : <div className="empty-state"><strong>No extra classes recorded</strong><p>Add an extra class in Profile & Settings or import your records; counting remains off unless you explicitly enable it.</p></div>}
    </section>
  </div>;
}
function Field({ label, value, onChange }: { label: string; value: string; onChange: (s: string) => void }) { return <div className="form-field"><label>{label}</label><input inputMode="decimal" type="number" min="0" step="any" value={value} onChange={e => onChange(e.target.value)} /></div>; }
