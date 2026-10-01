import { useEffect, useState } from "react";
import { Activity, AlertCircle, CheckCircle2, Download, FileSpreadsheet, Link2Off, Save, Settings2, ShieldCheck, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiGet, apiPatch, apiPost } from "@/features/api";
import { parseAcademicImport, type AcademicImport } from "@/features/importParsers";

type Profile = { displayName?: string | null; program?: string | null; semester?: string | null; cgpa?: string | number | null; creditsEarned?: number | null; requiredAttendance?: string | number | null; safeThreshold?: string | number | null; watchThreshold?: string | number | null };
type ImportLog = { id: number; source: string; status: string; recordsAdded: number; recordsUpdated: number; recordsUnchanged: number; recordsRejected: number; startedAt: string; completedAt: string | null; errorSummary: string | null };

export default function Settings() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sources, setSources] = useState<any>(null);
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<AcademicImport | null>(null);
  const [manualSubject, setManualSubject] = useState("");
  const [manualDate, setManualDate] = useState("");
  const [manualStatus, setManualStatus] = useState("present");
  const [manualRule, setManualRule] = useState("");
  const [extraSubject, setExtraSubject] = useState("");
  const [extraDate, setExtraDate] = useState("");
  const [extraFaculty, setExtraFaculty] = useState("");
  const [extraStatus, setExtraStatus] = useState("upcoming");
  const [extraCounts, setExtraCounts] = useState(false);
  const [extraSeparate, setExtraSeparate] = useState(false);
  const [examSubject, setExamSubject] = useState("");
  const [examTitle, setExamTitle] = useState("");
  const [examDate, setExamDate] = useState("");

  const load = async () => {
    const [studentData, syncData, subjectData] = await Promise.all([apiGet<any>("/student"), apiGet<any>("/sync/status"), apiGet<{ subjects: any[] }>("/subjects")]);
    setProfile(studentData.profile); setSources(syncData.liveSource); setLogs(syncData.logs); setSubjects(subjectData.subjects);
  };
  useEffect(() => { void load().catch(e => setError(e instanceof Error ? e.message : "Settings could not be loaded.")).finally(() => setLoading(false)); }, []);
  const current = profile ?? {};
  const displayName = String(current.displayName ?? "");
  const program = String(current.program ?? "");
  const semester = String(current.semester ?? "");
  const cgpa = current.cgpa == null ? "" : String(current.cgpa);
  const credits = current.creditsEarned == null ? "" : String(current.creditsEarned);
  const required = current.requiredAttendance == null ? "" : String(current.requiredAttendance);
  const safe = current.safeThreshold == null ? "" : String(current.safeThreshold);
  const watch = current.watchThreshold == null ? "" : String(current.watchThreshold);

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const num = (value: string) => value.trim() === "" ? null : Number(value);
    try {
      const result = await apiPatch<{ profile: Profile }>("/student", { displayName: displayName || undefined, program: program || undefined, semester: semester || undefined, cgpa: num(cgpa), creditsEarned: num(credits), requiredAttendance: num(required), safeThreshold: num(safe), watchThreshold: num(watch) });
      setProfile(result.profile); setMessage("Personal profile and thresholds saved.");
    } catch (e) { setError(e instanceof Error ? e.message : "Settings could not be saved."); }
    finally { setBusy(false); }
  };
  const importFile = async () => {
    if (!file || !preview) { setError("Choose a valid CSV, Excel, or JSON export and review its preview first."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const data = await parseAcademicImport(file);
      const result = await apiPost<{ success: boolean; counts: { added: number; updated: number; unchanged: number; rejected: number; rejectionDetails: string[] }; message: string }>("/sync", { source: "user_import", fileName: file.name, data });
      const details = result.counts.rejectionDetails ?? [];
      const rejectionSummary = details.length ? ` First rejected rows: ${details.slice(0, 8).join(" · ")}${result.counts.rejected > 8 ? ` · plus ${result.counts.rejected - 8} more` : ""}.` : "";
      setMessage(`${file.name}: ${result.counts.added} added · ${result.counts.updated} updated · ${result.counts.unchanged} unchanged · ${result.counts.rejected} rejected.${rejectionSummary} ${result.message}`);
      setFile(null); setPreview(null); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Import could not be parsed."); }
    finally { setBusy(false); }
  };
  const prepareImport = async (selectedFile: File | null) => {
    setFile(selectedFile); setPreview(null); setError(""); setMessage("");
    if (!selectedFile) return;
    if (selectedFile.size > 10 * 1024 * 1024) { setFile(null); setError("Academic export files must be 10 MB or smaller."); return; }
    try { setPreview(await parseAcademicImport(selectedFile)); }
    catch (e) { setError(e instanceof Error ? e.message : "The selected file could not be parsed for preview."); }
  };
  const submitManualAttendance = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!manualSubject.trim() || !manualDate) { setError("Enter a subject and class date."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const subject: Record<string, unknown> = { name: manualSubject.trim() };
      if (manualRule !== "") subject.requiredAttendance = Number(manualRule);
      const result = await apiPost<any>("/sync", { source: "manual", data: { subjects: [subject], attendance: [{ subjectName: manualSubject.trim(), status: manualStatus, classDate: manualDate, source: "manual" }] } });
      setMessage(`Class record saved: ${result.counts.added} added, ${result.counts.unchanged} unchanged.`); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Manual attendance could not be saved."); }
    finally { setBusy(false); }
  };
  const submitExtraClass = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!extraSubject.trim() || !extraDate) { setError("Enter the subject and actual date for the extra class."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await apiPost<any>("/sync", { source: "manual", data: { extraClasses: [{ subjectName: extraSubject.trim(), classDate: extraDate || null, faculty: extraFaculty.trim() || undefined, attendanceStatus: extraStatus, countsTowardAttendance: extraCounts, separateCategory: extraSeparate }] } });
      setMessage(`Extra class saved. ${result.counts.added} record added; your counting preference was saved.`); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Extra class could not be saved."); }
    finally { setBusy(false); }
  };
  const submitExamDate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!examSubject.trim() || !examDate) { setError("Enter the actual subject and exam date from your official schedule."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await apiPost<any>("/sync", { source: "manual", data: { exams: [{ subjectName: examSubject.trim(), title: examTitle.trim() || "Exam", examAt: new Date(`${examDate}T12:00:00`).toISOString() }] } });
      setMessage(`Exam date saved from your entry. ${result.counts.added} added · ${result.counts.unchanged} unchanged.`); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Exam date could not be saved."); }
    finally { setBusy(false); }
  };

  return <div>
    <div className="page-intro"><div><div className="eyebrow-accent">PROFILE & DATA SOURCES</div><h1>Set your own rules.</h1><p>Personalize the workspace, bring in authorized exports, and keep source status transparent.</p></div></div>
    {loading && <div className="notice-box">Loading your private settings…</div>}
    {(error || message) && <div className={`notice-box ${error ? "notice-box--warning" : ""}`} role={error ? "alert" : "status"}>{error || message}</div>}
    <div className="dashboard-grid" style={{ gridTemplateColumns: "minmax(0,1.15fr) minmax(280px,.85fr)" }}>
      <section className="panel"><div className="panel-heading"><div><h3>Personal profile & thresholds</h3><p>Required attendance is blank until you set your applicable rule.</p></div><Settings2 size={18} color="var(--primary)" /></div>
        <form onSubmit={saveProfile}><div className="form-grid">
          <Field label="Display name" value={displayName} onChange={value => setProfile(p => ({ ...p, displayName: value }))} />
          <Field label="Program" value={program} onChange={value => setProfile(p => ({ ...p, program: value }))} />
          <Field label="Semester / term" value={semester} onChange={value => setProfile(p => ({ ...p, semester: value }))} />
          <Field label="Current CGPA" value={cgpa} type="number" min="0" max="10" step="0.01" onChange={value => setProfile(p => ({ ...p, cgpa: value }))} />
          <Field label="Credits earned" value={credits} type="number" min="0" step="1" onChange={value => setProfile(p => ({ ...p, creditsEarned: value === "" ? null : Number(value) }))} />
          <Field label="Required attendance (%)" value={required} type="number" min="0" max="100" step="0.01" onChange={value => setProfile(p => ({ ...p, requiredAttendance: value }))} hint="Use your own official threshold; no universal 75% rule is assumed." />
          <Field label="Safe band starts at (%)" value={safe} type="number" min="0" max="100" step="0.01" onChange={value => setProfile(p => ({ ...p, safeThreshold: value }))} />
          <Field label="Watch band starts at (%)" value={watch} type="number" min="0" max="100" step="0.01" onChange={value => setProfile(p => ({ ...p, watchThreshold: value }))} />
        </div><div className="form-actions"><Button type="submit" disabled={busy}><Save size={14} className="mr-2" />Save profile</Button></div></form>
      </section>
      <div className="space-y-3">
        <section className="panel"><div className="panel-heading"><div><h3>Live connection status</h3><p>Only authorized sources can be connected.</p></div>{sources?.available ? <CheckCircle2 size={18} color="#43a982" /> : <Link2Off size={18} color="var(--muted-foreground)" />}</div>
          <div className="notice-box"><strong>{sources?.label ?? "Checking source status…"}</strong><br />{sources?.reason ?? "No university API is configured."}</div>
          <p className="form-hint" style={{ marginTop: 10 }}>This app does not scrape a university site, request portal passwords, or bypass access controls. Use a provider integration only if the institution explicitly authorizes it.</p>
        </section>
        <section className="panel"><div className="panel-heading"><div><h3>Import academic exports</h3><p>CSV · Excel (.xlsx/.xls) · JSON</p></div><FileSpreadsheet size={18} color="var(--primary)" /></div>
          <div className="form-field"><label htmlFor="academic-import">Choose export file</label><input id="academic-import" type="file" accept=".csv,.json,.xlsx,.xls" onChange={event => void prepareImport(event.target.files?.[0] ?? null)} /></div>
          {preview && <div className="notice-box" style={{ marginTop: 10 }}><strong>Import preview · {file?.name}</strong><div className="record-list">{Object.entries(preview).map(([kind, value]) => { const count = Array.isArray(value) ? value.length : value ? 1 : 0; return count ? <div className="record-item" key={kind}><div><strong>{kind.replace(/([A-Z])/g, " $1").toUpperCase()} · {count} record{count === 1 ? "" : "s"}</strong><p>{Array.isArray(value) ? JSON.stringify(value[0]).slice(0, 240) : JSON.stringify(value).slice(0, 240)}</p></div></div> : null; })}</div><p className="form-hint">Field mapping normalizes common aliases into the supported record fields. This preview checks file structure and shows sample values. Server validation, row-level rejection reasons and transaction apply happen only when you select Validate & import; use the CSV template for unmapped columns.</p></div>}
          <div className="form-actions"><Button disabled={!file || !preview || busy} onClick={() => void importFile()}><UploadCloud size={14} className="mr-2" />Validate & import</Button><a href="/academic-import-template.csv" download className="text-link"><Download size={13} style={{ display: "inline", verticalAlign: "-2px" }} /> CSV template</a></div>
          <p className="form-hint" style={{ marginTop: 10 }}>Imports are user-provided—not live synchronization. Invalid records are rejected without discarding previous records. Excel sheets can be named Student, Subjects, Attendance, Timetable, Marks, Results, Credits, Assignments, and Exams.</p>
        </section>
      </div>
    </div>
    <div className="dashboard-grid dashboard-grid--equal">
      <section className="panel"><div className="panel-heading"><div><h3>Add one attendance session</h3><p>Enter a real subject, date and status; no counts or dates are fabricated.</p></div><Activity size={18} color="var(--primary)" /></div>
        <form onSubmit={submitManualAttendance}><div className="form-grid"><div className="form-field"><label>Subject</label><input list="subject-list" value={manualSubject} onChange={e => setManualSubject(e.target.value)} placeholder="Subject name" /><datalist id="subject-list">{subjects.map(item => <option key={item.id} value={item.name} />)}</datalist></div><div className="form-field"><label>Class date</label><input required type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} /></div><div className="form-field"><label>Attendance status</label><select value={manualStatus} onChange={e => setManualStatus(e.target.value)}><option value="present">Present</option><option value="absent">Absent</option></select></div><div className="form-field"><label>Subject-specific required % (optional)</label><input type="number" min="0" max="100" step="0.01" value={manualRule} onChange={e => setManualRule(e.target.value)} placeholder="Use profile setting" /></div></div><div className="form-actions"><Button disabled={busy} type="submit">Add session</Button></div></form>
      </section>
      <section className="panel"><div className="panel-heading"><div><h3>Log an extra class</h3><p>Counting and separate-category rules are always explicit.</p></div><ShieldCheck size={18} color="var(--primary)" /></div>
        <form onSubmit={submitExtraClass}><div className="form-grid"><div className="form-field"><label>Subject</label><input list="subject-list" value={extraSubject} onChange={e => setExtraSubject(e.target.value)} placeholder="Subject name" /></div><div className="form-field"><label>Date</label><input type="date" required value={extraDate} onChange={e => setExtraDate(e.target.value)} /></div><div className="form-field"><label>Faculty (optional)</label><input value={extraFaculty} onChange={e => setExtraFaculty(e.target.value)} placeholder="Faculty name" /></div><div className="form-field"><label>Status</label><select value={extraStatus} onChange={e => setExtraStatus(e.target.value)}><option value="upcoming">Upcoming</option><option value="present">Attended</option><option value="absent">Absent</option></select></div></div>
          <div className="grid gap-2" style={{ marginTop: 12 }}><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={extraCounts} onChange={e => setExtraCounts(e.target.checked)} />This class counts in the subject's regular attendance percentage</label><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={extraSeparate} onChange={e => setExtraSeparate(e.target.checked)} />Track this as a separate attendance category</label></div><div className="form-actions"><Button disabled={busy} type="submit">Save extra class</Button></div>
        </form>
      </section>
    </div>
    <section className="panel" style={{ marginTop: 14 }}><div className="panel-heading"><div><h3>Add a scheduled exam</h3><p>Only enter a date present in your real schedule; plans will use this saved date.</p></div><Activity size={18} color="var(--primary)" /></div>
      <form onSubmit={submitExamDate}><div className="form-grid"><div className="form-field"><label>Subject</label><input list="subject-list" value={examSubject} onChange={e => setExamSubject(e.target.value)} placeholder="Subject name" /></div><div className="form-field"><label>Exam title</label><input value={examTitle} onChange={e => setExamTitle(e.target.value)} placeholder="e.g. Midterm examination" /></div><div className="form-field"><label>Exam date</label><input type="date" required value={examDate} onChange={e => setExamDate(e.target.value)} /></div></div><div className="form-actions"><Button disabled={busy} type="submit">Save exam date</Button></div></form>
    </section>
    <section className="panel" style={{ marginTop: 14 }}><div className="panel-heading"><div><h3>Import history</h3><p>These entries represent local imports/manual edits, not external account synchronization.</p></div></div>
      {logs.length ? <div className="record-list">{logs.map(log => <div className="record-item" key={log.id}><div><strong>{log.source.replaceAll("_", " ").toUpperCase()} · {log.status.toUpperCase()}</strong><p>{new Date(log.completedAt ?? log.startedAt).toLocaleString()} · {log.recordsAdded} added · {log.recordsUpdated} updated · {log.recordsUnchanged} unchanged · {log.recordsRejected} rejected{log.errorSummary ? ` · ${log.errorSummary}` : ""}</p></div><span className={`risk-badge ${log.status === "completed" ? "risk-badge--safe" : "risk-badge--at-risk"}`}>{log.status}</span></div>)}</div> : <div className="empty-state"><AlertCircle size={18} /><strong>No imports recorded yet</strong><p>Import history appears here after an upload or manual record.</p></div>}
    </section>
  </div>;
}
function Field({ label, value, onChange, type = "text", min, max, step, hint }: { label: string; value: string; onChange: (value: string) => void; type?: string; min?: string; max?: string; step?: string; hint?: string }) {
  return <div className="form-field"><label>{label}</label><input type={type} min={min} max={max} step={step} value={value} onChange={e => onChange(e.target.value)} />{hint && <span className="form-hint">{hint}</span>}</div>;
}
