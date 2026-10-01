import { useEffect, useMemo, useState } from "react";
import { BookOpen, Check, CheckCircle2, ClipboardList, FileText, GraduationCap, LoaderCircle, Plus, RefreshCw, RotateCcw, Sparkles, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiGet, apiPatch, apiPost } from "@/features/api";

type Material = { id: number; fileName: string; mimeType: string; subjectName: string | null; unit: string | null; topic: string | null; semester: string | null; pageCount: number | null; extractionStatus: string; uploadedAt: string };
type Topic = { id: number; title: string; learned: boolean; priority: "high" | "normal" | "low"; quizScore: string | null; revisionCount: number; subjectName: string | null; materialName: string | null };
type Plan = { items: Array<{ priority: string; source: string; title: string; detail: string; dueAt: string | null }>; examDatesConfigured: boolean; note: string };

export default function Study() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [subjectName, setSubjectName] = useState("");
  const [unit, setUnit] = useState("");
  const [topicLabel, setTopicLabel] = useState("");
  const [semester, setSemester] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState("summary");
  const [newTopic, setNewTopic] = useState("");
  const [topicSubject, setTopicSubject] = useState("");
  const [topicPriority, setTopicPriority] = useState("normal");

  const reload = async () => {
    const [materialData, topicData, planData, subjectData] = await Promise.all([
      apiGet<{ materials: Material[] }>("/materials"), apiGet<{ topics: Topic[] }>("/study/topics"), apiGet<Plan>("/study/plan"), apiGet<{ subjects: any[] }>("/subjects"),
    ]);
    setMaterials(materialData.materials); setTopics(topicData.topics); setPlan(planData); setSubjects(subjectData.subjects);
    setSelectedId(current => current ?? materialData.materials[0]?.id ?? null);
  };
  useEffect(() => { void reload().catch(e => setError(e instanceof Error ? e.message : "Study data could not be loaded.")); }, []);
  const selectedMaterial = materials.find(item => item.id === selectedId) ?? null;
  const learnedCount = topics.filter(item => item.learned).length;
  const weakTopics = useMemo(() => topics.filter(item => !item.learned || (item.quizScore != null && Number(item.quizScore) < 70)), [topics]);

  const upload = async () => {
    if (!file) { setError("Choose a study file first."); return; }
    if (file.size > 20 * 1024 * 1024) { setError("Files must be 20 MB or smaller."); return; }
    setBusy(true); setError(""); setMessage(""); setAnalysis("");
    try {
      const base64 = await fileBase64(file);
      const result = await apiPost<{ success: boolean; material: { id: number; fileName: string; extractionStatus: string; chunkCount: number }; note?: string | null }>("/materials/upload", { fileName: file.name, mimeType: file.type || "application/octet-stream", contentBase64: base64, subjectName: subjectName || undefined, unit: unit || undefined, topic: topicLabel || undefined, semester: semester || undefined });
      setMessage(`${result.material.fileName} saved · ${result.material.chunkCount} searchable text passages · ${result.material.extractionStatus}${result.note ? ` — ${result.note}` : ""}`);
      setSelectedId(result.material.id); setFile(null); await reload(); setSelectedId(result.material.id);
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed."); }
    finally { setBusy(false); }
  };
  const analyze = async (selectedMode = mode, customQuestion = question) => {
    if (!selectedMaterial) { setError("Upload or select a study material first."); return; }
    setBusy(true); setError(""); setMessage(""); setAnalysis("");
    const fallback = selectedMode === "exam" ? "From retrieved passages only, list key topics, concepts, definitions, formulas, diagram descriptions available in text, concise notes, 5-mark and 10-mark practice questions with model answer outlines, flashcards, five MCQs with answers, viva prompts, and revision checklist. Mention frequently recurring concepts only if repetition is visible in these passages. Label all generated suggestions as practice, never exam predictions." : selectedMode === "topics" ? "List key topics, definitions, formulas, important concepts, weak prerequisites to review, and a concise revision checklist." : selectedMode === "easy" ? "Explain the retrieved concept for a beginner in simple language, define unfamiliar terms, and give a small example using only the source material. Cite the source pages." : "Summarize the chapter, explain its key concepts, list definitions and formulas, and cite relevant page numbers.";
    try {
      const result = await apiPost<{ answer: string; citations: Array<{ fileName: string; pageNumber: number | null }>; retrievalMethod?: string }>("/materials/analyze", { materialId: selectedMaterial.id, mode: selectedMode, question: customQuestion.trim() || fallback });
      const cite = result.citations?.length ? `\n\nSources: ${result.citations.map(item => `${item.fileName} · p. ${item.pageNumber ?? "?"}`).join("; ")}` : "";
      setAnalysis(`${result.answer}${cite}\n\n${result.retrievalMethod ?? "Retrieved from uploaded material."}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Study analysis failed."); }
    finally { setBusy(false); }
  };
  const addTopic = async () => {
    if (!newTopic.trim()) return;
    setBusy(true); setError("");
    try { await apiPost("/study/topics", { title: newTopic.trim(), subjectId: topicSubject ? Number(topicSubject) : null, materialId: selectedId, priority: topicPriority }); setNewTopic(""); setTopicPriority("normal"); await reload(); setMessage("Topic added to your study tracker."); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not add topic."); }
    finally { setBusy(false); }
  };
  const updateTopic = async (id: number, patch: Record<string, unknown>) => {
    try { await apiPatch(`/study/topics/${id}`, patch); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : "Progress could not be saved."); }
  };

  return <div>
    <div className="page-intro"><div><div className="eyebrow-accent">STUDY STUDIO</div><h1>Build understanding that lasts.</h1><p>Organize course materials, find cited explanations, and track topics without guessing at exam outcomes.</p></div><Button variant="outline" onClick={() => void reload()}><RefreshCw size={14} className="mr-2" />Refresh</Button></div>
    {(error || message) && <div className={`notice-box ${error ? "notice-box--warning" : ""}`} role={error ? "alert" : "status"}>{error || message}</div>}
    <div className="data-source-ribbon" style={{ marginBottom: 14 }}><BookOpen size={15} /><span>Text is extracted automatically where supported. Retrieval is keyword-ranked, not vector-embedding search. Scanned PDFs/images may need OCR that is not configured here; generated practice questions are not exam predictions.</span></div>
    <div className="dashboard-grid" style={{ gridTemplateColumns: "minmax(280px,.82fr) minmax(0,1.5fr)" }}>
      <section className="panel"><div className="panel-heading"><div><h3>Add course material</h3><p>Private to your signed-in account · 20 MB max</p></div><UploadCloud size={18} color="var(--primary)" /></div>
        <div className="form-field"><label htmlFor="study-file">Choose file</label><input id="study-file" type="file" accept=".pdf,.ppt,.pptx,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp" onChange={e => setFile(e.target.files?.[0] ?? null)} /></div>
        <div className="form-grid" style={{ marginTop: 12 }}><div className="form-field"><label>Subject</label><select value={subjectName} onChange={e => setSubjectName(e.target.value)}><option value="">Unassigned</option>{subjects.map(subject => <option key={subject.id} value={subject.name}>{subject.name}</option>)}</select></div><div className="form-field"><label>Semester</label><input value={semester} onChange={e => setSemester(e.target.value)} placeholder="Optional" /></div><div className="form-field"><label>Unit / chapter</label><input value={unit} onChange={e => setUnit(e.target.value)} placeholder="Optional" /></div><div className="form-field"><label>Topic</label><input value={topicLabel} onChange={e => setTopicLabel(e.target.value)} placeholder="Optional" /></div></div>
        <div className="form-actions"><Button disabled={!file || busy} onClick={() => void upload()}>{busy ? <LoaderCircle size={15} className="mr-2 animate-spin" /> : <UploadCloud size={15} className="mr-2" />}Upload & process</Button></div>
        <p className="form-hint" style={{ marginTop: 10 }}>Accepted: PDF, PPT/PPTX, DOC/DOCX, TXT and common images. Legacy Office files and images may be stored without text extraction.</p>
        <div style={{ marginTop: 20 }}><div className="panel-heading"><div><h3>Library · {materials.length}</h3><p>Your uploaded references</p></div></div>
          {materials.length ? <div className="record-list">{materials.map(item => <button key={item.id} onClick={() => { setSelectedId(item.id); setAnalysis(""); }} className="record-item" style={{ width: "100%", textAlign: "left", border: 0, borderTop: "1px solid var(--border)", background: selectedId === item.id ? "var(--muted)" : "transparent", padding: "11px 8px", borderRadius: 9 }}><FileText size={16} color="var(--primary)" /><div style={{ flex: 1, minWidth: 0 }}><strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.fileName}</strong><p>{item.subjectName ?? "Unassigned"}{item.unit ? ` · ${item.unit}` : ""} · {item.pageCount ?? "—"} pages · {item.extractionStatus}</p></div></button>)}</div> : <div className="empty-state"><strong>No study materials uploaded</strong><p>Your library will appear here after your first upload.</p></div>}
        </div>
      </section>
      <section className="panel"><div className="panel-heading"><div><h3>{selectedMaterial?.fileName ?? "Material analysis"}</h3><p>{selectedMaterial ? [selectedMaterial.subjectName, selectedMaterial.unit, selectedMaterial.topic, selectedMaterial.semester].filter(Boolean).join(" · ") || "Study reference" : "Select a saved reference or upload one"}</p></div><Sparkles size={18} color="var(--primary)" /></div>
        <div className="form-grid"><div className="form-field"><label>Study mode</label><select value={mode} onChange={e => setMode(e.target.value)}><option value="summary">Chapter summary</option><option value="topics">Key topics & revision list</option><option value="exam">Flashcards, MCQs & practice questions</option><option value="easy">Explain in easy language</option><option value="analysis">Ask from the document</option></select></div><div className="form-field"><label>Question or focus (optional)</label><input value={question} onChange={e => setQuestion(e.target.value)} placeholder="e.g. Explain the process shown on page 4" /></div></div>
        <div className="form-actions"><Button disabled={!selectedMaterial || busy} onClick={() => void analyze()}><Sparkles size={14} className="mr-2" />Generate study aid</Button><Button variant="outline" disabled={!selectedMaterial || busy} onClick={() => void analyze("exam", "Generate flashcards, MCQs with answers, short/long revision questions, and viva prompts only from the retrieved excerpts. Clearly label everything as generated practice, not an exam prediction.")}><GraduationCap size={14} className="mr-2" />Exam practice</Button></div>
        {analysis && <div className="study-answer" style={{ marginTop: 17 }}><pre style={{ margin: 0, whiteSpace: "pre-wrap", font: "inherit", fontSize: 12, lineHeight: 1.75 }}>{analysis}</pre></div>}
        {!analysis && <div className="empty-state" style={{ marginTop: 20 }}><Sparkles size={20} /><strong>Study from your own references</strong><p>Generated explanations use retrieved text passages when available and cite source pages. Suggestions are AI-generated; they are not predictions of exam questions.</p></div>}
      </section>
    </div>
    <div className="dashboard-grid dashboard-grid--equal">
      <section className="panel"><div className="panel-heading"><div><h3>Record-derived study plan</h3><p>Assignments, saved exam dates, attendance needs, relative marks, topic priorities, uploaded materials and timetable.</p></div><ClipboardList size={18} color="var(--primary)" /></div>
        {plan?.items.length ? <div className="record-list">{plan.items.map((item, index) => <div className="record-item" key={`${item.source}-${index}`}><div><strong>{item.title}</strong><p>{item.detail}</p></div><span className={`risk-badge ${item.priority === "high" ? "risk-badge--at-risk" : ""}`}>{item.priority.toUpperCase()}</span></div>)}</div> : <div className="empty-state"><strong>No plan items can be derived yet</strong><p>{plan?.note ?? "Import assignment, timetable and topic records to build a grounded plan."}</p></div>}
        <div className="form-hint" style={{ marginTop: 10 }}>{plan?.note}</div>
      </section>
      <section className="panel"><div className="panel-heading"><div><h3>Topic progress</h3><p>{learnedCount} learned · {topics.length - learnedCount} to review</p></div><CheckCircle2 size={18} color="var(--primary)" /></div>
        <div className="form-grid"><div className="form-field"><label>New topic</label><input value={newTopic} onChange={e => setNewTopic(e.target.value)} placeholder="Topic name" /></div><div className="form-field"><label>Subject</label><select value={topicSubject} onChange={e => setTopicSubject(e.target.value)}><option value="">Unassigned</option>{subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></div><div className="form-field"><label>Your priority</label><select value={topicPriority} onChange={e => setTopicPriority(e.target.value)}><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select></div></div><div className="form-actions"><Button size="sm" disabled={!newTopic.trim() || busy} onClick={() => void addTopic()}><Plus size={14} className="mr-1" />Track topic</Button></div>
        {topics.length ? <div className="record-list" style={{ marginTop: 14 }}>{topics.map(item => <div className="record-item" key={item.id}><div><strong>{item.title}</strong><p>{item.subjectName ?? "Unassigned"} · priority {item.priority}{item.quizScore != null ? ` · quiz ${Number(item.quizScore).toFixed(0)}%` : ""} · revised {item.revisionCount}×</p><input key={`${item.id}-${item.quizScore}`} aria-label={`Quiz score for ${item.title}`} type="number" min="0" max="100" step="1" defaultValue={item.quizScore ?? ""} placeholder="Quiz score %" onBlur={e => { const value = e.currentTarget.value.trim(); if (value !== String(item.quizScore ?? "")) void updateTopic(item.id, { quizScore: value === "" ? null : Number(value) }); }} style={{ width: 100, marginTop: 5 }} /></div><div style={{ display: "flex", flexWrap: "wrap", gap: 5, justifyContent: "flex-end" }}><select aria-label={`Priority for ${item.title}`} value={item.priority} onChange={e => void updateTopic(item.id, { priority: e.target.value })} style={{ width: 86, minHeight: 32, fontSize: 11 }}><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select><Button variant="outline" size="sm" title="Record another revision" onClick={() => void updateTopic(item.id, { incrementRevision: true })}><RotateCcw size={13} /></Button><Button variant={item.learned ? "secondary" : "outline"} size="sm" onClick={() => void updateTopic(item.id, { learned: !item.learned })}>{item.learned ? <><Check size={13} className="mr-1" />Learned</> : "Mark learned"}</Button></div></div>)}</div> : <div className="empty-state"><strong>Your progress tracker is ready</strong><p>Add a topic from the material you’re studying; no progress is assumed.</p></div>}
        {weakTopics.length > 0 && <div className="notice-box notice-box--warning" style={{ marginTop: 12 }}><strong>Review focus:</strong> {weakTopics.slice(0, 3).map(topic => topic.title).join(", ")}</div>}
      </section>
    </div>
  </div>;
}

function fileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The browser could not read this file."));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}
