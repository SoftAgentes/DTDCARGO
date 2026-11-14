# Pila contable al día con main (2026-11-11)

- Owner: Worker Claude, sesión del worktree `.claude/worktrees/pila-contable-al-dia-b3a9b7` (claim `pila-contable-b3a9b7`).
- Encargo: Director General (local_25e2dded), por pedido de Sam de vaciar la cola de PR sin romper main.
- Base: main `8f2029a80`. Estado de la tarea: en progreso (una PR por turno; el DG revisa y fusiona en orden).
- Permisos: commits y PR de ramas propias. **Sin** merge, sin aplicar migraciones, sin producción.

## Método
Las ramas `codex/*` de la pila tienen worktrees registrados (DTD-worktrees y `.codex`), así que no se tocan.
Cada paso sale de una rama `claude/…` creada desde la cabeza codex, que trae a la anterior con merge (sin rebase ni force push). La PR nueva reemplaza a la vieja; en la vieja queda un comentario, y cerrarla lo decide el DG.

| Paso | PR vieja | Rama nueva | Migración |
|---|---|---|---|
| 1 | #321 | claude/sdd-0577-diagnostico-go05b (#514) | — |
| 2 | #310 | claude/sdd-0572-conversor-usd-reemplazos | — |
| 3 | #311 | claude/sdd-0572-conversor-usd-sql | 0498 → **0527** |
| 4 | #312 | claude/sdd-0576-fechas-caracas-operaciones | 0499 → **0533** |
| 5 | #313 | claude/sdd-0576-fechas-caracas-anuales | 0500 → **0534** |
| 6 | #314 | claude/sdd-0576-fechas-caracas-movil | — |
| 7 | #317 | claude/sdd-0569-bcv-carga-diaria | 0501 → **0535** |

## Numeración (decisión del DG, 2026-11-11)
Medido hoy: la 0527 está libre. La 0528 la tiene el worktree `endurecer-permisos` (rama `claude/endurecer-permisos-dinero`), de la 0529 a la 0531 la #509 y la 0532 la #512. El DG no mueve esas reservas, así que la serie queda **0527, 0533, 0534, 0535**. La #318 ya no tiene la 0531 reservada: si Sam la aprueba, toma el siguiente número libre cuando le toque. Ninguna de estas migraciones está aplicada; todas quedan declaradas como espera sin aplicar.

## Validación hasta ahora
- #514: `docs:check`, `sdd:check` y `diff --check` PASARON.
- #310: vitest focal de 8 archivos, 283/283 PASÓ (turno pesado del DG). `docs:check` y `sdd:check` PASARON.
- #311 a #317, en local: `migrations-lock verificar`, gate de símbolos (0 rojos), `sdd:check` y `docs:check` PASARON; en la #317 también `build-crontab --check`. Vitest y typecheck de esas ramas: NO EJECUTADOS, quedan para el CI.
- `pnpm verify`: NO EJECUTADO; el portón es el CI de GitHub.

## Pendientes de esta tarea
Publicar de la #311 a la #317, una por turno, después de cada fusión. Antes de publicar cada una hay que traerle main.

## Seguimientos que dejó la revisión de la #516 (Opus, APPROVED)
- (a) Los totales de la 0572-a siguen sumando en coma flotante con `round2`. `sumarEnUsd` (`lib/shared/fx.ts`, suma exacta en centavos) solo lo usan sus pruebas; adoptarlo en los agregadores es una tarea aparte.
- (b) `lib/studio/accounting/subdiario.ts:163` falla abierto a propósito: una CxP histórica sin tasa se suma al nominal para cuadrar con su asiento. Es una decisión declarada en el comentario, no un descuido.

## Caminos sin uso desde la SDD-0614 (revisión de la #519)
- Los anuales v2 hoy se ven solo en Fidelización y en el Portal. El CRM (Asesor/Tablero) y Reportes › Por agente están ocultos; sus lectores (`crm/page.tsx` en las pestañas de Kommo y `commercialByAgentKommo`) se conservan sin uso.
- `app/studio/(app)/crm/__tests__/annual-billing-page.test.tsx` y los casos 0572-b de `commercialByAgentKommo` en `lib/studio/reports/__tests__/queries.test.ts` recorren ese camino. **En la 8.7 o en la R4 se borran o se convierten en contrato de lo que los reemplace.**

## FUERA DE ALCANCE DETECTADO
- #312: el readback de `issued_at` en `lib/studio/sales-orders/actions.ts` (+1 lectura de invoices con el cliente admin) quedó redundante, porque la RPC atómica de la 0497 ya fecha el asiento con `issued_at` persistido. No lo quité: es una decisión para quien revise.

