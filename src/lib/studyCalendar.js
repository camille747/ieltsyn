export const localDayKey = (value) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
};

export function studyCalendar(history, now = new Date()) {
  // Resume snapshots are not new submissions and must not inflate study totals.
  const attempts = history.filter((item) => item.submitted || item.attempt);
  const days = new Map();
  for (const item of attempts) {
    const key = localDayKey(item.submittedAt || item.updatedAt);
    if (!key) continue;
    const day = days.get(key) || [];
    day.push(item); days.set(key,day);
  }
  const keys = [...days.keys()].sort();
  const previousDay = (key) => { const date = new Date(`${key}T12:00:00`); date.setDate(date.getDate()-1); return localDayKey(date); };
  let longest = 0, run = 0, previous = "";
  for (const key of keys) { run = previous === previousDay(key) ? run+1 : 1; longest = Math.max(longest,run); previous=key; }
  let cursor = localDayKey(now), current = 0;
  if (!days.has(cursor)) cursor = previousDay(cursor);
  while (days.has(cursor)) { current++; cursor = previousDay(cursor); }
  return { attempts, days, current, longest };
}

export function subjectStudySummary(attempts, subject) {
  const entries = subject === "概览" ? attempts : attempts.filter((item) => item.subject === subject);
  return { count: entries.length, seconds: entries.reduce((sum,item) => sum + (Number.isFinite(item.durationSeconds) ? Math.max(0,item.durationSeconds) : 0),0) };
}
