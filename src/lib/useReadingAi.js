import { useEffect, useRef, useState } from "react";
import { readValue, writeValue } from "./persistence";
import { requestAi } from "./aiClient";
import { matchingReadingAnalysis, readingAnalysisPayload, readingAiHighlights } from "./readingAi";

export function useReadingAi(article, results) {
  const key = `ielts-reading-ai-v1:${article.id}`;
  const [entries, setEntries] = useState(() => readValue(key, {}));
  const [busy, setBusy] = useState({});
  const [errors, setErrors] = useState({});
  const controllers = useRef(new Map());
  const context = JSON.stringify({ article, results });
  const latestContext = useRef(context);
  latestContext.current = context;
  useEffect(() => {
    setEntries(readValue(key, {})); setBusy({}); setErrors({});
    return () => { for (const controller of controllers.current.values()) controller.abort(); controllers.current.clear(); };
  }, [key, context]);
  const reportFor = (q) => matchingReadingAnalysis(entries?.[q.id], readingAnalysisPayload(article, q));
  const generate = async (q) => {
    if (controllers.current.has(q.id)) return;
    const payload = readingAnalysisPayload(article, q), snapshot = context, controller = new AbortController();
    controllers.current.set(q.id, controller);
    setBusy((value) => ({ ...value, [q.id]: true })); setErrors((value) => ({ ...value, [q.id]: "" }));
    try {
      const report = await requestAi("reading/analysis", payload, controller.signal);
      if (controller.signal.aborted || latestContext.current !== snapshot) return;
      const entry = { input: JSON.stringify(payload), report };
      if (!matchingReadingAnalysis(entry, payload)) throw new Error("分析未通过原文证据核对，请重试。原答案及笔记仍保留。");
      const current = readValue(key, {});
      const next = { ...(current && !Array.isArray(current) ? current : {}), [q.id]: entry };
      setEntries(next);
      try { writeValue(key, next); } catch { throw new Error("分析已返回，但本机保存失败。请先复制当前分析，再检查存储空间。"); }
    } catch (error) {
      if (!controller.signal.aborted && latestContext.current === snapshot) setErrors((value) => ({ ...value, [q.id]: error.message }));
    } finally {
      if (controllers.current.get(q.id) === controller) {
        controllers.current.delete(q.id);
        setBusy((value) => ({ ...value, [q.id]: false }));
      }
    }
  };
  const cancel = (q) => { controllers.current.get(q.id)?.abort(); controllers.current.delete(q.id); setBusy((value) => ({ ...value, [q.id]: false })); };
  return { reportFor, generate, cancel, busy, errors, highlights: readingAiHighlights(article, results.map(reportFor).filter(Boolean)) };
}
