import { useEffect, useRef, useState } from "react";
import { ArrowRight, CaretRight, Check, List, Timer, X } from "@phosphor-icons/react";

export function AppFrame({ active, navigate, navigation, product = "听 · 读 · 写", locked = false, tools, children }) {
  const [open, setOpen] = useState(false);
  const go = (id) => { if (!locked) { navigate(id); setOpen(false); } };
  return <div className="ui-app" onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}>
    <a className="ui-skip" href="#learning-content" onClick={event=>{event.preventDefault();const content=document.getElementById("learning-content");content?.focus();content?.scrollIntoView({block:"start"});}}>跳到学习内容</a>
    <header className="ui-masthead">
      <button className="ui-brand" disabled={locked} onClick={() => go("home")} aria-label={`${product}首页`}><span className="ui-brand-name">IELTSyn<span aria-hidden="true">.</span></span><span className="ui-product-name">{product}</span></button>
      <nav className={`ui-main-nav ${open ? "is-open" : ""}`} aria-label={`${product}主导航`}>
        {navigation.map(({ id, label, icon: Icon }) => <button key={id} disabled={locked} aria-current={active === id ? "page" : undefined} className={active === id ? "is-current" : ""} onClick={() => go(id)}>{Icon && <Icon size={20} weight={active === id ? "fill" : "regular"} aria-hidden="true"/>}<span>{label}</span></button>)}
      </nav>
      <div className="ui-frame-tools">{tools}<button className="ui-menu-toggle" aria-label={open ? "收起导航" : "打开导航"} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X size={23}/> : <List size={23}/>}</button></div>
    </header>
    <div id="learning-content" className="ui-app-content" tabIndex={-1}>{children}</div>
  </div>;
}

export function LearningWorkspace({ title, description, active, onChange, options, children, aside }) {
  return <div className="ui-workbench">
    <aside className="ui-workbench-nav"><div className="ui-workbench-intro"><h2>{title}</h2>{description && <p>{description}</p>}</div>
      <nav aria-label={`${title}学习方式`}>{options.map((option) => <button key={option.value} className={active === option.value ? "is-current" : ""} aria-current={active === option.value ? "page" : undefined} onClick={() => onChange(option.value)}><span>{option.label}</span><CaretRight size={16} aria-hidden="true"/></button>)}</nav>
      {aside && <div className="ui-workbench-aside">{aside}</div>}
    </aside>
    <section className="ui-workbench-body">{children}</section>
  </div>;
}

export function ResourceEntry({ icon: Icon, part, title, subtitle, metadata, status, onOpen, children }) {
  return <article className="ui-resource-entry">
    <button className="ui-resource-open" onClick={onOpen}><span className="ui-resource-part">{Icon ? <Icon size={25} aria-hidden="true"/> : part}</span><span className="ui-resource-copy"><span className="ui-resource-meta">{metadata}</span><strong>{title}</strong>{subtitle && <span className="ui-resource-subtitle">{subtitle}</span>}</span><ArrowRight size={21} className="ui-resource-arrow" aria-hidden="true"/></button>
    {(status || children) && <div className="ui-resource-bottom">{status && <span className="ui-resource-status">{status}</span>}<div>{children}</div></div>}
  </article>;
}

export function StudyEmpty({ icon: Icon, title, description, children }) {
  return <div className="ui-empty">{Icon && <span className="ui-empty-icon"><Icon size={28} aria-hidden="true"/></span>}<h3>{title}</h3>{description && <p>{description}</p>}{children}</div>;
}

export function StepOutline({ steps, active = 0 }) {
  return <ol className="ui-step-outline">{steps.map((step, index) => <li key={step.title} className={index === active ? "is-current" : index < active ? "is-complete" : ""}><span className="ui-step-number">{index < active ? <Check size={18}/> : index + 1}</span><div><strong>{step.title}</strong><p>{step.description}</p></div></li>)}</ol>;
}

export function TimerTools() {
  const details = useRef(null);
  useEffect(() => {
    const close = (event) => { if (!details.current?.contains(event.target) && details.current) details.current.open = false; };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  return <details className="ui-timer-tools" ref={details} onKeyDown={(e) => { if (e.key === "Escape") details.current.open = false; }}><summary><Timer size={21} aria-hidden="true"/><span>学习计时</span></summary><div className="ui-timer-popover"><h2>给学习留一段时间</h2><timer-suite/></div></details>;
}
