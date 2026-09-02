---
title: "Codex: publicación de rama y preflight alojado"
tipo: auditoria-operativa
autor: Codex
estado: rama-publicada-release-bloqueado
created: 2026-09-02
updated: 2026-09-02
review-by: 2026-09-09
confidencialidad: interno
---

# Publicación y preflight alojado · 2026-09-02

La rama de saneamiento está publicada. No está autorizada para integración o
promoción: la aplicación necesita 10 RPC ausentes y hay 18 migraciones sin
aplicar. El [checklist operativo](2026-09-02-codex-arranque-checklist.md) sigue
siendo el punto único de tareas pendientes.

## Git y PR

- Repositorio verificado mediante GitHub: `hailuwaycom-sketch/DTDCARGO`,
  `PRIVATE`, permiso de la cuenta `ADMIN`, rama predeterminada `main`.
- Publicación exacta: `git push --porcelain -u origin codex/saneamiento-integral`.
  Exit 0, rama nueva y upstream correcto. Sin force-push ni cambio de `main`.
- SHA del lote funcional: `a9895487d010f39edcc1c7b20915547f6a93d773`.
- `origin/main`: `2a2e81bf554dbe7bd4f05170847e8f02e988d320`.
- `git ls-remote` confirmó ambos hashes; la rama local/remota quedó 0/0, y la
  rama funcional 53 delante / 0 detrás de `origin/main`.
- Diff revisado: 312 archivos, 19.416 inserciones y 4.078 eliminaciones.
  El escaneo de líneas añadidas no encontró patrones AWS, PAT Supabase/GitHub,
  llaves Stripe/OpenAI, claves privadas ni JWT. Es un control acotado, no una
  garantía universal de ausencia de secretos. No se publicaron `.env` locales.
