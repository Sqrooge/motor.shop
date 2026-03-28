// ══════════════════════════════════════════════════════════════════════════════
// ALERT MANAGER — aanmaken, bekijken en verwijderen van koopjes-alerts
// ══════════════════════════════════════════════════════════════════════════════
import { useState, useEffect } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

const BRANDS = ["","BMW","Ducati","Harley-Davidson","Honda","Kawasaki","KTM","Suzuki","Triumph","Yamaha","Royal Enfield","Aprilia"];
const TYPES  = ["","Adventure / Enduro","Naked / Streetfighter","Sport / Supersport","Tourer / GT","Cruiser / Chopper","Retro / Café Racer","Scooter"];

function Label({ children }) {
  return <div style={{ fontSize:"8px", color:"#444", letterSpacing:"2px", marginBottom:"5px" }}>{children}</div>;
}

function Field({ children }) {
  return <div style={{ marginBottom:"12px" }}>{children}</div>;
}

// ── Alert aanmaken formulier ───────────────────────────────────────────────────
function CreateAlertForm({ userPos, onCreated }) {
  const [form, setForm] = useState({
    brand: "", type: "", query: "", maxPrice: "", maxKm: "", maxDist: "",
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const hasFilter = form.brand || form.type || form.query || form.maxPrice || form.maxKm;

  const submit = async () => {
    if (!hasFilter) return setError("Stel minstens één filter in");
    setSaving(true); setError(null);
    try {
      const body = {
        brand:    form.brand    || null,
        type:     form.type     || null,
        query:    form.query    || null,
        maxPrice: form.maxPrice ? parseInt(form.maxPrice) : null,
        maxKm:    form.maxKm    ? parseInt(form.maxKm)    : null,
        maxDist:  form.maxDist  ? parseInt(form.maxDist)  : null,
        userLat:  userPos?.lat  || null,
        userLng:  userPos?.lng  || null,
      };
      const r = await fetch(`${API}/api/auth/alerts`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Fout");
      setForm({ brand:"", type:"", query:"", maxPrice:"", maxKm:"", maxDist:"" });
      onCreated?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ background:"#111", border:"1px solid #1a1a1a", borderRadius:"3px", padding:"16px" }}>
      <div style={{ fontSize:"11px", color:"#ff6b00", letterSpacing:"3px", marginBottom:"14px" }}>
        NIEUWE ALERT INSTELLEN
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" }}>
        <Field>
          <Label>MERK</Label>
          <select value={form.brand} onChange={e => set("brand", e.target.value)}
            style={{ width:"100%", background:"#0d0d0d", color: form.brand ? "#fff":"#555",
              border:"1px solid #222", borderRadius:"3px", padding:"9px 12px", fontSize:"13px",
              outline:"none", fontFamily:"inherit" }}>
            <option value="">Alle merken</option>
            {BRANDS.filter(Boolean).map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </Field>

        <Field>
          <Label>TYPE</Label>
          <select value={form.type} onChange={e => set("type", e.target.value)}
            style={{ width:"100%", background:"#0d0d0d", color: form.type ? "#fff":"#555",
              border:"1px solid #222", borderRadius:"3px", padding:"9px 12px", fontSize:"13px",
              outline:"none", fontFamily:"inherit" }}>
            <option value="">Alle typen</option>
            {TYPES.filter(Boolean).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>

        <Field>
          <Label>ZOEKTERM</Label>
          <input value={form.query} onChange={e => set("query", e.target.value)}
            placeholder='bijv. "GS Adventure"'
            style={{ width:"100%", background:"#0d0d0d", color:"#fff",
              border:"1px solid #222", borderRadius:"3px", padding:"9px 12px", fontSize:"13px",
              outline:"none", fontFamily:"inherit", boxSizing:"border-box" }}
            onFocus={e => e.target.style.borderColor="#ff6b00"}
            onBlur={e  => e.target.style.borderColor="#222"}
          />
        </Field>

        <Field>
          <Label>MAX PRIJS</Label>
          <input type="number" value={form.maxPrice} onChange={e => set("maxPrice", e.target.value)}
            placeholder="€ bijv. 15000"
            style={{ width:"100%", background:"#0d0d0d", color:"#fff",
              border:"1px solid #222", borderRadius:"3px", padding:"9px 12px", fontSize:"13px",
              outline:"none", fontFamily:"inherit", boxSizing:"border-box" }}
            onFocus={e => e.target.style.borderColor="#ff6b00"}
            onBlur={e  => e.target.style.borderColor="#222"}
          />
        </Field>

        <Field>
          <Label>MAX KM-STAND</Label>
          <input type="number" value={form.maxKm} onChange={e => set("maxKm", e.target.value)}
            placeholder="bijv. 20000"
            style={{ width:"100%", background:"#0d0d0d", color:"#fff",
              border:"1px solid #222", borderRadius:"3px", padding:"9px 12px", fontSize:"13px",
              outline:"none", fontFamily:"inherit", boxSizing:"border-box" }}
            onFocus={e => e.target.style.borderColor="#ff6b00"}
            onBlur={e  => e.target.style.borderColor="#222"}
          />
        </Field>

        <Field>
          <Label>MAX AFSTAND {!userPos && <span style={{ color:"#f44336" }}>(GPS vereist)</span>}</Label>
          <select value={form.maxDist} onChange={e => set("maxDist", e.target.value)}
            disabled={!userPos}
            style={{ width:"100%", background:"#0d0d0d",
              color: !userPos ? "#333" : form.maxDist ? "#fff" : "#555",
              border:`1px solid ${!userPos ? "#111":"#222"}`,
              borderRadius:"3px", padding:"9px 12px", fontSize:"13px",
              outline:"none", fontFamily:"inherit", cursor: !userPos ? "not-allowed":"auto" }}>
            <option value="">Heel Nederland/België</option>
            <option value="25">Binnen 25 km</option>
            <option value="50">Binnen 50 km</option>
            <option value="100">Binnen 100 km</option>
            <option value="150">Binnen 150 km</option>
          </select>
          {!userPos && (
            <div style={{ fontSize:"9px", color:"#444", marginTop:"4px" }}>
              📍 Geef locatietoegang voor radius-filtering
            </div>
          )}
        </Field>
      </div>

      {error && (
        <div style={{ background:"#1a0000", border:"1px solid #f4433644", borderRadius:"3px",
          padding:"8px 12px", fontSize:"11px", color:"#f44336", marginBottom:"10px" }}>
          {error}
        </div>
      )}

      {/* Preview van de alert */}
      {hasFilter && (
        <div style={{ background:"#0d0d0d", border:"1px solid #1a1a1a", borderRadius:"3px",
          padding:"8px 12px", marginBottom:"12px", fontSize:"11px", color:"#555" }}>
          <span style={{ color:"#333", letterSpacing:"1px", fontSize:"9px" }}>ALERT: </span>
          {[
            form.brand, form.type,
            form.query ? `"${form.query}"` : null,
            form.maxPrice ? `max €${parseInt(form.maxPrice).toLocaleString("nl-NL")}` : null,
            form.maxKm    ? `max ${parseInt(form.maxKm).toLocaleString("nl-NL")} km` : null,
            form.maxDist  ? `binnen ${form.maxDist} km` : null,
          ].filter(Boolean).join(" · ")}
        </div>
      )}

      <button onClick={submit} disabled={saving || !hasFilter}
        style={{ width:"100%", background: saving || !hasFilter ? "#111" : "#ff6b00",
          color: saving || !hasFilter ? "#333" : "#000",
          border:"none", padding:"11px", fontSize:"13px", fontWeight:"900",
          letterSpacing:"2px", cursor: saving || !hasFilter ? "default":"pointer",
          fontFamily:"inherit", borderRadius:"3px", transition:"background 0.2s" }}>
        {saving ? "⟳ OPSLAAN..." : "🔔 ALERT INSTELLEN"}
      </button>
    </div>
  );
}

// ── Alert kaart ───────────────────────────────────────────────────────────────
function AlertCard({ alert, onDelete }) {
  const [deleting, setDeleting] = useState(false);

  const doDelete = async () => {
    setDeleting(true);
    try {
      await fetch(`${API}/api/auth/alerts/${alert.id}`, {
        method: "DELETE", credentials: "include",
      });
      onDelete?.();
    } finally {
      setDeleting(false);
    }
  };

  const parts = [
    alert.brand, alert.type,
    alert.query      ? `"${alert.query}"`                                      : null,
    alert.max_price  ? `max €${alert.max_price.toLocaleString("nl-NL")}`       : null,
    alert.max_km     ? `max ${alert.max_km.toLocaleString("nl-NL")} km`        : null,
    alert.max_dist_km? `binnen ${alert.max_dist_km} km`                        : null,
  ].filter(Boolean);

  const hasHit = !!alert.last_hit;

  return (
    <div style={{ background:"#111", border:"1px solid #1a1a1a", borderRadius:"3px",
      padding:"12px 14px", display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"12px" }}>
      <div style={{ flex:1 }}>
        <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginBottom:"6px" }}>
          {parts.map((p, i) => (
            <span key={i} style={{ background:"#0d0d0d", border:"1px solid #1e1e1e",
              padding:"3px 8px", borderRadius:"2px", fontSize:"11px", color:"#aaa" }}>{p}</span>
          ))}
          {!parts.length && (
            <span style={{ fontSize:"11px", color:"#444" }}>Alle motoren</span>
          )}
        </div>
        <div style={{ display:"flex", gap:"12px", fontSize:"10px", color:"#333" }}>
          <span>Aangemaakt: {new Date(alert.created_at).toLocaleDateString("nl-NL")}</span>
          {hasHit && (
            <span style={{ color:"#69f0ae" }}>
              Laatste hit: {new Date(alert.last_hit).toLocaleString("nl-NL",{ hour:"2-digit", minute:"2-digit", day:"numeric", month:"short" })}
            </span>
          )}
          {!hasHit && <span style={{ color:"#2a2a2a" }}>Nog geen matches</span>}
        </div>
      </div>
      <button onClick={doDelete} disabled={deleting}
        style={{ background:"none", border:"1px solid #222", color:"#555",
          padding:"5px 10px", fontSize:"12px", cursor: deleting ? "default":"pointer",
          borderRadius:"3px", flexShrink:0, transition:"all 0.15s", fontFamily:"inherit" }}
        onMouseEnter={e => { e.target.style.borderColor="#f44336"; e.target.style.color="#f44336"; }}
        onMouseLeave={e => { e.target.style.borderColor="#222";    e.target.style.color="#555"; }}>
        {deleting ? "⟳" : "✕"}
      </button>
    </div>
  );
}

// ── Hoofd alert manager modal ─────────────────────────────────────────────────
export function AlertManager({ userPos, onClose }) {
  const [alerts,  setAlerts]  = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAlerts = () => {
    setLoading(true);
    fetch(`${API}/api/auth/alerts`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setAlerts(d.alerts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(loadAlerts, []);

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:9000,
      background:"rgba(0,0,0,0.9)", backdropFilter:"blur(3px)",
      display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>

      <div onClick={e => e.stopPropagation()} style={{
        background:"#0d0d0d", border:"1px solid #1e1e1e", borderRadius:"4px",
        width:"100%", maxWidth:"560px", maxHeight:"90vh", display:"flex", flexDirection:"column",
        animation:"slideUp 0.2s ease",
      }}>
        <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>

        {/* Header */}
        <div style={{ padding:"16px 18px", borderBottom:"1px solid #1a1a1a",
          display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
          <div>
            <div style={{ fontSize:"18px", fontWeight:"900", color:"#fff" }}>🔔 MIJN ALERTS</div>
            <div style={{ fontSize:"10px", color:"#444", marginTop:"2px", letterSpacing:"1px" }}>
              Email notificaties bij nieuwe koopjes
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"1px solid #222",
            color:"#555", fontSize:"18px", cursor:"pointer", padding:"4px 10px" }}>✕</button>
        </div>

        <div style={{ overflowY:"auto", flex:1, padding:"16px 18px", display:"grid", gap:"14px" }}>

          {/* Hoe werkt het */}
          <div style={{ background:"#0a0a0a", border:"1px solid #111", borderRadius:"3px",
            padding:"10px 14px", display:"flex", gap:"16px" }}>
            {[
              { icon:"⚡", text:"Scan elke 4 uur" },
              { icon:"🎯", text:"Alleen nieuwe koopjes" },
              { icon:"📧", text:"Max 5 per email" },
            ].map(b => (
              <div key={b.text} style={{ display:"flex", alignItems:"center", gap:"6px", flex:1 }}>
                <span style={{ fontSize:"16px" }}>{b.icon}</span>
                <span style={{ fontSize:"10px", color:"#444" }}>{b.text}</span>
              </div>
            ))}
          </div>

          {/* Nieuwe alert aanmaken */}
          <CreateAlertForm userPos={userPos} onCreated={loadAlerts} />

          {/* Bestaande alerts */}
          {loading ? (
            <div style={{ textAlign:"center", padding:"20px", fontSize:"11px", color:"#333",
              fontFamily:"monospace", letterSpacing:"2px" }}>⟳ LADEN...</div>
          ) : alerts.length ? (
            <div style={{ display:"grid", gap:"8px" }}>
              <div style={{ fontSize:"9px", color:"#333", letterSpacing:"2px" }}>
                ACTIEVE ALERTS ({alerts.length})
              </div>
              {alerts.map(a => (
                <AlertCard key={a.id} alert={a} onDelete={loadAlerts} />
              ))}
            </div>
          ) : (
            <div style={{ textAlign:"center", padding:"20px", fontSize:"11px", color:"#2a2a2a" }}>
              Nog geen alerts ingesteld
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
