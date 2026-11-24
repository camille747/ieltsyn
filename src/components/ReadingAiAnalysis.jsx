import { Button } from "./Common";

export default function ReadingAiAnalysis({ articleId, report, loading, error, onGenerate, onCancel }) {
  return <div className="reading-ai-analysis" aria-busy={loading}>
    <div className="review-controls">
      <Button variant="ghost" disabled={loading} onClick={onGenerate}>{loading ? "正在分析本题…" : report ? "重新分析本题" : "AI 分析本题"}</Button>
      {loading && <Button variant="text" onClick={onCancel}>取消</Button>}
    </div>
    {error && <p role="alert">{error}</p>}
    {report ? <>
      <p className="reading-ai-source">AI 学习辅助 · {report.provider || "阿里云百炼"}{report.model ? ` / ${report.model}` : ""} · 以原题与原文为准</p>
      <h4>作答分析</h4><p className="preserve-lines">{report.explanation}</p>
      <h4>原文证据</h4>
      {report.evidence.length ? report.evidence.map((item, index) => <div key={index} className="ai-evidence">
        {item.paragraphId !== "intro" && <a href={`#paragraph-${articleId}-${item.paragraphId}`}>定位 {item.paragraphId} 段</a>}
        <blockquote>{item.quote}</blockquote><p>{item.reason}</p>
      </div>) : <p>未提供可直接引用的定位句，请结合全文与标准答案复核。</p>}
      {report.vocabulary.length > 0 && <><h4>语境词汇</h4><dl>{report.vocabulary.map((item, index) => <div key={index}><dt>{item.term}</dt><dd>{item.meaning}</dd></div>)}</dl></>}
      {report.synonyms.length > 0 && <><h4>同义替换</h4>{report.synonyms.map((item, index) => <p key={index}><strong>{item.questionPhrase}</strong> → <strong>{item.passagePhrase}</strong><br/>{item.explanation}</p>)}</>}
      <h4>解题思路</h4><p className="preserve-lines">{report.approach}</p>
    </> : <p className="reading-ai-source">点击后发送本篇原文、题干和本次答案进行分析；你的复盘笔记单独保留。</p>}
  </div>;
}
