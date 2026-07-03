# RESUMEN · lane `mailing-norte`

**Ventana:** secundaria (no push, no merge, no migrations a prod).
**Rama:** `feat/mailing-norte` (off `main`, sin upstream).
**Worktree:** `DTD-worktrees/mailing-norte`.
**Tarea:** llevar el módulo **Mailing** (`/studio/mailing`) al Norte, construyendo
**de verdad** las 3 vistas que faltaban (decisión founder: "construir todo real").
**Spec:** `docs/specs/0140-mailing-norte/spec.md`.

## Commits (en orden)

| Slice | Qué | Commit | Migración |
|---|---|---|---|
| **A · Reshape** | 7 tabs al orden Norte, default Templates, rename, Blacklist en Config, subtítulo por tab | `40888602` | — |
| **B · Firmas** | vista de equipo + editor 5 layouts + preview + guardado admin | `68f10a11` | **0204** |
| **D · Programados** | tabla cola + KPIs + enviar ya/cancelar + **cron** | `e0d32667` | **0205** |
| **C · Envío manual** | compose: canal, para/cc/bcc, template, firma, enviar ahora + programar | `bb29d6e6` | — |

*(D antes que C a propósito: el botón "Programar" de Compose reusa `scheduleEmailAction` de D.)*

## Decisiones del founder aplicadas
- **Firmas:** el admin edita la firma de CUALQUIER miembro → migración 0204 suma
  policies tenant-scoped (gating admin en la app, RLS por tenant).
- **Programados:** tabla `mail_scheduled` + `/api/cron/mail-scheduled` (Vercel `*/5`).
- **Layouts:** se usa el enum backend existente mapeando los nombres del Norte
  (clasico→corporate, compacto→inline, vertical→card, minimo→minimal, foto→image_only).

## Detalles de calidad
- Arreglé 2 defectos de los subagentes antes de commitear:
  1. Botón Guardar de Firmas daba verde al despachar aunque el server fallara →
     ahora la acción se llama directo y el verde es solo si confirma (Regla 3).
  2. Un correo **programado con firma** no la renderizaba (el cron manda body
     crudo) → helper `buildOutgoingHtml` compartido hornea firma + formato al
     encolar; el programado sale idéntico al inmediato.

## Verificación (lane)
- `tsc --noEmit` → **exit 0** (las 4 slices).
- `eslint app/studio/(app)/mailing/` → **0 errores** (2 warnings preexistentes de
  `Date.now` en `RelTime` de BlacklistView/MailingClient — no las toqué).
- `docs:check` → **exit 0** (frontmatter del spec válido).
- **NO** corrí `verify.mjs` ni `pnpm build` (gate del Director).

## Pendiente del Director para poner en prod
1. **Aplicar migraciones 0204 + 0205** (revisión con skills Supabase seguridad +
   postgres antes; el lane no las aplicó a prod).
2. **Setear `CRON_SECRET`** + confirmar el schedule de Vercel para
   `/api/cron/mail-scheduled` (sin esto la cola no se autoenvía; "enviar ya" y
   "cancelar" funcionan igual).
3. `node scripts/verify.mjs` + `pnpm build`.
4. Check `ui-ux-designer` de las 3 vistas nuevas (Firmas, Envío manual, Programados).
5. `pnpm docs:index` (regenerar índice) + marcar spec `status: done`.

## Cabos sueltos conocidos (V1, documentados en el spec)
- WhatsApp = display-only (sin integración real; el canal se guarda/valida).
- Sin uploader de adjuntos en Compose (`sendEmail` no los soporta).
- Compose sin picker de clientes/leads (input de email, nota "próximamente").
- Cuerpo = textarea texto plano → `<br>` (sin editor rich; template HTML se
  muestra crudo en el textarea).
- Cron sin "claim lock": a 5 min de granularidad + proceso rápido el riesgo de
  doble-envío es teórico; si se quiere blindar, agregar un `status='sending'`
  intermedio.

## Nada de esto se pushea. Merge + push los hace el Director con OK del founder.
