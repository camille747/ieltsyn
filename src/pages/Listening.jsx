import { LearningWorkspace, ResourceEntry, StudyEmpty } from "../components/LearningUI";
import { findQuestion, multipleQuestionIds } from "../lib/listeningScoring";
import SetBuilder from "../components/SetBuilder";
import PracticeHistory from "../components/PracticeHistory";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowClockwise,
  ArrowLeft,
  ArrowRight,
  Check,
  Headphones,
  ListChecks,
  LockSimple,
  Pause,
  Play,
  SpeakerHigh,
  WarningCircle,
} from "@phosphor-icons/react";
import listeningIndex from "../data/listening-index.json";
import listening232Index from "../data/listening-232-index.json";
import AnnotatableText from "../components/AnnotatableText";
import {
  Button,
  LoadingState,
  MetaTag,
  Pagination,
  PageHeading,
  SearchField,
  SectionHeading,
  Segmented,
  SelectField,
} from "../components/Common";
import {
  getStudyActivity,
  getStudyHistory,
  estimateListeningBand,
  recordStudyActivity,
  recordPracticeAttempt,
  replaceWrongItemsForSource,
} from "../lib/localStudyStore";
import { scrollElementToTopAfterRender, scrollPageToTopAfterRender } from "../lib/pageScroll";
import InsperaChrome from "../components/InsperaChrome";

const tabs = [
  { value: "library", label: "题库" },
  { value: "mock", label: "套题模式" },
  { value: "history", label: "练习记录" },
];

const listeningLibrary = listening232Index;
const listeningDataPath = (item) => `data/listening${item.collection === "232" ? "-232" : ""}/${item.id}.json`;
const listeningAudioPath = (item) => `media/listening${item.collection === "232" ? "-232" : ""}/${item.id}.mp3`;

const recallItems = [
  ["Swimming Lessons", "P1", "已匹配"],
  ["Washing Machine Warranty", "P1", "已匹配"],
  ["Shampoo Marketing Project", "P3", "已匹配"],
  ["Mangrove", "P4", "仅有标题"],
  ["Vikings", "P4", "仅有标题"],
  ["Holiday on Jackson Island", "P1", "已匹配"],
];

function frequencyTone(value) {
  return value === "高频" ? "dark" : value === "次高频" ? "soft" : "neutral";
}

function localAssetUrl(path) {
  if (window.location.protocol !== "file:") return `/${path}`;
  const prefix = window.location.pathname.includes("/dist/") ? "./" : "./public/";
  return new URL(`${prefix}${path}`, window.location.href).href;
}

import {expectedAnswer,responseForQuestion,hasResponseForQuestion,answerMatches,calculateScore} from "../lib/listeningScoring";
function timestampToSeconds(value = "") {
  const match = String(value).match(/(\d{2}):(\d{2}):(\d{2})[,\.](\d{3})/);
  if (!match) return 0;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000;
}

