import { useLayoutEffect } from "react";
import { ArrowRight, FileDoc, FilePdf, X } from "@phosphor-icons/react";
import PdfViewer from "./PdfViewer";
import { IconButton, MetaTag } from "./Common";
import { scrollPageToTop } from "../lib/pageScroll";

export function DocumentViewer({ resource, onClose }) {
  useLayoutEffect(() => {
    if (resource) scrollPageToTop();
  }, [resource?.id]);

  if (!resource) return null;
  const section = resource.section || resource.task;
  return (
    <div className="document-viewer">
      <header>
        <div>
          <FilePdf size={21} />
          <span>
            <strong>{resource.title}</strong>
            <small>{section} / {resource.type} / {resource.pages} 页</small>
          </span>
        </div>
        <div>
          {resource.originalUrl && (
            <a className="button button-ghost" href={resource.originalUrl} download>
              <FileDoc size={17} />下载原始 Word
            </a>
          )}
          <a className="button button-ghost" href={resource.url} target="_blank" rel="noreferrer">在新窗口打开</a>
          <IconButton icon={X} label="关闭文档" onClick={onClose} />
        </div>
      </header>
      <PdfViewer src={resource.url} title={resource.title} />
    </div>
  );
}

export function DocumentResourceGrid({ resources, onOpen }) {
  return (
    <div className="writing-resource-grid">
      {resources.map((item, index) => (
        <button type="button" className={index === 0 ? "featured-resource" : ""} key={item.id} onClick={() => onOpen(item)}>
          <div className="resource-icon">{item.originalUrl ? <FileDoc size={24} /> : <FilePdf size={24} />}</div>
          <MetaTag>{item.type}</MetaTag>
          <strong>{item.title}</strong>
          <span>{item.pages} 页</span>
          <div><span>打开资料</span><ArrowRight size={17} /></div>
        </button>
      ))}
    </div>
  );
}
