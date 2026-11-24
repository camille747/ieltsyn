import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  ArrowSquareOut,
  BookOpen,
  CaretDown,
  CaretUp,
  FilePdf,
  Headphones,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import nineScoreIndex from "../data/nine-score-index.json";
import PdfViewer from "./PdfViewer";
import { IconButton, LoadingFrame, MetaTag, Pagination } from "./Common";
import { recordStudyActivity } from "../lib/localStudyStore";
import { scrollPageToTop } from "../lib/pageScroll";

const AUDIO_PAGE_SIZE = 5;

const subjectRecords = {
  listening: { label: "听力", page: "listening", location: { tab: "nine" } },
  reading: { label: "阅读", page: "reading", location: { tab: "nine" } },
  writing: { label: "写作", page: "writing", location: { tab: "nine" } },
  speaking: { label: "口语", page: "speaking", location: { tab: "nine" } },
};

function archiveUrl(file) {
  return `/api/nine-score/file?path=${encodeURIComponent(file.path)}`;
}

function formatBytes(bytes) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function fileLabel(file, kind, index, hasOriginal) {
  if (kind === "original") return file.name.includes("新版") ? "原书新版" : index ? `原书版本 ${index + 1}` : "原书";
  if (!hasOriginal) return index ? `原书及解析 ${index + 1}` : "原书及解析";
  return index ? `配套解析 ${index + 1}` : "配套解析";
}

function FileViewer({ file, onClose }) {
  useLayoutEffect(() => {
    if (file) scrollPageToTop();
  }, [file?.path]);

  if (!file) return null;
  const url = archiveUrl(file);
  const isPdf = file.extension?.toLowerCase() === ".pdf" || file.name.toLowerCase().endsWith(".pdf");
  return (
    <div className="nine-viewer" role="dialog" aria-modal="true" aria-label={file.name}>
      <header>
        <div><FilePdf size={21} /><span><strong>{file.name}</strong><small>{formatBytes(file.size)}</small></span></div>
        <div>
          <a className="button button-ghost" href={url} target="_blank" rel="noreferrer"><ArrowSquareOut size={17} />在新窗口打开</a>
          <IconButton icon={X} label="关闭资料" onClick={onClose} />
        </div>
      </header>
      {isPdf
        ? <PdfViewer src={url} title={file.name} />
        : <LoadingFrame src={url} title={file.name} label="正在读取资料..." minimumDuration={1800} />}
    </div>
  );
}

