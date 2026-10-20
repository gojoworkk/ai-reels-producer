export type ScriptBlock = {
  text: string;
  visual: string;
};

export type Script = {
  title: string;
  idea: string;
  whyItWorks: string;
  hook: ScriptBlock;
  body: ScriptBlock[];
  cta: ScriptBlock;
  caption: string;
  sourceLanguage: string;
  generatedAt: string;
  editedAt?: string;
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
