import { useEffect, useId, useRef, useState } from "react";
import { Button } from "./Common";
import { requestAi } from "../lib/aiClient";
import "./ai-settings.css";

export default function AiConnectionStatus({ onStatusChange }) {
  const [status, setStatus] = useState(null), [busy, setBusy] = useState(true), [error, setError] = useState("");
  const [apiKey, setApiKey] = useState(""), [region, setRegion] = useState("beijing"), [notice, setNotice] = useState("");
  const request = useRef(null), fileInput = useRef(null), callback = useRef(onStatusChange);
  callback.current = onStatusChange;
  const id = useId();
  const applyStatus = (result) => { setStatus(result); setRegion(result.region || "beijing"); callback.current?.(result); };
  const refresh = async () => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(""); setNotice("");
    try { const result = await requestAi("status", undefined, controller.signal); if (!controller.signal.aborted) applyStatus(result); }
    catch (e) { if (!controller.signal.aborted) setError(e.message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };
  useEffect(() => { void refresh(); return () => request.current?.abort(); }, []);
  const save = async (event) => {
    event.preventDefault();
    if (busy) return;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await requestAi("config", { apiKey: apiKey.trim(), region }, controller.signal);
      if (!controller.signal.aborted) { applyStatus(result); setApiKey(""); setNotice(result.message); }
    } catch (e) { if (!controller.signal.aborted) setError(e.message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };
  const importKey = async (event) => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    setError(""); setNotice("");
    try {
      if (file.size > 2048) throw new Error("请选择只包含一行 API Key 的小型 TXT 文件（不超过 2 KB）。");
      const value = (await file.text()).trim();
      if (!/^sk-[!-~]{9,1021}$/.test(value)) throw new Error("文件应只包含完整的百炼 API Key（以 sk- 开头），请检查后重新选择。");
      setApiKey(value); setNotice("已读入 Key。请核对所属地域，再点击“保存 Key”。");
    } catch (e) { setError(e.message); }
  };
  const managed = Boolean(status?.managedByEnvironment);
  return <section className="ai-settings" aria-busy={busy}>
    <header><h2>AI 设置</h2><p role="status">{busy ? "正在处理本机配置…" : status?.message || "填写自己的阿里云百炼 Key，开启 AI 学习辅助。"}</p></header>
    <p className="ai-settings-help">两款 App 共用此电脑上的配置。Key 只保存在本机，不包含在学习备份或导出的 PDF 中。</p>
    {managed ? <p>当前 Key 由启动环境管理。如需更换，请移除环境中的 Key 并重启 App。</p> : <form onSubmit={save}>
      <label htmlFor={`${id}-region`}>Key 所属地域</label>
      <select id={`${id}-region`} value={region} disabled={busy} onChange={(e) => { setRegion(e.target.value); setNotice(""); }} aria-describedby={`${id}-help`}>
        <option value="beijing">中国内地 · 北京</option><option value="singapore">新加坡</option><option value="virginia">美国 · 弗吉尼亚</option>
      </select>
      <label htmlFor={`${id}-key`}>{status?.ready ? "更换 API Key" : "阿里云百炼 API Key"}</label>
      <input id={`${id}-key`} type="password" value={apiKey} disabled={busy} onChange={(e) => { setApiKey(e.target.value); setNotice(""); }} placeholder={status?.ready ? "已保存；填写新 Key 可更换" : "粘贴以 sk- 开头的完整 Key"} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={1100} required aria-describedby={`${id}-help`} />
      <p id={`${id}-help`} className="ai-settings-help">在百炼控制台创建按量付费 API Key，并选择相同地域。不要填写 AccessKey 或 Coding Plan Key。保存和检查配置不调用收费模型；生成 AI 结果时使用你自己的账户额度。</p>
      <div className="ai-settings-actions"><Button type="submit" disabled={busy || !apiKey.trim()}>保存 Key</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => fileInput.current?.click()}>从 TXT 导入</Button></div>
      <input ref={fileInput} hidden type="file" accept=".txt,text/plain" onChange={importKey} />
    </form>}
    {error && <p className="ai-settings-message" role="alert">{error}</p>}
    {notice && <p className="ai-settings-message" role="status">{notice}</p>}
    <Button type="button" variant="ghost" disabled={busy} onClick={refresh}>重新检查配置</Button>
  </section>;
}
