import { useEffect, useRef, useState } from "react";

export function QuarterRing({ size = 20, className = "" }) {
  return (
    <span
      className={`quarter-ring ${className}`}
      style={{ "--quarter-ring-size": `${size}px` }}
      aria-hidden="true"
    />
  );
}

export function LoadingState({ label = "正在加载...", compact = false, className = "" }) {
  return (
    <div className={`loading-state ${compact ? "loading-state-compact" : ""} ${className}`} role="status" aria-live="polite">
      <QuarterRing size={compact ? 15 : 23} />
      <span>{label}</span>
    </div>
  );
}

export function LoadingFrame({ src, title, className = "", label = "正在打开资料...", minimumDuration = 900 }) {
  const [loaded, setLoaded] = useState(false);
  const startedAt = useRef(Date.now());
  const finishTimer = useRef(null);

  useEffect(() => {
    setLoaded(false);
    startedAt.current = Date.now();
    window.clearTimeout(finishTimer.current);
    return () => window.clearTimeout(finishTimer.current);
  }, [src]);

  const finishLoading = () => {
    const remaining = Math.max(0, minimumDuration - (Date.now() - startedAt.current));
    finishTimer.current = window.setTimeout(() => setLoaded(true), remaining);
  };

  return (
    <div className={`loading-frame ${loaded ? "is-loaded" : ""}`}>
      {!loaded && <LoadingState className="loading-frame-state" label={label} />}
      <iframe className={className} src={src} title={title} onLoad={finishLoading} />
    </div>
  );
}
