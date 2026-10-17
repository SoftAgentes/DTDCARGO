---
sdd: "0548"
title: "El gate migrations-applied mide solo en producción y dice dónde midió"
status: in-progress
author: "Claude Worker (Sam)"
created: 2026-10-17
updated: 2026-10-17
supersedes: null
superseded_by: null
related: ["0505", "0540", "0546"]
confidencialidad: interno
---

# SDD-0548 — El gate `migrations-applied` mide solo en producción

> Desde el corte del 2026-10-14 producción es el Supabase del servidor propio
> (`https://supabase.dtdcargo.com`), y Supabase Cloud quedó como copia congelada
> que sigue respondiendo. El gate de `pnpm verify` que vigila las migraciones sin
> aplicar leía el ledger de la URL que hubiera configurada, sin mirar el host y
> llamándolo siempre «prod». Ahora solo mide en producción, imprime el origen que
> midió y da SKIP, sin consultarlo, ante cualquier otro destino.

## Pedido

Sam al Director, literal, el 2026-10-17: «Haz una tarea continua sin detenerte…
trata de hacer todos los trabajos pendientes». El Director encargó a un Worker
comprobar la sospecha NO VERIFICADA del Worker de la SDD-0546
(`.agents/handoffs/0546-migraciones-servidor-propio.md:185-189`) y, si el gate
medía Cloud o podía medirlo sin avisar, arreglarlo. Quedaron fuera la fusión y
el contacto con cualquier base, servidor o Cloud.

## Contexto medido (`cdb7ff76`, 2026-10-17, sin conectarse a nada)

**De dónde saca la conexión.** `scripts/check-migrations-applied.mjs:313-315` (en
`cdb7ff76`) tomaba `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` de
`.env.local` del directorio donde corre (`:102-117`) o del entorno, y hacía
`POST <url>/rest/v1/rpc/applied_migration_names` (`:292`). No validaba el host, y
sus mensajes decían «ledger de prod» (`:347`) y «[OK] … no hay migraciones nuevas
sin aplicar» (`:405`) sin nombrarlo. `verify.mjs:485` lo corre como paso crítico.

**A qué base apunta hoy en cada entorno:**

| Entorno | Qué mide hoy | Evidencia |
|---|---|---|
| Local (esta máquina) | Nada: SKIP. No hay `.env.local` en el checkout principal ni en ningún worktree, y el shell no exporta las variables | comprobado por existencia de archivo, sin leer valores; coincide con `.agents/handoffs/c-l05-portal-perfil-privado.md:447` y `c-l17-verificar-throttle.md:390` |
| `.env.example` raíz | Vacío: quien lo copie da SKIP | `.env.example:112` y `:118` |
| CI (`quality.yml`) | No corre el gate: el job es «Calidad local sin secretos» y sus pasos no incluyen `migrations-applied` | `.github/workflows/quality.yml:21`, `:49-96` |
| Servidor | No corre el gate. La puerta de la publicación lee el ledger con `psql` dentro del contenedor de la base; `publicable.mjs` solo reutiliza `findMissing` con un ledger vacío | `infra/ops/web/publicar-web.sh:309-315`, `infra/ops/web/publicable.mjs:44` |
| `.env` del servidor | Producción | `infra/dtd-cargo/.env.example:67` |

**Por qué podía medir Cloud sin avisar:**

- `docs/agents/README.md:61` (en `cdb7ff76`) mandaba poner en `.env.local` la URL
  de Cloud `https://xpfuzqombmjmxvprjgmi.supabase.co`.
- Cloud sigue vivo: la Fase 4, que lo pausa, está pendiente
  (`docs/runbooks/servidor-contabo.md:920`), y su ledger quedó en el corte
  (`docs/runbooks/aplicar-migraciones-prod.md` §13).
- Medir esa copia da rojos falsos (todo lo aplicado en el servidor después del
  corte «falta») y verdes falsos (una migración huérfana aplicada en el servidor
  no aparece), con la etiqueta «prod».

**Comentario vencido.** `check-migrations-applied.mjs:41-42` decía que
`pendingBelowCutoff` cubre «hoy: 0017 y 0257»; en `supabase/migrations-baseline.json`
hoy son `0422_payment_report_command_boundary` y
`0423_payment_report_historical_identity`, ambas por encima del corte.

**Conclusión:** hoy el gate no mide Cloud en ningún entorno, pero podía hacerlo
sin avisar con la configuración que la documentación prescribía.

## Requisitos

1. **R1 — Solo producción.** El gate mide únicamente si `NEXT_PUBLIC_SUPABASE_URL`
   es `https://supabase.dtdcargo.com` (con o sin barra, ruta, mayúsculas, puerto
   443 explícito o punto final).
2. **R2 — Cloud no se consulta.** Con cualquier host `*.supabase.co`, y en
   particular `xpfuzqombmjmxvprjgmi.supabase.co`, da SKIP (exit 3) **antes** de leer
   el baseline, git o la red, con un motivo que nombra el origen configurado y el
   de producción.
