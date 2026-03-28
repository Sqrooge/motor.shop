// ══════════════════════════════════════════════════════════════════════════════
// ADMIN PANEL — alleen zichtbaar voor m_s_d_bron@hotmail.com
// ══════════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useRef } from "react";
import { useSettings, resetSettings, DEFAULTS } from "./settings.js";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
const PLATFORMS = ["Marktplaats","2dehands","AutoScout24","eBay Motors","Facebook Marketplace","Motortreffer"];

// ══════════════════════════════════════════════════════════════════════════════
// SETTINGS UI HELPERS
// ══════════════════════════════════════════════════════════════════════════════
function SettingsSection({ title, children }) {
  return (
    <div style={{ background:"#111", border:"1px solid #1a1a1a", borderRadius:"3px", overflow:"hidden" }}>
      <div style={{ padding:"10px 16px", borderBottom:"1px solid #1a1a1a",
        fontSize:"9px", color:"#ff6b00", letterSpacing:"3px" }}>{title}</div>
      <div style={{ display:"grid" }}>{children}</div>
    </div>
  );
}

function SettingToggle({ label, desc, value, onChange, badge, badgeColor }) {
  return (
    <div style={{ padding:"14px 16px", borderBottom:"1px solid #0f0f0f",
      display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"20px" }}>
      <div style={{ flex:1 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"3px" }}>
          <div style={{ fontSize:"13px", color:"#ccc", fontWeight:"600" }}>{label}</div>
          {badge && (
            <span style={{ fontSize:"8px", fontWeight:"800", letterSpacing:"1px",
              color:badgeColor, background:`${badgeColor}18`,
              border:`1px solid ${badgeColor}44`, padding:"1px 6px", borderRadius:"2px" }}>
              {badge}
            </span>
          )}
        </div>
        <div style={{ fontSize:"11px", color:"#444", lineHeight:1.5 }}>{desc}</div>
      </div>
      {/* Toggle switch */}
      <div onClick={() => onChange(!value)} style={{ flexShrink:0, marginTop:"2px",
        width:"42px", height:"22px", borderRadius:"11px", cursor:"pointer",
        background: value ? "#ff6b0033" : "#111",
        border:`1px solid ${value ? "#ff6b00" : "#2a2a2a"}`,
        position:"relative", transition:"all 0.25s" }}>
        <div style={{ position:"absolute", top:"3px",
          left: value ? "21px" : "3px", width:"14px", height:"14px",
          borderRadius:"50%", background: value ? "#ff6b00" : "#333",
          transition:"left 0.25s, background 0.25s",
          boxShadow: value ? "0 0 8px rgba(255,107,0,0.5)" : "none" }}/>
      </div>
    </div>
  );
}

