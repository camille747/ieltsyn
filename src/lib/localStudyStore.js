const HISTORY_KEY = "ielts-local-study-history-v1";
const WRONG_ITEMS_KEY = "ielts-local-wrong-items-v1";
const DICTATION_SESSIONS_KEY = "ielts-local-dictation-sessions-v1";

export const LOCAL_STUDY_EVENT = "ielts-local-study-change";

function normalizedTitle(item) {
  return String(item?.title || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function isReadingActivity(item) {
  return item?.subject === "阅读" || String(item?.id || "").startsWith("reading:");
}

function normalizeStudyHistory(items) {
  return [...items].filter((item) => item && typeof item === "object").sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

function readList(key) {
  if (typeof window === "undefined") return [];
  if (window.ieltsDesktop?.store) {
    const desktopValue = window.ieltsDesktop.store.get(key);
    if (Array.isArray(desktopValue)) return desktopValue;
    try {
      const legacyValue = JSON.parse(window.localStorage.getItem(key) || "[]");
      if (Array.isArray(legacyValue) && legacyValue.length) {
        window.ieltsDesktop.store.set(key, legacyValue);
        return legacyValue;
      }
    } catch {
      return [];
    }
    return [];
  }
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeList(key, value) {
  if (typeof window === "undefined") return;
  if (window.ieltsDesktop?.store) { if (window.ieltsDesktop.store.set(key, value) === false) throw new Error("本机保存失败，请先导出练习记录。"); }
  else window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(LOCAL_STUDY_EVENT, { detail: { key } }));
}

export function getStudyHistory() {
  return normalizeStudyHistory(readList(HISTORY_KEY));
}

export function getStudyActivity(id) {
  return getStudyHistory().find((item) => item.id === id) || null;
}

export function deleteStudyActivity(id) {
  if (!id) return;
  writeList(HISTORY_KEY, getStudyHistory().filter((item) => item.id !== id));
  // Wrong-item notes are independent learning data; deleting an attempt must remain reversible.
}

export function getLatestSubjectScores() {
  const latest = new Map();
  for (const item of getStudyHistory().sort((a,b) => (b.submittedAt || b.updatedAt) - (a.submittedAt || a.updatedAt))) {
    if (item.subject && Number.isFinite(item.score) && item.score >= 0 && item.score <= 9 && !latest.has(item.subject)) latest.set(item.subject, item);
  }
  return latest;
}

export function roundIeltsBand(value) {
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 2) / 2;
}

export function estimateListeningBand(correct, total = 40) {
  if (!Number.isFinite(correct) || !Number.isFinite(total) || total <= 0) return null;
  const scaledCorrect = correct * 40 / total;
  const thresholds = [[39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6], [18, 5.5], [16, 5], [13, 4.5], [10, 4], [7, 3.5], [5, 3], [3, 2.5]];
  return thresholds.find(([minimum]) => scaledCorrect >= minimum)?.[1] ?? 2;
}

export function estimateAcademicReadingBand(correct, total = 40) {
  if (!Number.isFinite(correct) || !Number.isFinite(total) || total <= 0) return null;
  const scaledCorrect = correct * 40 / total;
  const thresholds = [[39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6], [19, 5.5], [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5]];
  return thresholds.find(([minimum]) => scaledCorrect >= minimum)?.[1] ?? 2;
}

export function recordStudyActivity(activity) {
  if (!activity?.id || !activity?.page || !activity?.title) return null;
  const history = getStudyHistory();
  const existing = history.find((item) => item.id === activity.id);
  const next = {
    ...existing,
    ...activity,
    intent: { ...(existing?.intent || {}), ...(activity.intent || {}) },
    progress: activity.progress ?? existing?.progress ?? null,
    updatedAt: Date.now(),
  };
  const others = history.filter((item) => item.id !== activity.id);
  writeList(HISTORY_KEY, [next, ...others]);
  return next;
}

export function getWrongItems() {
  return readList(WRONG_ITEMS_KEY).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function replaceWrongItemsForSource(sourceKey, items) {
  const current = getWrongItems();
  const previousById = new Map(current.map((item) => [item.id, item]));
  const unaffected = current.filter((item) => item.sourceKey !== sourceKey);
  const next = items.map((item) => ({
    ...previousById.get(item.id),
    ...item,
    resolved: previousById.get(item.id)?.resolved || false,
    updatedAt: Date.now(),
  }));
  writeList(WRONG_ITEMS_KEY, [...next, ...unaffected]);
}

export function upsertWrongItems(items) {
  if (!Array.isArray(items) || items.length === 0) return;
  const current = getWrongItems();
  const incomingIds = new Set(items.map((item) => item.id));
  const next = items.map((item) => ({
    ...current.find((existing) => existing.id === item.id),
    ...item,
    resolved: false,
    updatedAt: Date.now(),
  }));
  writeList(WRONG_ITEMS_KEY, [...next, ...current.filter((item) => !incomingIds.has(item.id))]);
}

export function recordDictationSession(session) {
  if (!session?.id || !Array.isArray(session.results)) return null;
  const sessions = readList(DICTATION_SESSIONS_KEY);
  writeList(
    DICTATION_SESSIONS_KEY,
    [session, ...sessions.filter((item) => item.id !== session.id)].slice(0, 30),
  );
  return session;
}

export function getDictationSession(id) {
  if (!id) return null;
  return readList(DICTATION_SESSIONS_KEY).find((session) => session.id === id) || null;
}

export function setWrongItemResolved(id, resolved) {
  const items = getWrongItems().map((item) => item.id === id ? { ...item, resolved, updatedAt: Date.now() } : item);
  writeList(WRONG_ITEMS_KEY, items);
}

export function formatStudyTime(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDifference = Math.round((startOfToday - startOfDate) / 86400000);
  if (dayDifference === 0) return "今天";
  if (dayDifference === 1) return "昨天";
  return new Intl.DateTimeFormat("zh-CN", {
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function recordPracticeAttempt(activity) {
  return recordStudyActivity({ ...activity, id: `${activity.id}:attempt:${globalThis.crypto?.randomUUID?.() || Date.now()}`, attempt: true, submitted: true, submittedAt: Date.now() });
}
export function calculateOverall(scores) {
  if (!Array.isArray(scores) || scores.length !== 4 || !scores.every((value) => Number.isFinite(value) && value >= 0 && value <= 9)) return null;
  return roundIeltsBand(scores.reduce((sum, value) => sum + value, 0) / 4);
}
export function restoreStudyActivity(activity) { writeList(HISTORY_KEY, [activity, ...getStudyHistory().filter((entry) => entry.id !== activity.id)]); }
export function replaceStudyHistory(history) { writeList(HISTORY_KEY, history); }
