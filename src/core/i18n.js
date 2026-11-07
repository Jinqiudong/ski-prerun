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
  "去征服哪座山？": "Which mountain next?", "去哪座山？": "Which mountain?", "挥手": "Wave", "比耶": "Peace", "欢呼": "Cheer", "举照片": "Hold a photo", "对讲机": "Radio", "去过 {a} 座 · {b} 座里滑了 {p}%": "{a} visited · {p}% of {b} mountains skied", "{b} 座山，还没开始": "{b} mountains, none yet", "每座山一块真实的地形 · 滑得越多颜色越足，全滑遍插上旗 · 拖动转一圈，两指缩放": "Each tile is the real mountain · the more you ski it the richer its colour, ski it all for a flag · drag to turn, pinch to zoom",
  "地形 AWS Terrain Tiles · 雪道 © OpenStreetMap 贡献者 · 原型，以雪场官方地图为准": "Terrain AWS Terrain Tiles · runs © OpenStreetMap contributors · a prototype: use the resort's official map",
  "全图": "All", "地形 AWS Terrain Tiles · 道路、河流和雪道 © OpenStreetMap 贡献者 · 原型，以雪场官方地图为准": "Terrain AWS Terrain Tiles · roads, rivers and runs © OpenStreetMap contributors · a prototype: use the resort's official map",
  "📖 我的滑雪记录": "📖 My ski log", "每个雪场你滑过多少（存在这台手机上）": "How much of each resort you've skied (kept on this phone)",
  "还没去过": "Not yet", "去滑一趟，这里就会记下来": "Ski it once and it shows up here", "🗺 看地图": "🗺 Map", "📜 预滑路书": "📜 Roadbook",
  "继续征服 ›": "Keep going ›", "去这里 ›": "Go here ›",
  "还没有。选一个默认人物，点「换装」改颜色、取名字，就会存到这里。": "None yet. Pick a rider, tap Dress to change colours and give it a name, and it's saved here.",
  // The opening, about your nearest trip
  "还有 {n} 天 · {name}": "{n} days to go · {name}", "明天出发 · {name}": "Tomorrow · {name}", "打开行程 ›": "Open the trip ›", "计划去 {list}": "Planned: {list}",
  "轻点飞机，看看是谁": "Tap a plane to see who's in it", "欢迎来到科罗拉多": "Welcome to Colorado", "今天的计划：{resort}": "Today's plan: {resort}", "今天还没定去哪": "Nothing planned for today yet",
  "直接去 {resort} ›": "Straight to {resort} ›", "第 {n} 天 · 今天去 {resort}": "Day {n} · {resort} today", "第 {n} 天 · 今天还没定去哪": "Day {n} · nothing planned yet",
  "这趟滑完了": "That's a wrap", "这趟的山：{list}": "The mountains: {list}", "看看记录 ›": "See the memories ›", "已经在 Denver": "Already in Denver", "还没填从哪飞": "No airport yet",
  "第一天 · {resort} · {sky} {temp}": "Day one · {resort} · {sky} {temp}", "今天 · {resort} · {sky} {temp}": "Today · {resort} · {sky} {temp}", " · 新雪 {cm} 厘米": " · {cm} cm of snow",
  "少云": "Partly cloudy", "雾": "Fog", "降雪": "Snow", "大雪": "Heavy snow", "晴雪": "Snow and sun",
  "大家都到啦": "Everyone's here", "到 Denver 啦": "Down at Denver", "穿过云，落在雪山里。": "Through the clouds, down into the mountains.", "轻点进入": "TAP TO ENTER", "去滑之前，先在这里滑一遍。": "Ride it here before you ride it there.", "2026–27 雪季": "2026–27 season", "声音": "Sound", "我的头像": "My avatar", "‹ 全部雪场": "‹ All resorts", "视角": "View", "图层": "Layers", "现在": "Now", "预览": "Preview", "晴": "Clear", "多云": "Cloudy", "阴": "Overcast", "路书": "Roadbook", "小星球地图": "Planet map", "平面小地图": "Flat map", "路线": "Route", "速度": "Speed", "雪场地图": "Resort map", "滑雪记录": "Ski log", "轻点车罩 · 放下挡风": "Tap the canopy to pull it down", "轻点车罩 · 收起": "Tap the canopy to lift it", "角色": "Character", "穿搭推荐": "Suggested", "穿搭": "Outfits", "女": "Female", "男": "Male", "手套": "Gloves", "雪鞋": "Boots", "制作中": "coming", "改颜色": "Colours", "存成我的": "Save as mine", "选你的穿搭": "Pick your outfit", "先选一套穿搭，再选雪场": "An outfit first, then a resort", "穿搭模版": "Outfits", "我的穿搭": "My outfits", "雪况 ⌄": "Snow ⌄", "收起 ⌃": "Close ⌃", "坐到山顶": "to the top", "3 天降雪": "3-day snow", "树上积雪": "snow on trees", "正在下雪": "snowing", "地图": "Map", "结束今天": "End the day", "捏人": "Customise", "雪板": "Board", "身材、衣服、颜色、动作，取个名字存在这台手机": "Body, clothes, colours, moves; name it to keep it on this phone", "身材": "Body", "衣服": "Clothes", "颜色": "Colours", "动作": "Moves", "身高": "Height", "体重": "Weight", "肌肉": "Muscle", "偏瘦": "slim", "适中": "medium", "偏壮": "solid", "柔和": "soft", "普通": "normal", "结实": "strong", "外套宽松": "Jacket fit", "外套长度": "Jacket length", "裤子宽松": "Pants fit", "合身": "fitted", "宽松": "loose", "短": "short", "长": "long", "长发": "Long hair", "头发": "Hair", "披发": "Loose", "辫子": "Braid", "不要头发": "No hair", "帽兜": "Hood", "马甲": "Vest", "帽檐": "Visor", "贴纸": "Stickers", "格纹": "Grid", "站立": "Stand", "抱板": "Hold board", "坐雪地": "Sit", "压板头": "Nose press", "压板尾": "Tail press", "欧式刻滑": "Euro carve", "刻平陀螺": "Carve spin", "立刃 S 弯": "Carved S", "搓雪 S 弯": "Skidded S", "坡上跳跃": "Slope pop", "平花倒滑": "Switch slide", "点一个看动作；再点一次正在播的 trick，设成你最爱的（选人页会时不时做一下）": "Tap to watch; tap the playing trick again to make it your favourite (your rider shows it now and then).", "继续预滑": "Continue", "继续": "Continue", "预滑中": "Pre-running", "缆车上": "on the lift", "滑行中": "skiing",
  // The rider page's wardrobe
  "上衣": "Jacket", "裤子": "Pants", "装备": "Gear", "外形": "Look", "发型": "Hair", "体形 {n}": "Build {n}", "更多 ⌄": "More ⌄", "随机": "Shuffle",
  "马甲颜色": "Vest colour", "亮面": "Glossy", "更多颜色": "More colours", "更多动作": "More moves", "改过": "changed", "左脚在前": "left foot forward", "右脚在前": "right foot forward",
  "摆姿势": "Poses", "出场": "Entrance", "出场 · 点一下从头看，再点一下设成最爱 ★": "Entrances · tap to watch, tap again for your favourite ★", "‹ 收起": "‹ Close",
  "‹ 人物": "‹ Rider", "完成": "Done", "款式": "Style", "格子": "Check", "短发": "Short", "标准": "regular", "衣服版型": "Fit", "最近用过": "Recent",
  "上衣颜色": "Jacket colour", "裤子颜色": "Pants colour", "头盔颜色": "Helmet colour", "手套颜色": "Glove colour", "雪镜颜色": "Lens colour", "雪鞋颜色": "Boot colour", "头发颜色": "Hair colour",
  "小动物": "Animals", "小动物不穿衣服，换块雪板吧": "Animals don't wear clothes: try another board", "转一圈": "Spin",
  "鼠兔": "Pika", "雪兔": "Hare", "土拨鼠": "Marmot", "雷鸟": "Ptarmigan", "狐狸": "Fox", "大角羊": "Bighorn", "黑熊": "Bear", "马鹿": "Elk", "驼鹿": "Moose",
  "再点一次正在做的 trick，设成最爱（出场时会做）": "Tap the playing trick again to make it your favourite (your rider comes in with it).",
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
  // The painted map (src/ride/paintedmap.js)
  "已滑": "Skied", "已滑 {p}%": "Skied {p}%", "我的 {name}": "My {name}", "绿道": "Green", "蓝道": "Blue", "黑道": "Black", "双黑": "Double",
  "点山上任意地方 → 从那里出发 · 点雪道 → 看名字和难度 · 彩色 = 滑过 · 铅笔线 = 还没滑": "Tap anywhere on the mountain → start there · tap a run → its name and level · colour = skied · pencil = not yet",
  "换条路线": "Another way", "去找他 ›": "Go to them ›", "跟随": "Follow", "滑到缆车站，坐上去": "Ski to the lift and ride it", "无名雪道": "Unnamed run",
  "滑过了": "skied", "还没滑过": "not skied yet", "在这里重新出发，接着去 {x}": "start here, then on to {x}",
  // Planning
  "我的行程": "My trips", "＋ 新建行程": "＋ New trip", "即将出发": "Coming up", "去过的": "Been there",
  "还没有行程。建一个，生成链接发给朋友，大家就能看到同一份计划。": "No trips yet. Make one and send the link: everyone sees the same plan.",
  "可能去的山": "Where we might ski", "日子": "Dates", "一起滑的人": "The crew", "整月": "Month", "收起": "Week",
  "上下滑，抽下一张": "swipe up or down for the next", "张机票": "passes", "张机票 ": "passes ",
  "改一改": "Edit", "删掉": "Delete", "存到我的行程": "Save to my trips", "朋友分享给你的行程": "A friend shared this trip",
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
  // Shared trips
  "共享 · {n} 人": "shared · {n}", "共享行程": "Shared trip", "加入啦！大家都能看到你了。": "You're in! Everyone can see you now.", "去挑你的人物 ›": "Pick your rider ›",
  "住宿": "Stay", "还没定住哪 · 点这里填": "Nowhere to stay yet · tap to fill in", "待确认改动": "change pending", "点一个人，可以把 TA 移出行程": "Tap someone to take them off the trip",
  "装备清单": "Gear list", "加一样，比如 暖宝宝": "Add one, e.g. hand warmers", "加": "Add", "最近": "Lately", "最近：": "Lately:",
  "谁负责什么": "Who does what", "退出行程": "Leave trip", "有人": "Someone", "大家都能改": "Anyone can edit", "我负责": "Mine", "负责": "'s",
  "离线 · 显示上次同步的": "Offline · showing the last sync", "刚刚同步": "synced just now", "{x}同步": "synced {x}", "{n} 人": "{n} people", "{n} 个人": "{n} people",
  "等负责人确认": "waiting for the owners", "等你确认": "waiting for you", "等{x}确认": "waiting for {x}", "{who} 提了 {n} 处改动": "{who} suggested {n} change(s)", "看看": "See",
  "每天去哪": "Each day", "还没定": "Not decided", "点一下选雪场": "tap to pick a mountain", "日期": "Dates", "人员": "People", "把「{s}」交给了": "handed “{s}” to",
  "退出「{x}」？": "Leave “{x}”?", "没退成：{x}": "Couldn't leave: {x}", "没连上网，等有网再退": "Offline: try again when you're online", "把 {x} 移出行程？": "Take {x} off the trip?", "{x} 已移出": "{x} is off the trip",
  "没连上网，这次没改成": "Offline: that change didn't go through", "没改成：{x}": "Couldn't change it: {x}", "正在打开行程…": "Opening the trip…",
  "没连上网，有网了再打开这个链接": "Offline: open this link again when you're online", "打不开这个行程：{x}": "Couldn't open this trip: {x}", "找不到这个行程，可能已经删了": "Can't find this trip: it may have been deleted",
  "改好了，大家都能看到": "Done: everyone sees it", "已发给 {x} 确认": "Sent to {x} to confirm", "没连上网，有网了再分享": "Offline: share when you're online", "没分享成：{x}": "Couldn't share: {x}",
  "发给朋友": "Send to friends", "朋友点开链接，填个名字就能加入，不用注册。大家看到的是同一份行程，改了会同步。": "Friends open the link, type a name and they're in, no sign-up. Everyone sees the same trip, and changes sync.",
  "分享": "Share", "复制链接": "Copy link", "链接已复制": "Link copied", "你叫什么？": "What's your name?", "朋友在行程里看到的名字": "The name friends see on the trip", "比如 阿北": "e.g. Sam", "好": "OK",
  "等待确认的改动": "Changes to confirm", "每一块有一个负责人：负责人改了直接生效，别人改的要负责人点头。": "Each part has an owner: their changes go straight in; anyone else's need their OK.",
  "你是负责人的，这里由你来点 ↓": "Where you're the owner, it's your call ↓", "不要": "Decline", "回复": "Reply", "接受": "Accept", "说点什么": "Say something", "发送": "Send",
  "没有等确认的改动了。": "Nothing waiting.", "接受了": "Accepted", "没采纳": "Declined", "回复了": "Replied", "可能去": "Maybe", "名字": "Name", "雪卡": "Pass",
  "负责人改了直接生效，别人改的变成提议。默认都是建行程的人负责。": "The owner's changes go straight in; anyone else's become suggestions. Whoever made the trip owns everything at first.",
  "机票：每人自己填自己的（在「改一改」里）。": "Flights: everyone fills in their own (in Edit).", "交给 {x} 了": "Handed to {x}",
  "每天去哪和路线": "Each day & routes", "日期和人员": "Dates & people",
  "「每天去哪」你负责，改了直接生效。": "You own “Each day”: your change goes straight in.", "「每天去哪」是 {x} 负责，你改的会发给 TA 确认。": "{x} owns “Each day”: your change goes to them to confirm.",
  "备注（可以不填）": "Note (optional)", "为什么想改（可以不填）": "Why (optional)", "就这么定": "Set it", "发给 {x} 确认": "Send to {x}",
  "住宿你负责，改了直接生效。": "You own the stay: your change goes straight in.", "住宿是 {x} 负责，你改的会发给 TA 确认。": "{x} owns the stay: your change goes to them to confirm.",
  "住哪，比如 Frisco · Airbnb": "Where, e.g. Frisco · Airbnb", "几号到几号、几间房、订好没": "Nights, rooms, booked yet?", "邀请你一起去滑雪": "invites you to ski", "你": "You",
  "朋友看到的名字": "The name friends see", "从哪里出发": "Flying from", "加入行程": "Join the trip", "不用注册 · 加入后可以挑你的人物": "No sign-up · pick your rider after joining",
  "先填个名字": "Type a name first", "没连上网，有网了再加入": "Offline: join when you're online", "没加入成：{x}": "Couldn't join: {x}", "你的名字（朋友看到的）": "Your name (friends see it)",
  "别人负责的部分，改了会变成提议，等负责人确认。": "Changes to parts someone else owns become suggestions for them to confirm.",
  "没连上网，先存在这台手机上；有网了点「＋ 邀请」分享": "Offline: kept on this phone for now; tap ＋ Invite when you're online",
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
  "雪季": "season", "趟行程": "trips", "天": "days", "座山": "mountains", "条雪道": "runs", "一个人的雪季": "A season on my own", "冲洗中…": "Developing…",
  "第 {n} 天": "Day {n}", "还没定雪场的那天": "No mountain that day",
  "开板第一天": "First day on snow", "一个人的预滑": "A pre-run on my own", "这个雪季没有记录。": "Nothing from this season.",
  "这个雪季还没开板。去预滑一趟，或者和朋友去滑，每天都会在这里留一张合照。": "No days on snow this season yet. Pre-run one, or ski with friends: every day leaves a group photo here.",
  "存到手机": "Save", "全部": "All", "合上": "Close",
  // Riding together (src/ride/together.js)
  "等我": "Wait for me", "缆车站见": "Meet at the lift", "这条好滑": "This run's great", "我先下去了": "Heading down", "去找你": "Coming to you",
  "{lift} 缆车上": "on {lift}", "{lift} 山顶": "top of {lift}", "在山顶": "at the top", "徒步上山": "hiking up", "在 {lift} 底站": "at the {lift} lift", "在 {run}": "on {run}",
  "和 {name} 一起坐 {lift}": "Riding {lift} with {name}", "和 {name} 一起坐 {lift} ›": "Ride {lift} with {name} ›", "{name} 坐上了 {lift}": "{name} got on {lift}",
  "等 {name} 一起上": "Waiting for {name}", "看我们": "See us", "先走": "Go now", "坐这": "Sit here", "{name} 在 {lift} 等你一起坐": "{name} is holding a chair on {lift} for you",
  "坐 {name} 后面那把": "In the chair behind {name}", "跟着 {name}": "Following {name}", "去找 {name}…": "Off to {name}…", "到 {name} 身边了": "Here with {name}",
  "已发送：{msg}": "Sent: {msg}", "{name} 也在山上": "{name} is on the mountain too", "{name} 不在线了，不跟了": "{name} went offline: stopped following",
  "滑起来就跟着 {name} 走": "Once you ski, you'll follow {name}", "{name} 在 {lift} 上，去底站": "{name} is on {lift}: to its bottom station", "跟着 {name}，重新规划": "Following {name}: route updated",
  "找不到去 {name} 那儿的路": "No way to {name} from here", "{name} 那里附近没有雪道": "No run near {name}", "传话": "Quick message", "和 {name} 去 {dest}": "With {name} to {dest}", "朋友": "Friend",
  // Voice (src/ride/voice.js)
  "麦克风": "Mic", "开": "on", "关": "off", "麦克风开着，点一下关掉": "Mic on: tap to turn it off", "麦克风关着，点一下打开": "Mic off: tap to turn it on",
  "按住": "Hold", "对讲": "to talk", "对讲中": "Talking", "松开结束": "let go to end", "静音": "Mute", "取消静音": "Unmute", "能听到 {name} 了": "You can hear {name} again", "已静音 {name}": "{name} muted", "已静音": "Muted",
  "麦克风关了": "Mic off", "麦克风开了：附近的朋友能听到你": "Mic on: friends near you can hear you", "麦克风好了，按住说话": "Mic ready: hold to talk",
  "和 {name} 的语音连不上：可能是网络挡住了": "Can't reach {name} for voice: the network may be blocking it",
  "语音已断开，回到页面后重新连接": "Voice disconnected: it reconnects when you come back to the page", "语音重新连接了": "Voice reconnected", "语音重新连接了。麦克风关着，点一下再打开": "Voice reconnected. Your mic is off: tap it to turn it back on",
  "没有麦克风权限。点地址栏左边的「大小」›「网站设置」›「麦克风」选「允许」，再点一次麦克风": "No mic permission. Tap \"aA\" in the address bar › Website Settings › Microphone › Allow, then tap the mic again",
  "没找到麦克风": "No microphone found", "麦克风被占用了（比如正在打电话），挂断后再试": "The mic is busy (a phone call?): try again after it ends",
  "这个页面用不了麦克风（需要 https）": "This page can't use the mic (it needs https)", "麦克风打不开，再试一次": "Couldn't open the mic: try again",
  "按住对讲": "Hold to talk", "对讲中，松开结束": "Talking: let go to end", "麦克风开了：一起滑的朋友能听到你": "Mic on: your party can hear you", "这把坐满了，坐后面那把": "That chair's full: you're in the one behind",
  // The party (src/core/party.js): the pet, its sign, the panel
  "一起滑": "Ride together", "加入": "Join", "加入一起滑": "Join the party", "离开": "Leave", "＋邀请": "＋ Invite", "发邀请": "Send invites", "在线": "online", "哪个行程": "Which trip",
  "先在行程里分享给朋友": "Share a trip with friends first", "行程里的人都在了": "Everyone on the trip is here", "还没有人在一起滑": "Nobody's riding together yet",
  "还没有别人。点＋邀请，叫上一起去的朋友": "Nobody else yet. Tap ＋ Invite to ask your friends on the trip",
  "去找他": "Go to them", "跟着他": "Follow", "跟着中": "Following", "叫他来": "Call them over", "自由滑": "Ride free", "跟队": "Stay with the group", "跟着你": "following you", "麦克风开着": "mic on",
  "{name} 约你一起滑": "{name} asks you to ride together", "{name} 叫你过去": "{name} wants you over", "{name} 加入了": "{name} joined", "等会儿": "Later",
  "邀请已发出": "Invites sent", "叫过了，等他来": "Called: wait for them",
  "一起坐": "Ride with them", "这次不坐": "Not this time", "等大家…": "Waiting…", "约你一起坐 {lift}": "asks you to ride {lift} together", "约大家一起坐": "Asking everyone to ride",
  "约大家一起坐 {lift}": "Ask everyone to ride {lift}", "约大家一起坐 ›": "Ride it with everyone ›",
  "在行程里": "on the trip", "还在主页 · {what}": "On the home page · {what}", "选衣服": "picking clothes", "看地图": "on the map", "看行程": "planning", "翻记录": "looking back",
  "{rn} · 看全山": "{rn} · looking at the mountain", "{rn} · 在山脚选缆车": "{rn} · picking a lift at the base", "{rn} · 坐 {lift} 上山中": "{rn} · riding {lift} up",
  "{rn} · 在 {lift} 山顶": "{rn} · at the top of {lift}", "{rn} · 在山顶": "{rn} · at the top", "{rn} · 徒步上山": "{rn} · hiking up", "{rn} · 滑向 {to}": "{rn} · skiing to {to}",
  "{rn} · 在滑 {run}": "{rn} · skiing {run}", "{rn} · 滑行中": "{rn} · skiing",
  // The snow's fun (src/ride/snow-core.js, snowfx.js): a crash, powder, moguls (蘑菇, "mushrooms": bumps)
  "撞到树了": "Into a tree", "粉雪！": "Powder!", "重心靠后，板头浮起来": "sit back, let the nose float", "粉雪": "powder",
  "今天有粉雪": "Powder today", "那天有粉雪：雪道边上、树林里和背风坡最深，重心稍微靠后": "A powder day: deepest at the run edges, in the trees and on lee slopes; sit back a little",
  "蘑菇道": "Moguls", "蘑菇道：{runs}": "Moguls: {runs}", "前方蘑菇道": "Moguls ahead", "膝盖放软，看着下一个蘑菇": "soft knees, look to the next bump",
  "放慢一点，膝盖放软，一个一个绕过去": "Slow down a little, soft knees, round them one by one", "蘑菇道：有雪包（猫跳）的雪道": "Moguls: a run with bumps",
  // The guide animal (src/ride/guide-core.js LINES, guide.js): what it says, the detour offers, the spots found
  "我是{name}，今天我带路！": "I'm {name}, I'll lead today!", "跟着{name}走，不会迷路～": "Follow {name}, you won't get lost~", "出发咯，跟紧我！": "Off we go, stay close!", "{name}来带路啦": "{name} is here to lead",
  "这边这边～": "This way, this way~", "跟紧我哦": "Stay close", "今天雪真好": "The snow's lovely today", "风好舒服～": "What a nice breeze~", "你滑得不错嘛": "You ride pretty well!",
  "看我的脚印走就对了": "Just follow my paw prints", "前面一路顺～": "Smooth all the way ahead~", "嘿嘿，追上我呀": "Hehe, catch me!", "我闻到松树的味道了": "I can smell the pines", "别看风景啦，看我～": "Eyes on me, not the view~",
  "慢慢来～": "Take your time~", "跟上呀": "Keep up!", "我在这儿等你": "I'm waiting here", "不急不急～": "No rush~", "我在前面哦！": "I'm up ahead!", "喂～这边！": "Hey~ over here!", "等你一下下": "Waiting a sec", "我不走，你慢慢滑": "I'm not going anywhere, take it easy",
  "走咯！": "Let's go!", "好嘞，继续！": "Right, on we go!", "跟上啦～": "There you are~", "就是这样！": "That's it!",
  "前面要左转哦": "Left turn coming up", "下个路口往左～": "Left at the next junction~", "等下靠左边！": "Keep left in a bit!",
  "前面要右转哦": "Right turn coming up", "下个路口往右～": "Right at the next junction~", "等下靠右边！": "Keep right in a bit!",
  "这边！": "This way!", "从这儿进～": "In here~", "看我，就是这条": "Look, it's this one", "这个口子，别错过": "This opening, don't miss it",
  "哎——不是那边！": "Hey, not that way!", "走错啦，回来回来～": "Wrong way, come back~", "那边不对哦": "That's not it", "等等我！路在这边": "Wait! The way's over here",
  "对啦，就是这条": "Yes, this one", "回来啦～": "You're back~", "好险好险": "Phew, close one", "嗯！跟着我": "Mm! Follow me",
  "哎呀，没事吧？": "Oops, you OK?", "拍拍雪，再来～": "Dust off, go again~", "树也吓了一跳": "The tree got a fright too", "摔一下不算什么": "A tumble's nothing",
  "小心树哦～": "Mind the trees~", "低头，有树枝！": "Duck, branches!", "跟着我的脚印走": "Follow my footprints", "这里好安静": "So quiet in here", "松针掉进领子里了": "Pine needles down my collar",
  "跟我来！": "Follow me!", "走！钻树林咯～": "Into the trees we go~", "就这儿，进！": "Right here, in!", "好，下次再带你去～": "OK, another time~", "那我们走大路～": "The main way, then~",
  "找到啦！": "Found it!", "这是我们的秘密基地～": "Our secret spot~", "记住这里哦": "Remember this place",
  "要不要钻一下树林？": "Shall we duck into the trees?", "敢不敢试试蘑菇？": "Dare to try the moguls?", "那边有深粉，去不去？": "Deep powder over there, want to go?", "走！": "Go!", "不了": "Not now",
  "{run} 旁的松林": "The pines by {run}", "{run} 的蘑菇阵": "The bumps on {run}", "{run} 边的深粉": "The stash by {run}", "雪道": "the run",
  "解锁新地点": "NEW SPOT", "又来啦": "BACK AGAIN", "已发现 {n} 处秘密地点": "{n} secret spots found", "这趟 +{k}": "+{k} this run", "小狐狸": "Little fox",
  // The bunny hill practice (src/ride/practice.js)
  "宝宝坡": "Bunny hill", "{name} 宝宝坡": "{name} bunny hill", "{name} 旁的缓坡": "The gentle slope by {name}", "去宝宝坡练习": "Practise on the bunny hill", "去宝宝坡练习 ›": "Practise on the bunny hill ›",
  "{len} 米 · 平均 {deg}°": "{len} m · {deg}° on average", "加速 · 立刃 · 换刃 · 刹车": "Speed · edges · linked turns · braking",
  "握好手机": "Hold your phone", "怎么舒服怎么握，点「开始」，现在的角度就是「平」": "Hold it however feels right and tap Start: that angle is \"flat\"", "先站稳～手机怎么舒服怎么拿": "Stand steady~ hold the phone however's comfy",
  "板头朝坡下放平，手机往前倾（或手指往下拖），滑到 {v} km/h": "Nose down the hill, board flat, tip the phone forward (or drag down): reach {v} km/h", "板头朝下，放平，冲～": "Nose down, flat base, go~",
  "立刃转弯": "Edge turns", "手机左右倾就是立刃。先脚跟刃、再脚尖刃，各压住转过坡下那条线": "Tilting the phone sets an edge. A heel-side turn, then a toe-side one: hold each past the fall line", "压住刃别松，转过滚落线": "Hold the edge, round past the fall line",
  "换刃": "Linked turns", "连着转：脚跟、脚尖、脚跟……连续换刃 {n} 次": "Link them: heel, toe, heel… {n} edge changes in a row", "左一下，右一下，像画 S": "Left, right, draw an S",
  "减速刹车": "Slow down and stop", "滑到 {from} km/h 以上，手机往回倒（或手指往上拖）把板横过来，{m} 米内停住": "Get past {from} km/h, tip the phone back (or drag up) to swing the board across, stop within {m} m", "板子横过来，脚跟踩住": "Board across, weight on the heels",
  "吃刃": "Catching an edge", "刹车横着滑时往脚尖猛压一下，感受吃刃；再用脚跟刃干净地停一次": "Sliding sideways, snap onto your toes to feel an edge catch; then stop cleanly on the heel edge", "下坡那条刃一插进雪里，就会绊一下": "Dig in the downhill edge and it trips you",
  "自由练习": "Free practice", "想练什么练什么，滑到底会送你回坡顶": "Practise anything; at the bottom you're taken back up", "自己玩吧，我在这儿看着": "Your turn, I'm watching",
  "步骤": "Steps", "开始": "Start", "平": "Flat", "脚跟": "Heel", "脚尖": "Toe", "脚跟刃": "Heel edge", "脚尖刃": "Toe edge", "感受吃刃": "Feel a catch", "干净停住": "Clean stop",
  "滑行": "Gliding", "刹车 {k}%": "Braking {k}%", "急停": "Full stop", "回坡顶": "Back up", "再练一次": "Again", "练这个": "Practise", "去练": "Go", "接着练": "Keep going", "去滑雪道 ›": "To the runs ›", "坐 {lift} 上山 ›": "Ride {lift} up ›",
  "{step} · 过关": "{step} · passed", "下一步：{step} ›": "Next: {step} ›", "刹车中 · {m} 米": "Braking · {m} m", "先滑到 {v} km/h": "Get up to {v} km/h first", "连续换刃 {k} / {n}": "Edge changes {k} / {n}",
  "吃刃了！刹车时重心留在脚跟（上坡那条刃）": "Caught an edge! Braking, keep your weight on the heels (the uphill edge)", "板子再横一点：这次最多 {d}°": "Swing the board further across: {d}° at most this time",
  "停住用了 {m} 米，要 {lim} 米内：早一点、狠一点": "Took {m} m to stop, aim for {lim}: earlier and harder", "{v} km/h！板头朝下、板放平，速度就上来了": "{v} km/h! Nose down and a flat base bring the speed",
  "脚跟、脚尖都转过了滚落线。立刃越多，弯越急": "Heel and toe, both round past the fall line. More edge, tighter turn", "连续换刃 {n} 次：每个弯都压住，过了坡下再换": "{n} edge changes: hold each turn, change after the fall line",
  "从 {v} km/h 停住只用了 {m} 米，板子横到 {d}°": "From {v} km/h to a stop in {m} m, the board {d}° across", "吃刃是下坡那条刃插进雪里。横着滑时，重心留在上坡那条刃上": "A catch is the downhill edge digging in. Sliding sideways, stay on the uphill edge",
  "现在这样就是「平」。左右倾立刃，前倾加速，往回倒刹车": "That's flat now. Tilt sideways to edge, forward to speed up, back to brake", "没感应到手机倾斜：用手指拖，左右拖转弯，往下拖加速，往上拖刹车": "No phone tilt found: drag instead, across to turn, down to speed up, up to brake",
  "还没感应到手机倾斜，也可以用手指拖": "No phone tilt yet: dragging works too", "看我：{line}": "Watch: {line}", "压住，转过去": "hold it, round we go", "绊了一下吧？这就是吃刃。再用脚跟刃停一次": "Felt that trip? That's a catch. Now stop on the heel edge",
  "{name}：欢迎来宝宝坡！我来教你": "{name}: welcome to the bunny hill! I'll teach you", "漂亮！": "Nice!", "学会啦～": "Got it~", "再来一次～": "Once more~", "到底啦，回坡顶": "Bottom! Back up we go",
  "真实的初学者坡：{len} 米，平均 {deg}°": "The real beginner slope: {len} m, {deg}° on average", "这个雪场没有宝宝坡，找了雪场底下最缓的一段": "No bunny hill here: the gentlest slope near the base",
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
// Your face on trips (the crew): one of the owner's painted avatars (assets/icons), chosen in settings.
export const AVATARS = ["av_rider", "av_girl", "av_fox", "av_hare", "av_marmot", "av_elk", "av_bear"];
export const myAvatar = () => { try { const a = localStorage.getItem("prerunAvatar"); return AVATARS.includes(a) ? a : "av_rider"; } catch { return "av_rider"; } };
const ROOT = () => (location.pathname.includes("/mountain/") ? "../" : "");

