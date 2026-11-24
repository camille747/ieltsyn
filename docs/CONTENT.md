# 添加自己的学习资料

网页直接导入：阅读页可选择本地 PDF；口语影子跟读页可同时选择视频/音频和同名 SRT/VTT。个人导入素材只保存在本机，不进入 Git。

开发者可参照仓库中原创示例扩展结构化题库：

| 文件 | 格式与用途 |
| --- | --- |
| `src/data/listening-232-index.json` | 数组；每条有 id、title、part（P1–P4）、collection（历史兼容值 232）、frequency |
| `public/data/listening-232/<id>.json` | questionIds、groups、answerKey、transcriptLines；示例包含填空，计分代码也支持选择、匹配和多选 |
| `public/media/listening-232/<id>.mp3` | 与题目 id 相同的本地听力音频 |
| `src/data/reading-question-bank.generated.json` | 数组；paragraphs 与 questionGroups；每篇有独立 id、articleId、archiveItemId 与 P1/P2/P3 |
| `src/data/reading-october.json` | 阅读列表与 PDF/text 路径，matchedArchiveItemId 关联交互练习 |
| `src/data/writing-task1.json` | Task 1 题干与本地图表 image 路径 |
| `src/data/writing-topics.json` | topics 数组，包含 essayQuestion、primaryTopic、questionType |
| `speaking-app/src/speaking/eic-bank.json` | part1 话题及 questions；pairs 中有 title、cue、part3；初始内容为原创示例 |
| `speaking-app/public/shadowing/library.json` | items 数组；初始为空。个人素材优先从 UI 导入 |

完整连续模考要求听力 P1–P4、阅读 P1–P3、Task 1 与 Task 2 都有可用题目。仓库的少量示例用于验证完整流程；其题量不能作为正式考试成绩依据。

不要把他人的题库文本转换成 JSON 后就当作你拥有再分发权。公开仓库只添加原创或许可允许的资料，保留来源与许可证。资料数量变化后应同步更新 `scripts/check-project.mjs` 的示例检查。

`node scripts/generate-demo-pdfs.mjs` 可从原创阅读 JSON 重建附带 PDF；示例音频的原文在 `docs/sample-scripts/`。
