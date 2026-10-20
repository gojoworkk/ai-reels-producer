// Наполняет data/db.json демо-данными, чтобы посмотреть интерфейс без ключей API.
// Запуск: npm run seed:demo  (удалить: удалите data/db.json или аккаунт demo_account на странице «Конкуренты»)
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const now = new Date();
const daysAgo = (d) => new Date(now.getTime() - d * 86_400_000).toISOString();

const account = "demo_account";
const views = [1_840_000, 96_000, 412_000, 71_000, 58_000, 120_000, 88_000, 64_000];
const sorted = [...views].sort((a, b) => a - b);
const median = (sorted[3] + sorted[4]) / 2;

const captions = [
  "I tried waking up at 5am for 30 days. Here's what nobody tells you 👇",
  "3 apps that replaced my entire to-do system",
  "Stop saying 'I'm busy'. Say this instead.",
  "My morning routine (realistic version)",
  "How I plan my week in 10 minutes",
  "The 2-minute rule changed everything",
  "Desk setup tour 2026",
  "Why your goals keep failing",
];

const reels = views.map((v, i) => ({
  id: `DEMO${i + 1}`,
  account,
  url: "https://www.instagram.com/",
  caption: captions[i],
  views: v,
  likes: Math.round(v * 0.06),
  comments: Math.round(v * 0.002),
  durationSec: 25 + i * 4,
  postedAt: daysAgo(i * 3 + 1),
  score: v / median,
  fetchedAt: now.toISOString(),
}));

reels[0].transcript =
  "I tried waking up at 5am for 30 days. Day one? Brutal. By day ten I was getting more done before 9 than most people do all day. But here's what nobody tells you: it's not about the alarm. It's about what time you go to bed. If you want to try it, start with 15 minutes earlier, not two hours. Follow for part two.";
reels[0].transcriptFetched = true;
reels[0].script = {
  title: "30 дней подъёма в 5 утра",
  idea: "Личный эксперимент: месяц подъёмов в 5 утра и главный неочевидный вывод — всё решает время отбоя, а не будильник.",
  whyItWorks:
    "Хук-обещание личного опыта с цифрой («30 дней»), интрига «вот что никто не говорит» и практичный совет в конце, который хочется сохранить.",
  hook: { text: "Я месяц вставал в 5 утра. И вот что об этом молчат.", visual: "Крупно: звонит будильник, на экране 5:00" },
  body: [
    { text: "Первый день — просто ад. Хотелось всё бросить.", visual: "Помятое лицо, кружка кофе, темно за окном" },
    {
      text: "К десятому дню я успевал до девяти утра больше, чем раньше за весь день.",
      visual: "Быстрая нарезка: тренировка, ноутбук, список задач с галочками",
    },
    {
      text: "Но фишка не в будильнике. Всё решает, во сколько ты ложишься.",
      visual: "Смена кадра: кровать, часы показывают 22:00",
    },
    { text: "Хочешь попробовать — сдвигай подъём на 15 минут, а не сразу на два часа.", visual: "Говорящая голова, жест «чуть-чуть»" },
  ],
  cta: { text: "Подпишись — во второй части расскажу, что делать в эти утренние часы.", visual: "Указываю на кнопку подписки" },
  caption: "Месяц подъёмов в 5 утра: честный итог ⏰ Сохрани, чтобы попробовать. #продуктивность #утро #привычки",
  sourceLanguage: "английский",
  generatedAt: now.toISOString(),
};

const db = {
  competitors: [{ username: account, fullName: "Demo Creator", addedAt: now.toISOString(), lastFetchedAt: now.toISOString(), medianViews: median }],
  reels,
};

const dir = path.join(process.cwd(), "data");
await mkdir(dir, { recursive: true });
await writeFile(path.join(dir, "db.json"), JSON.stringify(db, null, 2), "utf8");
console.log(`Демо-данные записаны: ${reels.length} рилсов @${account}`);
