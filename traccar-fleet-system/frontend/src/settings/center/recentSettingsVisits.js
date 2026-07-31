const STORAGE_KEY = 'settingsRecentSections';
const MAX_ENTRIES = 5;

/**
 * Minimal real "recently visited" tracker for the Settings Overview — no
 * backend, no new table. Upgrades to a real activity feed once Platform ▸
 * Audit Logs ships (see the Settings discovery-audit artifact); this is the
 * honest MVP version, not a placeholder.
 */
export function recordSettingsVisit(sectionId) {
  if (!sectionId) return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const next = [
      { id: sectionId, at: Date.now() },
      ...list.filter((entry) => entry.id !== sectionId),
    ].slice(0, MAX_ENTRIES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable (private mode, quota) — recents just won't persist.
  }
}

export function getRecentSettingsVisits() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