## Deuda declarada en la revisión de la #520
- `lib/studio/sales-orders/actions.ts:637-661`: el readback de `issued_at` sobra cuando la 0533 está aplicada, porque la RPC atómica de la 0497 fecha el asiento con `issued_at` persistido. Retirarlo (y bajar en 1 el inventario de `invoice-read-boundary`) es una tarea aparte, después de aplicar la 0533.
- Contrato de la 0533 bajo la RLS de la 0511: NO DISPONIBLE. El fixture no monta la 0511 ni la 0497. Lo intenté y montar la 0511 arrastra 0190, 0294 y la cadena de auditoría D2 (`append_audit_event_v1`); quedó como deuda.

## Estado de aplicación (2026-11-13, Director General)

- **0533_fechas_caracas_operaciones**: **aplicada**. Prueba 16:25:51Z y producción 19:06:22Z del 2026-11-13, md5 `ef1805bd799471fe4c453276639c7b27`, verificación PASÓ.
  - En producción la previa encontró una deriva cosmética en `public.sales_order_claim_and_invoice`: era la lógica de la 0128 sin comentarios ni caracteres no ASCII.
  - Con el OK de Sam («Sí, restaura y aplica») se restauró el cuerpo exacto de la 0128, con guardas de md5 antes y después, y enseguida se aplicó la 0533.
- **0534_annual_billing_caracas**: **aplicada**. Prueba 16:26:30Z y producción 18:01:47Z del 2026-11-13, md5 `9b16d8aaf26282e4db3ddf4930e64981`, verificación PASÓ.

Las dos se retiraron de la espera y quedaron selladas en el tren AD (#529). Donde este documento dice «sin aplicar» o «no aplicada», es el estado histórico anterior a esa fecha. La cabecera del `.sql` no se edita, porque cambiaría el md5 aplicado.

## Estado de aplicación (2026-11-13, Director General)

La **0527_annual_billing_fx_v2** está **aplicada**: prueba 2026-11-11 17:11:57Z y producción 2026-11-13 18:00:50Z, md5 `422a371de0ae02c74c1ad46c4f83ed28`, verificación PASÓ en las dos. Se retiró su espera y quedó sellada en el tren AD (#529). Donde este documento dice «no aplicada» o «sigue sin aplicar», es el estado histórico anterior a esa fecha.

## #527: TLS de la fuente BCV y banda de plausibilidad (2026-11-14)

Hecho a pedido del DG, en la rama `claude/sdd-0569-bcv-carga-diaria`. No traje main ni toqué producción. El detalle está en la spec 0569, en la sección «Banda de plausibilidad y TLS de la fuente».

- Cabeza `93f83ab2b`: TLS con el intermedio Sectigo DV R36 fijado por huella, y la banda (15 %, referencia de 10 días). La revisión independiente (Opus) la APROBÓ.
- Menores de esa revisión, en el commit siguiente:
  - se quitó el `-----END CERTIFICATE-----` duplicado de `bcv-tls.ts`;
  - `bcvTrustedCaFor` permite inyectar el pin;
  - hay pruebas de que una huella distinta (`BCV_TLS_PIN_MISMATCH`) termina en `SOURCE_UNAVAILABLE`, sin abrir conexión y sin escrituras.
- Pendiente: el OK de Sam sobre la banda, el intermedio y la 0535. Después vienen la aplicación de la 0535 y el encendido con `BCV_RATES_ENABLED=true`, cada uno con su autorización. Cuando la PR entre a un tren se trae main una sola vez, con conflicto solo en los dos JSON de migraciones.

### Junction de parse5 en node_modules (riesgo anotado)

El `node_modules` de este worktree es anterior a la dependencia directa `parse5@8.0.1`, y por eso Vitest no encontraba `parse5`. Para correr las pruebas creé un junction `node_modules/parse5` que apunta a `node_modules/.pnpm/parse5@8.0.1/node_modules/parse5`. Está dentro del worktree, no en el `node_modules` de main.

- Nunca entró a Git, porque `node_modules` está ignorado.
- Lo quité con `rmdir` sobre el enlace después de cada corrida: después de la cabeza `93f83ab2b` y de nuevo después de las pruebas de los menores. El paquete en `.pnpm` quedó intacto.
- Lo correcto es `pnpm install` con turno del DG. No debe quedar ningún junction a mano (ver la memoria «junction a node_modules»).
