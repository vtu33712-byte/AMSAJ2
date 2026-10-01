import { useState } from "react";
import { Bot, BookOpen, GraduationCap, Send, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/features/api";

type Message = { role: "user" | "assistant"; text: string; citations?: Array<{ fileName: string; pageNumber: number | null }> };
const suggestions = ["Which subjects are below my configured attendance threshold?", "How many consecutive classes do I need to attend?", "What assignments are due soon?", "Explain a concept from my uploaded study material."];
const greeting = "I’m your private academic assistant. I answer from your imported records and uploaded study materials; if a required value is missing, I’ll say so rather than invent it.";

export default function Assistant() {
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", text: greeting }]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const send = async (override?: string) => {
    const text = (override ?? question).trim();
    if (!text || busy) return;
    setError(""); setQuestion(""); setMessages(current => [...current, { role: "user", text }]); setBusy(true);
    try {
      const result = await apiPost<{ answer: string; citations?: Message["citations"] }>("/ai/chat", { question: text });
      setMessages(current => [...current, { role: "assistant", text: result.answer, citations: result.citations }]);
    } catch (e) { setError(e instanceof Error ? e.message : "The assistant is temporarily unavailable."); }
    finally { setBusy(false); }
  };
  return <div>
    <div className="page-intro"><div><div className="eyebrow-accent">GROUNDED ACADEMIC AI</div><h1>Ask your records a better question.</h1><p>Attendance calculations use deterministic formulas; general study explanations are clearly distinguished from facts in your documents.</p></div></div>
    <div className="dashboard-grid" style={{ gridTemplateColumns: "minmax(0,1.5fr) minmax(260px,.7fr)" }}>
      <section className="panel"><div className="panel-heading"><div className="flex items-center gap-2"><span className="brand-mark brand-mark--small"><span>N</span></span><div><h3>Nexora academic assistant</h3><p>Private to your signed-in workspace · conversation is not saved</p></div></div><Bot size={18} color="var(--primary)" /></div>
        <div className="chat-thread" aria-live="polite">{messages.map((item, index) => <div key={index} className={`chat-bubble chat-bubble--${item.role}`}>{item.text}{item.citations?.length ? <div className="form-hint" style={{ marginTop: 9 }}>Sources: {item.citations.map(c => `${c.fileName}, p. ${c.pageNumber ?? "?"}`).join(" · ")}</div> : null}</div>)}{busy && <div className="chat-bubble chat-bubble--assistant">Checking your records and relevant study passages…</div>}</div>
        {error && <div className="notice-box notice-box--warning" role="alert">{error}</div>}
        <div className="chat-composer"><textarea aria-label="Ask about your academic data" placeholder="Ask about attendance, results, assignments, or a study reference…" value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} /><Button aria-label="Send message" size="icon" disabled={!question.trim() || busy} onClick={() => void send()}><Send size={15} /></Button></div>
      </section>
      <div className="space-y-3">
        <section className="panel"><div className="panel-heading"><div><h3>Try asking</h3><p>Questions answerable from your records</p></div><Sparkles size={17} color="var(--primary)" /></div><div className="grid gap-2">{suggestions.map(prompt => <button key={prompt} className="text-left rounded-lg border border-border bg-background px-3 py-2.5 text-xs leading-relaxed text-foreground hover:bg-muted" onClick={() => void send(prompt)}>{prompt}</button>)}</div></section>
        <section className="panel"><div className="panel-heading"><div><h3>Trust boundaries</h3><p>What Nexora will—and won’t—claim</p></div><ShieldCheck size={17} color="var(--primary)" /></div><div className="record-list"><div className="record-item"><GraduationCap size={16} color="var(--primary)" /><div><strong>Numbers from your records</strong><p>Attendance, CGPA, credits and assignment facts are not invented when missing.</p></div></div><div className="record-item"><BookOpen size={16} color="var(--primary)" /><div><strong>Material citations</strong><p>Retrieved excerpts include filename and page where available. Scanned content may not extract.</p></div></div><div className="record-item"><Sparkles size={16} color="var(--primary)" /><div><strong>Study suggestions are generated</strong><p>Practice questions are aids, not exam predictions or official academic decisions.</p></div></div></div></section>
      </div>
    </div>
  </div>;
}
