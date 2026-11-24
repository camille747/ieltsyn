export const examSections = [{ subject: "听力", seconds: 1800 }, { subject: "阅读", seconds: 3600 }, { subject: "写作", seconds: 3600 }];
export const secondsRemaining = (deadline, now = Date.now()) => Math.max(0, Math.ceil((deadline - now) / 1000));
export function createExam(items, mode = "full", now = Date.now()) {
  const sections = mode === "writing" ? [examSections[2]] : examSections;
  return { version: 2, id: `exam:${now}`, mode, items, phase: 0, responses: {}, results: [], status: "active", startedAt: now, sectionStartedAt: now, deadline: now + sections[0].seconds * 1000 };
}
export function lockSection(state, result, now = Date.now()) {
  if (state.status !== "active") return state;
  return { ...state, status: "locked", results: [...state.results, { ...result, phase: state.phase, submittedAt: now, durationSeconds: Math.min(Math.max(0, Math.round((now - state.sectionStartedAt) / 1000)), (state.mode === "writing" ? examSections[2] : examSections[state.phase]).seconds) }] };
}
export function advanceSection(state, now = Date.now()) {
  if (state.status !== "locked") return state;
  const sections = state.mode === "writing" ? [examSections[2]] : examSections;
  const phase = state.phase + 1;
  return phase >= sections.length ? { ...state, status: "finished" } : { ...state, phase, status: "active", sectionStartedAt: now, deadline: now + sections[phase].seconds * 1000 };
}
export function changeExamAnswer(state, key, value, now = Date.now()) {
  if (state.status !== "active" || now >= state.deadline) return state;
  return { ...state, responses: { ...state.responses, [key]: value } };
}