function VolumeCard({ volume, subject, onOpen, onPlayAudio, targetPath }) {
  const hasTargetAudio = volume.audios.some((file) => file.path === targetPath);
  const [audioOpen, setAudioOpen] = useState(hasTargetAudio);
  const [audioPage, setAudioPage] = useState(1);
  const audioFiles = useMemo(
    () => [...volume.audios].sort((a, b) => (a.test || 99) - (b.test || 99) || (a.section || 99) - (b.section || 99) || a.name.localeCompare(b.name)),
    [volume.audios],
  );
  const audioPageCount = Math.max(1, Math.ceil(audioFiles.length / AUDIO_PAGE_SIZE));
  const visibleAudio = audioFiles.slice((audioPage - 1) * AUDIO_PAGE_SIZE, audioPage * AUDIO_PAGE_SIZE);
  const hasOriginal = volume.originals.length > 0;
  const documents = [...volume.originals.map((file) => ({ file, kind: "original" })), ...volume.analyses.map((file) => ({ file, kind: "analysis" })), ...volume.documents.map((file) => ({ file, kind: "document" }))];

  useEffect(() => {
    if (!hasTargetAudio) return;
    const targetIndex = audioFiles.findIndex((file) => file.path === targetPath);
    setAudioOpen(true);
    setAudioPage(Math.floor(targetIndex / AUDIO_PAGE_SIZE) + 1);
  }, [audioFiles, hasTargetAudio, targetPath]);

  return (
    <article className="nine-volume">
      <header>
        <div><span className="nine-book-number">{String(volume.number).padStart(2, "0")}</span><div><h3>{volume.title}</h3><p>{volume.fileCount} 个压缩包条目</p></div></div>
        <div className="nine-volume-counts"><MetaTag>{documents.length} 份文档</MetaTag>{audioFiles.length > 0 && <MetaTag tone="soft">{audioFiles.length} 个音频</MetaTag>}</div>
      </header>

      <div className="nine-paired-files">
        {volume.originals.map((file, index) => (
          <button type="button" key={file.path} className={file.path === targetPath ? "is-target" : ""} onClick={() => onOpen(file, volume)}>
            <span className="nine-file-icon"><BookOpen size={21} /></span>
            <span><strong>{fileLabel(file, "original", index, hasOriginal)}</strong><small>{file.name}</small></span>
            <span>{formatBytes(file.size)}</span><ArrowSquareOut size={17} />
          </button>
        ))}
        {volume.analyses.map((file, index) => (
          <button type="button" key={file.path} className={file.path === targetPath ? "is-target" : ""} onClick={() => onOpen(file, volume)}>
            <span className="nine-file-icon"><FilePdf size={21} /></span>
            <span><strong>{fileLabel(file, "analysis", index, hasOriginal)}</strong><small>{file.name}</small></span>
            <span>{formatBytes(file.size)}</span><ArrowSquareOut size={17} />
          </button>
        ))}
        {volume.documents.map((file) => (
          <button type="button" key={file.path} className={file.path === targetPath ? "is-target" : ""} onClick={() => onOpen(file, volume)}>
            <span className="nine-file-icon"><FilePdf size={21} /></span>
            <span><strong>补充资料</strong><small>{file.name}</small></span>
            <span>{formatBytes(file.size)}</span><ArrowSquareOut size={17} />
          </button>
        ))}
        {documents.length === 0 && <div className="nine-no-document"><WarningCircle size={18} />压缩包中没有识别到这一册的独立 PDF。</div>}
      </div>

      {audioFiles.length > 0 && (
        <div className="nine-audio-section">
          <button type="button" className="nine-audio-toggle" onClick={() => setAudioOpen((value) => !value)}>
            <span><Headphones size={19} /><strong>配套音频</strong><small>{audioFiles.length} 个文件</small></span>
            {audioOpen ? <CaretUp size={18} /> : <CaretDown size={18} />}
          </button>
          {audioOpen && (
            <div className="nine-audio-list">
              <div className="nine-audio-page">
                {visibleAudio.map((file) => (
                  <div key={file.path} className={`nine-audio-row ${file.path === targetPath ? "is-target" : ""}`}>
                    <div><MetaTag>{file.test ? `Test ${file.test}` : subject === "speaking" ? `第 ${volume.number} 册` : "音频"}</MetaTag><span><strong>{file.name}</strong><small>{file.section ? `Section ${file.section} / ` : ""}{formatBytes(file.size)}</small></span></div>
                    <audio controls preload="none" src={archiveUrl(file)} onPlay={() => onPlayAudio(file, volume)} />
                  </div>
                ))}
              </div>
              <Pagination page={audioPage} totalPages={audioPageCount} onChange={setAudioPage} label={`${volume.title}音频分页`} />
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export default function NineScoreLibrary({ subject, initialFilePath }) {
  const catalog = nineScoreIndex.catalog.find((item) => item.id === subject);
  const [viewerFile, setViewerFile] = useState(null);
  const [archiveState, setArchiveState] = useState("checking");

  const recordFile = (file, volume, kind) => {
    const subjectRecord = subjectRecords[subject];
    if (!subjectRecord) return;
    recordStudyActivity({
      id: `nine:${subject}:${file.path}`,
      page: subjectRecord.page,
      subject: subjectRecord.label,
      title: file.name,
      detail: `9 分达人 / 第 ${volume.number} 册 / ${kind === "audio" ? "音频" : "资料"}`,
      intent: { ...subjectRecord.location, nineFilePath: file.path },
    });
  };

  const openDocument = (file, volume) => {
    setViewerFile(file);
    recordFile(file, volume, "document");
  };

  useEffect(() => {
    fetch("/api/nine-score/status")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("unavailable")))
      .then((result) => setArchiveState(result.available ? "ready" : "missing"))
      .catch(() => setArchiveState("missing"));
  }, []);

  useEffect(() => {
    if (!catalog || !initialFilePath) return;
    for (const volume of catalog.volumes) {
      const document = [...volume.originals, ...volume.analyses, ...volume.documents].find((file) => file.path === initialFilePath);
      if (document) {
        setViewerFile(document);
        recordFile(document, volume, "document");
        return;
      }
      const audio = volume.audios.find((file) => file.path === initialFilePath);
      if (audio) {
        setViewerFile(null);
        recordFile(audio, volume, "audio");
        return;
      }
    }
  }, [catalog, initialFilePath]);

  if (!catalog) return null;
  return (
    <div className="nine-library">
      {archiveState === "missing" && (
        <div className="nine-archive-warning"><WarningCircle size={20} /><div><strong>九分达人资料暂时无法读取</strong></div></div>
      )}

      <div className="nine-volume-list">
        {catalog.volumes.map((volume) => (
          <VolumeCard
            key={`${subject}-${volume.number}`}
            volume={volume}
            subject={subject}
            onOpen={openDocument}
            onPlayAudio={(file, nextVolume) => recordFile(file, nextVolume, "audio")}
            targetPath={initialFilePath}
          />
        ))}
      </div>
      <FileViewer file={viewerFile} onClose={() => setViewerFile(null)} />
    </div>
  );
}
