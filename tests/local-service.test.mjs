import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { startLocalServer } from "../desktop/local-server.mjs";
import { DurableStudyStore } from "../desktop/data-store.mjs";

test("development resolves project materials, supports audio seeking and rejects traversal", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ielts-service-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const folder of ["public", "study-materials/九分达人", "work/reading-source/ZYZ八月合集"]) {
    fs.mkdirSync(path.join(root, folder), { recursive: true });
  }
  fs.writeFileSync(path.join(root, "public/index.html"), "IELTS test");
  fs.writeFileSync(path.join(root, "public/clip.mp4"), "0123456789");
  fs.writeFileSync(path.join(root, "study-materials/九分达人/audio.mp3"), "0123456789");
  fs.writeFileSync(path.join(root, "work/reading-source/ZYZ八月合集/article.pdf"), "%PDF-fixture");
  const service = await startLocalServer({
    distDirectory: path.join(root, "public"), resourcesDirectory: path.join(root, "runtime"),
    userDataDirectory: path.join(root, "records"),
  });
  t.after(() => service.close());
  const status = await fetch(`${service.origin}/api/nine-score/status`).then((r) => r.json());
  assert.equal(status.available, true);
  const response = await fetch(`${service.origin}/api/nine-score/file?path=${encodeURIComponent("9分达人/audio.mp3")}`, { headers: { Range: "bytes=3-6" } });
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("content-range"), "bytes 3-6/10");
  assert.equal(await response.text(), "3456");
  const video = await fetch(`${service.origin}/clip.mp4`, { headers: { Range: "bytes=2-4" } });
  assert.equal(video.status, 206);
  assert.equal(video.headers.get("content-type"), "video/mp4");
  assert.equal(await video.text(), "234");
  const pdf = await fetch(`${service.origin}/api/zyz-august/file?path=${encodeURIComponent("ZYZ八月合集/article.pdf")}`);
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get("content-type"), "application/pdf");
  assert.equal(await pdf.text(), "%PDF-fixture");
  const escaped = await fetch(`${service.origin}/api/nine-score/file?path=../../public/index.html`);
  assert.notEqual(escaped.status, 200);
});

test("study records survive restart and recover from interrupted primary data", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ielts-records-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = new DurableStudyStore(root);
  store.set("ielts-test-history", [{ id: "listening:1", responses: { q1: "boat" } }]);
  assert.deepEqual(new DurableStudyStore(root).get("ielts-test-history"), store.get("ielts-test-history"));
  store.set("ielts-test-annotations", [{ text: "note" }]);
  fs.writeFileSync(store.file, "{interrupted");
  assert.deepEqual(new DurableStudyStore(root).get("ielts-test-history"), [{ id: "listening:1", responses: { q1: "boat" } }]);
});


test("desktop restore validates keys and preserves existing data on disk errors",t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"ielts-restore-"));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const store=new DurableStudyStore(root);store.set("ielts-original",{answer:"kept"});
 for(const data of ["invalid",null,[],{"not-study":1}])assert.equal(store.restore(data),false);
 assert.equal(store.restore({"ielts-second":{answer:"new"}}),true);
 assert.deepEqual(new DurableStudyStore(root).snapshot(),store.snapshot());
 const before=store.snapshot();store.save=()=>{throw new Error("disk full");};assert.equal(store.restore({"ielts-original":{answer:"lost"}}),false);assert.deepEqual(store.snapshot(),before);
 assert.throws(()=>store.set("ielts-original",{}),/disk full/);assert.deepEqual(store.snapshot(),before);
 assert.deepEqual(new DurableStudyStore(root).get("ielts-original"),{answer:"kept"});
});
