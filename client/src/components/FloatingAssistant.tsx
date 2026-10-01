import { useState } from "react";
import { Bot, Send, X } from "lucide-react";
import { apiPost } from "@/features/api";
import { Button } from "./ui/button";

type Message = { role: "user" | "assistant"; text: string };
export default function FloatingAssistant() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", text: "I’ll answer from your saved academic records and study materials. What would you like to check?" }]);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    const text = question.trim();
    if (!text || busy) return;
    setMessages(current => [...current, { role: "user", text }]); setQuestion(""); setBusy(true);
    try {
      const result = await apiPost<{ answer: string; citations?: Array<{ fileName: string; pageNumber: number | null }> }>("/ai/chat", { question: text });
      const refs = result.citations?.length ? `\n\nSources: ${result.citations.map(c => `${c.fileName}, p. ${c.pageNumber ?? "?"}`).join("; ")}` : "";
      setMessages(current => [...current, { role: "assistant", text: `${result.answer}${refs}` }]);
    } catch (error) { setMessages(current => [...current, { role: "assistant", text: error instanceof Error ? error.message : "The assistant is unavailable right now." }]); }
    finally { setBusy(false); }
  };
  return <div className="floating-assistant">
    {open && <section className="floating-assistant-panel" aria-label="Academic assistant">
      <div className="floating-assistant-header"><div className="flex items-center gap-2"><span className="brand-mark brand-mark--small"><span>AMS</span></span><div><strong>Ask CRACKING AMS</strong><div className="small-meta">Grounded in your records</div></div></div><button className="icon-button" onClick={() => setOpen(false)} aria-label="Close assistant"><X size={16} /></button></div>
      <div className="chat-thread" style={{ maxHeight: 280, marginTop: 12 }}>{messages.slice(-8).map((message, index) => <div key={index} className={`chat-bubble chat-bubble--${message.role}`}>{message.text}</div>)}{busy && <div className="chat-bubble chat-bubble--assistant">Checking your records…</div>}</div>
      <div className="chat-composer"><textarea aria-label="Ask an academic question" placeholder="Ask about attendance, marks, or a document…" value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} /><Button size="icon" aria-label="Send question" disabled={!question.trim() || busy} onClick={() => void send()}><Send size={15} /></Button></div>
    </section>}
    <button className="floating-assistant-button" onClick={() => setOpen(value => !value)} aria-expanded={open}><Bot size={17} /> Ask AI</button>
  </div>;
}
