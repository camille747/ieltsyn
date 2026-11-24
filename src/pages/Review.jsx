import PracticeHistory from "../components/PracticeHistory";
import { LearningWorkspace } from "../components/LearningUI";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpenText,
  Check,
  CheckCircle,
  Headphones,
  SpeakerHigh,
  TextAa,
} from "@phosphor-icons/react";
import { BackButton, Button, LoadingState, MetaTag, PageHeading, Pagination, Segmented } from "../components/Common";
import {
  formatStudyTime,
  getStudyHistory,
  getWrongItems,
  LOCAL_STUDY_EVENT,
  setWrongItemResolved,
} from "../lib/localStudyStore";
import { speakEnglish } from "../lib/speech";
import { readingQuestionBankByArchiveItemId, readingQuestionBankByArticleId } from "../data/reading-question-bank";
import { scrollPageToTopAfterRender } from "../lib/pageScroll";

const PAGE_SIZE = 10;

function localAssetUrl(path) {
  if (window.location.protocol !== "file:") return `/${path}`;
  const prefix = window.location.pathname.includes("/dist/") ? "./" : "./public/";
  return new URL(`${prefix}${path}`, window.location.href).href;
}

function subjectIcon(subject) {
  if (subject === "听力") return Headphones;
  if (subject === "阅读") return BookOpenText;
  return TextAa;
}

function AnswerComparison({ item }) {
  return (
    <div className="answer-comparison">
      <div className="answer-wrong"><span>你的答案</span><strong>{item.userAnswer}</strong></div>
      <ArrowRight size={20} />
      <div className="answer-correct"><span>正确答案</span><strong>{item.correctAnswer}</strong></div>
    </div>
  );
}

