import readingIndex from "../data/reading-index.json";
import { recordStudyActivity } from "./localStudyStore";

export function resolveReadingArticle(reference) {
  if (reference?.英文题目 && (reference?.编号 != null || reference?.archiveItemId)) return reference;
  const articleId = reference?.编号 ?? reference?.id;
  if (articleId == null) return null;
  return readingIndex.find((item) => String(item.编号) === String(articleId)) || null;
}

export function recordReadingArticle(reference) {
  const article = resolveReadingArticle(reference);
  if (!article) return null;
  const articleKey = article.archiveItemId || article.编号;
  return recordStudyActivity({
    id: `reading:article:${articleKey}`,
    page: "reading",
    subject: "阅读",
    title: article.英文题目,
    detail: `${article.频次} / ${article.篇章}`,
    intent: { tab: "index", articleId: article.编号, archiveItemId: article.archiveItemId },
  });
}