function SettingSelect({ label, desc, value, onChange, options }) {
  return (
    <div style={{ padding:"14px 16px", borderBottom:"1px solid #0f0f0f",
      display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"20px" }}>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:"13px", color:"#ccc", fontWeight:"600", marginBottom:"3px" }}>{label}</div>
        <div style={{ fontSize:"11px", color:"#444", lineHeight:1.5 }}>{desc}</div>
      </div>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ flexShrink:0, background:"#0d0d0d", color:"#fff",
          border:"1px solid #222", borderRadius:"3px", padding:"6px 10px",
          fontSize:"12px", outline:"none", fontFamily:"inherit", cursor:"pointer" }}>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function useAdminData(endpoint, deps = []) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = () => {
    setLoading(true);
    fetch(`${API}/api/admin/${endpoint}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setData(d); setError(null); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, deps);
  return { data, loading, error, reload: load };
}

// ── Stat tile ─────────────────────────────────────────────────────────────────
function StatTile({ label, value, sub, color = "#ff6b00", onClick }) {
  return (
    <div onClick={onClick} style={{ background:"#111", border:"1px solid #1a1a1a", padding:"14px 16px",
      cursor: onClick ? "pointer" : "default", transition:"border-color 0.2s",
      borderRadius:"3px" }}
      onMouseEnter={e => { if(onClick) e.currentTarget.style.borderColor=color; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor="#1a1a1a"; }}>
      <div style={{ fontSize:"8px", color:"#333", letterSpacing:"2px" }}>{label}</div>
      <div style={{ fontSize:"26px", fontWeight:"900", color, lineHeight:1, marginTop:"4px" }}>{value ?? "—"}</div>
      {sub && <div style={{ fontSize:"10px", color:"#444", marginTop:"4px" }}>{sub}</div>}
    </div>
  );
}

// ── Platform status tabel ─────────────────────────────────────────────────────
function PlatformTable({ platforms }) {
  if (!platforms?.length) return <div style={{ color:"#333", fontSize:"11px", padding:"12px" }}>Geen data</div>;
  return (
    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"11px" }}>
      <thead>
        <tr style={{ borderBottom:"1px solid #1a1a1a" }}>
          {["Platform","Laatste scan","Listings","Status","Snelheid","Fouten op rij"].map(h => (
            <th key={h} style={{ padding:"8px 10px", textAlign:"left", fontSize:"8px", color:"#333", letterSpacing:"2px" }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {platforms.map(p => (
          <tr key={p.platform} style={{ borderBottom:"1px solid #0f0f0f" }}>
            <td style={{ padding:"9px 10px", color:"#ccc", fontWeight:"600" }}>{p.platform}</td>
            <td style={{ padding:"9px 10px", color:"#555", fontFamily:"monospace", fontSize:"10px" }}>
              {p.last_scan ? new Date(p.last_scan).toLocaleString("nl-NL",{hour:"2-digit",minute:"2-digit"}) : "—"}
            </td>
            <td style={{ padding:"9px 10px", color:"#ff6b00", fontFamily:"monospace" }}>{p.last_count ?? 0}</td>
            <td style={{ padding:"9px 10px" }}>
              <span style={{ padding:"2px 8px", borderRadius:"2px", fontSize:"9px", fontWeight:"700", letterSpacing:"1px",
                background: p.success ? "#001508" : "#1a0000",
                color:      p.success ? "#69f0ae" : "#f44336",
                border:`1px solid ${p.success ? "#69f0ae33" : "#f4433633"}` }}>
                {p.success ? "OK" : "FOUT"}
              </span>
            </td>
            <td style={{ padding:"9px 10px", color:"#555", fontFamily:"monospace" }}>
              {p.avg_ms ? `${(p.avg_ms/1000).toFixed(1)}s` : "—"}
            </td>
            <td style={{ padding:"9px 10px", color: p.fail_streak > 0 ? "#ffa726" : "#2a2a2a", fontFamily:"monospace" }}>
              {p.fail_streak || 0}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Scrape runs tabel ─────────────────────────────────────────────────────────
function RunsTable({ runs }) {
  if (!runs?.length) return <div style={{ color:"#333", fontSize:"11px", padding:"12px" }}>Geen runs</div>;
  return (
    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"11px" }}>
      <thead>
        <tr style={{ borderBottom:"1px solid #1a1a1a" }}>
          {["Gestart","Status","Gevonden","Nieuw","Bijgewerkt","Dubbel","Duur"].map(h => (
            <th key={h} style={{ padding:"8px 10px", textAlign:"left", fontSize:"8px", color:"#333", letterSpacing:"2px" }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {runs.map(r => {
          const dur = r.finished_at && r.started_at
            ? Math.round((new Date(r.finished_at) - new Date(r.started_at)) / 1000)
            : null;
          return (
            <tr key={r.id} style={{ borderBottom:"1px solid #0f0f0f" }}>
              <td style={{ padding:"8px 10px", color:"#888", fontFamily:"monospace", fontSize:"10px" }}>
                {new Date(r.started_at).toLocaleString("nl-NL",{hour:"2-digit",minute:"2-digit",day:"numeric",month:"short"})}
              </td>
              <td style={{ padding:"8px 10px" }}>
                <span style={{ padding:"2px 8px", fontSize:"9px", fontWeight:"700", letterSpacing:"1px",
                  color: r.status==="done"?"#69f0ae":r.status==="running"?"#ff6b00":"#f44336",
                  background: r.status==="done"?"#001508":r.status==="running"?"#1a0b00":"#1a0000",
                  border:`1px solid ${r.status==="done"?"#69f0ae33":r.status==="running"?"#ff6b0033":"#f4433633"}` }}>
                  {r.status?.toUpperCase()}
                </span>
              </td>
              <td style={{ padding:"8px 10px", color:"#ff6b00", fontFamily:"monospace" }}>{r.found}</td>
              <td style={{ padding:"8px 10px", color:"#69f0ae", fontFamily:"monospace" }}>{r.new_items}</td>
              <td style={{ padding:"8px 10px", color:"#60a5fa", fontFamily:"monospace" }}>{r.updated}</td>
              <td style={{ padding:"8px 10px", color:"#555",    fontFamily:"monospace" }}>{r.duplicates}</td>
              <td style={{ padding:"8px 10px", color:"#555",    fontFamily:"monospace" }}>{dur ? `${dur}s` : "—"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ── Gebruikers tabel ──────────────────────────────────────────────────────────
function UsersTable({ users }) {
  if (!users?.length) return <div style={{ color:"#333", fontSize:"11px", padding:"12px" }}>Geen gebruikers</div>;
  const PROVIDER_COLOR = { google:"#4285F4", microsoft:"#7FBA00", apple:"#fff" };
  return (
    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"11px" }}>
      <thead>
        <tr style={{ borderBottom:"1px solid #1a1a1a" }}>
          {["Naam","Email","Provider","Aangemeld","Laatste login"].map(h => (
            <th key={h} style={{ padding:"8px 10px", textAlign:"left", fontSize:"8px", color:"#333", letterSpacing:"2px" }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {users.map(u => (
          <tr key={u.id} style={{ borderBottom:"1px solid #0f0f0f" }}>
            <td style={{ padding:"8px 10px", color:"#ccc", fontWeight:"600" }}>{u.name || "—"}</td>
            <td style={{ padding:"8px 10px", color:"#777" }}>{u.email || "—"}</td>
            <td style={{ padding:"8px 10px" }}>
              <span style={{ fontSize:"9px", fontWeight:"700", letterSpacing:"1px",
                color: PROVIDER_COLOR[u.provider] || "#888" }}>
                {u.provider?.toUpperCase()}
              </span>
            </td>
            <td style={{ padding:"8px 10px", color:"#444", fontFamily:"monospace", fontSize:"10px" }}>
              {new Date(u.created_at).toLocaleDateString("nl-NL")}
            </td>
            <td style={{ padding:"8px 10px", color:"#444", fontFamily:"monospace", fontSize:"10px" }}>
              {new Date(u.last_login).toLocaleString("nl-NL",{hour:"2-digit",minute:"2-digit",day:"numeric",month:"short"})}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Hoofd admin panel ─────────────────────────────────────────────────────────
export function AdminPanel({ user, onClose }) {
  const [tab, setTab]             = useState("dashboard");
  const [scraping, setScraping]   = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState(null);
  const [selPlatforms, setSelPlatforms] = useState([]);

  const { data: stats,     reload: reloadStats }    = useAdminData("stats");
  const { data: platData,  reload: reloadPlat  }    = useAdminData("platforms");
  const { data: runsData,  reload: reloadRuns  }    = useAdminData("runs");
  const { data: usersData, reload: reloadUsers }    = useAdminData("users");
  const { data: alertsData }                        = useAdminData("alerts");
  const [emailTestResult, setEmailTestResult] = useState(null);
  const [alertTrigResult, setAlertTrigResult] = useState(null);
  const { settings, setSetting } = useSettings();

  const testEmail = async () => {
    const r = await fetch(\`\${API}/api/admin/email/test\`, {
      method:"POST", credentials:"include",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ to: user?.email }),
    });
    const d = await r.json();
    setEmailTestResult(d.ok ? \`✅ Verstuurd naar \${d.to}\` : \`❌ \${d.error}\`);
  };

  const triggerAlerts = async () => {
    const r = await fetch(\`\${API}/api/admin/alerts/trigger\`, {
      method:"POST", credentials:"include",
    });
    const d = await r.json();
    setAlertTrigResult(d.ok ? \`✅ \${d.message}\` : \`❌ \${d.error}\`);
  };

  const TABS = [
    { id:"dashboard", label:"📊 Dashboard" },
    { id:"platforms", label:"🔌 Platforms" },
    { id:"runs",      label:"⏱ Runs" },
    { id:"users",     label:"👤 Gebruikers" },
    { id:"alerts",      label:"🔔 Alerts" },
    { id:"settings",    label:"⚙️  Instellingen" },
  ];

  const triggerScrape = async (platforms = null) => {
    setScraping(true); setScrapeMsg(null);
    try {
      const r = await fetch(`${API}/api/admin/scrape`, {
        method:"POST", credentials:"include",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ platforms: platforms?.length ? platforms : null }),
      });
      const d = await r.json();
      setScrapeMsg(d.ok ? `✅ Gestart (${d.runId})` : `❌ ${d.error}`);
      setTimeout(() => { reloadRuns(); reloadPlat(); reloadStats(); }, 2000);
    } catch (e) {
      setScrapeMsg(`❌ ${e.message}`);
    } finally {
      setScraping(false);
    }
  };

  const togglePlatform = (p) => setSelPlatforms(prev =>
    prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
  );

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.96)", zIndex:9500,
      display:"flex", flexDirection:"column", fontFamily:"'Barlow Condensed','Arial Narrow',Arial,sans-serif" }}>

      {/* Header */}
      <div style={{ background:"#0a0a0a", borderBottom:"2px solid #ff6b00", padding:"0 24px",
        display:"flex", alignItems:"center", justifyContent:"space-between", height:"56px", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
          <div style={{ width:"32px", height:"32px", background:"#ff6b00", display:"flex", alignItems:"center",
            justifyContent:"center", fontSize:"18px" }}>🏍</div>
          <div>
            <div style={{ fontSize:"18px", fontWeight:"900", color:"#fff", letterSpacing:"2px", lineHeight:1 }}>
              MOTOR<span style={{ color:"#ff6b00" }}>.SHOP</span>
              <span style={{ fontSize:"10px", color:"#ff6b00", letterSpacing:"3px", marginLeft:"10px" }}>ADMIN</span>
            </div>
            <div style={{ fontSize:"8px", color:"#333", letterSpacing:"2px" }}>
              {user?.email} · {user?.name}
            </div>
          </div>
        </div>
        <button onClick={onClose} style={{ background:"none", border:"1px solid #222", color:"#555",
          fontSize:"18px", cursor:"pointer", padding:"4px 10px", letterSpacing:"1px" }}>
          ← TERUG
        </button>
      </div>

      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

        {/* Sidebar */}
        <div style={{ width:"200px", background:"#080808", borderRight:"1px solid #111",
          padding:"16px 0", flexShrink:0 }}>
          {TABS.map(t => (
            <div key={t.id} onClick={() => setTab(t.id)}
              style={{ padding:"11px 20px", fontSize:"12px", fontWeight: tab===t.id ? "800":"400",
                color: tab===t.id ? "#ff6b00" : "#444", cursor:"pointer",
                background: tab===t.id ? "#0f0f0f" : "none",
                borderLeft:`3px solid ${tab===t.id ? "#ff6b00" : "transparent"}`,
                letterSpacing:"1px", transition:"all 0.15s" }}>
              {t.label}
            </div>
          ))}

          {/* Scrape controls in sidebar */}
          <div style={{ margin:"20px 12px 0", padding:"12px", background:"#0d0d0d",
            border:"1px solid #1a1a1a", borderRadius:"3px" }}>
            <div style={{ fontSize:"8px", color:"#333", letterSpacing:"2px", marginBottom:"8px" }}>SCRAPE</div>
            <button onClick={() => triggerScrape(selPlatforms)} disabled={scraping}
              style={{ width:"100%", background: scraping ? "#111" : "#ff6b00",
                color: scraping ? "#333" : "#000", border:"none", padding:"9px",
                fontSize:"11px", fontWeight:"900", letterSpacing:"2px", cursor: scraping ? "default" : "pointer",
                fontFamily:"inherit", borderRadius:"2px", marginBottom:"6px" }}>
              {scraping ? "⟳ BEZIG..." : "⚡ START SCAN"}
            </button>
            {scrapeMsg && <div style={{ fontSize:"10px", color: scrapeMsg.startsWith("✅") ? "#69f0ae":"#f44336",
              marginTop:"4px", wordBreak:"break-all" }}>{scrapeMsg}</div>}
            <div style={{ marginTop:"8px" }}>
              <div style={{ fontSize:"8px", color:"#2a2a2a", letterSpacing:"1px", marginBottom:"4px" }}>PLATFORMS</div>
              {PLATFORMS.map(p => (
                <div key={p} onClick={() => togglePlatform(p)}
                  style={{ display:"flex", alignItems:"center", gap:"6px", padding:"3px 0",
                    cursor:"pointer", fontSize:"10px",
                    color: selPlatforms.includes(p) ? "#ff6b00" : "#333" }}>
                  <div style={{ width:"8px", height:"8px", borderRadius:"1px",
                    background: selPlatforms.includes(p) ? "#ff6b00" : "#1a1a1a",
                    border:`1px solid ${selPlatforms.includes(p) ? "#ff6b00" : "#333"}` }}/>
                  {p.split(" ")[0]}
                </div>
              ))}
              {selPlatforms.length > 0 && (
                <div onClick={() => setSelPlatforms([])} style={{ fontSize:"9px", color:"#444",
                  cursor:"pointer", marginTop:"4px" }}>wis selectie</div>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex:1, overflowY:"auto", padding:"20px 24px" }}>

          {/* ── DASHBOARD ─────────────────────────────────────────────────── */}
          {tab === "dashboard" && stats && (
            <div style={{ display:"grid", gap:"16px" }}>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:"10px" }}>
                <StatTile label="ACTIEVE LISTINGS"  value={stats.listings?.total}     color="#ff6b00" />
                <StatTile label="GEBRUIKERS"         value={stats.users?.total}        color="#69f0ae" />
                <StatTile label="ACTIEVE ALERTS"     value={stats.alerts?.total}       color="#60a5fa" />
                <StatTile label="GEOCODE CACHE"      value={stats.geocache?.total}     color="#a78bfa" />
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:"10px" }}>
                <StatTile label="NIEUWE GEBRUIKERS (7D)"  value={stats.users?.recent}  color="#69f0ae" />
                <StatTile label="FAVORIETEN TOTAAL"        value={stats.favorites?.total} color="#fb923c" />
                <StatTile label="SCRAPE ACTIEF"   value={stats.scrapeActive ? "JA":"NEE"} color={stats.scrapeActive?"#f44336":"#333"} />
                <StatTile label="PLATFORMS"        value={stats.listings?.platforms?.length ?? "—"} color="#ff6b00" />
              </div>

              {/* Per bron */}
              <div style={{ background:"#111", border:"1px solid #1a1a1a", borderRadius:"3px" }}>
                <div style={{ padding:"10px 14px", borderBottom:"1px solid #1a1a1a",
                  fontSize:"9px", color:"#ff6b00", letterSpacing:"3px" }}>LISTINGS PER BRON</div>
                <div style={{ padding:"12px 14px", display:"flex", gap:"8px", flexWrap:"wrap" }}>
                  {stats.listings?.bySource?.map(s => (
                    <div key={s.source} style={{ background:"#0d0d0d", border:"1px solid #1a1a1a",
                      padding:"6px 12px", borderRadius:"2px" }}>
                      <div style={{ fontSize:"10px", color:"#888" }}>{s.source}</div>
                      <div style={{ fontSize:"18px", fontWeight:"900", color:"#ff6b00" }}>{s.n}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top merken */}
              <div style={{ background:"#111", border:"1px solid #1a1a1a", borderRadius:"3px" }}>
                <div style={{ padding:"10px 14px", borderBottom:"1px solid #1a1a1a",
                  fontSize:"9px", color:"#ff6b00", letterSpacing:"3px" }}>TOP MERKEN</div>
                <div style={{ padding:"12px 14px", display:"grid", gap:"6px" }}>
                  {stats.listings?.byBrand?.map((b, i) => {
                    const max = stats.listings.byBrand[0]?.n || 1;
                    return (
                      <div key={b.brand} style={{ display:"grid", gridTemplateColumns:"20px 120px 1fr 40px", gap:"8px", alignItems:"center" }}>
                        <span style={{ fontSize:"9px", color:"#333", fontFamily:"monospace" }}>{i+1}</span>
                        <span style={{ fontSize:"12px", color:"#ccc" }}>{b.brand}</span>
                        <div style={{ height:"6px", background:"#0d0d0d", borderRadius:"3px" }}>
                          <div style={{ height:"100%", width:`${(b.n/max)*100}%`, background:"#ff6b00", borderRadius:"3px" }}/>
                        </div>
                        <span style={{ fontSize:"11px", color:"#ff6b00", fontFamily:"monospace", textAlign:"right" }}>{b.n}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Email & Alert tools */}
          <div style={{ background:"#111", border:"1px solid #1a1a1a", borderRadius:"3px", padding:"14px 16px" }}>
            <div style={{ fontSize:"9px", color:"#ff6b00", letterSpacing:"3px", marginBottom:"12px" }}>EMAIL & ALERTS</div>
            <div style={{ display:"flex", gap:"10px", flexWrap:"wrap" }}>
              <div>
                <button onClick={testEmail}
                  style={{ background:"#0d0d0d", border:"1px solid #222", color:"#888",
                    padding:"8px 16px", fontSize:"11px", cursor:"pointer", fontFamily:"inherit",
                    letterSpacing:"1px", borderRadius:"2px" }}>
                  📧 Test email versturen
                </button>
                {emailTestResult && <div style={{ fontSize:"10px", color: emailTestResult.startsWith("✅")?"#69f0ae":"#f44336", marginTop:"6px" }}>{emailTestResult}</div>}
              </div>
              <div>
                <button onClick={triggerAlerts}
                  style={{ background:"#0d0d0d", border:"1px solid #222", color:"#888",
                    padding:"8px 16px", fontSize:"11px", cursor:"pointer", fontFamily:"inherit",
                    letterSpacing:"1px", borderRadius:"2px" }}>
                  🔔 Alert engine handmatig starten
                </button>
                {alertTrigResult && <div style={{ fontSize:"10px", color: alertTrigResult.startsWith("✅")?"#69f0ae":"#f44336", marginTop:"6px" }}>{alertTrigResult}</div>}
              </div>
            </div>
          </div>

          {/* Gebruikers per provider */}
              <div style={{ background:"#111", border:"1px solid #1a1a1a", borderRadius:"3px" }}>
                <div style={{ padding:"10px 14px", borderBottom:"1px solid #1a1a1a",
                  fontSize:"9px", color:"#ff6b00", letterSpacing:"3px" }}>GEBRUIKERS PER PROVIDER</div>
                <div style={{ padding:"12px 14px", display:"flex", gap:"10px" }}>
                  {stats.users?.byProvider?.map(p => {
                    const cols = { google:"#4285F4", microsoft:"#7FBA00", apple:"#fff" };
                    return (
                      <div key={p.provider} style={{ background:"#0d0d0d", border:`1px solid ${cols[p.provider] || "#333"}33`,
                        padding:"8px 14px", borderRadius:"2px" }}>
                        <div style={{ fontSize:"9px", color: cols[p.provider] || "#888", fontWeight:"700", letterSpacing:"1px" }}>
                          {p.provider?.toUpperCase()}
                        </div>
                        <div style={{ fontSize:"22px", fontWeight:"900", color: cols[p.provider] || "#888" }}>{p.n}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── PLATFORMS ─────────────────────────────────────────────────── */}
          {tab === "platforms" && (
            <div style={{ display:"grid", gap:"14px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ fontSize:"14px", fontWeight:"800", color:"#fff", letterSpacing:"2px" }}>PLATFORM STATUS</div>
                <button onClick={reloadPlat} style={{ background:"none", border:"1px solid #222", color:"#555",
                  padding:"5px 12px", fontSize:"10px", cursor:"pointer", fontFamily:"inherit", letterSpacing:"1px" }}>
                  ↻ VERNIEUWEN
                </button>
              </div>
              <div style={{ background:"#111", border:"1px solid #1a1a1a", borderRadius:"3px", overflow:"hidden" }}>
                <PlatformTable platforms={platData?.platforms} />
              </div>
            </div>
          )}

          {/* ── RUNS ──────────────────────────────────────────────────────── */}
          {tab === "runs" && (
            <div style={{ display:"grid", gap:"14px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ fontSize:"14px", fontWeight:"800", color:"#fff", letterSpacing:"2px" }}>SCRAPE RUNS</div>
                <button onClick={reloadRuns} style={{ background:"none", border:"1px solid #222", color:"#555",
                  padding:"5px 12px", fontSize:"10px", cursor:"pointer", fontFamily:"inherit", letterSpacing:"1px" }}>
                  ↻ VERNIEUWEN
                </button>
              </div>
              <div style={{ background:"#111", border:"1px solid #1a1a1a", borderRadius:"3px", overflow:"hidden" }}>
                <RunsTable runs={runsData?.runs} />
              </div>
            </div>
          )}

          {/* ── GEBRUIKERS ────────────────────────────────────────────────── */}
          {tab === "users" && (
            <div style={{ display:"grid", gap:"14px" }}>
              <div style={{ fontSize:"14px", fontWeight:"800", color:"#fff", letterSpacing:"2px" }}>
                GEBRUIKERS <span style={{ color:"#333" }}>({usersData?.users?.length ?? 0})</span>
              </div>
              <div style={{ background:"#111", border:"1px solid #1a1a1a", borderRadius:"3px", overflow:"hidden" }}>
                <UsersTable users={usersData?.users} />
              </div>
            </div>
          )}

          {/* ── ALERTS ────────────────────────────────────────────────────── */}
          {tab === "alerts" && (
            <div style={{ display:"grid", gap:"14px" }}>
              <div style={{ fontSize:"14px", fontWeight:"800", color:"#fff", letterSpacing:"2px" }}>
                ACTIEVE ALERTS <span style={{ color:"#333" }}>({alertsData?.alerts?.length ?? 0})</span>
              </div>
              <div style={{ background:"#111", border:"1px solid #1a1a1a", borderRadius:"3px", overflow:"auto" }}>
                {!alertsData?.alerts?.length
                  ? <div style={{ padding:"20px", color:"#333", fontSize:"11px" }}>Geen actieve alerts</div>
                  : (
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"11px" }}>
                    <thead>
                      <tr style={{ borderBottom:"1px solid #1a1a1a" }}>
                        {["Gebruiker","Merk","Type","Max prijs","Max km","Max afstand","Zoekterm","Aangemaakt"].map(h => (
                          <th key={h} style={{ padding:"8px 10px", textAlign:"left", fontSize:"8px", color:"#333", letterSpacing:"2px", whiteSpace:"nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {alertsData.alerts.map(a => (
                        <tr key={a.id} style={{ borderBottom:"1px solid #0f0f0f" }}>
                          <td style={{ padding:"8px 10px", color:"#888" }}>{a.user_name || a.user_email || "—"}</td>
                          <td style={{ padding:"8px 10px", color:"#ccc" }}>{a.brand || "Alle"}</td>
                          <td style={{ padding:"8px 10px", color:"#ccc" }}>{a.type  || "Alle"}</td>
                          <td style={{ padding:"8px 10px", color:"#ff6b00", fontFamily:"monospace" }}>{a.max_price ? `€${a.max_price.toLocaleString("nl-NL")}` : "—"}</td>
                          <td style={{ padding:"8px 10px", color:"#555", fontFamily:"monospace" }}>{a.max_km ? `${a.max_km.toLocaleString("nl-NL")} km` : "—"}</td>
                          <td style={{ padding:"8px 10px", color:"#555", fontFamily:"monospace" }}>{a.max_dist_km ? `${a.max_dist_km} km` : "—"}</td>
                          <td style={{ padding:"8px 10px", color:"#555" }}>{a.query || "—"}</td>
                          <td style={{ padding:"8px 10px", color:"#444", fontFamily:"monospace", fontSize:"10px" }}>
                            {new Date(a.created_at).toLocaleDateString("nl-NL")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ── INSTELLINGEN ──────────────────────────────────────────── */}
          {tab === "settings" && (
            <div style={{ display:"grid", gap:"16px" }}>
              <div style={{ fontSize:"14px", fontWeight:"900", color:"#fff", letterSpacing:"2px" }}>
                INSTELLINGEN
              </div>

              {/* Prijshistoriek */}
              <SettingsSection title="PRIJSHISTORIEK GRAFIEK">
                <SettingToggle
                  label="Mock data gebruiken"
                  desc="Aan: gesimuleerde prijsdata tonen. Uit: echte API data ophalen (vereist live backend)."
                  value={settings.useMockPriceHistory}
                  onChange={v => setSetting("useMockPriceHistory", v)}
                  badge={settings.useMockPriceHistory ? "MOCK" : "LIVE"}
                  badgeColor={settings.useMockPriceHistory ? "#ffa726" : "#69f0ae"}
                />
                <SettingToggle
                  label="Grafiek tonen in detail modal"
                  desc="Verberg de prijshistoriek grafiek volledig."
                  value={settings.showPriceChart}
                  onChange={v => setSetting("showPriceChart", v)}
                />
              </SettingsSection>

              {/* Data bronnen */}
              <SettingsSection title="DATA BRONNEN">
                <SettingToggle
                  label="Mock listings gebruiken"
                  desc="Aan: gebruik ingebouwde demo-listings. Uit: haal echte listings op van backend API."
                  value={settings.useMockListings}
                  onChange={v => setSetting("useMockListings", v)}
                  badge={settings.useMockListings ? "MOCK" : "LIVE API"}
                  badgeColor={settings.useMockListings ? "#ffa726" : "#69f0ae"}
                />
              </SettingsSection>

              {/* UI */}
              <SettingsSection title="INTERFACE">
                <SettingToggle
                  label="Trending strip tonen"
                  desc="De '🔥 Trending nu' balk boven de resultaten."
                  value={settings.showTrendingStrip}
                  onChange={v => setSetting("showTrendingStrip", v)}
                />
                <SettingToggle
                  label="Advertenties tonen"
                  desc="Native ads en gesponsorde listings in het grid."
                  value={settings.showAds}
                  onChange={v => setSetting("showAds", v)}
                />
              </SettingsSection>

              {/* Zoeken */}
              <SettingsSection title="ZOEKEN & AFSTAND">
                <SettingSelect
                  label="Standaard maximale afstand"
                  desc="Standaardwaarde in de afstandsfilter (km)."
                  value={settings.maxDistDefault}
                  onChange={v => setSetting("maxDistDefault", parseInt(v))}
                  options={[
                    { value: 50,  label: "50 km" },
                    { value: 100, label: "100 km" },
                    { value: 150, label: "150 km" },
                    { value: 250, label: "250 km — heel Nederland/België" },
                  ]}
                />
              </SettingsSection>

              {/* Debug */}
              <SettingsSection title="DEVELOPER">
                <SettingToggle
                  label="Debug modus"
                  desc="Toont extra informatie in de browser console."
                  value={settings.debugMode}
                  onChange={v => setSetting("debugMode", v)}
                />
              </SettingsSection>

              {/* Reset */}
              <div style={{ paddingTop:"8px", borderTop:"1px solid #111" }}>
                <button onClick={() => { if(confirm("Alle instellingen terugzetten naar standaard?")) resetSettings(); }}
                  style={{ background:"none", border:"1px solid #333", color:"#555",
                    padding:"9px 18px", fontSize:"11px", cursor:"pointer",
                    fontFamily:"inherit", letterSpacing:"1px", borderRadius:"3px",
                    transition:"all 0.2s" }}
                  onMouseEnter={e => { e.target.style.borderColor="#f44336"; e.target.style.color="#f44336"; }}
                  onMouseLeave={e => { e.target.style.borderColor="#333";    e.target.style.color="#555"; }}>
                  ↺ Standaardinstellingen herstellen
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
