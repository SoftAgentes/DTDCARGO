import type { NewsCategoria, NewsTipo } from "./categories";

export type NewsContentKind = "guide" | "news" | "analysis" | "case";

export interface NewsPostRow {
  id: string;
  slug: string;
  tipo: NewsTipo;
  categoria: NewsCategoria;
  title: string;
  excerpt: string;
  body_markdown: string;
  author_name: string;
  author_role: string | null;
  focus_keyword: string | null;
  secondary_keywords: string[];
  meta_description: string | null;
  pain_points: string[];
  date: string;
  read_time_min: number;
  published: boolean;
  source: "manual" | "seo-generator";
  created_at: string;
  updated_at?: string | null;
  content_kind?: NewsContentKind | null;
  cover_image_url?: string | null;
  cover_alt?: string | null;
  featured?: boolean | null;
  reviewer_name?: string | null;
  reviewer_role?: string | null;
}
