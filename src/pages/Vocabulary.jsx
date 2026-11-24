import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowCounterClockwise,
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  Check,
  CheckCircle,
  FilePdf,
  FileXls,
  LinkSimple,
  SpeakerHigh,
  XCircle,
} from "@phosphor-icons/react";
import dictationData from "../data/dictation-words.json";
import readingGroups from "../data/reading-groups.json";
import readingVocabularyData from "../data/reading-vocabulary.json";
import { readingQuestionBankByArchiveItemId } from "../data/reading-question-bank";
import ReadingArticleDetail from "../components/ReadingArticleDetail";
import { BackButton, Button, MetaTag, PageHeading, SearchField, Segmented } from "../components/Common";
import {
  getDictationSession,
  recordDictationSession,
  recordStudyActivity,
  upsertWrongItems,
} from "../lib/localStudyStore";
import { scrollPageToTopAfterRender } from "../lib/pageScroll";
import { speakEnglish } from "../lib/speech";

const PAGE_SIZE = 50;
const readingArticleSources = new Map(
  readingGroups.flatMap((group) => group.items.map((item) => [
    item.fileName,
    { item, groupId: group.id, groupTitle: group.title },
  ])),
);
const allDictationWords = dictationData.units.flatMap((unit) => unit.words.map((word) => ({
  ...word,
  unitId: unit.id,
  unitLabel: unit.label,
})));

function localAssetUrl(path) {
  if (window.location.protocol !== "file:") return `/${path}`;
  const prefix = window.location.pathname.includes("/dist/") ? "./" : "./public/";
  return new URL(`${prefix}${path}`, window.location.href).href;
}

function openLocalDocument(event, path) {
  if (!window.ieltsDesktop?.openLocalDocument) return;
  event.preventDefault();
  void window.ieltsDesktop.openLocalDocument(localAssetUrl(path));
}

function normalizeAnswer(value) {
  return value.trim().toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ");
}

function compactTranslation(entry) {
  const translation = entry.translation?.replace(/\n+/g, "； ").replace(/\s+/g, " ").trim();
  if (!translation) return "ECDICT 未收录";
  if (!entry.partOfSpeech || /^(?:\[[^\]]+\]\s*)?(?:n|v|vt|vi|adj|adv|a|ad|prep|conj|pron|num|art|int|interj|aux)\./i.test(translation)) {
    return translation;
  }
  return `${entry.partOfSpeech} ${translation}`;
}

function shuffle(items) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }
  return next;
}

