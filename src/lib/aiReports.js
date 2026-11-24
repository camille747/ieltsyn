const band = (value) => Number.isFinite(value) && value >= 0 && value <= 9 && Number.isInteger(value * 2);
const string = (value) => typeof value === "string";
export function isWritingReport(report) {
  return Boolean(report && band(report.score) && ["task", "coherence", "lexical", "grammar"].every((k) => band(report.criteria?.[k]?.score) && string(report.criteria[k].feedback)) && string(report.summary) && string(report.revisedEssay) && Array.isArray(report.advice) && report.advice.every(string) && ["grammar", "logic"].every((field) => Array.isArray(report[field]) && report[field].every((item) => item && string(item.original) && string(item.reason) && string(item[field === "grammar" ? "replacement" : "suggestion"]))));
}
export function isSpeakingReport(report) {
  return Boolean(report && report.scores?.fluency === null && report.scores?.pronunciation === null && ["lexical", "grammar"].every((k) => band(report.scores?.[k])) && ["fluency", "lexical", "grammar", "pronunciation"].every((k) => string(report.feedback?.[k])) && Array.isArray(report.answers) && report.answers.every((item) => item && ["id", "polished", "example", "notes"].every((k) => string(item[k]))));
}
export function writingSectionBand(items, reports) {
  if (!items?.length || items.some((item) => !band(reports?.[item.id]?.score))) return null;
  const weight = (item) => item.task === "Task 1" ? 1 : 2;
  const average = items.reduce((sum, item) => sum + reports[item.id].score * weight(item), 0) / items.reduce((sum, item) => sum + weight(item), 0);
  return Math.round(average * 2) / 2;
}
