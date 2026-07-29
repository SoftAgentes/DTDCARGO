import type { NewsCategoria } from "@/lib/news/categories";

type Props = { category?: NewsCategoria; name?: "search" | "calendar" | "clock" | "mail" | "arrow" };

export function EditorialIcon({ category, name }: Props) {
  const common = {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "search") return <svg {...common}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>;
  if (name === "calendar") return <svg {...common}><path d="M6 2v4m12-4v4M3 9h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z"/></svg>;
  if (name === "clock") return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
  if (name === "mail") return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>;
  if (name === "arrow") return <svg {...common}><path d="M5 12h14m-5-5 5 5-5 5"/></svg>;

  switch (category) {
    case "importa-sin-perder-plata":
      return <svg {...common}><path d="M4 7h16v12H4zM8 7V5h8v2M8 12h8m-8 4h5"/></svg>;
    case "que-se-mueve-en-china":
      return <svg {...common}><path d="M3 21V9l6 3V8l6 3V4h6v17zM7 17h2m4 0h2m4 0h2"/></svg>;
    case "como-llega-tu-mercancia":
      return <svg {...common}><path d="M3 14h18l-2 5H6zM7 14V7h10v7M9 7V4h6v3M4 21c1-1 2-1 3 0s2 1 3 0 2-1 3 0 2 1 3 0 2-1 3 0"/></svg>;
    case "venezuela-y-tu-bolsillo":
      return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M15 8.5c-.7-.7-1.6-1-2.7-1-1.5 0-2.6.8-2.6 2s1 1.8 2.8 2.2c1.7.4 2.8.9 2.8 2.4s-1.2 2.4-2.9 2.4c-1.2 0-2.3-.4-3.1-1.2M12 5.5v13"/></svg>;
    case "historias-reales":
      return <svg {...common}><circle cx="9" cy="8" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M3 20c0-4 2.5-6 6-6s6 2 6 6m0-5c3 0 5 1.7 5 5"/></svg>;
    default:
      return <svg {...common}><path d="M6 3h12v18H6zM9 7h6m-6 4h6m-6 4h4"/></svg>;
  }
}
