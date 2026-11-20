# Handoff · SDD-0626 · El nombre: Oficina_Virtual (spec v0.14)

**Pedido:** Sam, el 20/11/2026: que «la oficina» se llame **Oficina_Virtual** en todos lados, en pantalla, con guion
bajo, y con la ruta `/studio/admin/oficina-virtual`; la vieja redirige. Lo lanzó la sesión «Director Ofi_Hermes».
Rama `claude/oficina-virtual-renombre`, desde `main` en `765f3954a`.

## Qué se hizo

- **La ruta.** `app/studio/(app)/admin/oficina/` se movió (`git mv`) a `app/studio/(app)/admin/oficina-virtual/`:
  página, mini-vista, layout (el candado de `is_platform_admin` sigue igual), acciones y componentes.
  `revalidatePath` y los redirects de las acciones (`RUTA`) y los dos enlaces internos usan la ruta nueva.
- **La redirección.** `next.config.ts` suma dos reglas permanentes (308), junto a las de `/studio/kommo`:
  `/studio/admin/oficina` → `/studio/admin/oficina-virtual` y `/studio/admin/oficina/:path*` →
  `/studio/admin/oficina-virtual/:path*`. Next conserva el query string (`?r=…&c=…`).
- **En pantalla.** Los `<title>` (`Oficina_Virtual · revisión` y `· mini-vista`), los encabezados
  (`Oficina_Virtual · SDD-0626 · …`; el nombre va en un `<span>` con `textTransform: "none"` para que no salga como
  OFICINA_VIRTUAL, porque `.studio-eyebrow` pone mayúsculas), las frases de la mini-vista sobre la pausa y el título del
  aviso de Discord (`Oficina_Virtual: hay N borradores…`), cuyo enlace también apunta a la ruta nueva.
- **Pruebas.** Rutas y textos al día en `mini-vista`, `paso3b-piezas`, `acuse-escalado-pantalla`, `oficina-contraste` y
  los comentarios de `rbac-actions-guard`. Nueva `lib/studio/oficina/__tests__/oficina-virtual-nombre.test.ts`: carga
  la `next.config` real y comprueba con el matcher de Next que la dirección vieja y `/vista` redirigen permanente, que la
  nueva no redirige (sin bucle), que la carpeta vieja ya no existe, y los textos y el aviso.
- **Docs.** Spec v0.14 (sección al final de §3 e historial), runbook (nota en la cabecera y las rutas) y este handoff.

## Lo que NO cambió (a propósito)

`office_*` (tablas y funciones), `OFICINA_*`, `lib/studio/oficina/`, los crons `oficina-*`, el webhook
`/api/oficina/webhook-chatwoot`, los ids y carpetas de SDD y los nombres de las migraciones. Sin migración. El texto
«La oficina nace pausada» que se ve como motivo en la mini-vista es un dato de la base (0541), no de la app: no se tocó.
Los handoffs viejos y las specs de otras SDD (0678, 0681) que nombran la ruta vieja quedan como registro histórico.

## Para quien siga

- **Administración no tiene tarjeta hacia la página.** El pedido hablaba de «el enlace en Administración»; no existe
  hoy (se entra por el aviso de Discord o por la dirección). No se agregó: la tarjeta la verían admins del tenant que no
  pueden entrar. Si Sam la quiere, es una PR aparte que la muestre solo a `is_platform_admin`.
- **PR #666 (botón de pausa, borrador)** toca `app/studio/(app)/admin/oficina/`. Si se fusiona después de esta, hay
  que mover `TarjetaPausa.tsx` a la carpeta nueva y la versión de la spec se reacomoda.
- **Publicar:** no a mitad de una tanda de pruebas de la Oficina_Virtual sin coordinarlo con «Director Ofi_Hermes». Tras
  publicar, la dirección vieja de los avisos ya enviados redirige sola.
