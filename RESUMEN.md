# RESUMEN · lane `enlaces-hub`

**Rama:** `feat/enlaces-hub` (off `main` @ 9b35c980) · **worktree:** `DTD-worktrees/enlaces-hub`
**Commit:** `59bb24fc` — `feat(interno): link-in-bio en el hub de marca + guía HTML`
**Estado:** ✅ merge-ready (NO pusheado — gate del Director).

## Contexto

La guía **.md** del link-in-bio ya está en `main` (mergeada antes: `44edb65b`). Este lane
suma lo que se había perdido cuando el Director podó el worktree anterior con trabajo sin
commitear (HTML + integración al hub). **Ahora se commiteó de una** para no repetirlo.

## Archivos (4 · commit selectivo)

- `app/interno/(app)/marca/enlaces/page.tsx` — **nuevo**. Página del hub interno: guía paso a
  paso (bio, botones nativos, atribución, editar) + **preview en vivo** del `/enlaces` real
  embebido en iframe (same-origin, no duplica el HTML).
- `app/interno/(app)/marca/page.tsx` — ToolCard "Link-in-bio · Instagram" en Herramientas.
- `docs/marketing/assets/link-in-bio-guia.html` — **nuevo**. Guía imprimible/compartible
  (tokens de marca, estilo de las guías de WhatsApp; botón Copiar la URL).
- `docs/marketing/link-in-bio.md` — puntero a la página del hub y al HTML.

## Gates

- typecheck ✓ · lint ✓ · `next build` ✓ (exit 0) → ruta `/interno/marca/enlaces` compila.
- Frontera pública respetada (la página del hub vive en área interna gateada).

## Merge sugerido (Director, con OK del founder)

```bash
git merge --no-ff feat/enlaces-hub && node scripts/verify.mjs && git push
node scripts/harness-worktree.mjs finish enlaces-hub --delete-branch
```
