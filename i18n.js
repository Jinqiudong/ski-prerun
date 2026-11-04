// Chinese or English. Strings are written in Chinese in the code and looked up here by that text; a
// "{name}" in a string is filled from vars. The page's own text (and any text added later) is translated
// as it appears, so markup needs no keys; strings built with numbers go through t().
const KEY = "prerunLang";
export const lang = (() => { try { return localStorage.getItem(KEY) || (navigator.language?.startsWith("zh") ? "zh" : "en"); } catch { return "zh"; } })();
export const EN_ON = lang === "en";
export function setLang(l) { try { localStorage.setItem(KEY, l); } catch { /* storage off */ } location.reload(); }

const EN = {
  // Tabs and the start page
  "人物": "Rider", "雪场": "Resorts", "行程": "Trips", "记录": "Memory",
  "选你的 Rider": "Pick your rider", "先选人物，再选雪场": "Rider first, then a resort", "人物加载中…": "Loading rider…",
  "默认人物": "Riders", "我的人物": "My riders", "哪只脚在前": "Which foot forward",
  "左脚在前 · Regular": "Left foot forward · Regular", "右脚在前 · Goofy": "Right foot forward · Goofy",
  "🎨 换装": "🎨 Dress", "用这个人物 ›": "Ride with this one ›", "给人物取个名字": "Name your rider", "比如：周末的我": "e.g. Weekend me",
  "取消": "Cancel", "保存": "Save", "换装": "Dress up", "去哪个雪场": "Which resort",
  "🏔 去征服哪座山？": "🏔 Which mountain next?",
  "灰色的雪道还没滑过，滑过的变成彩色，全滑遍会开花 · 拖动移动，两指转动、倾斜、缩放": "Grey runs are still to ski; skied ones turn to colour, and a fully skied mountain flowers · drag to move, two fingers to turn, tilt, zoom",
  "全图": "All", "地形 AWS Terrain Tiles · 道路、河流和雪道 © OpenStreetMap 贡献者 · 原型，以雪场官方地图为准": "Terrain AWS Terrain Tiles · roads, rivers and runs © OpenStreetMap contributors · a prototype: use the resort's official map",
  "📖 我的滑雪记录": "📖 My ski log", "每个雪场你滑过多少（存在这台手机上）": "How much of each resort you've skied (kept on this phone)",
  "还没去过": "Not yet", "去滑一趟，这里就会记下来": "Ski it once and it shows up here", "🗺 看地图": "🗺 Map", "📜 预滑路书": "📜 Roadbook",
  "继续征服 ›": "Keep going ›", "去这里 ›": "Go here ›",
  "还没有。选一个默认人物，点「换装」改颜色、取名字，就会存到这里。": "None yet. Pick a rider, tap Dress to change colours and give it a name, and it's saved here.",
  "外套": "Jacket", "雪裤": "Pants", "头盔": "Helmet", "雪镜": "Goggles", "单板": "Snowboard", "删除": "Delete", "🎨 换装 · 存成新人物": "🎨 Dress · save as new", "先取个名字": "Name it first",
  "改颜色，取个名字，保存到这台手机": "Change colours, name it, save it on this phone", "人物没加载出来，刷新试试": "The rider didn't load: try refreshing",
  "滑过 {a}/{b} 条雪道 · {km} 公里": "Skied {a}/{b} runs · {km} km", "滑过 {a}/{b} 条雪道 · {km} 公里 · {n} 趟": "Skied {a}/{b} runs · {km} km · {n} rides",
  // Roadbook
  "还没有。去预滑一趟，坐的缆车、在山顶的选择、滑的雪道都会一步一步记在这里。": "Nothing yet. Pre-run once: the lifts you take, the choices at each top, the runs you ski all go here, step by step.",
  "这里可以：": "From here you could:", "走了这条": "took this", "⛷ 滑下去": "⛷ Down", "↩ 改路线": "↩ Changed the route", "中间这段算看过了": "the stretch skipped counts as seen",
  "从 {x} 出发": "Set out from {x}", "坐 {x} 上山": "Ride {x} up", "到 {x} 山顶": "Top of {x}", "…还有 {n} 条": "…and {n} more", "到底坐 🚡 {x}": "then ride 🚡 {x}", "跳到 {x}": "Jumped to {x}",
  "金色是这一趟的路线": "Gold is this run's way", "📍 显示我在哪": "📍 Where am I", "📍 我在这": "📍 You're here", "📍 找不到位置": "📍 Can't find you",
  // Planning
  "我的行程": "My trips", "＋ 新建行程": "＋ New trip", "即将出发": "Coming up", "去过的": "Been there",
  "还没有行程。建一个，生成链接发给朋友，大家就能看到同一份计划。": "No trips yet. Make one and send the link: everyone sees the same plan.",
  "可能去的山": "Where we might ski", "日子": "Dates", "一起滑的人": "The crew", "整月": "Month", "收起": "Week",
  "上下滑，抽下一张": "swipe up or down for the next", "张机票": "passes", "张机票 ": "passes ",
  "🔗 分享给朋友": "🔗 Share", "改一改": "Edit", "删掉": "Delete", "存到我的行程": "Save to my trips", "朋友分享给你的行程": "A friend shared this trip",
  "‹ 我的行程": "‹ My trips", "‹ 取消": "‹ Cancel", "新建行程": "New trip", "改行程": "Edit trip",
  "先选雪卡，再看能去哪些山": "Pass first, then the mountains it opens",
  "用什么雪卡": "Which pass", "几号到几号": "When", "可能去哪些山": "Mountains we might ski", "叫什么（可以不填）": "Name (optional)",
  "点第一天，再点最后一天": "Tap the first day, then the last", "🌨 还没想好，都行": "🌨 Not sure yet — any",
  "可以多选 · 一起去的人雪卡不一样也行": "Pick any · friends can have different passes",
  "保存，发给朋友 ✈": "Save & share ✈", "日票": "Day ticket", "还没买": "No pass yet",
  "这些 Epic 雪场还没做：Vail、Breckenridge、Keystone、Beaver Creek": "Epic resorts aren't in yet: Vail, Breckenridge, Keystone, Beaver Creek",
  "你从哪个机场飞？（比如 SFO）": "Which airport do you fly from? (e.g. SFO)", "点这里填你从哪飞": "tap: where you fly from",
  "链接已复制 ✓": "Link copied ✓", "复制这个链接发给朋友": "Copy this link for your friends", "还没预滑": "not yet", "今天出发！": "Today!", "进行中": "On now",
  "邀请": "Invite", "我": "Me",
  // Resort guide
  "这几天的雪": "Snow on your days", "适合谁": "Who it's for", "数字": "Numbers", "你的进度": "Your progress",
  "还太远，天气预报出来（出发前 2 周内）就会写在这里": "Too far out — the forecast shows up here about 2 weeks before",
  "山顶": "Top", "山脚": "Base", "落差": "Vertical", "雪道": "Runs", "缆车": "Lifts", "从 Denver": "From Denver",
  "初级": "Easy", "中级": "Inter.", "高级": "Adv.", "专家": "Expert", "去预滑 ›": "Pre-run ›", "📜 路书": "📜 Roadbook",
  "还没预滑过": "Not pre-run yet", "粉雪日": "powder day", "小雪": "flurries", "晴": "bluebird", "阴": "cloudy", "雪": "snow",
  // Memory
  "雪的记忆": "Snow memory", "我的雪季": "My snow season", "向上翻，一张一张往回看": "swipe up to look back, card by card", "那天": "The day",
  "还没有记忆。去预滑或者去滑一趟，就会在这里留下一张卡。": "No memories yet. Pre-run or ski a trip and a card lands here.",
  "预滑": "Pre-run", "每个雪场": "Each resort",
};
export function t(zh, vars) {
  let s = EN_ON ? EN[zh] ?? zh : zh;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(v);
  return s;
}
// Translate the page's text as it is and as it changes: whole text nodes (trimmed) and placeholders.
export function translatePage(root = document.body) {
  if (!EN_ON) return;
  const fix = (n) => {
    if (n.nodeType === 3) { const k = n.nodeValue.trim(); if (k && EN[k]) n.nodeValue = n.nodeValue.replace(k, EN[k]); return; }
    if (n.nodeType !== 1) return;
    if (n.placeholder && EN[n.placeholder]) n.placeholder = EN[n.placeholder];
    for (const c of n.childNodes) fix(c);
  };
  fix(root);
  new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) fix(n); }).observe(root, { childList: true, subtree: true });
}
// The 中 | EN switch.
export function langSwitch() {
  const b = document.createElement("div");
  b.className = "langSwitch";
  b.innerHTML = `<button data-l="zh" class="${EN_ON ? "" : "on"}">中</button><button data-l="en" class="${EN_ON ? "on" : ""}">EN</button>`;
  b.onclick = (e) => { const l = e.target.dataset.l; if (l && l !== lang) setLang(l); };
  return b;
}
