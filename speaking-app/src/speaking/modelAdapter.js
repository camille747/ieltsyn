import { requestAi } from "../../../src/lib/aiClient";

export const getModelStatus = () => requestAi("status");
export const requestSpeakingFeedback = (payload, signal) => requestAi("speaking/feedback", payload, signal);
export const requestShadowAnalysis = (payload, signal) => requestAi("shadowing/analysis", payload, signal);

// Convert browser recordings locally into a bounded mono PCM WAV for ASR.
export async function recordingToWav(blob) {
  if (!blob?.size || blob.size > 20 * 1024 * 1024) throw new Error("录音为空或超过 20 MB，请分段录音。");
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) throw new Error("当前环境不能转换录音，请使用桌面版。");
  const context = new AudioContext();
  let source;
  try { source = await context.decodeAudioData(await blob.arrayBuffer()); }
  catch { throw new Error("录音格式无法读取，请确认能播放后重新录制。"); }
  finally { await context.close(); }
  if (source.duration > 300) throw new Error("转写每次支持最多 5 分钟，请分段录音。");
  const rate = 16000, length = Math.ceil(source.duration * rate);
  const offline = new OfflineAudioContext(1, length, rate);
  const node = offline.createBufferSource(); node.buffer = source; node.connect(offline.destination); node.start();
  const rendered = await offline.startRendering(), samples = rendered.getChannelData(0);
  const buffer = new ArrayBuffer(44 + samples.length * 2), view = new DataView(buffer);
  const write = (at, value) => [...value].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  write(0, "RIFF"); view.setUint32(4, buffer.byteLength - 8, true); write(8, "WAVEfmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, "data"); view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) { const sample = Math.max(-1, Math.min(1, samples[i])); view.setInt16(44 + i * 2, sample < 0 ? sample * 32768 : sample * 32767, true); }
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error("录音转换失败，请重试。")); reader.readAsDataURL(new Blob([buffer], { type: "audio/wav" })); });
}

export async function transcribeRecording(blob, signal) {
  return requestAi("transcribe", { audio: await recordingToWav(blob) }, signal);
}
