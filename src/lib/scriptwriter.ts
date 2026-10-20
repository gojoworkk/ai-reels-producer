import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Reel, Script } from "./types";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

const Block = z.object({
  text: z.string().describe("Текст для озвучки / в кадре, на русском"),
  visual: z.string().describe("Что показывать в кадре, коротко"),
});

const ScriptSchema = z.object({
  title: z.string().describe("Короткое рабочее название ролика, до 60 символов"),
  idea: z.string().describe("Суть ролика в 1–2 предложениях"),
  whyItWorks: z.string().describe("Почему рилс залетел: механика удержания, эмоция, триггер"),
  hook: Block.describe("Хук — первые 1–3 секунды"),
  body: z.array(Block).describe("Основная часть, 2–6 смысловых блоков по порядку"),
  cta: Block.describe("Призыв к действию в конце"),
  caption: z.string().describe("Описание под пост на русском, с 3–5 хэштегами"),
  sourceLanguage: z.string().describe("Язык оригинала, например «английский»"),
});

const SYSTEM_PROMPT = `Ты — сильный русскоязычный сценарист коротких вертикальных видео (Reels, Shorts, TikTok). Тебе дают взлетевший рилс конкурента: транскрипт речи, описание и метрики. Твоя задача — разобрать его и написать готовый к съёмке сценарий на русском языке, который повторяет механику успеха оригинала.

Как работать с иностранным оригиналом:
- Это адаптация, а не перевод. Передавай смысл, интонацию и приём удержания, а не слова. Никаких калек вроде «это изменит вашу игру» или «позвольте мне объяснить».
- Пиши так, как говорит живой русскоязычный блогер: разговорно, короткими фразами, удобными для озвучки. Без канцелярита и пафоса.
- Идиомы, шутки, мемы и культурные отсылки замени на понятные русскоязычной аудитории эквиваленты. Если отсылку нельзя заменить без потери смысла — коротко поясни её в тексте.
- Доллары, мили, фунты, Фаренгейты пересчитай или замени, если цифры важны для смысла. Американские бренды и сервисы оставляй, только если они известны в СНГ, иначе подбери аналог.
- Сохрани тип хука (вопрос, шок-факт, противоречие, обещание результата, «я сделал X и вот что вышло» и т. п.) и его длину: хук должен укладываться в 1–3 секунды.
- Факты и цифры не выдумывай. Если в оригинале есть утверждение, которое ты не можешь проверить, оставь его как есть.

Если оригинал уже на русском — не переводи, а структурируй и аккуратно отредактируй.
Если транскрипта нет (например, рилс на музыке без речи), опирайся на описание и метрики, а в поле idea прямо напиши, что текст восстановлен по описанию.

В поле visual описывай, что показывать в кадре. Видеоряд ты не видишь, поэтому предлагай визуал, который логично следует из текста.`;

export function hasAnthropicKey() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export async function writeScript(reel: Reel): Promise<Script> {
  const client = new Anthropic();

  const userContent = [
    `Аккаунт: @${reel.account}`,
    `Ссылка: ${reel.url}`,
    `Просмотры: ${reel.views}, лайки: ${reel.likes}, комментарии: ${reel.comments}`,
    `Во сколько раз просмотры выше медианы аккаунта: x${reel.score.toFixed(1)}`,
    reel.durationSec ? `Длительность: ${Math.round(reel.durationSec)} сек` : null,
    "",
    "<описание>",
    reel.caption || "(нет описания)",
    "</описание>",
    "",
    "<транскрипт>",
    reel.transcript || "(транскрипта нет)",
    "</транскрипт>",
  ]
    .filter((l) => l !== null)
    .join("\n");

  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: "high",
      format: betaZodOutputFormat(ScriptSchema),
    },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Модель отказалась обрабатывать этот рилс. Попробуйте другой.");
  }
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new Error("Не удалось получить сценарий от модели. Попробуйте ещё раз.");
  }

  return { ...response.parsed_output, generatedAt: new Date().toISOString() };
}
