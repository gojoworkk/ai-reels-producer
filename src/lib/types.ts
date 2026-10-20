// Формат ответов API бэкенда (backend/app/schemas.py)

export type SectionKey = "hook" | "body" | "cta";

export type JobStatus = "queued" | "running" | "done" | "failed";

export type Job = {
  id: string;
  kind: "sync_competitor" | "generate_script";
  status: JobStatus;
  progress: number;
  message: string;
  error: string | null;
  competitor_id: number | null;
  reel_id: string | null;
  created_at: string;
  finished_at: string | null;
};

export type ScriptBlock = {
  label: string;
  text: string;
  visual: string;
};

export type Script = {
  title: string;
  idea: string;
  why_it_works: string;
  hook: ScriptBlock;
  body: ScriptBlock[];
  cta: ScriptBlock;
  caption: string;
  tags: string[];
  notes: Partial<Record<SectionKey, string>>;
  source_language: string;
  version: number;
  generated_at: string;
  edited_at: string | null;
};

export type ScriptPatch = Partial<Pick<Script, "title" | "idea" | "why_it_works" | "hook" | "body" | "cta" | "caption" | "tags">>;

export type Comment = {
  id: string;
  section: SectionKey;
  text: string;
  author: string;
  created_at: string;
};

export type ReelStatus = "new" | "media_ready" | "scripting" | "scripted" | "error";

export type Reel = {
  id: string;
  account: string;
  url: string;
  caption: string;
  views: number;
  likes: number;
  comments: number;
  duration_sec: number | null;
  posted_at: string | null;
  score: number;
  rank: number;
  status: ReelStatus;
  cover_url: string | null;
  video_url: string | null;
  tags: string[];
  script_title: string | null;
  has_script: boolean;
  active_job: Job | null;
};

export type ReelDetail = Reel & {
  total: number;
  transcript: string | null;
  previews: string[];
  script: Script | null;
  comments_list: Comment[];
};

export type Competitor = {
  username: string;
  full_name: string | null;
  added_at: string;
  last_synced_at: string | null;
  median_views: number;
  reels_count: number;
  scripts_count: number;
  best_score: number;
  active_job: Job | null;
  last_job: Job | null;
};

export type Health = {
  ok: boolean;
  apify: boolean;
  anthropic: boolean;
  sync_interval_hours: number;
};
