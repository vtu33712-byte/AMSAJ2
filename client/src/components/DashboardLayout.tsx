import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import FloatingAssistant from "@/components/FloatingAssistant";
import { useTheme } from "@/contexts/ThemeContext";
import { Activity, BookOpen, CalendarDays, GraduationCap, LayoutDashboard, LogOut, Moon, Settings2, Sparkles, Sun } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "./ui/button";

const links = [
  { label: "Overview", href: "/", icon: LayoutDashboard, mobile: true },
  { label: "Attendance", href: "/attendance", icon: Activity, mobile: true },
  { label: "Study studio", href: "/study", icon: BookOpen, mobile: true },
  { label: "AI assistant", href: "/assistant", icon: Sparkles, mobile: true },
  { label: "Settings & imports", href: "/settings", icon: Settings2, mobile: false },
];
const pageTitles: Record<string, string> = {
  "/": "Academic overview", "/attendance": "Attendance intelligence", "/study": "Study studio", "/assistant": "Academic assistant", "/settings": "Profile & data sources",
};

function BrandMark({ small = false }: { small?: boolean }) {
  return <span className={`brand-mark ${small ? "brand-mark--small" : ""}`} aria-hidden="true"><span>AMS</span></span>;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user, logout, login } = useAuth();
  const [location, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();
  if (loading) return <div className="loading-shell"><div className="loading-orbit" /><p>Preparing your private workspace…</p></div>;
  if (!user) return (
    <main className="signin-screen">
      <div className="signin-card">
        <BrandMark />
        <div className="eyebrow">CRACKING AMS</div>
        <h1>Your records,<br /><em>in clear view.</em></h1>
        <p>Sign in to open your private academic workspace. Imported records stay tied to your account.</p>
        <Button className="signin-button" size="lg" onClick={() => login()}>Continue securely <span aria-hidden="true">→</span></Button>
        <div className="signin-note"><span className="status-dot" /> Independent application · No university portal credentials requested</div>
      </div>
    </main>
  );

  const desktopLinks = links;
  const mobileLinks = links.filter(link => link.mobile);
  return (
    <div className="app-frame">
      <aside className="desktop-rail">
        <button className="brand-lockup" onClick={() => setLocation("/")} aria-label="CRACKING AMS home">
          <BrandMark /><span><strong>CRACKING AMS</strong><small>ACADEMIC INTELLIGENCE</small></span>
        </button>
        <div className="rail-label">WORKSPACE</div>
        <nav className="rail-nav" aria-label="Main navigation">
          {desktopLinks.map(link => {
            const active = location === link.href;
            return <button key={link.href} className={`rail-link ${active ? "is-active" : ""}`} onClick={() => setLocation(link.href)} aria-current={active ? "page" : undefined}>
              <link.icon size={18} strokeWidth={1.8} /><span>{link.label}</span>{active && <i />}
            </button>;
          })}
        </nav>
        <div className="rail-bottom">
          <div className="rail-footnote"><div className="rail-footnote-icon"><GraduationCap size={18} /></div><p><strong>Your data, your signal.</strong><span>Insights are calculated from records you provide.</span></p></div>
          <div className="account-row">
            <div className="account-avatar">{user.name?.slice(0, 1).toUpperCase() ?? "S"}</div>
            <div className="account-copy"><strong>{user.name ?? "Student"}</strong><span>Private workspace</span></div>
            <button className="icon-button logout-button" onClick={() => void logout()} aria-label="Sign out" title="Sign out"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>
      <div className="app-column">
        <header className="topbar">
          <div className="mobile-brand"><BrandMark small /><strong>CRACKING AMS</strong></div>
          <div className="topbar-title"><span className="eyebrow">YOUR ACADEMIC COMMAND CENTER</span><h2>{pageTitles[location] ?? "Academic workspace"}</h2></div>
          <div className="topbar-actions">
            <span className="private-pill"><i /> PRIVATE</span>
            <button className="icon-button theme-toggle" onClick={toggleTheme} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button>
            <button className="user-chip" onClick={() => setLocation("/settings")} aria-label="Open profile and settings"><span className="account-avatar account-avatar--small">{user.name?.slice(0, 1).toUpperCase() ?? "S"}</span><span className="user-chip-name">{user.name ?? "Profile"}</span></button>
          </div>
        </header>
        <main className="page-main">{children}</main>
        <footer className="page-footer"><span><BrandMark small /> CRACKING AMS</span><span>Only your imported and authorized records power these insights.</span></footer>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {mobileLinks.map(link => {
          const active = location === link.href;
          return <button key={link.href} onClick={() => setLocation(link.href)} className={active ? "is-active" : ""} aria-current={active ? "page" : undefined}><link.icon size={19} /><span>{link.label === "Study studio" ? "Study" : link.label === "AI assistant" ? "AI" : link.label === "Overview" ? "Home" : link.label}</span></button>;
        })}
        <button onClick={() => setLocation("/settings")} className={location === "/settings" ? "is-active" : ""}><CalendarDays size={19} /><span>Profile</span></button>
      </nav>
      <FloatingAssistant />
    </div>
  );
}
