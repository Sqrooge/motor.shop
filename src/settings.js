// ══════════════════════════════════════════════════════════════════════════════
// SETTINGS STORE — admin-voorkeuren, persistent via localStorage
// Gedeeld door admin panel + componenten die settings nodig hebben
// ══════════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "motorshop-admin-settings";

const DEFAULTS = {
  useMockPriceHistory: true,   // false = echte API data
  useMockListings:     true,   // false = echte scraper data via API
  showPriceChart:      true,   // false = verberg grafiek in modal
  showTrendingStrip:   true,   // false = verberg trending balk
  showAds:             true,   // false = geen advertenties tonen
  maxDistDefault:      250,    // standaard max afstand in km
  alertCooldownHours:  4,      // (info-only, staat in backend .env)
  debugMode:           false,  // extra info in console
};

// Laad uit localStorage
function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

// Sla op in localStorage
function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

// ── Singleton state buiten React — zodat alle consumers dezelfde waarden zien ─
let _settings = loadSettings();
let _listeners = new Set();

function notifyListeners() {
  _listeners.forEach(fn => fn({ ..._settings }));
}

export function updateSetting(key, value) {
  _settings = { ..._settings, [key]: value };
  saveSettings(_settings);
  notifyListeners();
}

export function resetSettings() {
  _settings = { ...DEFAULTS };
  saveSettings(_settings);
  notifyListeners();
}

// ── React hook — abonneert op settings-wijzigingen ────────────────────────────
export function useSettings() {
  const [settings, setSettings] = useState(() => ({ ..._settings }));

  useEffect(() => {
    const listener = (updated) => setSettings(updated);
    _listeners.add(listener);
    return () => _listeners.delete(listener);
  }, []);

  const setSetting = useCallback((key, value) => updateSetting(key, value), []);

  return { settings, setSetting, resetSettings };
}

// ── Eenmalig lezen zonder React (voor buiten componenten) ─────────────────────
export const getSettings = () => ({ ..._settings });
