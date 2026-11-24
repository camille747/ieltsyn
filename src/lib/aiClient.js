export async function requestAi(route, payload, signal) {
  let response;
  try {
    response = await fetch(`/api/ai/${route}`, {
      method: payload === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", "X-IELTS-Local": "1" },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
      signal: AbortSignal.any([AbortSignal.timeout(120000), ...(signal ? [signal] : [])]),
    });
  } catch (e) {
    if (e.name === "AbortError") throw e;
    throw new Error(e.name === "TimeoutError" ? "AI 处理超时，请重试；已保存的作答不受影响。" : "无法连接本机 AI 服务，请检查 App 与网络后重试。");
  }
  let data;
  try { data = await response.json(); } catch { throw new Error("本机 AI 服务未启动，请重启预览或桌面 App。"); }
  if (!response.ok) throw new Error(data.error || "AI 服务暂时不可用，请重试。");
  return data;
}

export async function imageForWriting(topic) {
  if (topic.task !== "Task 1") return undefined;
  if (!topic.image) throw new Error("此题缺少图表，暂不能生成可靠的 Task 1 批改。");
  const url = new URL(topic.image, location.href);
  if (url.origin !== location.origin) throw new Error("请先把原题图表保存到本机资料库。");
  const response = await fetch(url);
  if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) throw new Error("原题图表读取失败，请检查本机资料。");
  const blob = await response.blob();
  if (blob.size > 8 * 1024 * 1024) throw new Error("原题图表过大，请缩小图片后重试。");
  return new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error("无法读取原题图表。")); reader.readAsDataURL(blob);
  });
}

export async function requestWritingFeedback(topic, essay, signal) {
  return requestAi("writing/feedback", { task: topic.task || "Task 2", question: topic.essayQuestion, essay, image: await imageForWriting(topic) }, signal);
}
