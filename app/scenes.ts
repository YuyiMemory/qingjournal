export const sceneInterval = 60 * 60 * 1000;
export const scenes = [
  {
    "id": "rainy-reading",
    "title": "雨天讀書",
    "caption": "雨聲裡，一起讀一頁故事",
    "season": 3,
    "time": 2,
    "position": "82% 40%"
  },
  {
    "id": "baking-together",
    "title": "一起做餅乾",
    "caption": "把今天烤成甜甜的樣子",
    "season": 0,
    "time": 1,
    "position": "80% 44%"
  },
  {
    "id": "afternoon-painting",
    "title": "午後畫畫",
    "caption": "你是我最喜歡的風景",
    "season": 0,
    "time": 2,
    "position": "85% 42%"
  },
  {
    "id": "picnic-breeze",
    "title": "微風野餐",
    "caption": "帶一點好心情去曬太陽",
    "season": 1,
    "time": 1,
    "position": "80% 50%"
  },
  {
    "id": "stargazing",
    "title": "一起看星星",
    "caption": "今晚的星光，分你一半",
    "season": 3,
    "time": 3,
    "position": "80% 40%"
  },
  {
    "id": "quiet-company",
    "title": "各自的小日子",
    "caption": "各自忙著，也一起陪著",
    "season": 2,
    "time": 2,
    "position": "82% 42%"
  },
  {
    "id": "breakfast-tea",
    "title": "早餐的熱茶",
    "caption": "一起把早晨慢慢喝完",
    "season": 0,
    "time": 1,
    "position": "82% 40%"
  },
  {
    "id": "folding-laundry",
    "title": "一起摺衣服",
    "caption": "平凡的小事，也想和你一起",
    "season": 0,
    "time": 1,
    "position": "82% 42%"
  },
  {
    "id": "blanket-fort",
    "title": "棉被小帳篷",
    "caption": "在家裡，搭一個小世界",
    "season": 0,
    "time": 1,
    "position": "82% 58%"
  },
  {
    "id": "jigsaw-afternoon",
    "title": "拼圖午後",
    "caption": "慢慢拼好，一起完成",
    "season": 0,
    "time": 1,
    "position": "82% 42%"
  },
  {
    "id": "evening-music",
    "title": "晚安小曲",
    "caption": "把溫柔唱給今天聽",
    "season": 0,
    "time": 1,
    "position": "82% 38%"
  },
  {
    "id": "window-bubbles",
    "title": "窗邊吹泡泡",
    "caption": "讓快樂輕輕飛起來",
    "season": 0,
    "time": 1,
    "position": "82% 60%"
  },
  {
    "id": "strawberry-cake",
    "title": "草莓小蛋糕",
    "caption": "今天的甜，分你一半",
    "season": 0,
    "time": 1,
    "position": "82% 34%"
  },
  {
    "id": "noodle-soup",
    "title": "暖暖的一碗麵",
    "caption": "有你在，連晚餐都很暖",
    "season": 0,
    "time": 1,
    "position": "82% 34%"
  },
  {
    "id": "jam-toast",
    "title": "果醬吐司",
    "caption": "把莓果香留在早晨",
    "season": 0,
    "time": 1,
    "position": "82% 40%"
  },
  {
    "id": "apple-pie",
    "title": "蘋果派出爐",
    "caption": "香氣裡，有我們的小日常",
    "season": 0,
    "time": 1,
    "position": "82% 34%"
  },
  {
    "id": "making-dumplings",
    "title": "包一點幸福",
    "caption": "把小小心意包進晚餐",
    "season": 0,
    "time": 1,
    "position": "82% 50%"
  },
  {
    "id": "cocoa-clouds",
    "title": "可可上的雲朵",
    "caption": "今天適合加一顆棉花糖",
    "season": 0,
    "time": 1,
    "position": "82% 53%"
  }
];

// Exclude the previous illustration so hourly changes and return visits feel different.
export function pickScene(previous: string | null, random = Math.random) {
  const choices = scenes.map((scene, index) => ({ scene, index })).filter(({ scene }) => scene.id !== previous);
  return choices[Math.floor(random() * choices.length)].index;
}

export function sceneUrl(index: number) {
  return `${import.meta.env.BASE_URL}scenes/${scenes[index].id}.webp`;
}
