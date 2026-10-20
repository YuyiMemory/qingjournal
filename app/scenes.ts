export const sceneInterval = 60 * 60 * 1000;
export const scenes = [
  { id: 'rainy-reading', title: '雨天讀書', caption: '雨聲裡，一起讀一頁故事', season: 3, time: 2, position: '82% 40%' },
  { id: 'baking-together', title: '一起做餅乾', caption: '把今天烤成甜甜的樣子', season: 0, time: 1, position: '80% 44%' },
  { id: 'afternoon-painting', title: '午後畫畫', caption: '你是我最喜歡的風景', season: 0, time: 2, position: '85% 42%' },
  { id: 'picnic-breeze', title: '微風野餐', caption: '帶一點好心情去曬太陽', season: 1, time: 1, position: '80% 50%' },
  { id: 'stargazing', title: '一起看星星', caption: '今晚的星光，分你一半', season: 3, time: 3, position: '80% 40%' },
  { id: 'quiet-company', title: '各自的小日子', caption: '各自忙著，也一起陪著', season: 2, time: 2, position: '82% 42%' },
];

// Exclude the previous illustration so hourly changes and return visits feel different.
export function pickScene(previous: string | null, random = Math.random) {
  const choices = scenes.map((scene, index) => ({ scene, index })).filter(({ scene }) => scene.id !== previous);
  return choices[Math.floor(random() * choices.length)].index;
}

export function sceneUrl(index: number) {
  return `${import.meta.env.BASE_URL}scenes/${scenes[index].id}.png`;
}
