const normalizeAnswer = (value) => String(value ?? "").trim().toLowerCase();
const sameAnswer = (value, expected) => String(expected).split(/\s*\/\s*/).some(answer=>normalizeAnswer(value).replace(/\s+/g," ")===normalizeAnswer(answer).replace(/\s+/g," "));
const multiSelection = (value, limit) => Array.isArray(value) ? [...new Set(value.filter((v) => typeof v === "string" && v.trim()).map((v) => v.trim().toUpperCase()))].slice(0, limit) : [];
const sameSet = (left, right) => {
  const a = [...(left || [])].map(normalizeAnswer).sort();
  const b = [...(right || [])].map(normalizeAnswer).sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
};

function articleQuestionIds(article) {
  return article.questionGroups.flatMap((group) => group.answerIds || group.questions.map((question) => question.id));
}

function answeredQuestionCount(article, responses) {
  return article.questionGroups.reduce((count, group) => {
    if (group.type === "multi") return count + multiSelection(responses[group.id], group.answer.length).length;
    return count + group.questions.filter((question) => String(responses[question.id] || "").trim()).length;
  }, 0);
}

function scoreArticle(article, responses) {
  return article.questionGroups.reduce((score, group) => {
    if (group.type === "multi") {
      const selected = multiSelection(responses[group.id], group.answer.length);
      return score + group.answer.filter((answer) => selected.includes(answer)).length;
    }
    return score + group.questions.filter((question) => sameAnswer(responses[question.id], question.answer)).length;
  }, 0);
}

function articleResults(article, responses) {
  return article.questionGroups.flatMap((group) => {
    if (group.type === "multi") {
      const selected = multiSelection(responses[group.id], group.answer.length);
      return group.answerIds.map((id, index) => ({
        id,
        groupId: group.id,
        multi: true,
        correct: selected.includes(group.answer[index]),
        expected: group.answer[index],
        response: selected.join("、") || "未作答",
        text: group.instruction,
        explanation: group.questionExplanations?.[id] || group.explanation,
        analysisImages: article.analysisImages || [],
      }));
    }
    return group.questions.map((question) => ({
      id: question.id,
      groupId: group.id,
      multi: false,
      correct: sameAnswer(responses[question.id], question.answer),
      expected: question.answer,
      response: responses[question.id] || "未作答",
      text: question.text,
      explanation: question.explanation,
      analysisImages: article.analysisImages || [],
    }));
  });
}


export {normalizeAnswer,sameAnswer,sameSet,articleQuestionIds,answeredQuestionCount,scoreArticle,articleResults};
