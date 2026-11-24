import { LearningWorkspace, ResourceEntry, StudyEmpty } from "../components/LearningUI";
import { getReadingStatus, setReadingStatus } from "../lib/readingStatus";
import OctoberReading from "../components/OctoberReading";
import SetBuilder from "../components/SetBuilder";
import PracticeHistory from "../components/PracticeHistory";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowClockwise,
  ArrowRight,
  BookOpenText,
  FilePdf,
  FolderOpen,
  LinkSimple,
  MagnifyingGlass,
  Play,
  UploadSimple,
  WarningCircle,
} from "@phosphor-icons/react";
import readingIndex from "../data/reading-index.json";
import readingGroups from "../data/reading-groups.json";
import readingQuestionBank, { readingQuestionBankByArchiveItemId, readingQuestionBankByArticleId } from "../data/reading-question-bank";
import PdfViewer from "../components/PdfViewer";
import ReadingArticleStudy from "../components/ReadingArticleStudy";
import ReadingArticleDetail from "../components/ReadingArticleDetail";
import ReadingPractice from "../components/ReadingPractice";
import {
  BackButton,
  Button,
  MetaTag,
  Modal,
  Pagination,
  PageHeading,
  SearchField,
  Segmented,
  SelectField,
  TextArrow,
} from "../components/Common";
import { estimateAcademicReadingBand, recordPracticeAttempt, getStudyHistory, LOCAL_STUDY_EVENT, recordStudyActivity } from "../lib/localStudyStore";
import { recordReadingArticle, resolveReadingArticle } from "../lib/readingStudy";
import { scrollElementToTopAfterRender, scrollPageToTopAfterRender } from "../lib/pageScroll";

const tabs = [
  { value: "index", label: "文章索引" },
  { value: "mock", label: "套题模式" },
  { value: "pdf", label: "PDF 阅读" },
  { value: "history", label: "练习记录" },
];

const monthlyGroups = readingGroups.map((group, index) => ({
  ...group,
  count: group.items.length,
  tone: index === 0 ? "accent" : "neutral",
}));

const matchesMockFrequency = (item, frequency) => {
  if (frequency === "全部频次") return true;
  if (frequency === "非高频") return String(item.frequency).startsWith("非高频");
  return item.frequency === frequency;
};

const articlePdfOverrides = {
  "3": "august-high-94",
  "4": "august-high-81",
  "17": "august-high-56",
  "70": "august-secondary-50",
  "129": "august-high-78",
};

const localPdfSources = readingGroups.flatMap((group) => group.items
  .filter((item) => item.archivePath)
  .map((item) => ({ item, group })));
const localPdfSourcesByItemId = new Map(localPdfSources.map((source) => [source.item.id, source]));
const localPdfSourcesByArticleId = new Map();

localPdfSources.forEach((source) => {
  const articleId = source.item.article?.id;
  if (articleId && !localPdfSourcesByArticleId.has(String(articleId))) {
    localPdfSourcesByArticleId.set(String(articleId), source);
  }
});
Object.entries(articlePdfOverrides).forEach(([articleId, itemId]) => {
  localPdfSourcesByArticleId.set(articleId, localPdfSourcesByItemId.get(itemId));
});

const legacyReadingIndexById = new Map(readingIndex.map((item) => [String(item.编号), item]));

const toLibraryArticle = (practiceArticle) => {
  const legacyArticle = legacyReadingIndexById.get(String(practiceArticle.articleId));
  const localSource = localPdfSourcesByItemId.get(String(practiceArticle.archiveItemId));
  const isFlowchartEdition = localSource?.item?.archivePath?.includes("流程图版");
  const questionCount = practiceArticle.questionGroups.reduce(
    (count, group) => count + (group.answerIds?.length || group.questions.length),
    0,
  );
  return {
    编号: practiceArticle.articleId,
    archiveItemId: practiceArticle.archiveItemId,
    篇章: practiceArticle.part,
    频次: practiceArticle.frequency,
    中文题目: `${practiceArticle.chineseTitle || legacyArticle?.中文题目 || ""}${isFlowchartEdition ? "（流程图版）" : ""}`,
    英文题目: `${practiceArticle.title}${isFlowchartEdition ? "（流程图版）" : ""}`,
    主题分类: practiceArticle.topic || legacyArticle?.主题分类 || "",
    题型: legacyArticle?.题型 || practiceArticle.questionGroups.map((group) => group.title).join("；"),
    难度定位: legacyArticle?.难度定位 || `${practiceArticle.part} · 共 ${questionCount} 题`,
    检索关键词: legacyArticle?.检索关键词 || practiceArticle.topic || practiceArticle.title,
    正文链接: practiceArticle.feishuLink ? { link: practiceArticle.feishuLink } : null,
  };
};