- [PR #21](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/21), creado en
  borrador. No se cambió a listo, no se fusionó y no se creó otra tarea Codex.
- [Primera corrida de calidad](https://github.com/hailuwaycom-sketch/DTDCARGO/actions/runs/33659251763)
  terminó en fallo para ese SHA: TypeScript agotó el heap implícito de unos
  2 GiB (`JavaScript heap out of memory`, exit 134). Instalación, ESLint y
  frontera RSC pasaron; los gates posteriores a TypeScript no se ejecutaron.
  El push de rama solo no la activaba: el workflow escucha PR hacia `main`,
  push de `main` y ejecución manual.

Seguimiento SDD-0349: límite explícito de old-space 4096 sólo en TypeScript y
build. Regresión 6/6 (antes 1 fallo / 5 pases), TypeScript sin caché incremental
aprobado con 2.898.635 K de memoria / 48,84 s y build aislado de 158 páginas
aprobado. El commit `726a7118` quedó publicado, 54 delante de `origin/main`.

La [segunda corrida](https://github.com/hailuwaycom-sketch/DTDCARGO/actions/runs/33660502119)
confirmó el arreglo de memoria: TypeScript y Edge pasaron. Falló 1 de 5.958
unitarios (`DestinoCombobox`: al escribir `mara` quedó `a`), por una selección
de texto diferida con `requestAnimationFrame`. Duración total: 12 min 3 s;
unitarios: 537,88 s. Los gates posteriores no corrieron; no fue un timeout.

SDD-0360 reproduce dos ordenamientos del foco (11 pasan / 2 fallan antes),
elimina la selección diferida y conserva el cursor manual. Después: 13/13
focales y 527 archivos / 5.961 pruebas completas aprobadas. TypeScript sin
caché, ESLint, numeración, componentes y gobernanza aprobados. El navegador
local confirmó escritura, Escape, cursor intermedio y selección con Enter;
el backend local rechazó toda operación Supabase. Build aislado sin secretos:
158 páginas, postbuild y restauración de `tsconfig.json` correctos. El tercer
CI queda pendiente de medir este commit. No se relajó ningún test.

## Vercel: preview confirmado, no producción

El status de GitHub del SHA informa `Vercel: success`. El registro de
deployments devuelve:

- ID GitHub: `6227630435`, SHA exacto del lote funcional.
- `environment=Preview`, `production_environment=false`, estado `success`.
- [Preview generado](https://dtdcargo-ao1onb0p7-hailu-wey.vercel.app).
- [Registro Vercel](https://vercel.com/hailu-wey/dtdcargo/FmCffqxf339j71R3v55LSGzXiaef).

El conector Vercel devolvió 404 para ese deployment y proyecto. Por tanto, la
clasificación anterior está respaldada por los metadatos de deployments de
GitHub, no por una consulta exitosa al API Vercel. No se inspeccionaron ni
modificaron variables de entorno; no se promovió producción ni se hizo smoke
autenticado sobre datos reales. Un build correcto no certifica las llamadas a
las RPC ausentes.

## Supabase: identidad y ledger

Se verificó `xpfuzqombmjmxvprjgmi`, nombre `DTD Cargo`, estado
`ACTIVE_HEALTHY`, región `us-east-1`, Postgres `17.6.1.121`.

El MCP local devuelve un URL placeholder, por lo que no se usó como prueba de
producción. La medición utilizó el conector alojado con `project_id` explícito,
limitado a metadatos. Las consultas SQL de catálogo usaron `BEGIN READ ONLY`
y `ROLLBACK`. No se leyeron filas de negocio ni se invocaron RPC de negocio.

Ledger: 406 entradas, última `0398_audit_comment_action_summary` con versión
`20260830230243`. Comparación contra `origin/main` unión checkout: 413 archivos,
cutoff histórico 238 y la espera 0017 conservados sin modificar el baseline.

- 18 pendientes exactas: 0399–0416.
- Cero entradas huérfanas posteriores al corte histórico.
- No se revalidó todo el pasado <=238 por el nombre libre de su ledger.
- No se reparó el historial ni se renumeró ninguna migración aplicada.

### Dependencias de aplicación: comprobadas contra objetos

Cada nombre siguiente devolvió **0 funciones** en `pg_proc` para el schema `public`:

| Migración | RPC que todavía no existe |
|---|---|
| 0401 | `get_portal_brand` |
| 0402 | `get_portal_hidden_shipment_statuses` |
| 0403 | `get_portal_advisor` |
| 0404 | `get_portal_referral_program` |
| 0405 | `get_portal_private_profile_context` |
| 0406 | `get_portal_packing_list_documents` |
| 0410 | `collections_mail_context` |
| 0411 | `studio_client_annual_billing` |
| 0412 | `conversation_client_outstanding` |
| 0413 | `sales_order_invoice_refs` |

No basta con que una migración falte en el ledger: esta comprobación evita
asumir que las funciones pudieron haberse creado por fuera del historial.

### Preflight específico de 0399

Sobre 249 tablas de `public`, `has_table_privilege` midió:

| Rol | Tablas con TRUNCATE | LOGIN |
|---|---:|---|
| `anon` | 179 | no |
| `authenticated` | 204 | no |
| `service_role` | 238 | no |
| `postgres` | 249 | sí |

La 0399 sólo revoca TRUNCATE a `anon`/`authenticated`; no borra filas ni cambia
SELECT/INSERT/UPDATE/DELETE, Storage o defaults. La existencia del privilegio
no demuestra una vía explotable por PostgREST. Las cifras difieren en una
tabla del snapshot histórico del 28-ago; no se modificó esa evidencia pasada.
Se solicitó autorización específica para aplicar únicamente esta migración.
Sin respuesta nominal no se ejecuta.

## Avisos de seguridad: clasificar, no barrer

El asesor devolvió 204 avisos: 20 INFO y 184 WARN.

| Categoría | Cantidad | Interpretación de esta lectura |
|---|---:|---|
| RLS habilitado sin policy | 20 INFO | Incluye throttles/auditoría internos; no abrir acceso por reflejo. |
| Extensión en `public` | 1 WARN | `pg_net`; requiere análisis propio antes de moverla. |
| SECURITY DEFINER ejecutable por `anon` | 21 WARN | Mezcla funciones públicas intencionales y triggers; revisar por entidad. |
| SECURITY DEFINER ejecutable por `authenticated` | 162 WARN | Ejecutable no equivale a bypass: comprobar guards, ACL y callers. |

Son señales de configuración, **no 204 vulnerabilidades confirmadas**. No se
cambió ningún grant ni policy a partir del contador. Referencias oficiales del
asesor: [sin policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy),
[extensión](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public),
[EXECUTE anon](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
y [EXECUTE authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

## Secuencia de release y stop conditions

1. Completar el tercer CI con SDD-0360. SDD-0349 ya superó TypeScript/Edge en
   el runner; SDD-0360 corrige la carrera real expuesta por los unitarios.
   Completar preflights y mantener el PR en borrador.
2. Obtener OK por nombre y aplicar cada migración elegible de una en una,
   conforme a `docs/runbooks/aplicar-migraciones-prod.md`. Las 10 RPC deben
   existir y verificarse antes de publicar la app consumidora.
3. 0410 es expansión compatible. 0414 y 0415 se aplican **después** del deploy
   y smoke de los consumidores; el orden numérico no sustituye este gate.
4. Integración/deploy requieren su propia autorización y confirmación del SHA
   real. 0416 y Telegram mantienen sus verificaciones de dominio separadas.
5. Retirar el worktree sólo al estar limpio, inactivo y contenido en
   `origin/main`; conservar las dos ramas archive hasta resolver su evidencia.

Este documento registra publicación y consultas de lectura, no cierre Cloud,
aprobación productiva, ausencia global de riesgos ni finalización del objetivo.
