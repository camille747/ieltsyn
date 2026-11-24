import { BookOpenText, FilePdf, LinkSimple, Play } from "@phosphor-icons/react";
import { Button, MetaTag, Modal } from "./Common";

export default function ReadingArticleDetail({
  article,
  localPdf,
  practiceArticle,
  onClose,
  onOpenPdf,
  onOpenFeishu,
  onOpenStudy,
  onStartPractice,
}) {
  const link = article?.正文链接?.link;

  return (
    <Modal open={Boolean(article)} title="文章详情" onClose={onClose} width="medium">
      {article && (
        <div className="article-detail">
          <div className="article-title-block">
            <div className="meta-row"><MetaTag tone="dark">{article.篇章}</MetaTag><MetaTag>{article.频次}</MetaTag></div>
            <h2>{article.英文题目}</h2>
            <p>{article.中文题目}</p>
          </div>
          <div className="ui-article-detail-layout"><dl className="detail-grid">
            <div><dt>主题</dt><dd>{article.主题分类}</dd></div>
            <div><dt>题型</dt><dd>{article.题型}</dd></div>
            <div><dt>难度</dt><dd>{article.难度定位}</dd></div>
            <div><dt>检索词</dt><dd>{article.检索关键词}</dd></div>
          </dl>
          <div className="article-actions">
            {practiceArticle && onOpenStudy && <Button icon={BookOpenText} onClick={() => onOpenStudy(practiceArticle)}>文章复盘</Button>}
            {practiceArticle && onStartPractice && <Button variant="ghost" icon={Play} onClick={() => onStartPractice(practiceArticle)}>练习本篇题目</Button>}
            {localPdf && onOpenPdf && <Button icon={FilePdf} onClick={() => onOpenPdf(localPdf, article)}>打开本地 PDF</Button>}
            {link && onOpenFeishu && <Button variant="ghost" icon={LinkSimple} onClick={() => onOpenFeishu(article)}>打开飞书精读</Button>}
          </div></div>
        </div>
      )}
    </Modal>
  );
}
