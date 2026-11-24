const nonempty = (value) => typeof value === "string" && value.trim().length > 0 && value.length <= 40000;
const vocabulary = (value) => Array.isArray(value) && value.length <= 8 && value.every((item) => item && nonempty(item.term) && nonempty(item.meaning));

export function isReadingAnalysis(report) {
  return Boolean(report && nonempty(report.questionId) && nonempty(report.explanation) && nonempty(report.approach) && vocabulary(report.vocabulary)
    && Array.isArray(report.evidence) && report.evidence.length <= 6 && report.evidence.every((item) => item && ["paragraphId", "quote", "reason"].every((k) => nonempty(item[k])))
    && Array.isArray(report.synonyms) && report.synonyms.length <= 6 && report.synonyms.every((item) => item && ["questionPhrase", "passagePhrase", "explanation"].every((k) => nonempty(item[k]))));
}

export function isReadingTextReport(report) {
  return Boolean(report && nonempty(report.translation) && nonempty(report.grammar) && vocabulary(report.vocabulary));
}

export function readingAnalysisPayload(article, question) {
  const group = article.questionGroups.find((item) => item.id === question.groupId);
  return {
    title: article.title,
    paragraphs: [ ...(article.intro ? [{ id: "intro", text: article.intro }] : []), ...article.paragraphs ].map((p) => ({ id: String(p.id), text: p.text })),
    question: {
      id: String(question.id), text: question.text || group?.instruction || `Question ${question.id}`,
      instruction: [group?.title, group?.instruction, group?.context].filter(Boolean).join("\n") || "根据原文作答",
      options: (group?.options || []).map((option) => `${option.value}: ${option.label}`).join("\n"),
      expected: question.multi && group?.answer ? `本组正确选项（顺序不限）：${group.answer.join("、")}；本题号对应选项：${question.expected}` : String(question.expected),
      response: String(question.response || "未作答"), sourceExplanation: question.explanation || "",
    },
  };
}

// Only reuse a saved report when passage, choices, source answer and actual answer all still match.
export function matchingReadingAnalysis(entry, payload) {
  const report = entry?.report;
  if (entry?.input !== JSON.stringify(payload) || !isReadingAnalysis(report) || report.questionId !== payload.question.id) return null;
  const passage = payload.paragraphs.map((p) => p.text).join("\n");
  const question = [payload.question.text, payload.question.instruction, payload.question.options].join("\n");
  if (report.evidence.some((item) => !payload.paragraphs.some((p) => p.id === item.paragraphId && p.text.includes(item.quote)))
    || report.vocabulary.some((item) => !passage.includes(item.term))
    || report.synonyms.some((item) => !question.includes(item.questionPhrase) || !passage.includes(item.passagePhrase))) return null;
  return report;
}

export function readingAiHighlights(article, reports) {
  return reports.flatMap((report) => (report?.evidence || []).flatMap((evidence, index) => {
    const paragraph = article.paragraphs.find((p) => String(p.id) === evidence.paragraphId);
    const start = paragraph?.text.indexOf(evidence.quote) ?? -1;
    return start < 0 ? [] : [{ id: `evidence:ai:${report.questionId}:${index}`, paragraphId: `passage:${paragraph.id}`, start, end: start + evidence.quote.length, color: "brown", note: `题 ${report.questionId} · AI 原文证据：${evidence.reason}` }];
  }));
}