3. **R3 — Otro destino no se consulta.** Otro host, `http`, un puerto distinto o
   una URL ilegible dan SKIP sin consultarlo.
4. **R4 — Sin credenciales a la vista.** Lo único que se imprime de la URL es su
   origen (esquema, host, puerto). Una URL con usuario o clave da SKIP sin
   imprimirlos y sin consultar. De una URL ilegible no se imprime nada. La clave
   nunca se imprime.
5. **R5 — Dice dónde midió.** En producción imprime «mide el ledger de producción
   (https://supabase.dtdcargo.com)» y lo repite en el conteo, en cada rojo y en el
   OK.
6. **R6 — La clave no sale del host.** La petición usa `redirect: "manual"`; una
   redirección da SKIP con motivo y no se sigue.
7. **R7 — Comentarios al día.** El comentario de las esperas deja de listar
   números; el de `verify.mjs` y el §11 del runbook de migraciones dicen dónde mide.
8. **R8 — Sin cambio de veredicto en producción.** Contra producción el gate sigue
   cazando la migración sin aplicar (rojo) y la huérfana, como antes.

## No objetivos

- Medir el ledger del entorno de prueba. La SDD-0540 lo menciona como opcional de
  la Fase 4 (`docs/specs/0540-entorno-prueba-staging/spec.md:253`); con este gate
  haría falta una opción explícita que cambie el origen esperado y la etiqueta, no
  una URL distinta en el `.env.local`. Queda para esa tarea.
- Leer el ledger por `psql` en el servidor desde el gate: exigiría ssh desde cada
  `verify` local. La puerta de la publicación ya lo hace en el servidor.
- Actualizar los demás documentos que nombran Cloud como producción: van en la
  Fase 4, paso 4 (`servidor-contabo.md` §4).

## Diseño

- `clasificarDestino(url)` (pura) devuelve `{ tipo, origen }` con `tipo` en
  `produccion | cloud | con-credenciales | otro | ilegible`.
- `motivoSinMedir(destino)` (pura) devuelve el motivo del SKIP o `null`.
- `main()` las llama justo después de comprobar que hay credenciales; si hay
  motivo, `skip(motivo)`. `fetchLedger` recibe el origen ya normalizado.
- `ORIGEN_PRODUCCION` es la constante exportada; si producción cambia de host, el
  gate da SKIP (crítico sin medir) hasta actualizarla: falla hacia el lado seguro.
- Un SKIP no es verde: `verify.mjs` lo cuenta como crítico sin medir y el veredicto
  queda incompleto (`scripts/verify-step-policy.mjs`).

## Aceptación

| # | Criterio | Prueba |
|---|---|---|
| A1 | R1-R4 en la función pura | `scripts/check-migrations-applied.test.mjs` · `clasificarDestino` y `motivoSinMedir` |
| A2 | Con la URL de Cloud, exit 3, el motivo nombra el origen, sin `[OK]` y **cero** llamadas al `fetch` doble | ídem · «con la URL de Cloud da SKIP» |
| A3 | Otro host y URL con credenciales: exit 3 y cero llamadas; las credenciales no se imprimen | ídem |
| A4 | Producción: exit 0, una llamada a `https://supabase.dtdcargo.com/rest/v1/rpc/applied_migration_names` con `redirect: "manual"`, y el OK nombra el origen | ídem |
| A5 | Producción con una migración sin aplicar: exit 1 y el rojo nombra el origen | ídem |
| A6 | Redirección: exit 3 con motivo | ídem |
| A7 | La clave de prueba no aparece en ninguna salida | ídem (cada corrida) |
| A8 | Control rojo: cada guarda quitada hace caer la suite | 10 mutantes, ver la tabla de evidencia |

Las pruebas de punta a punta corren el script como lo corre `verify.mjs`, en un
proyecto de mentira, con `fetch` reemplazado por un doble (`node --import`) y git
apuntando a un `GIT_DIR` inexistente: no tocan la red ni ninguna base.

## Evidencia

| Fecha | Qué | Resultado |
|---|---|---|
| 2026-10-17 | `vitest run scripts/check-migrations-applied.test.mjs` | 36/36 PASÓ (22 previas + 14 nuevas) |
| 2026-10-17 | 10 mutantes (Cloud, corte antes de la red, https, puerto, credenciales, `redirect`, rama de redirección, punto final, URL cruda, etiqueta) | 10/10 MUERTOS; archivo restaurado |
| 2026-10-17 | `node scripts/check-migrations-applied.mjs` sin credenciales | exit 3, SKIP «sin NEXT_PUBLIC_SUPABASE_URL…» |

El resto de las comprobaciones está en el handoff
`.agents/handoffs/0548-gate-migraciones-host-produccion.md`.