// Settings: your avatar (swipe through, tap one), and the language.
export function openSettings() {
  const el = document.createElement("div"), mine = myAvatar();
  el.style.cssText = "position:fixed;inset:0;z-index:60;background:rgba(40,34,28,0);display:flex;align-items:flex-end;transition:background .3s";
  el.innerHTML = `<div data-drawer style="width:100%;box-sizing:border-box;min-width:0;overflow:hidden;background:#fdfbf6;border-radius:18px 18px 0 0;padding:10px 18px calc(28px + env(safe-area-inset-bottom));transform:translateY(100%);transition:transform .3s cubic-bezier(.2,.9,.3,1);touch-action:pan-x;box-shadow:0 -6px 20px rgba(40,25,10,.25);font-family:'Noto Serif SC',serif;color:#33302c">
    <div style="width:44px;height:5px;border-radius:3px;background:#d6cdbf;margin:0 auto 12px"></div>
    <div style="font:500 10px Oswald,sans-serif;letter-spacing:.3em;color:#8a8278">SETTINGS</div>
    <div style="font:600 28px 'Cormorant Garamond','Noto Serif SC',serif;color:#22344d;margin:2px 0 14px">${t("设置")}</div>
    <div style="font:16px 'Cormorant Garamond','Noto Serif SC',serif;color:#6f675e;margin-bottom:6px">${t("我的头像")}</div>
    <div data-av-row style="display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;padding:8px 4px 12px;scrollbar-width:none">${AVATARS.map((a) => `<button data-av="${a}" style="flex:none;scroll-snap-align:center;width:84px;height:84px;padding:0;border-radius:50%;border:3px solid ${a === mine ? "#22344d" : "#fffdf8"};box-shadow:0 4px 10px rgba(90,70,40,.18);background:#e6ebee;overflow:hidden;transition:transform .2s;transform:scale(${a === mine ? 1.08 : 1})"><img src="${ROOT()}assets/icons/${a}.png?v=1" alt="" style="width:100%;height:100%;display:block;pointer-events:none"></button>`).join("")}</div>
    <div style="font:16px 'Cormorant Garamond','Noto Serif SC',serif;color:#6f675e;margin-bottom:8px">${t("语言")} · Language</div>
    <div style="display:flex;gap:8px">${[["zh", "中文"], ["en", "English"]].map(([l, n]) => `<button data-l="${l}" style="flex:1;font:600 17px 'Cormorant Garamond','Noto Serif SC',serif;padding:10px;border-radius:6px;border:1px solid ${l === lang ? "#22344d" : "#cbbfa9"};background:${l === lang ? "#22344d" : "#f6f1e7"};color:${l === lang ? "#fdfbf6" : "#22344d"}">${n}</button>`).join("")}</div>
  </div>`;
  document.body.append(el);
  el.onclick = (e) => {
    const av = e.target.closest?.("[data-av]")?.dataset.av;
    if (av) { // pick it: ring it, keep it, tell the page
      try { localStorage.setItem("prerunAvatar", av); } catch { /* private mode */ }
      for (const b of el.querySelectorAll("[data-av]")) { const on = b.dataset.av === av; b.style.borderColor = on ? "#22344d" : "#fffdf8"; b.style.transform = `scale(${on ? 1.08 : 1})`; }
      dispatchEvent(new CustomEvent("prerun:avatar", { detail: av })); return;
    }
    const l = e.target.dataset?.l; if (l && l !== lang) setLang(l); else if (e.target === el) close();
  };
  // A drawer: it slides up; pull it down (or tap above it) and it slides away.
  const dr = el.querySelector("[data-drawer]");
  const close = () => { dr.style.transition = "transform .25s ease-in"; dr.style.transform = "translateY(100%)"; el.style.background = "rgba(40,34,28,0)"; setTimeout(() => el.remove(), 260); removeEventListener("pointermove", move); removeEventListener("pointerup", up); removeEventListener("pointercancel", up); };
  requestAnimationFrame(() => requestAnimationFrame(() => { dr.style.transform = "translateY(0)"; el.style.background = "rgba(40,34,28,.35)"; }));
  let y0 = null, t0 = 0, dy = 0;
  dr.addEventListener("pointerdown", (e) => { if (e.target.closest("[data-av-row]")) return; y0 = e.clientY; t0 = performance.now(); dy = 0; dr.style.transition = "none"; });
  const move = (e) => { if (y0 === null) return; dy = Math.max(0, e.clientY - y0); dr.style.transform = `translateY(${dy}px)`; };
  addEventListener("pointermove", move);
  const up = () => { if (y0 === null) return; y0 = null; const fast = dy / Math.max(1, performance.now() - t0) > 0.5;
    if (dy > 90 || (fast && dy > 30)) close(); else { dr.style.transition = "transform .25s"; dr.style.transform = "translateY(0)"; } };
  addEventListener("pointerup", up); addEventListener("pointercancel", up);
  el.querySelector(`[data-av="${mine}"]`)?.scrollIntoView({ inline: "center", block: "nearest" });
}