function plainTranscriptText(value = "") {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function analysisQuestionIds(value = "") {
  const ids = new Set();
  const text = plainTranscriptText(value);
  const numberList = String.raw`\d+(?:\s*(?:[-–—~至到和、,，及与]\s*\d+))*`;

  const addReferences = (body) => {
    const numbers = [...String(body).matchAll(/\d+/g)].map((match) => Number(match[0]));
    if (!numbers.length) return;
    if (/[-–—~至到]/.test(body) && numbers.length === 2) {
      let [start, end] = numbers;
      if (end < start) [start, end] = [end, start];
      for (let id = start; id <= end; id += 1) ids.add(String(id));
      return;
    }
    numbers.forEach((id) => ids.add(String(id)));
  };

  for (const match of text.matchAll(new RegExp(`第\\s*(${numberList})\\s*题`, "gi"))) {
    addReferences(match[1]);
  }
  for (const match of text.matchAll(new RegExp(`问题\\s*(${numberList})\\s*(?:题)?`, "gi"))) {
    addReferences(match[1]);
  }
  for (const match of text.matchAll(/\bQ\s*(\d+)\b/gi)) {
    ids.add(String(Number(match[1])));
  }

  return ids;
}

function transcriptIndexForQuestion(data, questionId) {
  if (!data?.transcriptLines?.length) return -1;
  const normalizedQuestionId = String(questionId);
  const directMatches = data.transcriptLines
    .map((line, index) => ({ index, analysis: plainTranscriptText(line.analysis) }))
    .filter(({ analysis }) => analysisQuestionIds(analysis).has(normalizedQuestionId));

  if (directMatches.length) {
    const expected = expectedAnswer(data, normalizedQuestionId);
    const option = typeof expected === "string" && /^[A-Z]$/i.test(expected.trim()) ? expected.trim() : "";
    if (option) {
      const optionPattern = new RegExp(`(?:正确答案\\s*(?:是|为|:|：)?\\s*${option}\\b|选项\\s*${option}\\b)`, "i");
      const preferred = directMatches.find(({ analysis }) => optionPattern.test(analysis) && analysis.includes("正确答案"));
      if (preferred) return preferred.index;
    }
    return directMatches[0].index;
  }

  const answerText = data.transcriptHighlights?.find((highlight) => String(highlight.qid) === normalizedQuestionId)?.text;
  if (!answerText) return -1;
  const normalized = plainTranscriptText(answerText).toLowerCase();
  return data.transcriptLines.findIndex((line) => plainTranscriptText(line.html).toLowerCase().includes(normalized));
}

function mockQuestionResults(data, responses) {
  return data.questionIds.map((id) => {
    const expected = expectedAnswer(data, id);
    const response = responseForQuestion(data, responses, id);
    const question = findQuestion(data, id);
    return {
      id: String(id),
      response: Array.isArray(response) ? response.join("、") : (response || "未作答"),
      expected,
      correct: answerMatches(response, expected),
      text: question.text,
    };
  });
}

function TranscriptPanel({ data, review, audioRef, activeLine, setActiveLine, focusQuestion }) {
  const [showEnglish, setShowEnglish] = useState(true);
  const [showChinese, setShowChinese] = useState(true);
  const [showAnalysis, setShowAnalysis] = useState(true);
  const lineRefs = useRef([]);

  useEffect(() => {
    if (activeLine < 0) return;
    lineRefs.current[activeLine]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeLine]);

  useEffect(() => {
    if (!review || focusQuestion == null) return;
    const nextIndex = transcriptIndexForQuestion(data, focusQuestion);
    if (nextIndex >= 0) setActiveLine(nextIndex);
  }, [data, focusQuestion, review, setActiveLine]);

  const playLine = (index, shouldPlay = true) => {
    const line = data.transcriptLines[index];
    if (!line || !audioRef.current) return;
    audioRef.current.currentTime = timestampToSeconds(line.time.split(" --> ")[0]);
    setActiveLine(index);
    if (shouldPlay) audioRef.current.play().catch(() => {});
  };

  if (!review) {
    return (
      <section className="transcript-panel transcript-locked">
        <LockSimple size={24} />
        <h3>原文与精听</h3>
        <p>提交答案后显示逐句原文、中文翻译和题目解析。</p>
      </section>
    );
  }

  return (
    <section className="transcript-panel">
      <header>
        <div><span>Transcript</span><h3>原文与精听</h3></div>
        <div className="transcript-controls">
          <Button variant="ghost" onClick={() => playLine(Math.max(0, activeLine - 1))}>上一句</Button>
          <Button icon={activeLine >= 0 && !audioRef.current?.paused ? Pause : Play} onClick={() => {
            if (!audioRef.current) return;
            if (!audioRef.current.paused) audioRef.current.pause();
            else playLine(Math.max(0, activeLine));
          }}>播放</Button>
          <Button variant="ghost" onClick={() => playLine(Math.min(data.transcriptLines.length - 1, activeLine + 1))}>下一句</Button>
        </div>
        <div className="transcript-toggles">
          <button type="button" className={showEnglish ? "active" : ""} onClick={() => setShowEnglish((value) => !value)}>原文</button>
          <button type="button" className={showChinese ? "active" : ""} onClick={() => setShowChinese((value) => !value)}>中文</button>
          <button type="button" className={showAnalysis ? "active" : ""} onClick={() => setShowAnalysis((value) => !value)}>解析</button>
        </div>
      </header>
      <div className="transcript-lines">
        {data.transcriptLines.map((line, index) => (
          <button
            type="button"
            ref={(node) => { lineRefs.current[index] = node; }}
            key={`${line.time}-${index}`}
            className={index === activeLine ? "active" : ""}
            onClick={() => playLine(index)}
          >
            <time>{line.time}</time>
            {showEnglish && <p dangerouslySetInnerHTML={{ __html: line.html }} />}
            {showChinese && line.cn && <p className="transcript-cn" dangerouslySetInnerHTML={{ __html: line.cn }} />}
            {showAnalysis && line.analysis && <div className="analysis-note" dangerouslySetInnerHTML={{ __html: line.analysis }} />}
          </button>
        ))}
      </div>
    </section>
  );
}

function QuestionResult({ id, response, answer, review }) {
  if (!review) return null;
  const values = Array.isArray(response) ? response.map(String) : [String(response ?? "")];
  const correct = values.some((value) => value.trim().toLowerCase() === String(answer ?? "").trim().toLowerCase());
  return (
    <div className={`answer-result ${correct ? "correct" : "incorrect"}`}>
      {correct ? <Check size={15} weight="bold" /> : <WarningCircle size={15} weight="bold" />}
      <span>{correct ? "回答正确" : `正确答案：${answer || "资料中未提供"}`}</span>
    </div>
  );
}

function PracticeGroup({ group, groupKey, responses, setResponse, answerKey, review, annotations, setAnnotations }) {
  const annotationPrefix = `listening:${group.id || groupKey}`;
  const annotate = (text, targetId, as = "span", className) => (
    <AnnotatableText
      as={as}
      text={text}
      targetId={`${annotationPrefix}:${targetId}`}
      annotations={annotations}
      setAnnotations={setAnnotations}
      className={className}
    />
  );
  const optionList = (options, targetPrefix) => (
    <div className="choice-text-list" aria-label="备选项">
      {options.map(([value, text]) => (
        <div key={value} className={String(value).trim().toLowerCase() === String(text).trim().toLowerCase() ? "same-value" : ""}>
          {String(value).trim().toLowerCase() !== String(text).trim().toLowerCase() && <strong>{value}</strong>}
          {annotate(text || value, `${targetPrefix}:${value}`)}
        </div>
      ))}
    </div>
  );
  const answerSelect = ({ value, onChange, label, options, selectedValues = [], fieldKey }) => (
    <label className="answer-select-field" id={fieldKey ? `question-${fieldKey}` : undefined} key={fieldKey}>
      <span>{label}</span>
      <select value={value || ""} onChange={(event) => onChange(event.target.value)} disabled={review}>
        <option value="">选择答案</option>
        {options.map(([optionValue]) => (
          <option
            key={optionValue}
            value={optionValue}
            disabled={selectedValues.includes(optionValue) && optionValue !== value}
          >
            {optionValue}
          </option>
        ))}
      </select>
    </label>
  );

  if (group.type === "fill") {
    return (
      <section className="question-group">
        <h3>{group.title}</h3>
        {annotate(`${group.instruction}.`, "instruction", "p", "instruction")}
        <div className="fill-questions">
          {group.questions.map((question) => {
            const key = `q${question.id}`;
            return (
              <label className="fill-question" id={`question-${question.id}`} key={key}>
                <strong>{question.id}</strong>
                {annotate(question.text.replace(new RegExp(`${question.id}\\.\\s*_+`, "g"), "________"), `question:${question.id}`)}
                <input
                  aria-label={`第 ${question.id} 题答案`}
                  value={responses[key] || ""}
                  onChange={(event) => setResponse(key, event.target.value)}
                  disabled={review}
                  placeholder="输入答案"
                />
                <QuestionResult id={question.id} response={responses[key]} answer={answerKey.text?.[key]} review={review} />
              </label>
            );
          })}
        </div>
      </section>
    );
  }

  if (group.type === "single") {
    return (
      <section className="question-group">
        <h3>{group.title}</h3>
        {annotate(group.instruction, "instruction", "p", "instruction")}
        {group.questions.map((question) => {
          const key = `q${question.id}`;
          return (
            <div className="choice-question" id={`question-${question.id}`} key={key}>
              <h4><span>{question.id}</span>{annotate(question.text, `question:${question.id}`)}</h4>
              {optionList(question.options, `question:${question.id}:option`)}
              {answerSelect({
                value: responses[key],
                onChange: (value) => setResponse(key, value),
                label: `第 ${question.id} 题答案`,
                options: question.options,
              })}
              <QuestionResult id={question.id} response={responses[key]} answer={answerKey.single?.[key]} review={review} />
            </div>
          );
        })}
      </section>
    );
  }

  if (group.type === "map") {
    return <section className="question-group"><h3>{group.title}</h3>{annotate(group.instruction,"instruction","p","instruction")}<img className="listening-diagram" src={group.image} alt="本题原始地图或结构图"/><div className="matching-questions">{group.questions.map(([id,text])=><div id={`question-${id}`} key={id}><strong>{id}</strong>{annotate(text,`question:${id}`)}<select aria-label={`第 ${id} 题答案`} disabled={review} value={responses[`q${id}`]||""} onChange={event=>setResponse(`q${id}`,event.target.value)}><option value="">选择</option>{group.options.map(value=><option key={value} value={value}>{value}</option>)}</select><QuestionResult id={id} response={responses[`q${id}`]} answer={answerKey.map?.[`q${id}`]} review={review}/></div>)}</div></section>;
  }
  if (group.type === "matching") {
    return (
      <section className="question-group">
        <h3>{group.title}</h3>
        {annotate(group.instruction, "instruction", "p", "instruction")}
        <div className="matching-options">
          {group.options.map(([value, text]) => <span key={value}><strong>{value}</strong>{annotate(text, `option:${value}`)}</span>)}
        </div>
        <div className="matching-questions">
          {group.questions.map(([id, text]) => {
            const key = `q${id}`;
            return (
              <div id={`question-${id}`} key={key}>
                <strong>{id}</strong>
                {annotate(text, `question:${id}`)}
                <select value={responses[key] || ""} onChange={(event) => setResponse(key, event.target.value)} disabled={review}>
                  <option value="">选择</option>
                  {group.options.map(([value]) => <option key={value} value={value}>{value}</option>)}
                </select>
                <QuestionResult id={id} response={responses[key]} answer={answerKey.matching?.[key]} review={review} />
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  if (group.type === "multiple") {
    const key = `multi:${group.id}`;
    const selected = responses[key] || [];
    const selectedValues = selected.filter(Boolean);
    const questionIds = multipleQuestionIds(group);
    const updateAnswerAt = (index, value) => {
      if (review) return;
      const next = Array.from({ length: group.limit }, (_, answerIndex) => selected[answerIndex] || "");
      next[index] = value;
      setResponse(key, next);
    };
    return (
      <section className="question-group">
        <h3>{group.title}</h3>
        {annotate(group.instruction, "instruction", "p", "instruction")}
        <div className="choice-question">
          {annotate(group.questionText, "question", "h4")}
          {optionList(group.options, "option")}
          <div className="answer-slot-grid">
            {Array.from({ length: group.limit }, (_, index) => answerSelect({
              value: selected[index],
              onChange: (value) => updateAnswerAt(index, value),
              label: `第 ${questionIds[index] || index + 1} 题答案`,
              options: group.options,
              selectedValues,
              fieldKey: questionIds[index] || index,
            }))}
          </div>
          {review && (
            <div className="answer-result neutral">
              <ListChecks size={16} />
              <span>正确答案：{answerKey.multiple?.[`q${group.id.replace("-", "_")}`]?.join("、") || "资料中未提供"}</span>
            </div>
          )}
        </div>
      </section>
    );
  }

  return null;
}

function ListeningPractice({ item, onBack, backLabel = "返回题库", mockPosition, reviewResult, onMockSubmit, initialQuestionId }) {
  const [data, setData] = useState(null);
  const [responses, setResponses] = useState({});
  const [review, setReview] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [activeLine, setActiveLine] = useState(-1);
  const [focusQuestion, setFocusQuestion] = useState(initialQuestionId || null);

  const [sessionAnnotations, setSessionAnnotations] = useState([]);
  const audioRef = useRef(null);
  const beganAt = useRef(Date.now());

  useEffect(() => {
    setData(null);
    setResponses({});
    setReview(false);
    setLoadError(false);
    setActiveLine(-1);
    setFocusQuestion(initialQuestionId || null);

    setSessionAnnotations(reviewResult?.annotations || []);
    fetch(localAssetUrl(listeningDataPath(item)))
      .then((response) => {
        if (!response.ok) throw new Error("load failed");
        return response.json();
      })
      .then((nextData) => {
        const saved = getStudyActivity(`listening:${item.id}`);
        const detachedResponses = reviewResult?.responses || {};
        setData(nextData);
        setResponses(reviewResult ? detachedResponses : (mockPosition ? {} : (saved?.responses || {})));
        setReview(Boolean(reviewResult) || (!mockPosition && Boolean(saved?.review)));
        if (mockPosition || reviewResult) return;
        recordStudyActivity({
          id: `listening:${item.id}`,
          page: "listening",
          subject: "听力",
          title: item.title,
          detail: saved?.detail || `${item.part} / ${nextData.questionIds.length} 题`,
          intent: { tab: "library", itemId: item.id },
          responses: saved?.responses || {},
          review: Boolean(saved?.review),
          progress: saved?.progress || { completed: 0, total: nextData.questionIds.length },
        });
      })
      .catch(() => setLoadError(true));
  }, [initialQuestionId, item.id, mockPosition?.current, reviewResult]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    if (!data || !initialQuestionId) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`question-${initialQuestionId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      const lineIndex = transcriptIndexForQuestion(data, initialQuestionId);
      if (lineIndex >= 0) {
        setActiveLine(lineIndex);
        if (audioRef.current) audioRef.current.currentTime = timestampToSeconds(data.transcriptLines[lineIndex].time.split(" --> ")[0]);
      }
    }, 120);
    return () => window.clearTimeout(timer);
  }, [data, initialQuestionId]);

  const saveProgress = (nextResponses, nextReview = review) => {
    if (!data || mockPosition || reviewResult) return;
    const completed = data.questionIds.filter((id) => hasResponseForQuestion(data, nextResponses, id)).length;
    recordStudyActivity({
      id: `listening:${item.id}`,
      page: "listening",
      subject: "听力",
      title: item.title,
      detail: nextReview ? `已提交，得分 ${calculateScore(data, nextResponses)} / ${data.questionIds.length}` : `已作答 ${completed} / ${data.questionIds.length} 题`,
      intent: { tab: "library", itemId: item.id },
      responses: nextResponses,
      review: nextReview,
      progress: { completed, total: data.questionIds.length },
      score: nextReview ? estimateListeningBand(calculateScore(data, nextResponses), data.questionIds.length) : null,
      rawScore: nextReview ? calculateScore(data, nextResponses) : null,
      rawTotal: data.questionIds.length,
    });
  };

  const setResponse = (key, value) => setResponses((current) => {
    const next = { ...current, [key]: value };
    saveProgress(next);
    return next;
  });

  const score = useMemo(() => calculateScore(data, responses), [data, responses]);

  const resetPractice = () => {
    beganAt.current = Date.now();
    setResponses({});
    setReview(false);
    setSessionAnnotations([]);
    saveProgress({}, false);
    replaceWrongItemsForSource(`listening:${item.id}`, []);
  };

  const submitPractice = () => {
    const wrongItems = data.questionIds.flatMap((id) => {
      const expected = expectedAnswer(data, id);
      if (!expected) return [];
      const response = responseForQuestion(data, responses, id);
      if (answerMatches(response, expected)) return [];
      const question = findQuestion(data, id);
      return [{
        id: `listening:${item.id}:q${id}`,
        sourceKey: `listening:${item.id}`,
        subject: "听力",
        title: item.title,
        detail: `Question ${id}`,
        reason: Array.isArray(response) || String(response || "").trim() ? "答案不一致" : "未作答",
        sourceId: item.id,
        part: item.part,
        questionId: String(id),
        questionText: question.text,
        instruction: question.instruction,
        userAnswer: Array.isArray(response) ? response.join("、") : (response || "未作答"),
        correctAnswer: expected,
        updatedAt: Date.now(),
      }];
    });
    replaceWrongItemsForSource(`listening:${item.id}`, wrongItems);
    const result = {
      item,
      score: calculateScore(data, responses),
      total: data.questionIds.length,
      questions: mockQuestionResults(data, responses),
      responses,
      annotations: sessionAnnotations,
    };
    if (mockPosition) {
      onMockSubmit?.(result);
      return;
    }
    recordPracticeAttempt({id:`listening:${item.id}`,page:"listening",subject:"听力",title:item.title,detail:`已提交 · ${result.score}/${result.total}`,responses,score:estimateListeningBand(result.score,result.total),rawScore:result.score,rawTotal:result.total,durationSeconds:Math.round((Date.now()-beganAt.current)/1000),review:true,intent:{tab:"library",itemId:item.id}});
    setReview(true);
    saveProgress(responses, true);
    scrollElementToTopAfterRender(`question-${data.questionIds[0]}`);
  };

  const focusTranscriptQuestion = (id) => {
    setFocusQuestion(String(id));
    document.getElementById(`question-${id}`)?.scrollIntoView({block:"center"});
    const lineIndex = transcriptIndexForQuestion(data, id);
    if (review && lineIndex >= 0) {
      setActiveLine(lineIndex);
      if (audioRef.current) audioRef.current.currentTime = timestampToSeconds(data.transcriptLines[lineIndex].time.split(" --> ")[0]);
    }
  };

  const handleAudioTime = () => {
    if (!data?.transcriptLines?.length || !audioRef.current) return;
    const currentTime = audioRef.current.currentTime;
    const nextIndex = data.transcriptLines.findIndex((line) => {
      const [start, end] = line.time.split(" --> ").map(timestampToSeconds);
      return currentTime >= start && currentTime < end;
    });
    if (nextIndex >= 0 && nextIndex !== activeLine) setActiveLine(nextIndex);
  };

  if (loadError) {
    return (
      <div className="page practice-page exam-surface">
        <Button variant="text" icon={ArrowLeft} onClick={onBack}>{backLabel}</Button>
        <div className="error-panel"><WarningCircle size={28} /><h2>题目暂时无法读取</h2><p>本地题目文件没有成功载入。请从软件入口打开；如仍失败，请检查软件包是否完整。</p></div>
      </div>
    );
  }

  return (
    <div className="page practice-page exam-surface">
      <div className="practice-topline">
        <Button variant="text" icon={ArrowLeft} onClick={onBack}>{backLabel}</Button>
        {mockPosition && <MetaTag tone="soft">套题 {mockPosition.current} / {mockPosition.total}</MetaTag>}
      </div>
      <InsperaChrome key={item.id} storageKey={`listening:${item.id}`} isAnswered={(id) => data && hasResponseForQuestion(data,responses,id)} subject="听力" part={Number(String(item.part || "P1").replace("P", "")) || 1} totalParts={4} questionIds={data?.questionIds || []} activeQuestion={focusQuestion || data?.questionIds?.[0]} responses={responses} onQuestion={focusTranscriptQuestion} listening/>
      <PageHeading
        eyebrow={`${item.part} / ${item.frequency}`}
        title={item.title}
        actions={review && !reviewResult ? <Button variant="ghost" icon={ArrowClockwise} onClick={resetPractice}>重新练习</Button> : null}
      />

      <section className="audio-player-panel">
        <div className="audio-icon"><SpeakerHigh size={24} weight="fill" /></div>
        <div>
          <strong>听力音频</strong>
          <span>原始 MP3</span>
        </div>
        <audio ref={audioRef} controls preload="metadata" onTimeUpdate={handleAudioTime} src={localAssetUrl(listeningAudioPath(item))} />
        <div className="playback-rate" role="group" aria-label="音频倍速">
          {[0.75, 1, 1.25, 1.5].map((rate) => (
            <button type="button" key={rate} className={playbackRate === rate ? "active" : ""} onClick={() => setPlaybackRate(rate)}>{rate}x</button>
          ))}
        </div>
      </section>

      {data && (
        <div className="reading-practice-hint">
          <span>题干和选项都可选中后右键标记；提交批改后仍保留，退出本次练习后自动清除。</span>
        </div>
      )}

      {!data ? (
        <LoadingState className="practice-loading" label="正在读取题目、答案与解析..." />
      ) : (
        <>
          <div className="practice-layout">
            <div className="question-paper">
              {data.groups.map((group, index) => (
                <PracticeGroup
                  key={`${group.type}-${index}`}
                  groupKey={`${group.type}-${index}`}
                  group={group}
                  responses={responses}
                  setResponse={setResponse}
                  answerKey={data.answerKey || {}}
                  review={review}
                  annotations={sessionAnnotations}
                  setAnnotations={setSessionAnnotations}
                />
              ))}
            </div>
            <aside className="practice-side">
              <div className="question-navigator">
                <span>题号</span>
                <div>
                  {data.questionIds.map((id) => (
                    <a
                      key={id}
                      href={`#question-${id}`}
                      className={`${hasResponseForQuestion(data, responses, id) ? "answered" : ""}${review && !answerMatches(responseForQuestion(data, responses, id), expectedAnswer(data, id)) ? " incorrect" : ""}`}
                      onClick={() => review && focusTranscriptQuestion(id)}
                    >{id}</a>
                  ))}
                </div>
                {review && <div className="score-block"><strong>{score} / {data.questionIds.length}</strong><span>本次得分</span></div>}
              </div>
              <TranscriptPanel
                data={data}
                review={review}
                audioRef={audioRef}
                activeLine={activeLine}
                setActiveLine={setActiveLine}
                focusQuestion={focusQuestion}
              />
            </aside>
          </div>
          <div className="practice-footer">
            <Button variant="ghost" onClick={onBack}>暂存退出</Button>
            {!review ? (
              <Button icon={Check} onClick={submitPractice}>提交答案</Button>
            ) : (
              <Button icon={ArrowRight} onClick={onBack}>完成复盘</Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Library({ onOpen, state, onStateChange }) {
  const pageSize = 10;
  const { search, part, frequency, page } = state;
  const updateState = (change) => onStateChange((current) => ({ ...current, ...change }));

  const items = useMemo(() => listeningLibrary.filter((item) => {
    const matchesSearch = item.title.toLowerCase().includes(search.toLowerCase()) || String(item.id).includes(search);
    return matchesSearch && (part === "全部" || item.part === part) && (frequency === "全部频次" || item.frequency === frequency);
  }), [search, part, frequency]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pageItems = items.slice(pageStart, pageStart + pageSize);

  return (
    <>
      <div className="ui-content-heading"><div><h1>听力题库</h1><p>原创示例用于体验练习流程。提交后解锁原文与精听。</p></div></div>
      <div className="ui-filter-panel"><div className="filter-row"><SearchField value={search} onChange={(value)=>updateState({search:value,page:1})} placeholder="搜索题目或编号"/><SelectField value={frequency} onChange={(value)=>updateState({frequency:value,page:1})} label="频次"><option>全部频次</option><option>高频</option><option>次高频</option><option>非高频</option></SelectField></div><Segmented value={part} onChange={(value)=>updateState({part:value,page:1})} label="按 Part 筛选" options={["全部","P1","P2","P3","P4"]}/></div>
      <div className="ui-catalog-summary"><span>{items.length} 篇符合条件 · 第 {currentPage} 页</span><span>含原题与音频</span></div>
      <div className="ui-resource-grid">{pageItems.map(item=><ResourceEntry key={item.id} part={item.part} title={item.title} subtitle={`${item.part} · 10 道题 · 音频练习`} metadata={`编号 ${item.id} · ${item.frequency}`} status="可开始练习" onOpen={()=>onOpen(item)}/>)}</div>
      {!items.length&&<StudyEmpty icon={Headphones} title="没有找到匹配的练习" description="试试其他关键词，或放宽 Part 与频次条件。"/>}
      <Pagination page={currentPage} totalPages={totalPages} onChange={(value) => updateState({ page: value })} label="听力题库分页" />
    </>
  );
}

function MockBuilder({ onStart }) { return <SetBuilder items={listeningLibrary} parts={["P1","P2","P3","P4"]} subject="听力" onStart={onStart}/>; }

function MockResults({ results, onOpenQuestion, onBack }) {
  const score = results.reduce((sum, result) => sum + result.score, 0);
  const total = results.reduce((sum, result) => sum + result.total, 0);
  useEffect(() => {
    const firstResult = results[0];
    const firstQuestion = firstResult?.questions[0];
    if (firstResult && firstQuestion) {
      scrollElementToTopAfterRender(`listening-result-${firstResult.item.id}-${firstQuestion.id}`);
    }
  }, [results]);
  return (
    <div className="page mock-results-page">
      <Button variant="text" icon={ArrowLeft} onClick={onBack}>返回听力题库</Button>
      <PageHeading
        eyebrow="Listening / Mock result"
        title={<>套题 <em>批改结果</em></>}
        description="点击任意题目，进入题库中的对应原题与精听位置。"
      />
      <section className="accent-panel mock-score-hero">
        <span>本套成绩</span>
        <strong>{score} / {total}</strong>
        <p>P1、P2、P3、P4 各 10 题</p>
      </section>
      <div className="mock-result-sections">
        {results.map((result) => (
          <section key={result.item.id}>
            <header>
              <div><MetaTag tone={frequencyTone(result.item.frequency)}>{result.item.part}</MetaTag><h2>{result.item.title}</h2></div>
              <strong>{result.score} / {result.total}</strong>
            </header>
            <div className="mock-result-questions">
              {result.questions.map((question) => (
                <button
                  type="button"
                  key={question.id}
                  id={`listening-result-${result.item.id}-${question.id}`}
                  className={question.correct ? "correct" : "incorrect"}
                  onClick={() => onOpenQuestion(result.item, question.id, result)}
                >
                  <span>Question {question.id}</span>
                  <strong>{question.correct ? "回答正确" : `正确答案：${question.expected}`}</strong>
                  <small>进入原题精听 <ArrowRight size={13} /></small>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export default function Listening({ intent }) {
  const [tab, setTab] = useState(intent?.tab || "library");
  const [selected, setSelected] = useState(null);
  const [mockQueue, setMockQueue] = useState(null);
  const [mockIndex, setMockIndex] = useState(0);
  const [mockResults, setMockResults] = useState([]);
  const [showMockResults, setShowMockResults] = useState(false);
  const [focusQuestionId, setFocusQuestionId] = useState(null);
  const [reviewReturn, setReviewReturn] = useState(false);
  const [mockReviewResult, setMockReviewResult] = useState(null);
  const [libraryState, setLibraryState] = useState({ search: "", part: "全部", frequency: "全部频次", page: 1 });
  const returnScrollRef = useRef(0);

  const rememberPosition = () => {
    returnScrollRef.current = window.scrollY;
  };

  const restorePosition = () => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      window.scrollTo({ top: returnScrollRef.current, behavior: "auto" });
    }));
  };

  const openLibraryItem = (item) => {
    rememberPosition();
    setSelected(item);
    scrollPageToTopAfterRender();
  };

  useEffect(() => {
    if (intent?.tab) {
      setTab(intent.tab);
      if (!intent.itemId) {
        setSelected(null);
        setMockQueue(null);
        setMockIndex(0);
        setMockResults([]);
        setShowMockResults(false);
      }
    }
    if (intent?.itemId) {
      const item = listeningLibrary.find((entry) => String(entry.id) === String(intent.itemId));
      if (item) setSelected(item);
    }
  }, [intent]);

  const startMock = (items) => {
    setMockQueue(items);
    setMockIndex(0);
    setMockResults([]);
    setShowMockResults(false);
    setFocusQuestionId(null);
    setReviewReturn(false);
    setMockReviewResult(null);
    setSelected(items[0]);
    scrollPageToTopAfterRender();
  };

  const closePractice = () => {
    setSelected(null);
    setFocusQuestionId(null);
    if (reviewReturn) {
      setReviewReturn(false);
      setMockReviewResult(null);
      setShowMockResults(true);
      scrollPageToTopAfterRender();
      return;
    }
    setMockQueue(null);
    setMockIndex(0);
    restorePosition();
  };

  const finishMock = (finalResult) => {
    const completeResults = [...mockResults.filter((entry) => entry.item.id !== finalResult.item.id), finalResult];
    setMockResults(completeResults);
    const rawScore = completeResults.reduce((sum,result)=>sum+result.score,0);
    const rawTotal = completeResults.reduce((sum,result)=>sum+result.total,0);
    recordPracticeAttempt({id:"listening:mock",page:"listening",subject:"听力",title:"听力套题 P1–P4",detail:`已提交 · ${rawScore}/${rawTotal}`,score:estimateListeningBand(rawScore,rawTotal),rawScore,rawTotal,responses:Object.fromEntries(completeResults.map((e)=>[e.item.id,e.responses])),details:completeResults.map((e)=>({id:e.item.id,title:e.item.title,questions:e.questions})),intent:{tab:"history"}});
    setSelected(null);
    setFocusQuestionId(null);
    setShowMockResults(true);
    scrollPageToTopAfterRender();
  };

  const submitMockResult = (result) => {
    if (mockIndex + 1 < mockQueue.length) {
      setMockResults((current) => [...current.filter((entry) => entry.item.id !== result.item.id), result]);
      const next = mockIndex + 1;
      setMockIndex(next);
      setSelected(mockQueue[next]);
      setFocusQuestionId(null);
      scrollPageToTopAfterRender();
      return;
    }
    finishMock(result);
  };

  const openMockQuestion = (item, questionId, result) => {
    setShowMockResults(false);
    setReviewReturn(true);
    setMockReviewResult(result);
    setFocusQuestionId(String(questionId));
    setSelected(item);
    scrollPageToTopAfterRender();
  };

  if (showMockResults) {
    return (
      <MockResults
        results={[...mockResults].sort((a, b) => a.item.part.localeCompare(b.item.part))}
        onOpenQuestion={openMockQuestion}
        onBack={() => {
          setShowMockResults(false);
          setMockQueue(null);
          setMockIndex(0);
          setMockResults([]);
          setMockReviewResult(null);
          setTab("library");
        }}
      />
    );
  }

  if (selected) {
    return (
      <ListeningPractice
        item={selected}
        onBack={closePractice}
        backLabel={reviewReturn ? "返回套题结果" : "返回题库"}
        initialQuestionId={focusQuestionId}
        reviewResult={mockReviewResult}
        mockPosition={mockQueue && !reviewReturn ? { current: mockIndex + 1, total: mockQueue.length } : null}
        onMockSubmit={submitMockResult}
      />
    );
  }

  return (
    <div className="page">
      <LearningWorkspace title="听力" description="听懂，也听清。" active={tab} onChange={setTab} options={tabs} aside={<p>单篇练习支持保存作答。提交后，在精听中对照原文复盘。</p>}>
        {tab === "library" && <Library onOpen={openLibraryItem} state={libraryState} onStateChange={setLibraryState} />}
        {tab === "mock" && <MockBuilder onStart={startMock} />}
        {tab === "history" && <PracticeHistory subject="听力" onOpen={(entry) => { const item = [...listeningLibrary,...listeningIndex].find((i)=>String(i.id)===String(entry.intent?.itemId)); if(item) { setMockReviewResult(entry.submitted ? {responses:entry.responses,annotations:[]} : null); openLibraryItem(item); } }} />}
      </LearningWorkspace>
    </div>
  );
}

function ListeningHistory({ onOpen }) {
  const [history, setHistory] = useState(() => getStudyHistory().filter((item) => item.subject === "听力"));
  useEffect(() => {
    const refresh = () => setHistory(getStudyHistory().filter((item) => item.subject === "听力"));
    window.addEventListener("ielts-local-study-change", refresh);
    return () => window.removeEventListener("ielts-local-study-change", refresh);
  }, []);
  if (!history.length) return <div className="empty-state"><Headphones size={28}/><h3>还没有听力练习记录</h3></div>;
  return <div className="content-list">{history.map((entry) => {
    const item = listeningLibrary.find((record) => String(record.id) === String(entry.intent?.itemId));
    return <div key={entry.id}><MetaTag>{entry.detail || "听力练习"}</MetaTag><strong>{entry.title}</strong><span>{new Date(entry.updatedAt).toLocaleDateString("zh-CN")}</span>{item && <Button variant="text" icon={ArrowRight} onClick={() => onOpen(item)}>继续复盘</Button>}</div>;
  })}</div>;
}

export { PracticeGroup, calculateScore, mockQuestionResults, listeningLibrary, listeningDataPath, listeningAudioPath };