function ListeningReviewDetail({ item, onBack }) {
  const [source, setSource] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(localAssetUrl(`data/listening/${item.sourceId}.json`))
      .then((response) => {
        if (!response.ok) throw new Error("原题资料读取失败");
        return response.json();
      })
      .then((data) => active && setSource(data))
      .catch((nextError) => active && setError(nextError.message));
    return () => { active = false; };
  }, [item.sourceId]);

  const analysisIndex = source?.transcriptLines?.findIndex((line) => line.analysis?.includes(`第${item.questionId}题`)) ?? -1;
  const transcriptContext = analysisIndex >= 0
    ? source.transcriptLines.slice(Math.max(0, analysisIndex - 1), analysisIndex + 1)
    : [];

  return (
    <div className="page review-detail-page">
      <BackButton onClick={onBack}>返回错题本</BackButton>
      <PageHeading
        eyebrow="听力 / 错题详情"
        title={<>原题 <em>复盘</em></>}
        description={`${item.title} · Question ${item.questionId}`}
      />
      {error && <div className="review-source-error">{error}</div>}
      {!source && !error && <LoadingState className="review-detail-loading" label="正在读取原题、原音频与解析..." />}
      {source && (
        <>
          <section className="review-source-hero accent-panel">
            <div>
              <MetaTag tone="dark">{item.part}</MetaTag>
              <h2>{item.title}</h2>
              <p>以下内容来自你实际提交的这道错题。</p>
            </div>
            <audio controls preload="metadata" src={localAssetUrl(`media/listening/${item.sourceId}.mp3`)} />
          </section>
          <div className="review-detail-grid">
            <main>
              <section className="review-detail-card">
                <span className="detail-kicker">原题 / Question {item.questionId}</span>
                <h2>{item.questionText || `Question ${item.questionId}`}</h2>
                {item.instruction && <p className="source-instruction">{item.instruction}</p>}
                <AnswerComparison item={item} />
              </section>
              <section className="review-detail-card">
                <span className="detail-kicker">原文定位与解析</span>
                {transcriptContext.length > 0 ? (
                  <div className="transcript-context">
                    {transcriptContext.map((line) => (
                      <article key={`${line.time}-${line.html}`}>
                        <time>{line.time.split(" --> ")[0]}</time>
                        <p dangerouslySetInnerHTML={{ __html: line.html }} />
                        <p className="transcript-cn" dangerouslySetInnerHTML={{ __html: line.cn }} />
                        {line.analysis && <div className="analysis-note" dangerouslySetInnerHTML={{ __html: line.analysis }} />}
                      </article>
                    ))}
                  </div>
                ) : <p className="source-instruction">原资料没有提供这道题的逐句定位解析。</p>}
              </section>
            </main>
            <aside className="review-detail-aside">
              <span>本次记录</span>
              <strong>{item.reason}</strong>
              <p>此记录来自你提交答案时的真实结果；重新练习并提交后会按最新结果更新。</p>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

function DictationReviewDetail({ item, onBack }) {
  const expected = [...(item.correctAnswer || "")];
  const submitted = [...(item.userAnswer === "未作答" ? "" : (item.userAnswer || ""))];
  return (
    <div className="page review-detail-page">
      <BackButton onClick={onBack}>返回错题本</BackButton>
      <PageHeading
        eyebrow="听写 / 错词详情"
        title={<>拼写 <em>复盘</em></>}
        description={`${item.unitLabel} · 词表第 ${item.wordPosition} 词`}
      />
      <section className="accent-panel dictation-review-card">
        <MetaTag tone="dark">听写</MetaTag>
        <span>正确单词</span>
        <h2>{item.correctAnswer}</h2>
        <p>{item.reason}</p>
        <Button icon={SpeakerHigh} onClick={() => speakEnglish(item.correctAnswer)}>播放英式发音</Button>
        <AnswerComparison item={item} />
      </section>
      <section className="review-detail-card spelling-breakdown">
        <span className="detail-kicker">逐字对照</span>
        <div>
          {expected.map((letter, index) => (
            <span key={`${letter}-${index}`} className={submitted[index]?.toLowerCase() === letter.toLowerCase() ? "" : "different"}>
              <strong>{letter}</strong><small>{submitted[index] || "空"}</small>
            </span>
          ))}
        </div>
        <p>上方为正确字母，下方为你输入的对应位置；标红处需要重新确认。</p>
      </section>
    </div>
  );
}

function ReadingReviewDetail({ item, onBack }) {
  const article = readingQuestionBankByArchiveItemId.get(String(item.archiveItemId))
    || readingQuestionBankByArticleId.get(String(item.articleId));
  const questionGroup = article?.questionGroups.find((group) => (
    group.id === String(item.questionId)
    || group.answerIds?.some((id) => String(id) === String(item.questionId))
    || group.questions?.some((question) => String(question.id) === String(item.questionId))
  ));
  const question = questionGroup?.questions?.find((entry) => String(entry.id) === String(item.questionId));

  return (
    <div className="page review-detail-page reading-review-detail">
      <BackButton onClick={onBack}>返回错题本</BackButton>
      <PageHeading
        eyebrow="阅读 / 错题详情"
        title={<>原文与 <em>错题复盘</em></>}
        description={`${item.title} · ${item.detail}`}
      />
      {!article ? (
        <div className="review-source-error">这道旧记录尚未关联到本地阅读原题。</div>
      ) : (
        <div className="reading-review-layout">
          <main className="review-reading-passage">
            <header><MetaTag tone="dark">{article.part}</MetaTag><h2>{article.title}</h2><p>{article.chineseTitle}</p></header>
            {article.paragraphs.map((paragraph) => (
              <article key={paragraph.id}>
                <strong>{paragraph.id}</strong>
                <div><p>{paragraph.text}</p><p className="paragraph-translation">{paragraph.translation}</p></div>
              </article>
            ))}
          </main>
          <aside className="reading-review-question">
            <span className="detail-kicker">原题 / Question {item.questionId}</span>
            <h2>{question?.text || questionGroup?.instruction || item.questionText}</h2>
            {questionGroup?.instruction && question?.text && <p className="source-instruction">{questionGroup.instruction}</p>}
            <AnswerComparison item={item} />
            <div className="reading-review-explanation">
              <span>答案解析</span>
              <p>{item.explanation || question?.explanation || questionGroup?.explanation || "原资料未提供单独解析。"}</p>
            </div>
            <div className="reading-review-reason"><span>本次错误</span><strong>{item.reason}</strong></div>
          </aside>
        </div>
      )}
    </div>
  );
}

function ReviewDetail({ item, onBack }) {
  if (item.subject === "听力") return <ListeningReviewDetail item={item} onBack={onBack} />;
  if (item.subject === "阅读") return <ReadingReviewDetail item={item} onBack={onBack} />;
  if (item.subject === "听写") return <DictationReviewDetail item={item} onBack={onBack} />;
  return (
    <div className="page review-detail-page">
      <BackButton onClick={onBack}>返回错题本</BackButton>
      <PageHeading eyebrow={`${item.subject} / 错题详情`} title={item.title} description={item.detail} />
      <section className="review-detail-card"><AnswerComparison item={item} /></section>
    </div>
  );
}

export default function Review({ navigate, intent }) {
  const [tab, setTab] = useState(intent?.tab || "错题本");
  const [subject, setSubject] = useState("全部");
  const [wrongItems, setWrongItems] = useState(() => getWrongItems());
  const [history, setHistory] = useState(() => getStudyHistory());
  const [selectedItem, setSelectedItem] = useState(null);
  const [wrongPage, setWrongPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const returnScrollRef = useRef(0);

  const openItem = (item) => {
    returnScrollRef.current = window.scrollY;
    setSelectedItem(item);
    scrollPageToTopAfterRender();
  };

  const closeItem = () => {
    setSelectedItem(null);
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: returnScrollRef.current, behavior: "auto" })));
  };

  const refresh = () => {
    setWrongItems(getWrongItems());
    setHistory(getStudyHistory());
  };

  useEffect(() => {
    if (intent?.tab) setTab(intent.tab);
  }, [intent]);

  useEffect(() => {
    window.addEventListener(LOCAL_STUDY_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(LOCAL_STUDY_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const items = useMemo(
    () => wrongItems.filter((item) => subject === "全部" || item.subject === subject),
    [subject, wrongItems],
  );
  const wrongTotalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const currentWrongPage = Math.min(wrongPage, wrongTotalPages);
  const visibleWrongItems = items.slice((currentWrongPage - 1) * PAGE_SIZE, currentWrongPage * PAGE_SIZE);
  const historyTotalPages = Math.max(1, Math.ceil(history.length / PAGE_SIZE));
  const currentHistoryPage = Math.min(historyPage, historyTotalPages);
  const visibleHistory = history.slice((currentHistoryPage - 1) * PAGE_SIZE, currentHistoryPage * PAGE_SIZE);
  const pendingCount = wrongItems.filter((item) => !item.resolved).length;
  const weekStart = Date.now() - 7 * 86400000;
  const resolvedThisWeek = wrongItems.filter((item) => item.resolved && item.updatedAt >= weekStart).length;

  useEffect(() => setWrongPage(1), [subject]);
  useEffect(() => {
    if (wrongPage > wrongTotalPages) setWrongPage(wrongTotalPages);
  }, [wrongPage, wrongTotalPages]);
  useEffect(() => {
    if (historyPage > historyTotalPages) setHistoryPage(historyTotalPages);
  }, [historyPage, historyTotalPages]);

  const toggleResolved = (item) => {
    setWrongItemResolved(item.id, !item.resolved);
    refresh();
  };

  if (selectedItem) return <ReviewDetail item={selectedItem} onBack={closeItem} />;

  return (
    <div className="page review-page">
      <PageHeading
        eyebrow="Review"
        title={<>错题与 <em>复盘</em></>}
      />

      <LearningWorkspace title="复盘" description="把练过的，变成自己的。" active={tab} onChange={setTab} options={[{value:"错题本",label:"错题本"},{value:"学习记录",label:"学习记录"}]} aside={<p>{pendingCount} 道待复盘 · 最近 7 天已处理 {resolvedThisWeek} 道</p>}>
        {tab === "错题本" && (
          <>
            {wrongItems.length > 0 && (
              <div className="review-filter" role="group" aria-label="科目筛选">
                {["全部", "听力", "阅读", "听写"].map((filterItem) => (
                  <button type="button" key={filterItem} className={subject === filterItem ? "active" : ""} onClick={() => setSubject(filterItem)}>{filterItem}</button>
                ))}
              </div>
            )}
            {items.length > 0 ? (
              <>
              <div className={`review-list${wrongTotalPages > 1 ? " paginated-list" : ""}`}>
                {visibleWrongItems.map((item) => {
                  const Icon = subjectIcon(item.subject);
                  return (
                    <article key={item.id} className={item.resolved ? "resolved" : ""}>
                      <button type="button" className="review-open" onClick={() => openItem(item)}>
                        <span className="review-icon"><Icon size={20} /></span>
                        <div className="review-copy">
                          <div><MetaTag tone={item.subject === "听力" ? "dark" : "neutral"}>{item.subject}</MetaTag><time>{formatStudyTime(item.updatedAt)}</time></div>
                          <h3>{item.title}</h3>
                          <p>{item.detail}</p>
                        </div>
                        <div className="review-reason"><span>错误原因</span><strong>{item.reason}</strong></div>
                        <ArrowRight className="review-open-arrow" size={18} />
                      </button>
                      <button type="button" className="resolve-button" onClick={() => toggleResolved(item)}>
                        {item.resolved ? <><CheckCircle size={19} weight="fill" />已复盘</> : <><Check size={19} />标记完成</>}
                      </button>
                    </article>
                  );
                })}
              </div>
              <Pagination page={currentWrongPage} totalPages={wrongTotalPages} onChange={setWrongPage} label="错题本分页" />
              </>
            ) : (
              <div className="empty-state"><CheckCircle size={28} /><h3>很好，没有错题</h3></div>
            )}
          </>
        )}

        {tab==="学习记录"&&<PracticeHistory onOpen={item=>navigate(item.page,item.intent)}/>}
      </LearningWorkspace>
    </div>
  );
}
