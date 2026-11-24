import fs from "node:fs";
import path from "node:path";

const validKey = (key) => typeof key === "string" && key.startsWith("ielts-") && key.length < 250;

export class DurableStudyStore {
  constructor(userDataDir) {
    this.directory = path.join(userDataDir, "study-records");
    this.file = path.join(this.directory, "study-data.json");
    this.backup = path.join(this.directory, "study-data.backup.json");
    fs.mkdirSync(this.directory, { recursive: true });
    this.data = this.readData();
  }

  readData() {
    for (const candidate of [this.file, this.backup]) {
      try {
        const parsed = JSON.parse(fs.readFileSync(candidate, "utf8"));
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
      } catch {
        // A missing or interrupted write falls through to the backup.
      }
    }
    return {};
  }

  get(key) {
    return this.data[key] ?? null;
  }

  set(key, value) {
    if (!validKey(key)) throw new Error("Invalid study key");
    const previous = this.data;
    this.data = { ...this.data, [key]: value };
    try { this.save(); } catch(error) { this.data = previous; throw error; }
    return true;
  }

  restore(values) {
    if (!values || typeof values !== "object" || Array.isArray(values) || Object.keys(values).some(key => !validKey(key))) return false;
    const previous = this.data; this.data = { ...this.data, ...values };
    try { this.save(); return true; } catch { this.data = previous; return false; }
  }

  snapshot() { return Object.fromEntries(Object.entries(this.data).filter(([key]) => validKey(key))); }

  save() {
    const temporary = `${this.file}.tmp`;
    const serialized = JSON.stringify(this.data, null, 2);
    fs.writeFileSync(temporary, serialized, "utf8");
    if (fs.existsSync(this.file)) fs.copyFileSync(this.file, this.backup);
    try {
      fs.renameSync(temporary, this.file);
    } catch (error) {
      // Keep the last good primary file when replacement is blocked.
      fs.rmSync(temporary, { force: true });
      throw error;
    }
  }
}
