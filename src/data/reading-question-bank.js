import bank from "./reading-question-bank.generated.json";
export const readingQuestionBankByArticleId = new Map(bank.map(item => [String(item.articleId), item]));
export const readingQuestionBankByArchiveItemId = new Map(bank.map(item => [String(item.archiveItemId), item]));
export default bank;
