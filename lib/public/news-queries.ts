import { getAnonClient } from "./supabase-anon";
import type { NewsCategoria } from "@/lib/news/categories";
import type { NewsPostRow } from "@/lib/news/types";

export type { NewsPostRow } from "@/lib/news/types";

export async function listPublishedPosts(limit?: number): Promise<NewsPostRow[]> {
  try {
    const supabase = getAnonClient();
    let query = supabase
      .from("news_posts")
      .select("*")
      .eq("published", true)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (typeof limit === "number" && limit > 0) query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as NewsPostRow[];
  } catch (error) {
    console.error("listPublishedPosts error:", error);
    return [];
  }
}

export async function getPostBySlug(slug: string): Promise<NewsPostRow | null> {
  try {
    const { data, error } = await getAnonClient()
      .from("news_posts")
      .select("*")
      .eq("slug", slug)
      .eq("published", true)
      .maybeSingle<NewsPostRow>();
    if (error) throw error;
    return data ?? null;
  } catch (error) {
    console.error("getPostBySlug error:", error);
    return null;
  }
}

export async function getRelatedPosts(
  currentSlug: string,
  categoria: NewsCategoria,
  limit = 3,
): Promise<NewsPostRow[]> {
  try {
    const supabase = getAnonClient();
    const { data: same, error: sameError } = await supabase
      .from("news_posts")
      .select("*")
      .eq("published", true)
      .eq("categoria", categoria)
      .neq("slug", currentSlug)
      .order("date", { ascending: false })
      .limit(limit);
    if (sameError) throw sameError;

    const collected = (same ?? []) as NewsPostRow[];
    if (collected.length >= limit) return collected.slice(0, limit);

    const { data: others, error: otherError } = await supabase
      .from("news_posts")
      .select("*")
      .eq("published", true)
      .neq("slug", currentSlug)
      .neq("categoria", categoria)
      .order("date", { ascending: false })
      .limit(limit - collected.length);
    if (otherError) throw otherError;
    return [...collected, ...((others ?? []) as NewsPostRow[])];
  } catch (error) {
    console.error("getRelatedPosts error:", error);
    return [];
  }
}

export async function listPublishedSlugs(): Promise<string[]> {
  try {
    const { data, error } = await getAnonClient()
      .from("news_posts")
      .select("slug")
      .eq("published", true);
    if (error) throw error;
    return (data ?? []).map((row) => String(row.slug));
  } catch (error) {
    console.error("listPublishedSlugs error:", error);
    return [];
  }
}
