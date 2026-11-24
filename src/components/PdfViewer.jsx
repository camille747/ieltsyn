import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowsInSimple,
  ArrowsOutSimple,
  DownloadSimple,
  MagnifyingGlass,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
} from "@phosphor-icons/react";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { IconButton, LoadingState } from "./Common";
import { Button } from "./Common";
import { readValue,writeValue } from "../lib/persistence";
import { requestAi } from "../lib/aiClient";
import { inkColors,validPdfInk,exportAnnotatedPdf } from "../lib/pdfInk";
import PdfInkLayer from "./PdfInkLayer";
import PdfTextStudy from "./PdfTextStudy";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const MIN_ZOOM = 0.45;
const MAX_ZOOM = 3;

function normalizedSearchText(value) {
  return String(value || "").trim().toLocaleLowerCase();
}

export default function PdfViewer({ src, title = "PDF", className = "" }) {
  const canvasRef = useRef(null);
  const readerRef = useRef(null);
  const viewportRef = useRef(null);
  const pdfRef = useRef(null);
  const renderTaskRef = useRef(null);
  const [documentState, setDocumentState] = useState("loading");
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [zoom, setZoom] = useState(1.15);
  const [fitWidth, setFitWidth] = useState(true);
  const [containerWidth, setContainerWidth] = useState(900);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState([]);
  const [matchIndex, setMatchIndex] = useState(-1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [studyMode, setStudyMode] = useState(false);
  const [pageText, setPageText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [textError, setTextError] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [ink,setInk]=useState({});const inkRef=useRef({});
  const [drawing,setDrawing]=useState(false),[inkColor,setInkColor]=useState(inkColors[0]),[inkWidth,setInkWidth]=useState(.002);
  const [canvasSize,setCanvasSize]=useState({width:1,height:1});
  const [exporting,setExporting]=useState(false),[ocrBusy,setOcrBusy]=useState(false);
  const [ocrText,setOcrText]=useState("");const ocrRequest=useRef(null),ocrVersion=useRef(0);
  useEffect(()=>{const saved=documentId?readValue(`ielts-pdf-ink-v1:${documentId}`,{}):{};const next=validPdfInk(saved)?saved:{};inkRef.current=next;setInk(next);setDrawing(false);},[documentId]);
  useEffect(()=>{ocrVersion.current++;ocrRequest.current?.abort();setOcrBusy(false);setOcrText(documentId?readValue(`ielts-pdf-ocr-v1:${documentId}:${page}`,{}).text||"":"");},[documentId,page]);
  useEffect(()=>()=>ocrRequest.current?.abort(),[]);
  const saveInk=strokes=>{const next={...inkRef.current,[page]:strokes};if(!validPdfInk(next)){setError("批注已达到本地容量限制，请导出批注 PDF 后再开始新文档。");return;}inkRef.current=next;setInk(next);try{writeValue(`ielts-pdf-ink-v1:${documentId}`,next);setError("");}catch{setError("批注暂未保存到本机，请先导出批注 PDF 或学习备份。");}};
  const exportInk=async()=>{if(exporting||!pdfRef.current)return;setExporting(true);setError("");try{const pdf=pdfRef.current,marks=inkRef.current;const bytes=await pdf.getData();const output=await exportAnnotatedPdf(bytes,marks);const url=URL.createObjectURL(new Blob([output],{type:"application/pdf"}));const link=document.createElement("a");link.href=url;link.download=`${title.replace(/\.pdf$/i,"")}-原页批注.pdf`;link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}catch{setError("批注 PDF 导出失败，原文与本机批注仍保留，请重试。加密 PDF 需先解密。");}finally{setExporting(false);}};
  const recognizePage=async()=>{if(ocrBusy||!pdfRef.current)return;const controller=new AbortController(),version=ocrVersion.current;ocrRequest.current=controller;setOcrBusy(true);setError("");try{const pdfPage=await pdfRef.current.getPage(page),natural=pdfPage.getViewport({scale:1}),viewport=pdfPage.getViewport({scale:Math.min(2,2200/Math.max(natural.width,natural.height))});const canvas=document.createElement("canvas");canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);await pdfPage.render({canvasContext:canvas.getContext("2d"),viewport}).promise;if(controller.signal.aborted)return;const result=await requestAi("reading/ocr",{image:canvas.toDataURL("image/jpeg",.9)},controller.signal);if(controller.signal.aborted||version!==ocrVersion.current)return;setOcrText(result.text);try{writeValue(`ielts-pdf-ocr-v1:${documentId}:${page}`,{text:result.text,uncertain:result.uncertain,updatedAt:Date.now()});}catch{setError("识别结果暂未保存，请复制本页文字。 ");}setStudyMode(true);if(!result.text)setError("本页没有识别到文字，请切回原页核对。");}catch(e){if(!controller.signal.aborted)setError(e.message);}finally{if(ocrRequest.current===controller){ocrRequest.current=null;setOcrBusy(false);}}};
  const searchVersion = useRef(0);

  useEffect(() => {
    const updateFullscreenState = () => {
      const activeElement = document.fullscreenElement || document.webkitFullscreenElement;
      setIsFullscreen(activeElement === readerRef.current);
    };
    document.addEventListener("fullscreenchange", updateFullscreenState);
    document.addEventListener("webkitfullscreenchange", updateFullscreenState);
    updateFullscreenState();
    return () => {
      document.removeEventListener("fullscreenchange", updateFullscreenState);
      document.removeEventListener("webkitfullscreenchange", updateFullscreenState);
    };
  }, []);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    const loadingTask = getDocument({ url: src });
    setDocumentState("loading");
    setError("");
    setPage(1);
    setPages(0);
    setMatches([]);
    setMatchIndex(-1);
    setStudyMode(false); setPageText(""); setDocumentId(""); setSearching(false); setQuery(""); searchVersion.current++;

    loadingTask.promise
      .then((pdf) => {
        if (!active) return;
        pdfRef.current = pdf;
        setDocumentId(pdf.fingerprints[0]);
        setPages(pdf.numPages);
        setDocumentState("ready");
      })
      .catch((nextError) => {
        if (!active) return;
        setError(nextError?.message || "PDF 无法读取");
        setDocumentState("error");
      });

    return () => {
      active = false;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
      pdfRef.current = null;
      void loadingTask.destroy();
    };
  }, [src]);

  useEffect(() => {
    if (documentState !== "ready" || !pdfRef.current || !studyMode) return;
    let active = true;
    setPageText(""); setExtracting(true); setTextError("");
    pdfRef.current.getPage(page).then((pdfPage) => pdfPage.getTextContent()).then((content) => {
      if (active) setPageText(content.items.map((item) => `${item.str || ""}${item.hasEOL ? "\n" : " "}`).join(""));
    }).catch(() => { if (active) setTextError("本页文字提取失败，请切回原页阅读。"); }).finally(() => { if (active) setExtracting(false); });
    return () => { active = false; };
  }, [documentState, studyMode, page, src]);

  useEffect(() => {
    if (documentState !== "ready" || !pdfRef.current || !canvasRef.current || studyMode) return undefined;
    let active = true;
    setRendering(true);
    renderTaskRef.current?.cancel();

    pdfRef.current.getPage(page).then((pdfPage) => {
      if (!active) return;
      const naturalViewport = pdfPage.getViewport({ scale: 1 });
      const scale = fitWidth
        ? Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (containerWidth - 44) / naturalViewport.width))
        : zoom;
      const viewport = pdfPage.getViewport({ scale });
      const outputScale = Math.min(2, window.devicePixelRatio || 1);
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d", { alpha: false });
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      setCanvasSize({width:Math.floor(viewport.width),height:Math.floor(viewport.height)});
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      const renderTask = pdfPage.render({
        canvasContext: context,
        viewport,
        transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0],
      });
      renderTaskRef.current = renderTask;
      return renderTask.promise;
    }).then(() => {
      if (active) setRendering(false);
    }).catch((nextError) => {
      if (active && nextError?.name !== "RenderingCancelledException") {
        setError(nextError?.message || "页面渲染失败");
        setRendering(false);
      }
    });

    return () => {
      active = false;
      renderTaskRef.current?.cancel();
    };
  }, [containerWidth, documentState, fitWidth, page, zoom, studyMode]);

  const changePage = (nextPage) => {
    setPage(Math.min(pages, Math.max(1, Number(nextPage) || 1)));
    viewportRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const changeZoom = (nextZoom) => {
    setFitWidth(false);
    setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom)));
  };

  const runSearch = async (event) => {
    event?.preventDefault();
    const term = normalizedSearchText(query);
    if (!term || !pdfRef.current) {
      setMatches([]);
      setMatchIndex(-1);
      return;
    }
    setSearching(true);
    const pdf = pdfRef.current, version = ++searchVersion.current;
    const nextMatches = [];
    try {
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        if (searchVersion.current !== version) return;
        const pdfPage = await pdf.getPage(pageNumber);
        const textContent = await pdfPage.getTextContent();
        const text = textContent.items.map((item) => item.str || "").join(" ").toLocaleLowerCase();
        if (text.includes(term)) nextMatches.push(pageNumber);
      }
      if (searchVersion.current !== version) return;
      setMatches(nextMatches);
      setMatchIndex(nextMatches.length ? 0 : -1);
      if (nextMatches.length) changePage(nextMatches[0]);
    } catch {
      if (searchVersion.current === version) setError("搜索未完成，请缩短关键词或重新打开 PDF 后重试。");
    } finally {
      if (searchVersion.current === version) setSearching(false);
    }
  };

  const nextMatch = () => {
    if (!matches.length) return;
    const nextIndex = (matchIndex + 1) % matches.length;
    setMatchIndex(nextIndex);
    changePage(matches[nextIndex]);
  };

  const toggleFullscreen = async () => {
    const activeElement = document.fullscreenElement || document.webkitFullscreenElement;
    if (activeElement) {
      if (document.exitFullscreen) await document.exitFullscreen();
      else document.webkitExitFullscreen?.();
      return;
    }
    const reader = readerRef.current;
    if (reader?.requestFullscreen) await reader.requestFullscreen();
    else reader?.webkitRequestFullscreen?.();
  };

  return (
    <section className={`pdf-reader ${className}`} aria-label={`${title} PDF 阅读器`} ref={readerRef}>
      <div className="pdf-reader-toolbar">
        <form className="pdf-reader-search" onSubmit={runSearch}>
          <MagnifyingGlass size={16} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 PDF" aria-label="搜索 PDF" />
          <button type="submit" disabled={searching || documentState !== "ready"}>{searching ? "查找中" : "查找"}</button>
          {matches.length > 0 && <button type="button" onClick={nextMatch}>{matchIndex + 1} / {matches.length}</button>}
          {!searching && query && matches.length === 0 && documentState === "ready" && <span>无匹配</span>}
        </form>
        <div className="pdf-reader-pages">
          <IconButton icon={ArrowLeft} label="上一页" disabled={page <= 1} onClick={() => changePage(page - 1)} />
          <label><input value={page} inputMode="numeric" aria-label="当前页" onChange={(event) => changePage(event.target.value)} /><span>/ {pages || "-"}</span></label>
          <IconButton icon={ArrowRight} label="下一页" disabled={page >= pages} onClick={() => changePage(page + 1)} />
        </div>
        <div className="pdf-reader-zoom">
          <button type="button" aria-pressed={studyMode} disabled={documentState !== "ready"} onClick={() => { setStudyMode((value) => !value); setRendering(false); }}>{studyMode ? "返回 PDF 原页" : "文字与批注"}</button>
          <IconButton icon={MagnifyingGlassMinus} label="缩小" onClick={() => changeZoom((fitWidth ? 1 : zoom) - 0.15)} />
          <button type="button" onClick={() => setFitWidth(true)} className={fitWidth ? "is-active" : ""}>{fitWidth ? "适合宽度" : `${Math.round(zoom * 100)}%`}</button>
          <IconButton icon={MagnifyingGlassPlus} label="放大" onClick={() => changeZoom((fitWidth ? 1 : zoom) + 0.15)} />
          <IconButton
            icon={isFullscreen ? ArrowsInSimple : ArrowsOutSimple}
            label={isFullscreen ? "退出全屏" : "全屏阅读"}
            onClick={toggleFullscreen}
          />
          <a className="icon-button" href={src} download={title} aria-label="下载原文件" title="下载原文件"><DownloadSimple size={20} /></a>
        </div>
      </div>

      {documentState==="ready"&&<div className="pdf-study-toolbar" aria-label="PDF 学习工具"><Button variant="ghost" aria-pressed={drawing} onClick={()=>{setDrawing(v=>!v);setStudyMode(false);}}>{drawing?"结束手写":"原页手写"}</Button>{drawing&&<><label>笔色<select value={inkColor} onChange={e=>setInkColor(e.target.value)}>{inkColors.map((color,i)=><option key={color} value={color}>{["红色","棕色","蓝色","绿色"][i]}</option>)}</select></label><label>粗细<select value={inkWidth} onChange={e=>setInkWidth(Number(e.target.value))}><option value={.001}>细</option><option value={.002}>中</option><option value={.004}>粗</option></select></label><Button variant="text" disabled={!ink[page]?.length} onClick={()=>saveInk(inkRef.current[page].slice(0,-1))}>撤销本页最后一笔</Button></>}<Button variant="ghost" disabled={exporting||!Object.values(ink).some(s=>s.length)} onClick={exportInk}>{exporting?"正在导出…":"导出手写批注 PDF"}</Button><Button variant="ghost" disabled={ocrBusy} onClick={recognizePage}>{ocrBusy?"正在识别…":"识别本页文字"}</Button>{ocrBusy&&<Button variant="text" onClick={()=>ocrRequest.current?.abort()}>取消识别</Button>}<small>识别时仅将当前页图像发送给百炼；结果需对照原页核验。</small></div>}
      <div className="pdf-reader-viewport" ref={viewportRef}>
        {(documentState === "loading" || (!studyMode && rendering) || (studyMode && extracting)) && <LoadingState className="pdf-reader-loading" label={documentState === "loading" ? "正在读取 PDF..." : studyMode ? "正在提取本页文字..." : "正在显示页面..."} />}
        {documentState === "error" && <div className="pdf-reader-error"><strong>PDF 无法读取</strong><span>{error}</span></div>}
        {documentState === "ready" && error && <p role="alert">{error}</p>}
        {studyMode && documentState === "ready" && !extracting && (textError ? <p role="alert">{textError}</p> : <PdfTextStudy key={`${documentId}:${page}:${src}`} text={ocrText||pageText} ocr={Boolean(ocrText)} documentId={documentId} page={page} title={title}/>)}
        <div className="pdf-page-surface" style={{display:documentState!=="ready"||studyMode?"none":undefined,width:canvasSize.width,height:canvasSize.height}}><canvas ref={canvasRef}/>{documentState==="ready"&&<PdfInkLayer key={`${documentId}:${page}`} strokes={ink[page]||[]} enabled={drawing&&!rendering} color={inkColor} width={inkWidth} size={canvasSize} onChange={saveInk}/>}</div>
      </div>
    </section>
  );
}
