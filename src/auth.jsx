// ══════════════════════════════════════════════════════════════════════════════
// SIGN IN MODAL — Apple · Google · Microsoft
// Verschijnt automatisch bij eerste bezoek (na 3s), daarna op verzoek
// ══════════════════════════════════════════════════════════════════════════════
import { useState, useEffect } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
const FIRST_VISIT_KEY = "motorshop-visited";

// ── Auth hook — haal huidige gebruiker op ─────────────────────────────────────
export function useAuth() {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/auth/me`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setUser(d.user || null); })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Check URL params na OAuth redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth") === "success") {
      // Token zit in cookie — herlaad user
      fetch(`${API}/api/auth/me`, { credentials: "include" })
        .then(r => r.json())
        .then(d => setUser(d.user || null));
      // Verwijder params uit URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const logout = async () => {
    await fetch(`${API}/api/auth/logout`, { method: "POST", credentials: "include" });
    setUser(null);
  };

  return { user, loading, setUser, logout };
}

// ── Avatar component ──────────────────────────────────────────────────────────
export function UserAvatar({ user, onClick }) {
  if (!user) return null;
  const initials = (user.name || "?").split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase();

  return (
    <div onClick={onClick} style={{ display:"flex", alignItems:"center", gap:"8px", cursor:"pointer", padding:"5px 10px",
      background:"#0d0d0d", border:"1px solid #222", borderRadius:"3px", transition:"all 0.2s" }}
      onMouseEnter={e => e.currentTarget.style.borderColor="#ff6b00"}
      onMouseLeave={e => e.currentTarget.style.borderColor="#222"}>
      {user.avatar ? (
        <img src={user.avatar} alt={user.name} style={{ width:"26px", height:"26px", borderRadius:"50%", objectFit:"cover" }} />
      ) : (
        <div style={{ width:"26px", height:"26px", borderRadius:"50%", background:"#ff6b00",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:"10px", fontWeight:"900", color:"#000" }}>{initials}</div>
      )}
      <div>
        <div style={{ fontSize:"10px", fontWeight:"700", color:"#ccc", lineHeight:1 }}>
          {user.name?.split(" ")[0] || "Account"}
        </div>
        <div style={{ fontSize:"7px", color:"#444", letterSpacing:"1px" }}>PROFIEL</div>
      </div>
    </div>
  );
}

// ── Hoofd sign-in modal ───────────────────────────────────────────────────────
export function SignInModal({ onClose, onUser }) {
  const [providers, setProviders] = useState({ google: true, microsoft: true, apple: true });
  const [hovered,   setHovered]   = useState(null);

  useEffect(() => {
    fetch(`${API}/api/auth/providers`)
      .then(r => r.json())
      .then(d => { if (d.providers) setProviders(d.providers); })
      .catch(() => {});
  }, []);

  const login = (provider) => {
    // Sla huidige URL op zodat we terug kunnen na OAuth
    sessionStorage.setItem("auth_return", window.location.pathname);
    window.location.href = `${API}/api/auth/${provider}`;
  };

  const PROVIDERS = [
    {
      id:    "google",
      label: "Doorgaan met Google",
      icon:  <GoogleIcon />,
      bg:    "#fff",
      color: "#1f1f1f",
      border:"#e0e0e0",
      hoverBg: "#f8f8f8",
    },
    {
      id:    "microsoft",
      label: "Doorgaan met Microsoft",
      icon:  <MicrosoftIcon />,
      bg:    "#2f2f2f",
      color: "#fff",
      border:"#444",
      hoverBg: "#383838",
    },
    {
      id:    "apple",
      label: "Doorgaan met Apple",
      icon:  <AppleIcon />,
      bg:    "#000",
      color: "#fff",
      border:"#333",
      hoverBg: "#111",
    },
  ];

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:9000,
      background:"rgba(0,0,0,0.85)", backdropFilter:"blur(4px)",
      display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>

      <div onClick={e => e.stopPropagation()} style={{
        background:"#0d0d0d", border:"1px solid #222", borderRadius:"6px",
        width:"100%", maxWidth:"400px", overflow:"hidden",
        animation:"slideUp 0.25s ease",
      }}>
        <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style>

        {/* Header */}
        <div style={{ padding:"28px 28px 0", textAlign:"center", position:"relative" }}>
          <button onClick={onClose} style={{ position:"absolute", top:"16px", right:"16px",
            background:"none", border:"none", color:"#444", fontSize:"20px", cursor:"pointer",
            lineHeight:1, padding:"4px" }}>✕</button>

          <div style={{ width:"48px", height:"48px", background:"#ff6b00", borderRadius:"8px",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:"26px", margin:"0 auto 14px" }}>🏍</div>

          <div style={{ fontSize:"22px", fontWeight:"900", color:"#fff", letterSpacing:"1px" }}>
            Welkom bij Motor.shop
          </div>
          <div style={{ fontSize:"12px", color:"#555", marginTop:"6px", lineHeight:1.5 }}>
            Sla favorieten op, stel alerts in<br/>en ontvang koopjes direct in je inbox
          </div>
        </div>

        {/* Provider knoppen */}
        <div style={{ padding:"24px 28px", display:"grid", gap:"10px" }}>
          {PROVIDERS.map(p => !providers[p.id] ? null : (
            <button key={p.id} onClick={() => login(p.id)}
              onMouseEnter={() => setHovered(p.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                display:"flex", alignItems:"center", gap:"12px",
                padding:"13px 18px", borderRadius:"4px", cursor:"pointer",
                border:`1px solid ${p.border}`,
                background: hovered === p.id ? p.hoverBg : p.bg,
                color: p.color, width:"100%",
                fontSize:"14px", fontWeight:"600",
                transition:"all 0.15s", fontFamily:"inherit",
              }}>
              <span style={{ flexShrink:0, width:"20px", height:"20px", display:"flex", alignItems:"center" }}>{p.icon}</span>
              <span style={{ flex:1, textAlign:"center" }}>{p.label}</span>
            </button>
          ))}
        </div>

        {/* Benefits */}
        <div style={{ padding:"0 28px 24px", display:"grid", gap:"8px" }}>
          {[
            { icon:"❤️", text:"Bewaar favorieten" },
            { icon:"🔔", text:"Prijsalerts per model of merk" },
            { icon:"📍", text:"Koopjes in jouw regio" },
          ].map(b => (
            <div key={b.text} style={{ display:"flex", alignItems:"center", gap:"10px" }}>
              <span style={{ fontSize:"14px" }}>{b.icon}</span>
              <span style={{ fontSize:"12px", color:"#444" }}>{b.text}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding:"14px 28px", borderTop:"1px solid #111",
          fontSize:"10px", color:"#2a2a2a", textAlign:"center", lineHeight:1.6 }}>
          Door in te loggen ga je akkoord met onze voorwaarden.<br/>
          We verkopen nooit je gegevens.
        </div>
      </div>
    </div>
  );
}

// ── User menu (na inloggen) ───────────────────────────────────────────────────
export function UserMenu({ user, onLogout, onClose, onAlerts }) {
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:8000 }}>
      <div onClick={e => e.stopPropagation()} style={{
        position:"fixed", top:"68px", right:"20px", width:"220px",
        background:"#0d0d0d", border:"1px solid #222", borderRadius:"4px",
        overflow:"hidden", zIndex:8001,
        animation:"slideDown 0.15s ease",
      }}>
        <style>{`@keyframes slideDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}`}</style>

        {/* User info */}
        <div style={{ padding:"14px 16px", borderBottom:"1px solid #1a1a1a" }}>
          <div style={{ fontSize:"13px", fontWeight:"700", color:"#fff" }}>{user.name}</div>
          <div style={{ fontSize:"10px", color:"#444", marginTop:"2px" }}>{user.email}</div>
        </div>

        {/* Menu items */}
        {[
          { label:"❤️  Mijn favorieten", action:"favorites" },
          { label:"🔔  Mijn alerts",     action:"alerts",    onClick: onAlerts },
          { label:"👤  Profiel",          action:"profile" },
        ].map(item => (
          <div key={item.action} style={{ padding:"11px 16px", fontSize:"12px", color:"#888",
            cursor:"pointer", transition:"all 0.15s", borderBottom:"1px solid #111" }}
            onMouseEnter={e => { e.currentTarget.style.background="#111"; e.currentTarget.style.color="#fff"; }}
            onMouseLeave={e => { e.currentTarget.style.background="none"; e.currentTarget.style.color="#888"; }}>
            {item.label}
          </div>
        ))}

        <div onClick={onLogout} style={{ padding:"11px 16px", fontSize:"12px", color:"#f44336",
          cursor:"pointer", transition:"all 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.background="#1a0000"}
          onMouseLeave={e => e.currentTarget.style.background="none"}>
          ⎋  Uitloggen
        </div>
      </div>
    </div>
  );
}

// ── First visit trigger — toont modal na 3s als niet ingelogd ─────────────────
export function useFirstVisitModal(user, loading) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (user) return; // al ingelogd
    if (sessionStorage.getItem(FIRST_VISIT_KEY)) return; // al gezien deze sessie

    const t = setTimeout(() => {
      setShow(true);
      sessionStorage.setItem(FIRST_VISIT_KEY, "1");
    }, 3000);

    return () => clearTimeout(t);
  }, [user, loading]);

  return [show, setShow];
}

// ── SVG icons ─────────────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20">
      <path d="M11.4 2H2v9.4h9.4V2z" fill="#F25022"/>
      <path d="M22 2h-9.4v9.4H22V2z" fill="#7FBA00"/>
      <path d="M11.4 12.6H2V22h9.4v-9.4z" fill="#00A4EF"/>
      <path d="M22 12.6h-9.4V22H22v-9.4z" fill="#FFB900"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  );
}
