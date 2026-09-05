export type LabelPresentation = {
  showBrand: boolean;
  language: "zh-es" | "zh-en";
  size: "standard" | "large";
};
export const DEFAULT_LABEL_PRESENTATION: LabelPresentation = {
  showBrand: true, language: "zh-es", size: "standard",
};
export function parseLabelPresentation(value: unknown): LabelPresentation | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.showBrand !== "boolean" || !["zh-es", "zh-en"].includes(String(v.language)) ||
      !["standard", "large"].includes(String(v.size))) return null;
  return { showBrand: v.showBrand, language: v.language as LabelPresentation["language"], size: v.size as LabelPresentation["size"] };
}