const readingLibraryIndex = readingQuestionBank.map(toLibraryArticle);
const readingLibraryByArchiveItemId = new Map(readingLibraryIndex.map((item) => [String(item.archiveItemId), item]));
const readingLibraryByArticleId = new Map();
readingLibraryIndex.forEach((item) => {
  const key = String(item.编号);
  if (!readingLibraryByArticleId.has(key)) readingLibraryByArticleId.set(key, item);
});

const articleFromGroupItem = (item) => {
  const indexed = readingLibraryByArchiveItemId.get(String(item?.id));
  if (indexed) return indexed;
  const linked = item?.article;
  return {
    编号: linked?.id || item?.id,
    archiveItemId: item?.id,
    篇章: item?.part || linked?.part || "",
    频次: item?.frequency || linked?.frequency || "",
    中文题目: item?.chineseTitle || linked?.chineseTitle || "",
    英文题目: item?.englishTitle || linked?.englishTitle || item?.fileName || "未命名文章",
    主题分类: linked?.topic || item?.note || "",
    题型: linked?.questionType || "",
    难度定位: linked?.difficulty || "",
    检索关键词: linked?.topic || item?.englishTitle || "",
    正文链接: linked?.link ? { link: linked.link } : null,
  };
};

const getLocalPdfSource = (article) => (
  localPdfSourcesByItemId.get(String(article?.archiveItemId))
  || localPdfSourcesByArticleId.get(String(article?.编号))
);

function ArticleDetail({ article, onClose, onOpenPdf, onOpenFeishu, onOpenStudy, onStartPractice }) {
  const localPdf = getLocalPdfSource(article);
  const practiceArticle = readingQuestionBankByArchiveItemId.get(String(article?.archiveItemId))
    || readingQuestionBankByArticleId.get(String(article?.编号));
  return <ReadingArticleDetail {...{ article, localPdf, practiceArticle, onClose, onOpenPdf, onOpenFeishu, onOpenStudy, onStartPractice }} />;
}

