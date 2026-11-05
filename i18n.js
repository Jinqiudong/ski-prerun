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
  "去征服哪座山？": "Which mountain next?", "每座山一块真实的地形 · 滑得越多颜色越足，全滑遍插上旗 · 拖动转一圈，两指缩放": "Each tile is the real mountain · the more you ski it the richer its colour, ski it all for a flag · drag to turn, pinch to zoom",
  "地形 AWS Terrain Tiles · 雪道 © OpenStreetMap 贡献者 · 原型，以雪场官方地图为准": "Terrain AWS Terrain Tiles · runs © OpenStreetMap contributors · a prototype: use the resort's official map",
  "全图": "All", "地形 AWS Terrain Tiles · 道路、河流和雪道 © OpenStreetMap 贡献者 · 原型，以雪场官方地图为准": "Terrain AWS Terrain Tiles · roads, rivers and runs © OpenStreetMap contributors · a prototype: use the resort's official map",
  "📖 我的滑雪记录": "📖 My ski log", "每个雪场你滑过多少（存在这台手机上）": "How much of each resort you've skied (kept on this phone)",
  "还没去过": "Not yet", "去滑一趟，这里就会记下来": "Ski it once and it shows up here", "🗺 看地图": "🗺 Map", "📜 预滑路书": "📜 Roadbook",
  "继续征服 ›": "Keep going ›", "去这里 ›": "Go here ›",
  "还没有。选一个默认人物，点「换装」改颜色、取名字，就会存到这里。": "None yet. Pick a rider, tap Dress to change colours and give it a name, and it's saved here.",
  "大家都到啦": "Everyone's here", "到 Denver 啦": "Down at Denver", "穿过云，落在雪山里。": "Through the clouds, down into the mountains.", "轻点进入": "TAP TO ENTER", "去滑之前，先在这里滑一遍。": "Ride it here before you ride it there.", "2026–27 雪季": "2026–27 season", "声音": "Sound", "角色": "Character", "穿搭推荐": "Suggested", "穿搭": "Outfits", "女": "Female", "男": "Male", "手套": "Gloves", "雪鞋": "Boots", "制作中": "coming", "改颜色": "Colours", "存成我的": "save as mine", "选你的穿搭": "Pick your outfit", "先选一套穿搭，再选雪场": "An outfit first, then a resort", "穿搭模版": "Outfits", "我的穿搭": "My outfits",
  "🎨 改颜色": "🎨 Colours", "🎨 改颜色 · 存成我的": "🎨 Colours · save as mine", "穿这套去滑 ›": "Ride in this ›", "给这套穿搭取个名字": "Name this outfit", "比如：周末粉雪": "e.g. Weekend powder",
  "改颜色": "Colours", "穿搭加载中…": "Loading…", "还没有。选一套模版，点「改颜色」换几样、取个名字，就存到这里。": "None yet. Pick an outfit, tap Colours to change a few things, give it a name, and it's saved here.",
  "快到底放慢，别滑过站": "slow near the bottom, don't miss it", "单板注意": "For snowboards", "徒步上去再滑": "Hike, then ski", "要带的东西": "What to bring", "看雪定山": "wherever the snow is", "预滑路书": "Roadbook", "设置": "Settings", "语言": "Language", "⚙ 设置": "⚙ Settings", "你从哪飞（印在机票上）": "Where you fly from (printed on your pass)", "📍 用我的位置": "📍 Use my location", "最近的机场：{x}": "Nearest airport: {x}", "比如 SFO": "e.g. SFO", "定位不到，手动填吧": "Can't find you — type it in", "在「改一改」里填从哪飞": "set it in Edit",
  "外套": "Jacket", "雪裤": "Pants", "头盔": "Helmet", "雪镜": "Goggles", "单板": "Snowboard", "删除": "Delete", "🎨 换装 · 存成新人物": "🎨 Dress · save as new", "先取个名字": "Name it first",
  "改颜色，取个名字，保存到这台手机": "Change colours, name it, save it on this phone", "人物没加载出来，刷新试试": "The rider didn't load: try refreshing",
  "滑过 {a}/{b} 条雪道 · {km} 公里": "Skied {a}/{b} runs · {km} km", "滑过 {a}/{b} 条雪道 · {km} 公里 · {n} 趟": "Skied {a}/{b} runs · {km} km · {n} rides",
  // Roadbook
  "还没有。去预滑一趟，坐的缆车、在山顶的选择、滑的雪道都会一步一步记在这里。": "Nothing yet. Pre-run once: the lifts you take, the choices at each top, the runs you ski all go here, step by step.",
  "这里可以：": "From here you could:", "走了这条": "took this", "⛷ 滑下去": "⛷ Down", "↩ 改路线": "↩ Changed the route", "中间这段算看过了": "the stretch skipped counts as seen",
  "从 {x} 出发": "Set out from {x}", "坐 {x} 上山": "Ride {x} up", "到 {x} 山顶": "Top of {x}", "…还有 {n} 条": "…and {n} more", "到底坐 🚡 {x}": "then ride 🚡 {x}", "跳到 {x}": "Jumped to {x}",
  "金色是这一趟的路线": "Gold is this run's way", "📍 显示我在哪": "📍 Where am I", "📍 我在这": "📍 You're here", "📍 找不到位置": "📍 Can't find you",
  // The mountain page and the ride
  "← 回沙盘": "← Back to the model", "再坐一次": "Ride again", "加载中…": "Loading…", "加速": "faster", "按住": "Hold", "动作": "Tricks", "回到我": "Me",
  "回沙盘选下一条": "Back to pick the next", "更多": "More", "跳到山顶 ⏭": "Skip to the top ⏭", "还剩 ": "Left ", "雪场预滑": "Ski Pre-Run",
  "雪道和缆车 © OpenStreetMap 贡献者 · 地形 AWS Terrain Tiles · 雪地材质和云杉枝叶 Poly Haven (CC0) · 原型，仅供熟悉路线，以雪场官方地图为准": "Runs and lifts © OpenStreetMap contributors · terrain AWS Terrain Tiles · snow and spruce textures Poly Haven (CC0) · a prototype for learning the way: use the resort's official map",
  "雪道和缆车 © OpenStreetMap 贡献者 · 地形 AWS Terrain Tiles · 雪地材质 Poly Haven (CC0) · 原型，仅供熟悉路线，以雪场官方地图为准": "Runs and lifts © OpenStreetMap contributors · terrain AWS Terrain Tiles · snow textures Poly Haven (CC0) · a prototype for learning the way: use the resort's official map",
  "🗺 雪场地图 · 点一个地方，选从哪里出发": "🗺 Trail map · tap a spot to start from there", "🫧 放下防风罩": "🫧 Lower the bubble", "🫧 收起防风罩": "🫧 Raise the bubble",
  "← 回全景": "← Overview", "↻ 转一圈": "↻ Spin", "下雪": "Snow", "今天想怎么滑": "How do you want to ski today", "俯视": "Top", "全景": "Overview", "回到实时": "Now",
  "坐缆车上山 ›": "Ride up ›", "多云": "Cloudy", "山顶直接出发 ": "Straight from the top ", "巡航（蓝）": "Cruise (blue)", "挑战（黑）": "Challenge (black)", "换人物/雪场": "Change rider/resort",
  "滑下去能接上": "Ski down to", "点绿色标签选 base · 点右上角切时间和天气 · ": "Tap a green tag for a base · top right for time and weather · ", "点绿色标签选 base · 点右上角切时间和天气": "Tap a green tag for a base · top right for time and weather", "热身（绿）": "Warm up (green)", "生成山体…": "Building the mountain…",
  "自动旋转": "Spin", "跳过 ⏭": "Skip ⏭", "近看": "Close", "详情": "Details", "坐这条上山 ›": "Ride this one up ›",
  "🗺 雪场地图": "🗺 Trail map", "📖 滑雪记录": "📖 Ski log", "🪐 小地图换成小星球": "🪐 Little-planet map", "🗺 小地图改回平面": "🗺 Flat map", "🏔 回沙盘": "🏔 Back to the model", "🧑 换人物 / 换雪场": "🧑 Rider / resort",
  "看全图，选从哪里出发": "See it all, start anywhere", "这一趟怎么走的，明天照着走": "This run's way, to follow tomorrow", "这个雪场你滑过的地方": "Where you've skied here", "右上角的小地图样式": "The corner map's style", "回到开始页": "Back to the start",
  "菜单": "Menu", "📜 路书 · 怎么滑、哪里容易错": "📜 Roadbook · how to ski it, where it's easy to go wrong", "按这条路线滑 ›": "Ski this way ›", "从这条滑下去 ›": "Ski down this one ›", "回沙盘": "Back to the model", "再来一次": "Again",
  "取消": "Cancel", "从这里出发 ›": "Start here ›", "去坐 ›": "Go ride it ›", "那里没有雪道": "No run there", "点一条雪道或者一条缆车": "Tap a run or a lift",
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
    if (n.nodeType === 3) { const k = n.nodeValue.trim(); if (k && EN[k] && !n.parentElement?.closest('[translate="no"]')) n.nodeValue = n.nodeValue.replace(k, EN[k]); return; }
    if (n.nodeType !== 1 || n.getAttribute("translate") === "no") return; // names people typed stay as they are
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

