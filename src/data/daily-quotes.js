const DAY_MS = 86400000;
const FIRST_QUOTE_DATE = Date.UTC(2026, 7, 4);

export const dailyQuotes = [
  "行动自有回响。",
  "实干自带锋芒。",
  "路是走出来的。",
  "做事，就是修行。",
  "向前，自有答案。",
  "一动，胜过百想。",
  "事上磨，心上修。",
  "行动，是最硬的底气。",
  "人生不靠预测，靠建设。",
  "命运不在远方，就在脚下。",
  "不必等风来，走起来便有风。",
  "微小但持续，胜过盛大而短暂。",
  "慢一点没关系，别停在原地。",
  "真正的自由，来自长期的自律。",
  "你重复的日常，决定最终的模样。",
  "今日肯扎根，来日才有枝繁叶茂。",
  "所谓破局，不过是先走出第一步。",
  "把想法活成日常，才算真正拥有。",
  "别急着证明自己，先安静地成为自己。",
  "清醒地选择，坚定地承担。",
  "方向正确，慢也是前进。",
  "深耕自己，时间自会作答。",
  "先完成，再完美；先出发，再抵达。",
  "为者常成，行者常至。千里之行，始于足下。",
  "上士闻道，勤而行之。",
  "不积跬步，无以至千里。",
  "驽马十驾，功在不舍。",
  "君子欲讷于言，而敏于行。",
  "非知之艰，行之惟艰。",
  "人须在事上磨，方立得住。",
  "知者行之始，行者知之成。",
  "长安何处在，只在马蹄下。",
];

export function getDailyQuote(date = new Date()) {
  const localDateAsUtc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const dayOffset = Math.floor((localDateAsUtc - FIRST_QUOTE_DATE) / DAY_MS);
  const quoteIndex = ((dayOffset % dailyQuotes.length) + dailyQuotes.length) % dailyQuotes.length;
  return dailyQuotes[quoteIndex];
}
