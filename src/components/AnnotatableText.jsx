import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NotePencil, X } from "@phosphor-icons/react";
import { Button } from "./Common";

const highlightColors = [
  { id: "brown", label: "深棕色" },
  { id: "yellow", label: "黄色" },
  { id: "red", label: "红色" },
  { id: "blue", label: "蓝色" },
  { id: "green", label: "绿色" },
  { id: "purple", label: "紫色" },
  { id: "orange", label: "橙色" },
];

function highlightedText(text, annotations, showNote, hideNote) {
  const sorted = [...annotations]
    .filter((item) => item.start >= 0 && item.end > item.start && item.end <= text.length)
    .sort((a, b) => a.start - b.start);
  const fragments = [];
  let cursor = 0;
  sorted.forEach((item) => {
    if (item.start < cursor) return;
    if (item.start > cursor) fragments.push(text.slice(cursor, item.start));
    fragments.push(
      <mark
        key={item.id}
        className={`reading-highlight highlight-${item.color}`}
        onMouseEnter={(event) => item.note && showNote(event, item.note)}
        onMouseLeave={hideNote}
      >
        {text.slice(item.start, item.end)}
      </mark>,
    );
    cursor = item.end;
  });
  if (cursor < text.length) fragments.push(text.slice(cursor));
  return fragments;
}

export default function AnnotatableText({
  as: Tag = "span",
  text,
  targetId,
  annotations,
  setAnnotations,
  onAnnotationsChange,
  className,
}) {
  const [editor, setEditor] = useState(null);
  const [note, setNote] = useState("");
  const [color, setColor] = useState("brown");
  const [hoveredNote, setHoveredNote] = useState(null);
  const editorRef = useRef(null);
  const targetAnnotations = annotations.filter((item) => item.paragraphId === targetId);

  useEffect(() => {
    const close = (event) => {
      if (editorRef.current && !editorRef.current.contains(event.target)) setEditor(null);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, []);

  const openEditor = (event) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!event.currentTarget.contains(range.commonAncestorContainer)) return;
    event.preventDefault();
    const before = document.createRange();
    before.selectNodeContents(event.currentTarget);
    before.setEnd(range.startContainer, range.startOffset);
    const start = before.toString().length;
    const selectedText = range.toString();
    if (!selectedText.trim()) return;
    const end = start + selectedText.length;
    const overlap = targetAnnotations.find((item) => item.start < end && item.end > start);
    setNote(overlap?.note || "");
    setColor(overlap?.color || "brown");
    setEditor({
      start,
      end,
      text: selectedText,
      overlapId: overlap?.id,
      left: Math.max(16, Math.min(event.clientX, window.innerWidth - 330)),
      top: Math.max(16, Math.min(event.clientY, window.innerHeight - 240)),
    });
  };

  const applyAnnotations = (next) => {
    setAnnotations(next);
    onAnnotationsChange?.(next);
    window.getSelection()?.removeAllRanges();
    setEditor(null);
  };

  const commitAnnotation = () => {
    if (!editor) return;
    const next = annotations
      .filter((item) => item.id !== editor.overlapId && !(item.paragraphId === targetId && item.start < editor.end && item.end > editor.start))
      .concat({
        id: `${targetId}-${Date.now()}`,
        paragraphId: targetId,
        start: editor.start,
        end: editor.end,
        color,
        note: note.trim(),
      });
    applyAnnotations(next);
  };

  const removeAnnotation = () => {
    if (!editor?.overlapId) return;
    applyAnnotations(annotations.filter((item) => item.id !== editor.overlapId));
  };

  const showHoveredNote = (event, content) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const showBelow = rect.top < 110;
    setHoveredNote({
      content,
      left: Math.max(145, Math.min(rect.left + rect.width / 2, window.innerWidth - 145)),
      placement: showBelow ? "below" : "above",
      top: showBelow ? rect.bottom + 9 : undefined,
      bottom: showBelow ? undefined : window.innerHeight - rect.top + 9,
    });
  };

  return (
    <>
      <Tag className={className} onContextMenu={openEditor}>
        {highlightedText(String(text || ""), targetAnnotations, showHoveredNote, () => setHoveredNote(null))}
      </Tag>
      {hoveredNote && createPortal(
        <span
          className={`floating-highlight-note ${hoveredNote.placement}`}
          style={{ left: hoveredNote.left, top: hoveredNote.top, bottom: hoveredNote.bottom }}
        >
          {hoveredNote.content}
        </span>,
        document.body,
      )}
      {editor && createPortal(
        <div ref={editorRef} className="highlight-editor" style={{ left: editor.left, top: editor.top }}>
          <header><span>标记与笔记</span><button type="button" aria-label="关闭" onClick={() => setEditor(null)}><X size={15} /></button></header>
          <p>{editor.text}</p>
          <div className="highlight-palette" role="group" aria-label="高亮颜色">
            {highlightColors.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`${item.id}${color === item.id ? " active" : ""}`}
                aria-label={item.label}
                title={item.label}
                onClick={() => setColor(item.id)}
              />
            ))}
          </div>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="输入笔记（悬停在标记文字上时显示）" />
          <footer>
            {editor.overlapId && <button type="button" onClick={removeAnnotation}>删除标记</button>}
            <Button icon={NotePencil} onClick={commitAnnotation}>保存</Button>
          </footer>
        </div>,
        document.body,
      )}
    </>
  );
}
