import { useLayoutEffect, useRef } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CaretDown,
  Check,
  MagnifyingGlass,
  X,
} from "@phosphor-icons/react";

export { LoadingFrame, LoadingState, QuarterRing } from "./loading-ui/QuarterRing";

export function Button({ children, variant = "primary", icon: Icon, className = "", ...props }) {
  return (
    <button className={`button button-${variant} ${className}`} {...props}>
      {Icon && <Icon size={17} weight="bold" aria-hidden="true" />}
      {children != null && children !== "" && <span>{children}</span>}
    </button>
  );
}

export function IconButton({ label, icon: Icon, className = "", ...props }) {
  return (
    <button className={`icon-button ${className}`} aria-label={label} title={label} {...props}>
      <Icon size={20} aria-hidden="true" />
    </button>
  );
}

export function SearchField({ value, onChange, placeholder = "搜索", className = "" }) {
  return (
    <label className={`search-field ${className}`}>
      <MagnifyingGlass size={18} aria-hidden="true" />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      {value && (
        <button type="button" aria-label="清空搜索" onClick={() => onChange("")}>
          <X size={16} />
        </button>
      )}
    </label>
  );
}

export function SelectField({ value, onChange, children, label }) {
  return (
    <label className="select-field">
      {label && <span className="sr-only">{label}</span>}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
      <CaretDown size={15} aria-hidden="true" />
    </label>
  );
}

export function Segmented({ value, onChange, options, label }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => {
        const item = typeof option === "string" ? { value: option, label: option } : option;
        return (
          <button
            type="button"
            key={item.value}
            className={value === item.value ? "active" : ""}
            onClick={() => onChange(item.value)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function MetaTag({ children, tone = "neutral" }) {
  return <span className={`meta-tag meta-tag-${tone}`}>{children}</span>;
}

export function Pagination({ page, totalPages, onChange, label = "分页" }) {
  if (totalPages <= 1) return null;

  return (
    <nav className="pagination" aria-label={label}>
      <button type="button" disabled={page === 1} onClick={() => onChange(page - 1)}>
        <ArrowLeft size={15} aria-hidden="true" />
        <span>上一页</span>
      </button>
      <span aria-live="polite">{page} / {totalPages}</span>
      <button type="button" disabled={page === totalPages} onClick={() => onChange(page + 1)}>
        <span>下一页</span>
        <ArrowRight size={15} aria-hidden="true" />
      </button>
    </nav>
  );
}

export function PageHeading({ title, description, actions, eyebrow }) {
  return (
    <header className="page-heading">
      <div>
        <h1>{title}</h1>
        {eyebrow && <p className="page-context">{eyebrow}</p>}
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function SectionHeading({ title, description, action }) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="empty-state">
      {Icon && <Icon size={28} />}
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function Modal({ open, title, onClose, children, width = "wide" }) {
  const bodyRef = useRef(null);

  useLayoutEffect(() => {
    if (open) bodyRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [open, title]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`modal modal-${width}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <h2>{title}</h2>
          <IconButton icon={X} label="关闭" onClick={onClose} />
        </header>
        <div className="modal-body" ref={bodyRef}>{children}</div>
      </section>
    </div>
  );
}

export function BackButton({ onClick, children = "返回" }) {
  return <Button variant="text" icon={ArrowLeft} onClick={onClick}>{children}</Button>;
}

export function TextArrow({ children, onClick, href }) {
  const content = <>{children}<ArrowRight size={16} aria-hidden="true" /></>;
  if (href) return <a className="text-arrow" href={href} target="_blank" rel="noreferrer">{content}</a>;
  return <button className="text-arrow" type="button" onClick={onClick}>{content}</button>;
}

export function CheckItem({ children }) {
  return <div className="check-item"><span><Check size={13} weight="bold" /></span>{children}</div>;
}
