export function readValue(key, fallback = null) {
  if (typeof window === "undefined") return fallback;
  try {
    const desktop = window.ieltsDesktop?.store;
    const stored = desktop?.get(key);
    if (stored != null) return stored;
    const legacy = window.localStorage.getItem(key);
    if (legacy == null) return fallback;
    const value = JSON.parse(legacy);
    if (desktop && desktop.set(key, value) === false) throw new Error("无法迁移本地数据");
    return value;
  } catch { return fallback; }
}
export function writeValue(key, value) {
  if (window.ieltsDesktop?.store) {
    if (window.ieltsDesktop.store.set(key, value) === false) throw new Error("本机保存失败，请导出当前答案后重试。");
  } else window.localStorage.setItem(key, JSON.stringify(value));
}
