// Range IDs describe every answer slot (e.g. 18-20 includes question 19).
function multipleQuestionIds(group) {
  const endpoints = String(group.id || "").split("-").map(value => value.trim());
  if (endpoints.length === 2 && endpoints.every(value => /^\d+$/.test(value))) {
    const [start, end] = endpoints.map(Number);
    if (end >= start && end - start < 100) return Array.from({ length: end - start + 1 }, (_, index) => String(start + index));
  }
  return endpoints;
}

function expectedAnswer(data, id) {
  const key = `q${id}`;
  return data.answerKey?.text?.[key]
    ?? data.answerKey?.single?.[key]
    ?? data.answerKey?.matching?.[key]
    ?? data.answerKey?.map?.[key]
    ?? data.answerKey?.multipleMap?.[key]
    ?? null;
}

function responseForQuestion(data, responses, id) {
  const multipleGroup = data.groups.find((group) => group.type === "multiple" && multipleQuestionIds(group).includes(String(id)));
  if (multipleGroup) {
    const ids = multipleQuestionIds(multipleGroup);
    const answer = responses[`multi:${multipleGroup.id}`];
    const values = Array.isArray(answer) ? answer : ids.map((key) => responses[`q${key}`]);
    return [...new Set(values.filter((v) => typeof v === "string" && v.trim()).map((v) => v.trim().toLowerCase()))].slice(0, multipleGroup.limit || ids.length);
  }
  return responses[`q${id}`] ?? "";
}

function hasResponseForQuestion(data, responses, id) {
  const direct = responses[`q${id}`];
  if (direct !== undefined && String(direct).trim() !== "") return true;
  const multipleGroup = data.groups.find((group) => group.type === "multiple" && multipleQuestionIds(group).includes(String(id)));
  if (!multipleGroup) return false;
  const questionIndex = multipleQuestionIds(multipleGroup).indexOf(String(id));
  return Boolean((responses[`multi:${multipleGroup.id}`] || [])[questionIndex]);
}

function answerMatches(response, expected) {
  const normalize = (value) => typeof value === "string" || typeof value === "number" ? String(value).trim().toLowerCase().replace(/\s+/g, " ") : "";
  const alternatives = String(expected ?? "").split(/\s*\/\s*/).map(normalize).filter(Boolean);
  const values = Array.isArray(response) ? response : [response];
  return values.some((value) => normalize(value) && alternatives.includes(normalize(value)));
}

function findQuestion(data, id) {
  for (const group of data.groups) {
    if (group.type === "matching" || group.type === "map") {
      const match = group.questions.find(([questionId]) => String(questionId) === String(id));
      if (match) return { text: match[1], instruction: group.instruction };
    } else if (group.type === "multiple" && multipleQuestionIds(group).includes(String(id))) {
      return { text: group.questionText, instruction: group.instruction };
    } else {
      const match = group.questions?.find((question) => String(question.id) === String(id));
      if (match) return { text: match.text, instruction: group.instruction };
    }
  }
  return { text: `Question ${id}`, instruction: "" };
}

function calculateScore(data, responses) {
  if (!data) return 0;
  return data.questionIds.reduce((sum, id) => {
    const expected = expectedAnswer(data, id);
    if (!expected) return sum;
    return sum + (answerMatches(responseForQuestion(data, responses, id), expected) ? 1 : 0);
  }, 0);
}


export {multipleQuestionIds,findQuestion,expectedAnswer,responseForQuestion,hasResponseForQuestion,answerMatches,calculateScore};
