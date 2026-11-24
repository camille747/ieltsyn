import assert from "node:assert/strict";
import { test } from "node:test";
import { cueAtTime, parseSubtitles } from "../speaking-app/src/speaking/shadowingStore.js";

test("SRT/VTT imports handle BOM, multiline dialogue, cue settings and reject invalid ranges", () => {
  const cues = parseSubtitles("\uFEFFWEBVTT\r\n\r\nNOTE ignored\r\n\r\n1\r\n00:01.200 --> 00:03.400 align:start\r\n<v Anna>Hello.</v>\r\nHow are you?\r\n\r\n2\r\n00:00:05,000 --> 00:00:06,100\r\nFine, thanks.\r\n\r\n3\r\n00:00:09,000 --> 00:00:07,000\r\nInvalid\r\n");
  assert.deepEqual(cues, [
    { id: 0, start: 1.2, end: 3.4, text: "Hello. How are you?" },
    { id: 1, start: 5, end: 6.1, text: "Fine, thanks." },
  ]);
  assert.deepEqual(parseSubtitles("plain text without timecodes"), []);
});

test("playback chooses the right cue at exact boundaries and leaves silence unassigned", () => {
  const cues = [{ start: 0, end: 1 }, { start: 1, end: 2 }, { start: 4, end: 5 }];
  assert.equal(cueAtTime(cues, 0), 0);
  assert.equal(cueAtTime(cues, 1), 1);
  assert.equal(cueAtTime(cues, 2), -1);
  assert.equal(cueAtTime(cues, 4.999), 2);
  assert.equal(cueAtTime(cues, 5), -1);
  assert.equal(cueAtTime([], 0), -1);
});

test("analysis and vocabulary backup retains learner notes and rejects corrupt entries", async () => {
  const {validateProgress} = await import("../speaking-app/src/speaking/shadowingStore.js");
  const lesson = {analysis:{0:{collocations:"look forward to",grammar:"gerund",questions:["Why -ing?"],ai:{sourceText:"I look forward to it.",translation:"我很期待。",collocations:"look forward to",grammar:"介词后接动名词"},aiQuestions:[{question:"Why?",answer:"Explanation."}]}},vocabulary:[{id:"word-1",text:"look forward to",meaning:"期待",example:"I look forward to it.",cueId:0,learned:false}]};
  assert.deepEqual(validateProgress(JSON.parse(JSON.stringify({lesson}))),{lesson});
  assert.throws(() => validateProgress({lesson:{analysis:{0:{ai:{translation:{invalid:true}}}}}}));
  assert.throws(() => validateProgress({lesson:{analysis:{0:{aiQuestions:[{question:"Why?",answer:{bad:true}}]}}}}));
  for (const patch of [{analysis:[]},{analysis:{0:{grammar:4}}},{analysis:{0:{questions:[{}]}}},{vocabulary:[{...lesson.vocabulary[0],learned:"yes"}]},{vocabulary:[lesson.vocabulary[0],lesson.vocabulary[0]]}]) assert.throws(() => validateProgress({lesson:{...lesson,...patch}}));
});
