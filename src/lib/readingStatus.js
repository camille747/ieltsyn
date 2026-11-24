import { readValue, writeValue } from "./persistence";
const key="ielts-reading-status-v1";
export function getReadingStatus(id) { return readValue(key,{})[id] || {}; }
export function setReadingStatus(id,patch) { const all=readValue(key,{});const next={...(all[id]||{}),...patch};writeValue(key,{...all,[id]:next});return next; }