// Settings: for now the language. A sheet over whatever page you're on.
export function openSettings() {
  const el = document.createElement("div");
  el.style.cssText = "position:fixed;inset:0;z-index:60;background:rgba(40,34,28,.35);display:flex;align-items:flex-end";
  el.innerHTML = `<div style="width:100%;background:#fdfbf6;padding:18px 18px calc(24px + env(safe-area-inset-bottom));box-shadow:0 -6px 20px rgba(40,25,10,.25);font-family:'Noto Serif SC',serif;color:#33302c">
    <div style="font:500 10px Oswald,sans-serif;letter-spacing:.3em;color:#8a8278">SETTINGS</div>
    <div style="font:600 28px 'Cormorant Garamond','Noto Serif SC',serif;color:#22344d;margin:2px 0 14px">${t("设置")}</div>
    <div style="font:16px 'Cormorant Garamond','Noto Serif SC',serif;color:#6f675e;margin-bottom:8px">${t("语言")} · Language</div>
    <div style="display:flex;gap:8px">${[["zh", "中文"], ["en", "English"]].map(([l, n]) => `<button data-l="${l}" style="flex:1;font:600 17px 'Cormorant Garamond','Noto Serif SC',serif;padding:10px;border-radius:6px;border:1px solid ${l === lang ? "#22344d" : "#cbbfa9"};background:${l === lang ? "#22344d" : "#f6f1e7"};color:${l === lang ? "#fdfbf6" : "#22344d"}">${n}</button>`).join("")}</div>
    <button data-x style="margin-top:16px;width:100%;font:16px 'Cormorant Garamond','Noto Serif SC',serif;padding:9px;border-radius:999px;border:1px solid #cbbfa9;background:#fdfbf6;color:#22344d">${t("收起")}</button></div>`;
  document.body.append(el);
  el.onclick = (e) => { const l = e.target.dataset?.l; if (l && l !== lang) setLang(l); else if (e.target === el || e.target.dataset?.x !== undefined) el.remove(); };
}
