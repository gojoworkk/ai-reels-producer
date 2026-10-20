export type ScriptBlock = {
  label?: string; // короткий жирный заголовок пункта, например «Ошибка №1 — скучный хук»
  text: string;
  visual: string;
};

export type SectionKey = "hook" | "body" | "cta";

export type Script = {
  title: string;
  idea: string;
  whyItWorks: string;
  hook: ScriptBlock;
  body: ScriptBlock[];
  cta: ScriptBlock;
  caption: string;
  tags?: string[];
  // Короткие комментарии ИИ-продюсера к каждому блоку
  notes?: Partial<Record<SectionKey, string>>;
  sourceLanguage: string;
  generatedAt: string;
  editedAt?: string;
};

export type Comment = {
  id: string;
  section: SectionKey;
  text: string;
  author: string;
  createdAt: string;
};

export type Reel = {
  id: string; // Instagram shortCode
  account: string;
  url: string;
  caption: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  views: number;
  likes: number;
  comments: number;
  durationSec?: number;
  postedAt?: string;
  // Во сколько раз просмотры выше медианы аккаунта
  score: number;
  transcript?: string;
  transcriptFetched?: boolean;
  script?: Script;
  discussion?: Comment[];
  fetchedAt: string;
};

export type Competitor = {
  username: string;
  fullName?: string;
  addedAt: string;
  lastFetchedAt?: string;
  medianViews: number;
};

export type Database = {
  competitors: Competitor[];
  reels: Reel[];
};