function DictationSetup({ onStart }) {
  const [source, setSource] = useState("all");
  const [count, setCount] = useState(20);
  const [order, setOrder] = useState("random");
  const selectedUnit = dictationData.units.find((unit) => unit.id === source);
  const maximum = selectedUnit?.count || dictationData.total;
  const normalizedCount = Math.min(maximum, Math.max(1, Number(count) || 1));

  useEffect(() => {
    setCount((value) => Math.min(maximum, Number(value) || 20));
  }, [maximum]);

  const start = () => {
    const pool = source === "all"
      ? allDictationWords
      : allDictationWords.filter((word) => word.unitId === source);
    const selected = (order === "random" ? shuffle(pool) : [...pool]).slice(0, normalizedCount);
    onStart(selected, {
      source,
      sourceLabel: selectedUnit?.label || "全部词库",
      count: normalizedCount,
      order,
    });
  };

  return (
    <div className="dictation-setup">
      <section className="dictation-setup-main">
        <div className="setup-heading">
          <span>开始前设置</span>
          <h2>选择本轮听写范围</h2>
        </div>
        <div className="dictation-source-grid">
          <button type="button" className={source === "all" ? "active" : ""} onClick={() => setSource("all")}>
            <span>完整词库</span><strong>{dictationData.total}</strong><small>3 个单元</small>
          </button>
          {dictationData.units.map((unit) => (
            <button type="button" key={unit.id} className={source === unit.id ? "active" : ""} onClick={() => setSource(unit.id)}>
              <span>{unit.label}</span><strong>{unit.count}</strong><small>{unit.sourceSheet}</small>
            </button>
          ))}
        </div>

        <div className="dictation-options">
          <div>
            <label htmlFor="dictation-count">本轮词数</label>
            <div className="count-control">
              <input id="dictation-count" type="number" min="1" max={maximum} value={count} onChange={(event) => setCount(event.target.value)} />
              <span>/ {maximum}</span>
            </div>
            <div className="quick-counts">
              {[10, 20, 50, maximum].filter((value, index, values) => value <= maximum && values.indexOf(value) === index).map((value) => (
                <button type="button" key={value} className={normalizedCount === value ? "active" : ""} onClick={() => setCount(value)}>
                  {value === maximum ? "全部" : value}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="field-label">出题顺序</span>
            <Segmented
              value={order}
              onChange={setOrder}
              label="出题顺序"
              options={[{ value: "random", label: "随机抽取" }, { value: "sequential", label: "按词表顺序" }]}
            />
          </div>
        </div>
        <Button icon={SpeakerHigh} onClick={start}>开始听写</Button>
      </section>

      <aside className="dictation-source-note">
        <strong>621 个词已完整导入</strong>
        <a href={localAssetUrl("resources/vocabulary/dictation-word-list.pdf")} target="_blank" rel="noreferrer"><FilePdf size={18} />打开词汇总表 PDF</a>
        <a href={localAssetUrl("resources/vocabulary/dictation-practice.xlsx")} target="_blank" rel="noreferrer"><FileXls size={18} />打开听写表 Excel</a>
      </aside>
    </div>
  );
}

function DictationPractice({ words, config, onFinish, onExit }) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [results, setResults] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const inputRef = useRef(null);
  const current = words[index];
  const correctCount = results.filter((item) => item.correct).length;

  useEffect(() => {
    inputRef.current?.focus();
  }, [index]);

  const judge = (gaveUp = false) => {
    if (feedback) return;
    const submittedAnswer = gaveUp ? "" : answer;
    const result = {
      ...current,
      userAnswer: submittedAnswer.trim(),
      correct: normalizeAnswer(submittedAnswer) === normalizeAnswer(current.word),
    };
    setResults((items) => [...items, result]);
    setFeedback(result);
  };

  const continuePractice = () => {
    if (index === words.length - 1) {
      onFinish(results);
      return;
    }
    setIndex((value) => value + 1);
    setAnswer("");
    setFeedback(null);
  };

  return (
    <div className="dictation-practice">
      <section className="accent-panel dictation-card">
        <div className="dictation-top">
          <button type="button" onClick={onExit}><ArrowLeft size={16} />退出本轮</button>
          <span>{config.sourceLabel} · {config.order === "random" ? "随机" : "顺序"}</span>
          <strong>{index + 1} / {words.length}</strong>
        </div>

        <div className="dictation-listen-area">
          <button type="button" className="dictation-play" onClick={() => speakEnglish(current.word)} aria-label="播放当前单词">
            <SpeakerHigh size={34} weight="fill" />
          </button>
          <h2>{feedback ? (feedback.correct ? "拼写正确" : "需要复习") : "点击播放后输入单词"}</h2>
          <p>{feedback ? `${current.unitLabel} · 词表第 ${current.position} 词` : "需要时可以重复播放，不会自动播放下一词。"}</p>
        </div>

        <label>
          <span>你听到的英文单词</span>
          <input
            ref={inputRef}
            value={answer}
            disabled={Boolean(feedback)}
            onChange={(event) => setAnswer(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              if (feedback) continuePractice();
              else if (answer.trim()) judge(false);
            }}
            placeholder="在这里输入"
            autoComplete="off"
            spellCheck="false"
          />
        </label>

        {feedback && (
          <div className={feedback.correct ? "dictation-feedback correct" : "dictation-feedback wrong"}>
            {feedback.correct ? <CheckCircle size={20} weight="fill" /> : <XCircle size={20} weight="fill" />}
            <div><span>正确拼写</span><strong>{current.word}</strong></div>
          </div>
        )}

        <div className="action-row">
          {!feedback ? (
            <>
              <Button variant="accentGhost" onClick={() => judge(true)}>不会</Button>
              <Button icon={Check} disabled={!answer.trim()} onClick={() => judge(false)}>判定</Button>
            </>
          ) : (
            <Button icon={index === words.length - 1 ? CheckCircle : ArrowRight} onClick={continuePractice}>
              {index === words.length - 1 ? "查看成绩" : "下一词"}
            </Button>
          )}
        </div>
      </section>

      <aside className="dictation-stats">
        <span>本轮进度</span>
        <strong>{correctCount} / {results.length}</strong>
        <div className="result-dots">{results.slice(-18).map((result, resultIndex) => <span key={`${result.id}-${resultIndex}`} className={result.correct ? "correct" : "wrong"} />)}</div>
      </aside>
    </div>
  );
}

function DictationResult({ session, onRepeat, onReset }) {
  const wrongResults = session.results.filter((result) => !result.correct);
  return (
    <div className="dictation-result">
      <section className="accent-panel dictation-score-card">
        <span>{session.sourceLabel} · {session.total} 词</span>
        <strong>{session.score}</strong>
        <h2>本轮得分</h2>
        <p>答对 {session.correctCount} 个，错词 {wrongResults.length} 个。</p>
        <div className="action-row">
          <Button variant="accentGhost" icon={ArrowCounterClockwise} onClick={onRepeat}>再练一次</Button>
          <Button onClick={onReset}>重新选择</Button>
        </div>
      </section>

      <section className="dictation-result-list">
        <div className="section-heading-inline"><div><span>本轮错词</span><h2>{wrongResults.length ? `${wrongResults.length} 个需要复习` : "全部正确"}</h2></div></div>
        {wrongResults.length ? wrongResults.map((result) => (
          <article key={result.id}>
            <button type="button" className="result-play" onClick={() => speakEnglish(result.word)} aria-label={`播放 ${result.word}`}><SpeakerHigh size={18} /></button>
            <div><strong>{result.word}</strong><span>{result.unitLabel} · 第 {result.position} 词</span></div>
            <div><span>你的答案</span><strong>{result.userAnswer || "未作答"}</strong></div>
          </article>
        )) : <div className="dictation-perfect"><CheckCircle size={28} weight="fill" /><p>这轮没有错词。</p></div>}
      </section>
    </div>
  );
}

function Dictation({ intent }) {
  const previousSession = useMemo(() => getDictationSession(intent?.sessionId), [intent?.sessionId]);
  const [phase, setPhase] = useState(previousSession ? "result" : "setup");
  const [words, setWords] = useState([]);
  const [config, setConfig] = useState(null);
  const [session, setSession] = useState(previousSession);

  const start = (selectedWords, selectedConfig) => {
    setWords(selectedWords);
    setConfig(selectedConfig);
    setSession(null);
    setPhase("practice");
  };

  const finish = (results) => {
    const correctCount = results.filter((result) => result.correct).length;
    const createdAt = Date.now();
    const completedSession = {
      id: `dictation-session-${createdAt}`,
      createdAt,
      sourceLabel: config.sourceLabel,
      config,
      total: results.length,
      correctCount,
      score: Math.round((correctCount / results.length) * 100),
      results,
    };
    recordDictationSession(completedSession);
    recordStudyActivity({
      id: completedSession.id,
      page: "vocabulary",
      subject: "听写",
      title: `听写 · ${config.sourceLabel}`,
      detail: `${correctCount} / ${results.length}，正确率 ${completedSession.score}%`,
      intent: { tab: "dictation", sessionId: completedSession.id },
      progress: completedSession.score,
    });
    upsertWrongItems(results.filter((result) => !result.correct).map((result) => ({
      id: `dictation-${result.id}`,
      sourceKey: "dictation",
      subject: "听写",
      title: result.word,
      detail: `${result.unitLabel} · 词表第 ${result.position} 词`,
      reason: result.userAnswer ? "拼写错误" : "未作答",
      userAnswer: result.userAnswer || "未作答",
      correctAnswer: result.word,
      unitLabel: result.unitLabel,
      wordPosition: result.position,
      page: "vocabulary",
      intent: { tab: "dictation", wordId: result.id },
    })));
    setSession(completedSession);
    setPhase("result");
  };

  if (phase === "practice") return <DictationPractice words={words} config={config} onFinish={finish} onExit={() => setPhase("setup")} />;
  if (phase === "result" && session) return (
    <DictationResult
      session={session}
      onRepeat={() => start(session.results.map(({ userAnswer, correct, ...word }) => word), session.config)}
      onReset={() => setPhase("setup")}
    />
  );
  return <DictationSetup onStart={start} />;
}

function ReadingVocabularyDetail({ entry, onBack, onSelectArticle }) {
  const articleSources = entry.articles
    .map((fileName) => ({ fileName, ...readingArticleSources.get(fileName) }))
    .filter((source) => source.item);

  return (
    <div className="page vocabulary-detail-page">
      <BackButton onClick={onBack}>返回中频词表</BackButton>
      <PageHeading eyebrow="Reading Vocabulary" title={<><em>{entry.root}</em></>} description={`词表序号 ${entry.id} · 共出现 ${entry.totalOccurrences} 次`} />
      <section className="vocabulary-detail-summary accent-panel">
        <div><span>常见形式</span><strong>{entry.commonForm || "—"}</strong></div>
        <div><span>词性</span><strong>{entry.partOfSpeech || "未标注"}</strong></div>
        <div><span>总出现次数</span><strong>{entry.totalOccurrences}</strong></div>
        <div><span>出现文章数</span><strong>{entry.articleCount}</strong></div>
      </section>
      <div className="vocabulary-detail-grid">
        <div className="vocabulary-detail-stack">
          <section className="vocabulary-detail-card vocabulary-translation-card">
            <span>中文释义</span>
            {entry.translation
              ? <p>{entry.translation}</p>
              : <p className="dictionary-unmatched">ECDICT 暂未收录这个词条。</p>}
            {entry.dictionaryWord && entry.dictionaryWord.toLowerCase() !== entry.root.toLowerCase() && <small>按词形 {entry.dictionaryWord} 匹配</small>}
            {entry.dictionarySource && entry.dictionarySource !== "ECDICT" && <small>补充释义来源：{entry.dictionarySource}</small>}
          </section>
          <section className="vocabulary-detail-card">
            <span>所有词形</span>
            <div className="word-form-list">{entry.forms.split(",").map((form) => <MetaTag key={form.trim()}>{form.trim()}</MetaTag>)}</div>
          </section>
        </div>
        <section className="vocabulary-detail-card article-source-list">
          <div><span>出现的文章</span></div>
          <ol>{articleSources.map((source) => (
            <li key={source.fileName}>
              <span>{source.fileName}</span>
              <div className="article-source-actions">
                <button type="button" onClick={() => onSelectArticle(source)}>
                  <BookOpenText size={16} />文章详情
                </button>
              </div>
            </li>
          ))}</ol>
        </section>
      </div>
    </div>
  );
}

function WordLibrary({ onOpen, state, onStateChange }) {
  const { search, page } = state;
  const setSearch = (value) => onStateChange((current) => ({ ...current, search: value, page: 1 }));
  const setPage = (value) => onStateChange((current) => ({
    ...current,
    page: typeof value === "function" ? value(current.page) : value,
  }));
  const normalizedSearch = search.trim().toLowerCase();
  const words = useMemo(() => readingVocabularyData.entries.filter((entry) => {
    if (!normalizedSearch) return true;
    return `${entry.root} ${entry.commonForm} ${entry.forms} ${entry.partOfSpeech || ""} ${entry.translation || ""} ${entry.articles.join(" ")}`.toLowerCase().includes(normalizedSearch);
  }), [normalizedSearch]);
  const pageCount = Math.max(1, Math.ceil(words.length / PAGE_SIZE));
  const visibleWords = words.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  return (
    <>
      <section className="reading-vocab-source">
        <div><strong>{readingVocabularyData.total} 个阅读中频词</strong></div>
        <a
          href={localAssetUrl("resources/vocabulary/reading-medium-frequency.xlsx")}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => openLocalDocument(event, "resources/vocabulary/reading-medium-frequency.xlsx")}
        >
          <FileXls size={18} />打开原始 Excel
        </a>
      </section>
      <div className="filter-row vocab-filter-row">
        <SearchField value={search} onChange={setSearch} placeholder="搜索词根、词形、词性、中文释义或来源文章" />
        <span>找到 {words.length} 条 · 第 {page} / {pageCount} 页</span>
      </div>
      <div className="vocab-table reading-vocab-table">
        <div className="vocab-head"><span>词根</span><span>常见形式</span><span>中文释义（含词性）</span><span>出现次数</span><span>文章数</span><span /></div>
        {visibleWords.map((entry) => (
          <button type="button" key={entry.id} onClick={() => onOpen(entry)}>
            <strong>{entry.root}</strong><span>{entry.commonForm || "—"}</span><span className={entry.translation ? "vocab-translation" : "vocab-translation unmatched"}>{compactTranslation(entry)}</span><span>{entry.totalOccurrences}</span><span>{entry.articleCount}</span><ArrowRight size={16} />
          </button>
        ))}
      </div>
      <nav className="vocab-pagination" aria-label="阅读中频词分页">
        <Button variant="secondary" icon={ArrowLeft} disabled={page === 1} onClick={() => setPage((value) => value - 1)}>上一页</Button>
        <span>第 {page} 页，共 {pageCount} 页</span>
        <Button variant="secondary" icon={ArrowRight} disabled={page === pageCount} onClick={() => setPage((value) => value + 1)}>下一页</Button>
      </nav>
    </>
  );
}

export default function Vocabulary({ intent, navigate }) {
  const [tab, setTab] = useState(intent?.tab || "dictation");
  const [selectedReadingId, setSelectedReadingId] = useState(intent?.readingWordId || null);
  const [selectedArticleSource, setSelectedArticleSource] = useState(null);
  const [wordLibraryState, setWordLibraryState] = useState({ search: "", page: 1 });
  const returnScrollRef = useRef(0);
  const selectedReading = readingVocabularyData.entries.find((entry) => entry.id === Number(selectedReadingId));

  const rememberPosition = () => {
    returnScrollRef.current = window.scrollY;
  };

  const restorePosition = () => {
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: returnScrollRef.current, behavior: "auto" })));
  };

  const openReadingEntry = (entry) => {
    rememberPosition();
    recordStudyActivity({
      id: `reading-vocabulary-${entry.id}`,
      page: "vocabulary",
      subject: "阅读",
      title: entry.root,
      detail: `阅读中频词 · 出现 ${entry.totalOccurrences} 次`,
      intent: { tab: "reading", readingWordId: entry.id },
    });
    setSelectedReadingId(entry.id);
    scrollPageToTopAfterRender();
  };

  const closeReadingEntry = () => {
    setSelectedReadingId(null);
    restorePosition();
  };

  if (selectedReading) {
    const item = selectedArticleSource?.item;
    const practiceArticle = item ? readingQuestionBankByArchiveItemId.get(String(item.id)) : null;
    const isFlowchartEdition = item?.archivePath?.includes("流程图版");
    const questionCount = practiceArticle?.questionGroups.reduce(
      (count, group) => count + (group.answerIds?.length || group.questions?.length || 0),
      0,
    ) || 0;
    const article = item ? {
      编号: practiceArticle?.articleId || item.article?.id || item.id,
      archiveItemId: item.id,
      篇章: practiceArticle?.part || item.part || item.article?.part || "",
      频次: practiceArticle?.frequency || item.frequency || item.article?.frequency || "",
      中文题目: `${practiceArticle?.chineseTitle || item.chineseTitle || item.article?.chineseTitle || ""}${isFlowchartEdition ? "（流程图版）" : ""}`,
      英文题目: `${practiceArticle?.title || item.englishTitle || item.article?.englishTitle || item.fileName}${isFlowchartEdition ? "（流程图版）" : ""}`,
      主题分类: practiceArticle?.topic || item.article?.topic || item.note || "",
      题型: item.article?.questionType || practiceArticle?.questionGroups.map((group) => group.title).join("；") || "",
      难度定位: item.article?.difficulty || (questionCount ? `${practiceArticle.part} · 共 ${questionCount} 题` : ""),
      检索关键词: item.article?.topic || practiceArticle?.topic || item.englishTitle || "",
      正文链接: practiceArticle?.feishuLink || item.article?.link ? { link: practiceArticle?.feishuLink || item.article?.link } : null,
    } : null;

    return (
      <>
        <ReadingVocabularyDetail entry={selectedReading} onBack={closeReadingEntry} onSelectArticle={setSelectedArticleSource} />
        <ReadingArticleDetail
          article={article}
          localPdf={item?.archivePath ? selectedArticleSource : null}
          practiceArticle={practiceArticle}
          onClose={() => setSelectedArticleSource(null)}
          onOpenStudy={(nextArticle) => navigate("reading", { tab: "index", archiveItemId: nextArticle.archiveItemId, study: true })}
          onStartPractice={(nextArticle) => navigate("reading", { tab: "index", archiveItemId: nextArticle.archiveItemId, practice: true })}
          onOpenPdf={() => navigate("reading", { tab: "monthly", groupId: selectedArticleSource.groupId, archiveItemId: item.id })}
          onOpenFeishu={(nextArticle) => window.open(nextArticle.正文链接.link, "_blank", "noopener,noreferrer")}
        />
      </>
    );
  }

  return (
    <div className="page">
      <PageHeading eyebrow="Vocabulary" title={<>词汇与 <em>听写</em></>} description={`${dictationData.total} 个听写词，${readingVocabularyData.total} 个阅读中频词。`} />
      <Segmented value={tab} onChange={setTab} options={[{ value: "dictation", label: "听写词" }, { value: "reading", label: "阅读中频词" }, { value: "synonym", label: "同义词训练" }]} label="词汇视图" />
      <div className="tab-content">
        {tab === "dictation" && <Dictation intent={intent} />}
        {tab === "reading" && <WordLibrary onOpen={openReadingEntry} state={wordLibraryState} onStateChange={setWordLibraryState} />}
        {tab === "synonym" && (
          <div className="library-placeholder">
            <LinkSimple size={34} />
            <h2>雅思同义词训练</h2>
            <p>使用时需要联网。</p>
            <Button icon={LinkSimple} onClick={() => window.open("https://all-12345678-d6gd8aoxc8aef5ae4-1460131440.tcloudbaseapp.com/ielts-538-web/?v=7", "_blank", "noopener,noreferrer")}>打开训练</Button>
          </div>
        )}
      </div>
    </div>
  );
}
