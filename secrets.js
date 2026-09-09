"use strict";

/**
 * Local-only secrets for MarketDesk static Pages.
 * NEVER put Massive/Polygon/IB tokens in committed JS.
 * Keys live in a separate localStorage bucket and are excluded from workspace backups.
 */
const MarketDeskSecrets = (() => {
  const SECRETS_KEY = "marketdesk:secrets:v1";

  function read() {
    try {
      const raw = localStorage.getItem(SECRETS_KEY);
      if (!raw) return {};
      const data = JSON.parse(raw);
      return data && typeof data === "object" && !Array.isArray(data) ? data : {};
    } catch {
      return {};
    }
  }

  function write(next) {
    try {
      localStorage.setItem(SECRETS_KEY, JSON.stringify(next));
      return true;
    } catch {
      return false;
    }
  }

  function getMassiveKey() {
    const v = read().massiveApiKey;
    return typeof v === "string" && v.trim() ? v.trim() : "";
  }

  function setMassiveKey(key) {
    const next = { ...read() };
    const cleaned = String(key || "").trim();
    if (cleaned) next.massiveApiKey = cleaned;
    else delete next.massiveApiKey;
    return write(next);
  }

  function clearMassiveKey() {
    const next = { ...read() };
    delete next.massiveApiKey;
    return write(next);
  }

  function hasMassiveKey() {
    return !!getMassiveKey();
  }

  /** Strip any accidental secret fields if a backup ever included them. */
  function scrubBackupObject(obj) {
    if (!obj || typeof obj !== "object") return obj;
    const out = { ...obj };
    delete out.massiveApiKey;
    delete out.apiKey;
    delete out.polygonApiKey;
    delete out.secrets;
    delete out.ibToken;
    delete out.ibApiKey;
    return out;
  }

  return {
    SECRETS_KEY,
    getMassiveKey,
    setMassiveKey,
    clearMassiveKey,
    hasMassiveKey,
    scrubBackupObject
  };
})();

if (typeof window !== "undefined") window.MarketDeskSecrets = MarketDeskSecrets;
