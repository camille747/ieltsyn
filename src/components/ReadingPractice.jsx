import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowClockwise,
  ArrowLeft,
  ArrowRight,
  Check,
  FilePdf,
  LinkSimple,
  NotePencil,
} from "@phosphor-icons/react";
import { Button, MetaTag, PageHeading } from "./Common";
import AnnotatableText from "./AnnotatableText";
import { estimateAcademicReadingBand, recordPracticeAttempt, getStudyActivity, recordStudyActivity, replaceWrongItemsForSource } from "../lib/localStudyStore";
import { getReadingAnnotations, saveReadingAnnotations } from "../lib/readingAnnotationStore";
import { setReadingStatus } from "../lib/readingStatus";
import { scrollElementToTopAfterRender } from "../lib/pageScroll";
import InsperaChrome from "./InsperaChrome";

import {sameAnswer,sameSet,articleQuestionIds,answeredQuestionCount,scoreArticle,articleResults} from "../lib/readingScoring";

function ReadingPassage({ article, answerHighlights = [], annotations = [], setAnnotations = () => {}, onAnnotationsChange, showTranslations = false, annotationsEnabled = true }) {
  return (
    <section className="reading-paper-panel">
      <header className="reading-passage-head">
        <span>Reading Passage {article.part.slice(1)}</span>
        <h2>{article.title}</h2>
        {article.chineseTitle && <p>{article.chineseTitle}</p>}
      </header>
      {article.intro && (
        <div className="reading-intro">
          {annotationsEnabled ? (
            <AnnotatableText as="p" text={article.intro} targetId="passage:intro" annotations={annotations} setAnnotations={setAnnotations} onAnnotationsChange={onAnnotationsChange} />
          ) : <p>{article.intro}</p>}
          {showTranslations && <p className="paragraph-translation">{article.introTranslation}</p>}
        </div>
      )}
      <div className="reading-passage-copy">
        {article.paragraphs.map((paragraph) => {
          return (
            <article key={paragraph.id} id={`paragraph-${article.id}-${paragraph.id}`}>
              <strong>{paragraph.id}</strong>
              <div>
                {annotationsEnabled ? (
                  <AnnotatableText as="p" text={paragraph.text} targetId={`passage:${paragraph.id}`} annotations={[...annotations,...answerHighlights]} setAnnotations={(next)=>setAnnotations(next.filter(a=>!a.id.startsWith("evidence:")))} onAnnotationsChange={onAnnotationsChange} />
                ) : <p>{paragraph.text}</p>}
                {showTranslations && <p className="paragraph-translation">{paragraph.translation}</p>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function QuestionFeedback({ response, answer, explanation, correct }) {
  return (
    <div className={`reading-answer-feedback ${correct ? "correct" : "incorrect"}`}>
      <span>{correct ? "回答正确" : `正确答案：${answer}`}</span>
      {!correct && <small>你的答案：{Array.isArray(response) ? response.join("、") : (response || "未作答")}</small>}
      <p className="reading-analysis-text">{explanation}</p>
    </div>
  );
}

function ReadingQuestionGroup({ group, responses, setResponse, submitted, annotations, setAnnotations }) {
  const annotate = (text, targetId, as = "span", className) => (
    <AnnotatableText
      as={as}
      text={text}
      targetId={targetId}
      annotations={annotations}
      setAnnotations={setAnnotations}
      className={className}
    />
  );
  const renderOption = (option, targetId) => sameAnswer(option.value, option.label) ? (
    <>
      <strong aria-hidden="true" />
      {annotate(option.label, targetId)}
    </>
  ) : (
    <>
      <strong>{option.value}</strong>
      {annotate(option.label, targetId)}
    </>
  );
  const optionBank = (targetPrefix) => (
    <div className="reading-option-bank" aria-label="备选项">
      {group.options.map((option) => (
        <div key={option.value}>
          {renderOption(option, `${targetPrefix}:${option.value}`)}
        </div>
      ))}
    </div>
  );
  const hasDescriptiveOptions = group.options?.some((option) => !sameAnswer(option.value, option.label));
  const answerSelect = ({ value, onChange, label, selectedValues = [], fieldKey }) => (
    <label className="answer-select-field" key={fieldKey}>
      <span>{label}</span>
      <select value={value || ""} onChange={(event) => onChange(event.target.value)} disabled={submitted}>
        <option value="">选择答案</option>
        {group.options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={selectedValues.includes(option.value) && option.value !== value}
          >
            {option.value}
          </option>
        ))}
      </select>
    </label>
  );

  if (group.type === "multi") {
    const selected = responses[group.id] || [];
    const answered = selected.filter(Boolean);
    const correct = sameSet(selected, group.answer);
    const updateAnswerAt = (index, value) => {
      const next = Array.from({ length: group.answer.length }, (_, answerIndex) => selected[answerIndex] || "");
      next[index] = value;
      setResponse(group.id, next);
    };
    return (
      <section className="reading-question-group" id={`question-${group.answerIds[0]}`}>
        <header><strong>{group.title}</strong>{annotate(group.instruction, `question:${group.id}:instruction`, "p")}</header>
        {group.questionImage && <img className="reading-question-image" src={group.questionImage} alt={`${group.title} 原题图示`} />}
        {optionBank(`question:${group.id}:option`)}
        <div className="reading-answer-slots">
          {group.answerIds.map((id, index) => answerSelect({
            value: selected[index],
            onChange: (value) => updateAnswerAt(index, value),
            label: `第 ${id} 题`,
            selectedValues: answered,
            fieldKey: id,
          }))}
        </div>
        <small className="selection-count">已作答 {answered.length} / {group.answer.length}</small>
        {submitted && <QuestionFeedback response={selected} answer={group.answer.join("、")} explanation={group.explanation} correct={correct} />}
      </section>
    );
  }

  return (
    <section className="reading-question-group">
      <header><strong>{group.title}</strong>{annotate(group.instruction, `question:${group.id}:instruction`, "p")}</header>
      {group.questionImage && <img className="reading-question-image" src={group.questionImage} alt={`${group.title} 原题图示`} />}
      {group.passage && annotate(group.passage, `question:${group.id}:summary`, "p", "reading-summary-passage")}
      {group.type === "select" && hasDescriptiveOptions && optionBank(`question:${group.id}:option`)}
      <div className="reading-question-list">
        {group.questions.map((question) => {
          const response = responses[question.id] || "";
          const correct = sameAnswer(response, question.answer);
          return (
            <article key={question.id} id={`question-${question.id}`} className={submitted ? (correct ? "correct" : "incorrect") : ""}>
              <span>{question.id}</span>
              <div>
                {annotate(question.text, `question:${question.id}:text`, "p")}
                {group.type === "select" ? (
                  answerSelect({
                    value: response,
                    onChange: (value) => setResponse(question.id, value),
                    label: `第 ${question.id} 题答案`,
                  })
                ) : (
                  <input value={response} disabled={submitted} onChange={(event) => setResponse(question.id, event.target.value)} placeholder="输入答案" />
                )}
                {submitted && <QuestionFeedback response={response} answer={question.answer} explanation={question.explanation} correct={correct} />}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default function ReadingPractice({
  article,
  freshAttempt = false,
  embedded = false,
  onBack,
  onOpenPdf,
  onOpenFeishu,
  onOpenStudy,
  initialQuestionId,
  mockPosition,
  reviewResult,
  onMockSubmit,
  backLabel = "返回阅读题库",
}) {
  const beganAt = useRef(Date.now());
  const questionIds = useMemo(() => articleQuestionIds(article), [article]);
  const articleKey = article.archiveItemId || article.articleId;
  const sourceKey = `reading:${articleKey}`;
  const saved = getStudyActivity(`reading:article:${articleKey}`)
    || getStudyActivity(`reading:article:${article.articleId}`);
  const [responses, setResponses] = useState(reviewResult?.responses || (mockPosition || freshAttempt ? {} : (saved?.responses || {})));
  const [submitted, setSubmitted] = useState(Boolean(reviewResult) || (!mockPosition && !freshAttempt && Boolean(saved?.review)));
  const [sessionAnnotations, setSessionAnnotations] = useState(reviewResult?.annotations || getReadingAnnotations(article.id));
  const [focusQuestion, setFocusQuestion] = useState(initialQuestionId || questionIds[0] || null);

  useEffect(() => {
    setResponses(reviewResult?.responses || (mockPosition || freshAttempt ? {} : (saved?.responses || {})));
    setSubmitted(Boolean(reviewResult) || (!mockPosition && !freshAttempt && Boolean(saved?.review)));
    setSessionAnnotations(reviewResult?.annotations || getReadingAnnotations(article.id));
    setFocusQuestion(initialQuestionId || questionIds[0] || null);
  }, [article.id, mockPosition?.current, reviewResult, initialQuestionId]);

  useEffect(() => {
    if (mockPosition || reviewResult) return;
    const completed = answeredQuestionCount(article, responses);
    recordStudyActivity({
      id: `reading:article:${articleKey}`,
      page: "reading",
      subject: "阅读",
      title: article.title,
      detail: submitted ? `已提交，得分 ${scoreArticle(article, responses)} / ${questionIds.length}` : `已作答 ${completed} / ${questionIds.length} 题`,
      intent: { tab: "index", articleId: article.articleId, archiveItemId: article.archiveItemId, practice: true },
      responses,
      review: submitted,
      progress: { completed, total: questionIds.length },
      score: submitted ? estimateAcademicReadingBand(scoreArticle(article, responses), questionIds.length) : null,
      rawScore: submitted ? scoreArticle(article, responses) : null,
      rawTotal: questionIds.length,
    });
  }, [article, mockPosition, questionIds.length, responses, reviewResult, submitted]);

  useEffect(() => {
    if (!initialQuestionId) return;
    const targetGroup = article.questionGroups.find((group) => (
      group.type === "multi" && group.answerIds?.map(String).includes(String(initialQuestionId))
    ));
    const targetQuestionId = targetGroup?.answerIds?.[0] || initialQuestionId;
    const timer = window.setTimeout(() => {
      document.getElementById(`question-${targetQuestionId}`)?.scrollIntoView({ behavior: "auto", block: "start" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [article.questionGroups, initialQuestionId]);

  useEffect(()=>{ if(!reviewResult) saveReadingAnnotations(article.id,sessionAnnotations); },[article.id,sessionAnnotations,reviewResult]);

  const score = scoreArticle(article, responses);
  const results = articleResults(article, responses);

  const updateResponse = (key, value) => {
    if (submitted) return;
    setResponses((current) => ({ ...current, [key]: value }));
  };

  const submit = () => {
    if (submitted) return;
    setReadingStatus(article.id,{done:true});
    const wrongItems = article.questionGroups.flatMap((group) => {
      if (group.type === "multi") {
        const response = responses[group.id] || [];
        if (sameSet(response, group.answer)) return [];
        return [{
          id: `${sourceKey}:q${group.id}`,
          sourceKey,
          subject: "阅读",
          title: article.title,
          detail: `${article.part} / Questions ${group.id}`,
          reason: response.length ? "答案不一致" : "未作答",
          articleId: article.articleId,
          archiveItemId: article.archiveItemId,
          readingId: article.id,
          questionId: group.answerIds[0],
          questionText: group.instruction,
          userAnswer: response.join("、") || "未作答",
          correctAnswer: group.answer.join("、"),
          explanation: group.explanation,
          updatedAt: Date.now(),
        }];
      }
      return group.questions.flatMap((question) => {
        const response = responses[question.id] || "";
        if (sameAnswer(response, question.answer)) return [];
        return [{
          id: `${sourceKey}:q${question.id}`,
          sourceKey,
          subject: "阅读",
          title: article.title,
          detail: `${article.part} / Question ${question.id}`,
          reason: response ? "答案不一致" : "未作答",
          articleId: article.articleId,
          archiveItemId: article.archiveItemId,
          readingId: article.id,
          questionId: question.id,
          questionText: question.text,
          userAnswer: response || "未作答",
          correctAnswer: question.answer,
          explanation: question.explanation,
          updatedAt: Date.now(),
        }];
      });
    });
    replaceWrongItemsForSource(sourceKey, wrongItems);
    if (mockPosition) {
      onMockSubmit?.({ article, score, total: questionIds.length, questions: results, responses, annotations: sessionAnnotations });
      return;
    }
    recordPracticeAttempt({id:`reading:article:${articleKey}`,page:"reading",subject:"阅读",title:article.title,detail:`已提交 · ${score}/${questionIds.length}`,responses,score:estimateAcademicReadingBand(score,questionIds.length),rawScore:score,rawTotal:questionIds.length,review:true,durationSeconds:Math.round((Date.now()-beganAt.current)/1000),intent:{tab:"index",articleId:article.articleId,archiveItemId:article.archiveItemId,practice:true}});
    setSubmitted(true);
    scrollElementToTopAfterRender(`question-${questionIds[0]}`);
  };

  const reset = () => {
    beganAt.current = Date.now();
    setResponses({});
    setSubmitted(false);
    setSessionAnnotations([]);
    replaceWrongItemsForSource(sourceKey, []);
  };

  const navigateQuestion = (id) => {
    setFocusQuestion(String(id));
    const group = article.questionGroups.find((g) => g.type === "multi" && g.answerIds?.map(String).includes(String(id)));
    document.getElementById(`question-${group?.answerIds?.[0] || id}`)?.scrollIntoView({block:"center"});
  };
  return (
    <div className={embedded ? "reading-recall-questions" : "page reading-practice-page exam-surface"}>
      {!embedded && <>
      <div className="practice-topline">
        <Button variant="text" icon={ArrowLeft} onClick={onBack}>{backLabel}</Button>
        {mockPosition && <MetaTag tone="soft">套题 {mockPosition.current} / {mockPosition.total}</MetaTag>}
      </div>
      <InsperaChrome key={article.id} storageKey={`reading:${article.id}`} subject="阅读" part={Number(article.part?.replace("P","")) || mockPosition?.current || 1} totalParts={mockPosition?.total || 3} questionIds={questionIds} activeQuestion={focusQuestion || questionIds[0]} responses={responses} isAnswered={(id) => { const group=article.questionGroups.find(g=>g.type==="multi" && g.answerIds?.map(String).includes(String(id))); return group ? Boolean((responses[group.id]||[])[group.answerIds.map(String).indexOf(String(id))]) : Boolean(String(responses[id]||"").trim()); }} onQuestion={navigateQuestion}/>
      <PageHeading
        eyebrow={`${article.part} / ${article.frequency}`}
        title={article.title}
        actions={
          <>
            {submitted && onOpenStudy && <Button variant="ghost" icon={NotePencil} onClick={onOpenStudy}>查看索引精读</Button>}
            {!mockPosition && onOpenPdf && <Button variant="ghost" icon={FilePdf} onClick={onOpenPdf}>原题 PDF</Button>}
            {!mockPosition && onOpenFeishu && <Button variant="ghost" icon={LinkSimple} onClick={onOpenFeishu}>飞书精读</Button>}
            {submitted && !reviewResult && <Button variant="ghost" icon={ArrowClockwise} onClick={reset}>重新练习</Button>}
          </>
        }
      />

      </>}
      {embedded && <h2>重新作答</h2>}
      <div className="reading-mode-switch" role="note"><strong>{submitted ? "背题模式 · 已提交" : "背题模式"}</strong><span>{submitted ? "答案与解析已解锁。" : "先完成并提交作答，提交前不会显示答案和解析。"}</span>{onOpenStudy && <Button variant="ghost" icon={NotePencil} onClick={onOpenStudy}>切换精读模式</Button>}</div>

      <div className="reading-practice-layout">
        <ReadingPassage
          article={article}
          annotations={sessionAnnotations}
          setAnnotations={setSessionAnnotations}
          annotationsEnabled
        />
        <aside className="reading-questions-panel">
          <div className="reading-practice-hint">
            <NotePencil size={16} />
            <span>正文、题干和选项都可选中后右键标记；批注保存在本机，返回本篇仍可查看。</span>
          </div>
          {article.questionGroups.map((group) => (
            <ReadingQuestionGroup
              key={group.id}
              group={group}
              responses={responses}
              setResponse={updateResponse}
              submitted={submitted}
              annotations={sessionAnnotations}
              setAnnotations={setSessionAnnotations}
            />
          ))}
        </aside>
      </div>

      {submitted && article.analysisImages?.length>0 && <details className="reading-source-analysis"><summary>原始 PDF 解析图片 · 定位、翻译与同义替换</summary>{article.analysisImages.map(src=><a key={src} href={src} target="_blank" rel="noreferrer"><img loading="lazy" src={src} alt={`${article.title} 原始解析，点击放大`}/></a>)}</details>}
      <div className="reading-question-nav">
        <span>题号</span>
        <div>
          {questionIds.map((id) => {
            const result = results.find((item) => String(item.id) === String(id));
            const answered = result?.multi ? Boolean(responses[result.groupId]?.length) : Boolean(responses[id]);
            return <a key={id} href={`#question-${result?.multi ? result.groupId.split("-")[0] : id}`} className={`${answered ? "answered" : ""}${submitted && !result?.correct ? " incorrect" : ""}`}>{id}</a>;
          })}
        </div>
        {submitted && <strong>{score} / {questionIds.length}</strong>}
      </div>

      <div className="practice-footer">
        <Button variant="ghost" onClick={onBack}>暂存退出</Button>
        {!submitted ? (
          <Button icon={Check} onClick={submit}>提交答案</Button>
        ) : (
          <Button icon={ArrowRight} onClick={onBack}>完成复盘</Button>
        )}
      </div>
    </div>
  );
}

export { ReadingQuestionGroup, ReadingPassage, articleQuestionIds, articleResults, scoreArticle };