function ArticleIndex({ onSelect, state, onStateChange }) {
  const pageSize = 9;
  const { search, part, frequency, page } = state;
  const updateState = (change) => onStateChange((current) => ({ ...current, ...change }));

  const items = useMemo(() => readingLibraryIndex.filter((item) => {
    const term = search.trim().toLowerCase();
    const matches = !term || item.英文题目?.toLowerCase().includes(term) || item.中文题目?.includes(search.trim()) || item.检索关键词?.toLowerCase().includes(term);
    const matchPart = part === "全部" || item.篇章 === part;
    const matchFrequency = frequency === "全部频次" || item.频次 === frequency || (frequency === "非高频" && item.频次?.startsWith("非高频"));
    return matches && matchPart && matchFrequency;
  }), [search, part, frequency]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pageItems = items.slice(pageStart, pageStart + pageSize);

  return (
    <>
      <div className="ui-filter-panel">      <div className="filter-row reading-filters">
        <SearchField value={search} onChange={(value) => updateState({ search: value, page: 1 })} placeholder="搜索中英文标题、主题或关键词" />
        <Segmented value={part} onChange={(value) => updateState({ part: value, page: 1 })} label="阅读 Part" options={["全部", "P1", "P2", "P3"]} />
        <SelectField value={frequency} onChange={(value) => updateState({ frequency: value, page: 1 })} label="频次">
          <option>全部频次</option><option>高频</option><option>次高频</option><option>非高频</option>
        </SelectField>
      </div>
</div>
      <div className="ui-catalog-summary"><span>{items.length} 篇交互文章 · 第 {currentPage} 页</span><span>原文 · 题目 · 复盘</span></div>
      <div className="ui-resource-list">{pageItems.map(item=><ResourceEntry key={item.archiveItemId} part={item.篇章} title={item.英文题目} subtitle={item.中文题目} metadata={`${item.频次} · ${item.主题分类}`} status={getReadingStatus(readingQuestionBankByArchiveItemId.get(String(item.archiveItemId))?.id).reviewed?"已复盘":getReadingStatus(readingQuestionBankByArchiveItemId.get(String(item.archiveItemId))?.id).done?"已做":"未做"} onOpen={()=>onSelect(item)}/>)}</div>
      {!items.length&&<StudyEmpty icon={BookOpenText} title="没有匹配的文章" description="换个关键词或筛选条件再试。"/>}
      <Pagination page={currentPage} totalPages={totalPages} onChange={(value) => updateState({ page: value })} label="阅读文章索引分页" />
    </>
  );
}

function ReadingMockBuilder({ onStart }) { return <SetBuilder items={readingQuestionBank} parts={["P1","P2","P3"]} subject="阅读" onStart={onStart}/>; }

function ReadingMockResults({ results, onOpenArticle, onOpenQuestion, onBack }) {
  const score = results.reduce((sum, result) => sum + result.score, 0);
  const total = results.reduce((sum, result) => sum + result.total, 0);
  useEffect(() => {
    const firstResult = results[0];
    const firstQuestion = firstResult?.questions[0];
    if (firstResult && firstQuestion) {
      scrollElementToTopAfterRender(`reading-result-${firstResult.article.id}-${firstQuestion.id}`);
    }
  }, [results]);
  return (
    <div className="page mock-results-page reading-mock-results">
      <BackButton onClick={onBack}>返回阅读题库</BackButton>
      <PageHeading eyebrow="Reading / Mock result" title={<>套题 <em>批改结果</em></>} />
      <section className="accent-panel mock-score-hero"><span>本套成绩</span><strong>{score} / {total}</strong><p>P1、P2、P3 共 {total} 题</p></section>
      <div className="mock-result-sections">
        {results.map((result) => {
          return (
            <section key={result.article.id}>
              <header>
                <div>
                  <MetaTag tone="dark">{result.article.part}</MetaTag>
                  <h2>{result.article.title}</h2>
                  <button type="button" className="mock-article-source" onClick={() => onOpenArticle(result.article)}>
                    <BookOpenText size={14} />查看原文
                  </button>
                </div>
                <strong>{result.score} / {result.total}</strong>
              </header>
              <div className="mock-result-questions">
                {result.questions.map((question) => {
                  return (
                    <button
                      type="button"
                      key={question.id}
                      id={`reading-result-${result.article.id}-${question.id}`}
                      className={question.correct ? "correct" : "incorrect"}
                      onClick={() => onOpenQuestion(result.article, question.id, result)}
                    >
                      <span>Question {question.id}</span>
                      <strong>{question.correct ? "回答正确" : `正确答案：${question.expected}`}</strong>
                      <small>查看解析 <ArrowRight size={13} /></small>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function PdfReader({ onOpenFeishu }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [matched, setMatched] = useState(null);
  const [fileError, setFileError] = useState("");
  const fileRequest = useRef(0);

  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  const openFile = async (nextFile) => {
    if (!nextFile) return;
    const request = ++fileRequest.current;
    if (nextFile.type !== "application/pdf" && !nextFile.name.toLowerCase().endsWith(".pdf")) { setFileError("请选择 PDF 文件，其他格式暂不能阅读。"); return; }
    try {
      const header = await nextFile.slice(0, 1024).text();
      if (!header.includes("%PDF-")) throw new Error("这个文件不是有效的 PDF，请检查是否下载完整。");
    } catch (error) { if (request === fileRequest.current) setFileError(error.message || "文件读取失败，请重新选择。"); return; }
    if (request !== fileRequest.current) return;
    setFileError("");
    if (url) URL.revokeObjectURL(url);
    const nextUrl = URL.createObjectURL(nextFile);
    const normalized = nextFile.name.toLowerCase().replace(/[^a-z0-9\u3400-\u9fff]/g, "");
    const match = readingIndex.find((item) => {
      const english = item.英文题目?.toLowerCase().replace(/[^a-z0-9]/g, "");
      const chinese = item.中文题目?.replace(/[^\u3400-\u9fff]/g, "");
      return (english && normalized.includes(english)) || (chinese && normalized.includes(chinese));
    });
    setFile(nextFile);
    setUrl(nextUrl);
    setMatched(match || null);
  };

  if (file && url) {
    return (
      <div className="pdf-workspace">
        <div className="pdf-toolbar">
          <div><FilePdf size={21} /><span><strong>{file.name}</strong><small>{matched ? "已关联资料库文章" : "普通阅读模式"}</small></span></div>
          <div className="pdf-toolbar-actions">
            <Button variant="ghost" icon={FolderOpen} onClick={() => inputRef.current?.click()}>换一个 PDF</Button>
          </div>
          <input ref={inputRef} hidden type="file" accept="application/pdf,.pdf" onChange={(event) => openFile(event.target.files?.[0])} />
        </div>
        {matched && (
          <div className="pdf-match-bar">
            <span><strong>{matched.英文题目}</strong>{matched.中文题目}</span>
            <TextArrow onClick={() => onOpenFeishu(matched)}>飞书精读</TextArrow>
          </div>
        )}
        {fileError && <p role="alert">{fileError}</p>}
        <PdfViewer className="pdf-frame" src={url} title={file.name} />
      </div>
    );
  }

  return (
    <><div className="ui-content-heading"><div><h1>PDF 阅读</h1><p>打开你的本地文档，在阅读中翻译、批注与记录。</p></div></div><div className="ui-pdf-import-layout"><div
      className={`pdf-dropzone ${dragging ? "dragging" : ""}`}
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        openFile(event.dataTransfer.files?.[0]);
      }}
    >
      <div className="dropzone-icon"><UploadSimple size={28} /></div>
      <h2>拖入 PDF 开始阅读</h2>
      <p>资料库内的文件会关联已有标题和飞书正文；其他文件进入普通阅读模式。</p>
      <Button icon={FolderOpen} onClick={() => inputRef.current?.click()}>选择 PDF</Button>
      <input ref={inputRef} hidden type="file" accept="application/pdf,.pdf" onChange={(event) => openFile(event.target.files?.[0])} />
      {fileError && <p role="alert">{fileError}</p>}

    </div><aside className="ui-pdf-import-guide"><h2>从一份文档开始</h2><ol><li>拖入 PDF，或点击按钮从电脑中选择。</li><li>文件名匹配资料库时，会关联已有文章标题与飞书正文。</li><li>打开后可阅读、选词学习与批注，原始内容保留。</li></ol></aside></div></>
  );
}

function ArchivePdfViewer({ item, onBack, onOpenFeishu }) {
  const src = `/resources/reading/pdfs/${encodeURIComponent(item.id)}.pdf`;
  const hasFeishu = Boolean(item.linkedArticle?.正文链接?.link);
  return (
    <div className="page reading-subpage">
      <BackButton onClick={onBack}>{item.origin === "index" ? "返回文章详情" : "返回资料组"}</BackButton>
      <PageHeading
        eyebrow={`${item.part} / ${item.frequency}`}
        title={<>原题 <em>PDF</em></>}
        description={item.englishTitle}
        actions={hasFeishu && <Button variant="ghost" icon={LinkSimple} onClick={() => onOpenFeishu(item.linkedArticle)}>飞书精读</Button>}
      />
      <div className="archive-pdf-meta">
        <div><span>资料名称</span><strong>{item.fileName}</strong></div>
        <div><span>资料性质</span><strong>{item.note}</strong></div>
        <div><span>文件大小</span><strong>{(item.size / 1024 / 1024).toFixed(1)} MB</strong></div>
      </div>
      <PdfViewer className="archive-pdf-frame" src={src} title={item.fileName} />
    </div>
  );
}

function MonthlyGroupDetail({ group, state, onStateChange, onBack, onSelectArticle }) {
  const { search, part, visible } = state;
  const updateState = (change) => onStateChange((current) => ({ ...current, ...change }));
  const parts = [...new Set(group.items.map((item) => item.part).filter((item) => /^P[123]$/.test(item)))].sort();
  const items = useMemo(() => group.items.filter((item) => {
    const term = search.trim().toLowerCase();
    const matchesSearch = !term
      || item.englishTitle?.toLowerCase().includes(term)
      || item.chineseTitle?.includes(search.trim())
      || item.note?.toLowerCase().includes(term);
    return matchesSearch && (part === "全部" || item.part === part);
  }).sort((a, b) => a.part.localeCompare(b.part) || a.englishTitle.localeCompare(b.englishTitle, "en")), [group, search, part]);

  return (
    <div className="page reading-subpage">
      <BackButton onClick={onBack}>返回高频与月份</BackButton>
      <PageHeading
        eyebrow="Reading Collection"
        title={<>{group.title.slice(0, 2)} <em>{group.title.slice(2)}</em></>}
        description={`${group.description} 共 ${group.items.length} 份。`}
      />
      <div className="reading-group-stats accent-panel">
        <div><span>组内资料</span><strong>{group.items.length}</strong><small>来自原表格或原压缩包</small></div>
        <div><span>本地 PDF</span><strong>{group.items.filter((item) => item.archivePath).length}</strong><small>点击直接打开原文件</small></div>
        <div><span>飞书正文</span><strong>{group.items.filter((item) => item.article?.link).length}</strong><small>标题已准确关联</small></div>
      </div>
      <div className="filter-row reading-group-filters">
        <SearchField value={search} onChange={(value) => updateState({ search: value, visible: 40 })} placeholder="搜索中英文标题或备注" />
        {parts.length > 0 && <Segmented value={part} onChange={(value) => updateState({ part: value, visible: 40 })} label="资料 Part" options={["全部", ...parts]} />}
      </div>
      <div className="list-summary"><span>显示 {Math.min(visible, items.length)} / {items.length} 份</span><span>只展示真实资料状态</span></div>
      <div className="reading-group-list">
        {items.slice(0, visible).map((item) => {
          const hasPdf = Boolean(item.archivePath);
          const hasArticle = Boolean(item.article?.link);
          const detailArticle = articleFromGroupItem(item);
          return (
            <article key={item.id}>
              <div className="reading-group-main">
                <div className="meta-row">
                  <MetaTag tone="dark">{item.part}</MetaTag>
                  <MetaTag>{item.frequency}</MetaTag>
                  <MetaTag tone={hasPdf || hasArticle ? "soft" : "neutral"}>{hasPdf ? "本地 PDF" : hasArticle ? "飞书正文" : "仅有标题"}</MetaTag>
                </div>
                <h2>{detailArticle.英文题目}</h2>
                {detailArticle.中文题目 && <p>{detailArticle.中文题目}</p>}
                <small>{item.note}</small>
              </div>
              {(hasPdf || hasArticle) && (
                <div className="reading-group-actions">
                  <Button variant="ghost" icon={BookOpenText} onClick={() => onSelectArticle(item)}>文章详情</Button>
                </div>
              )}
            </article>
          );
        })}
      </div>
      {visible < items.length && <Button className="load-more" variant="ghost" onClick={() => updateState({ visible: visible + 40 })}>显示更多</Button>}
    </div>
  );
}

export default function Reading({ intent, navigate }) {
  const [tab, setTab] = useState(intent?.tab || "index");
  const [collection,setCollection]=useState("october");
  const [article, setArticle] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [archivePdf, setArchivePdf] = useState(null);
  const [studyArticle, setStudyArticle] = useState(null);
  const [practiceArticle, setPracticeArticle] = useState(null);
  const [focusQuestionId, setFocusQuestionId] = useState(null);
  const [mockQueue, setMockQueue] = useState(null);
  const [mockIndex, setMockIndex] = useState(0);
  const [mockResults, setMockResults] = useState([]);
  const [showMockResults, setShowMockResults] = useState(false);
  const [reviewReturn, setReviewReturn] = useState(false);
  const [mockReviewResult, setMockReviewResult] = useState(null);
  const [studyReturnToResults, setStudyReturnToResults] = useState(false);
  const [indexState, setIndexState] = useState({ search: "", part: "全部", frequency: "全部频次", page: 1 });
  const [monthlyGroupStates, setMonthlyGroupStates] = useState({});
  const returnScrollRef = useRef(0);

  const getMonthlyGroupState = (groupId) => monthlyGroupStates[groupId] || { search: "", part: "全部", visible: 40 };

  const updateMonthlyGroupState = (groupId, updater) => {
    setMonthlyGroupStates((current) => {
      const previous = current[groupId] || { search: "", part: "全部", visible: 40 };
      const next = typeof updater === "function" ? updater(previous) : updater;
      return { ...current, [groupId]: next };
    });
  };

  const rememberPosition = () => {
    returnScrollRef.current = window.scrollY;
  };

  const restorePosition = () => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      window.scrollTo({ top: returnScrollRef.current, behavior: "auto" });
    }));
  };

  const openArticle = (nextArticle) => {
    if (!nextArticle) return;
    setArticle(nextArticle);
    setTab("index");
  };

  const openFeishuArticle = (reference) => {
    const linkedArticle = resolveReadingArticle(reference);
    const link = linkedArticle?.正文链接?.link || reference?.正文链接?.link || reference?.link;
    if (!linkedArticle || !link) return;
    recordReadingArticle(linkedArticle);
    window.open(link, "_blank", "noopener,noreferrer");
  };

  const openArchivePdf = (item, group = selectedGroup, origin = "monthly", articleReference = item?.article) => {
    if (!item || !group) return;
    rememberPosition();
    const linkedArticle = resolveReadingArticle(articleReference);
    const nextItem = { ...item, groupId: group.id, origin, linkedArticle };
    setArchivePdf(nextItem);
    scrollPageToTopAfterRender();
    if (!recordReadingArticle(linkedArticle)) {
      recordStudyActivity({
        id: `reading:pdf:${group.id}:${item.id}`,
        page: "reading",
        subject: "阅读",
        title: item.englishTitle,
        detail: `${group.title} / ${item.part}`,
        intent: { tab: "monthly", groupId: group.id, archiveItemId: item.id },
      });
    }
  };

  useEffect(() => {
    if (intent?.tab) {
      setTab(intent.tab);
      if (intent.tab !== "index") setArticle(null);
      if (intent.tab !== "monthly") {
        setSelectedGroup(null);
        setArchivePdf(null);
      }
    }
    if (intent?.articleId || intent?.archiveItemId) {
      const nextPractice = (intent.archiveItemId
        ? readingQuestionBankByArchiveItemId.get(String(intent.archiveItemId))
        : null) || readingQuestionBankByArticleId.get(String(intent.articleId));
      const nextArticle = (nextPractice
        ? readingLibraryByArchiveItemId.get(String(nextPractice.archiveItemId))
        : null) || readingLibraryByArticleId.get(String(intent.articleId));
      if (intent.study && nextPractice) {
        setTab("index");
        setStudyArticle(nextPractice);
      } else if (intent.practice && nextPractice) {
        setTab("index");
        setPracticeArticle(nextPractice);
        if(intent.reviewRecord?.submitted) setMockReviewResult({responses:intent.reviewRecord.responses,annotations:[]});
        setFocusQuestionId(intent.questionId || null);
      } else if (nextArticle) openArticle(nextArticle);
    }
    if (intent?.groupId) {
      const group = monthlyGroups.find((item) => item.id === intent.groupId);
      if (group) {
        setTab("monthly");
        setSelectedGroup(group);
        if (intent.archiveItemId) {
          const item = group.items.find((entry) => entry.id === intent.archiveItemId);
          if (item) openArchivePdf(item, group);
        }
      }
    }
  }, [intent]);

  const selectArticleReference = (reference) => {
    const nextArticle = reference?.archiveItemId
      ? readingLibraryByArchiveItemId.get(String(reference.archiveItemId))
      : reference?.id && localPdfSourcesByItemId.has(String(reference.id))
        ? articleFromGroupItem(localPdfSourcesByItemId.get(String(reference.id)).item)
        : readingLibraryByArticleId.get(String(reference?.编号 ?? reference?.id));
    if (nextArticle) openArticle(nextArticle);
  };

  const openArticlePdf = (source, targetArticle) => {
    if (!source) return;
    openArchivePdf(source.item, source.group, "index", targetArticle);
  };

  const startPractice = (nextArticle, questionId = null) => {
    rememberPosition();
    setPracticeArticle(nextArticle);
    setFocusQuestionId(questionId);
    setArticle(null);
    scrollPageToTopAfterRender();
  };

  const startStudy = (nextArticle, returnToResults = false) => {
    rememberPosition();
    setStudyArticle(nextArticle);
    setStudyReturnToResults(returnToResults);
    setArticle(null);
    scrollPageToTopAfterRender();
  };

  const closeStudy = () => {
    setStudyArticle(null);
    if (studyReturnToResults) {
      setStudyReturnToResults(false);
      setShowMockResults(true);
      restorePosition();
      return;
    }
    restorePosition();
  };

  const closePractice = () => {
    setPracticeArticle(null);
    setFocusQuestionId(null);
    if (reviewReturn) {
      setReviewReturn(false);
      setMockReviewResult(null);
      setShowMockResults(true);
      scrollPageToTopAfterRender();
      return;
    }
    setMockQueue(null);
    setMockReviewResult(null);
    setMockIndex(0);
    restorePosition();
  };

  const startMock = (items) => {
    setMockQueue(items);
    setMockIndex(0);
    setMockResults([]);
    setShowMockResults(false);
    setReviewReturn(false);
    setMockReviewResult(null);
    setPracticeArticle(items[0]);
    scrollPageToTopAfterRender();
  };

  const nextMockArticle = () => {
    const nextIndex = mockIndex + 1;
    setMockIndex(nextIndex);
    setPracticeArticle(mockQueue[nextIndex]);
    setFocusQuestionId(null);
    scrollPageToTopAfterRender();
  };

  const finishMock = (finalResult) => {
    const completeResults = [...mockResults.filter((entry) => entry.article.id !== finalResult.article.id), finalResult];
    const score = completeResults.reduce((sum, result) => sum + result.score, 0);
    const total = completeResults.reduce((sum, result) => sum + result.total, 0);
    setMockResults(completeResults);
    recordStudyActivity({
      id: `reading:mock:${Date.now()}`,
      page: "reading",
      subject: "阅读",
      title: "阅读套题 P1-P3",
      detail: `已提交，得分 ${score} / ${total}`,
      intent: { tab: "mock" },
      progress: { completed: total, total },
      review: true, submitted: true, submittedAt:Date.now(),score:estimateAcademicReadingBand(score,total),rawScore:score,rawTotal:total,responses:Object.fromEntries(completeResults.map((e)=>[e.article.id,e.responses])),details:completeResults.map((e)=>({id:e.article.id,title:e.article.title,questions:e.questions})),
    });
    setPracticeArticle(null);
    setFocusQuestionId(null);
    setShowMockResults(true);
    scrollPageToTopAfterRender();
  };

  const submitMockResult = (result) => {
    if (mockIndex + 1 < mockQueue.length) {
      setMockResults((current) => [...current.filter((entry) => entry.article.id !== result.article.id), result]);
      nextMockArticle();
      return;
    }
    finishMock(result);
  };

  const openMonthlyGroup = (group) => {
    rememberPosition();
    setSelectedGroup(group);
    scrollPageToTopAfterRender();
  };

  const closeMonthlyGroup = () => {
    setSelectedGroup(null);
    restorePosition();
  };

  const openMockArticle = (nextArticle) => {
    const indexArticle = readingLibraryByArchiveItemId.get(String(nextArticle?.archiveItemId));
    if (indexArticle) setArticle(indexArticle);
  };

  const openMockQuestion = (nextArticle, questionId, result) => {
    setShowMockResults(false);
    setReviewReturn(true);
    setMockReviewResult(result);
    setFocusQuestionId(String(questionId));
    setPracticeArticle(nextArticle);
    scrollPageToTopAfterRender();
  };

  if (archivePdf) {
    return <ArchivePdfViewer item={archivePdf} onBack={() => { setArchivePdf(null); restorePosition(); }} onOpenFeishu={openFeishuArticle} />;
  }

  if (studyArticle) {
    const source = localPdfSourcesByItemId.get(studyArticle.archiveItemId);
    const libraryArticle = readingLibraryByArchiveItemId.get(String(studyArticle.archiveItemId));
    return (
      <ReadingArticleStudy
        article={studyArticle}
        reviewRecord={mockReviewResult}
        onBack={closeStudy}
        backLabel={studyReturnToResults ? "返回套题结果" : "返回文章索引"}
        onPractice={!studyReturnToResults ? () => { setStudyArticle(null); startPractice(studyArticle); } : null}
        onOpenPdf={source ? () => openArchivePdf(source.item, source.group, "study", libraryArticle) : null}
        onOpenFeishu={studyArticle.feishuLink ? () => openFeishuArticle(libraryArticle) : null}
      />
    );
  }

  if (practiceArticle) {
    const source = localPdfSourcesByItemId.get(practiceArticle.archiveItemId);
    const libraryArticle = readingLibraryByArchiveItemId.get(String(practiceArticle.archiveItemId));
    return (
      <ReadingPractice
        key={practiceArticle.id}
        article={practiceArticle}
        initialQuestionId={focusQuestionId}
        reviewResult={mockReviewResult}
        onBack={closePractice}
        backLabel={reviewReturn ? "返回套题结果" : "返回阅读题库"}
        onOpenPdf={source ? () => openArchivePdf(source.item, source.group, "practice", libraryArticle) : null}
        onOpenFeishu={practiceArticle.feishuLink ? () => openFeishuArticle(libraryArticle) : null}
        onOpenStudy={!mockQueue ? () => startStudy(practiceArticle) : null}
        mockPosition={!reviewReturn && mockQueue ? { current: mockIndex + 1, total: mockQueue.length } : null}
        onMockSubmit={submitMockResult}
      />
    );
  }

  if (showMockResults) {
    return (
      <>
        <ReadingMockResults results={mockResults} onOpenArticle={openMockArticle} onOpenQuestion={openMockQuestion} onBack={() => { setShowMockResults(false); setMockQueue(null); setMockResults([]); setMockReviewResult(null); setArticle(null); setTab("mock"); }} />
        <ArticleDetail
          article={article}
          onClose={() => setArticle(null)}
          onOpenPdf={openArticlePdf}
          onOpenFeishu={openFeishuArticle}
          onOpenStudy={(nextArticle) => startStudy(nextArticle, true)}
          onStartPractice={(nextArticle) => { setReviewReturn(true); startPractice(nextArticle); }}
        />
      </>
    );
  }

  if (selectedGroup) {
    return (
      <>
        <MonthlyGroupDetail
          group={selectedGroup}
          state={getMonthlyGroupState(selectedGroup.id)}
          onStateChange={(updater) => updateMonthlyGroupState(selectedGroup.id, updater)}
          onBack={closeMonthlyGroup}
          onSelectArticle={selectArticleReference}
        />
        <ArticleDetail article={article} onClose={() => setArticle(null)} onOpenPdf={openArticlePdf} onOpenFeishu={openFeishuArticle} onOpenStudy={startStudy} onStartPractice={startPractice} />
      </>
    );
  }

  return (
    <div className="page">
      <LearningWorkspace title="阅读" description="从读懂，到读透。" active={tab} onChange={(value)=>{setTab(value);setSelectedGroup(null);}} options={tabs} aside={<p>精读梳理文章，背题检验理解。原题详情与复盘标记都保留。</p>}>
        {tab === "index" && <><div className="ui-content-heading"><div><h1>文章索引</h1><p>按篇章和频次找文章，进入原题或精读复盘。</p></div></div><Segmented label="阅读资料集合" value={collection} onChange={setCollection} options={[{value:"october",label:"示例资料 · 280 篇"},{value:"interactive",label:"交互题库"}]}/>{collection==="october"?<OctoberReading onPractice={(id)=>startPractice(readingQuestionBankByArchiveItemId.get(id))}/>:<ArticleIndex onSelect={openArticle} state={indexState} onStateChange={setIndexState}/>}</>}
        {tab === "mock" && <ReadingMockBuilder onStart={startMock} />}
        {tab === "pdf" && <PdfReader onOpenFeishu={openFeishuArticle} />}
        {tab === "history" && <PracticeHistory subject="阅读" onOpen={(entry)=>navigate("reading",{...entry.intent,reviewRecord:entry})} />}
      </LearningWorkspace>
      <ArticleDetail article={article} onClose={() => setArticle(null)} onOpenPdf={openArticlePdf} onOpenFeishu={openFeishuArticle} onOpenStudy={startStudy} onStartPractice={startPractice} />
    </div>
  );
}

function ReadingHistory({ navigate }) {
  const [history, setHistory] = useState(() => getStudyHistory().filter((item) => item.subject === "阅读"));
  useEffect(() => {
    const refresh = () => setHistory(getStudyHistory().filter((item) => item.subject === "阅读"));
    window.addEventListener(LOCAL_STUDY_EVENT, refresh);
    return () => window.removeEventListener(LOCAL_STUDY_EVENT, refresh);
  }, []);
  if (!history.length) return <div className="empty-state"><BookOpenText size={28}/><h3>还没有阅读练习记录</h3></div>;
  return <div className="content-list">{history.map((entry) => <div key={entry.id}><MetaTag>{entry.detail || "阅读练习"}</MetaTag><strong>{entry.title}</strong><span>{new Date(entry.updatedAt).toLocaleDateString("zh-CN")}</span><Button variant="text" icon={ArrowRight} onClick={() => navigate("review", { tab: "学习记录" })}>查看记录</Button></div>)}</div>;
}
