/**
 * `ILIKE` para los dobles de Supabase, como lo ve PostgREST: `*` pasa a ser `%` antes
 * de llegar a Postgres, y `\` escapa al carácter siguiente.
 *
 * Un doble que compara exacto no puede ver un comodín: así pasó inadvertido el problema
 * de la SDD-0600. `coincide-ilike.test.ts` comprueba esta imitación contra Postgres.
 */
export function coincideIlike(texto: string, patron: string): boolean {
  const literal = (c: string) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const p = patron.replaceAll("*", "%");
  let regex = "";
  for (let i = 0; i < p.length; i += 1) {
    if (p[i] === "\\") {
      i += 1;
      regex += literal(p[i] ?? "");
    } else if (p[i] === "%") {
      regex += "[\\s\\S]*";
    } else if (p[i] === "_") {
      regex += "[\\s\\S]";
    } else {
      regex += literal(p[i]);
    }
  }
  return new RegExp(`^${regex}$`, "i").test(texto);
}
