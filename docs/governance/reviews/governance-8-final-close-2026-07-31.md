# REV-SGE-026 — Gobernanza 8: cierre técnico integral

**Fecha:** 2026-07-31

**Resultado local:** aprobado

**Alcance:** 27 políticas, CMP-01, PLG-01, Corte E2–E5 y publicación final

## 1. Resultado ejecutivo

Gobernanzas 1–7 permanecen cerradas. Gobernanza 8 resuelve todos los slices
que tenían una corrección técnica proporcionada y conserva como gate externo
únicamente aquello que exige fuente o autorización nominal. No hubo barrido
masivo, migration nueva, escritura Cloud ni cambio de Vercel.

La versión normativa final es 6.2. La cápsula conserva 27 políticas aprobadas;
CMP-01 registra cuatro componentes y `NumericInput` continúa canonical.

## 2. Matriz de pendientes y slices

| Pendiente inicial | Política | Clasificación final | Riesgo | Acción | SDD | Allowlist principal | Commit | Pruebas | Local / Git / Cloud / Vercel | Gate externo |
|---|---|---|---|---|---|---|---|---|---|---|
| Headers desfasados | AUD-01 / VIS-02 | cumplimiento reconciliado | R1 | Alinear estado con evidencia cerrada | no aplica | políticas, índice, cápsula, auditoría | `b3e908ac` | governance/docs checks | verde / commit local / no aplica / no aplica | ninguno |
| Primera entidad R3 | HTD-01 | cumplimiento en primer consumidor | R3 | Presión sostenida de 1,5 s + alternativa accesible en anulación | 0215 | ConfirmDialog, factura, tests, registro, spec | `3160a022` | 11/11 focalizadas + suite | verde / commit local / sin cambio / pendiente de publicación | adopción futura por slice |
| Bitácora no conforme | DND-01 | cumplimiento en flujo auditado | R2 | Selector teclado/touch, anuncios, rollback, conflicto y Deshacer | 0216 | Board, action, toast, tests, spec | `59109986` | 7/7 focalizadas + suite | verde / commit local / sin cambio / pendiente de publicación | adopción futura por flujo |
| Timezone implícito | CAL-01 / DAT-01 | parcial / no aplica | R2 | Timezone IANA del usuario y límites coherentes | 0217 | calendario, query, tipos, tests, spec | `d3b602fa` | 12/12 focalizadas + suite | verde / commit local / sin cambio / pendiente de publicación | fecha planificada editable antes de reprogramar |
| Caché y runner frágiles | PLG-01 | cumplimiento reproducible | R2 | Sync seguro, hashes, validador y runner Node | 0218 | plugin, policy, registry, scripts, tests, spec | `c8a0ae76` | 7/7 fuente + 7/7 caché | verde / commit local / no aplica / no aplica | infraestructura remota no requerida |
| Corte E2–E5 | AUD-02 | fuente promovida; implementación abierta por slices | R3 | Calendario v1.0 aprobado; E2–E5 conservan SDD y gates propios | 0166 / 0186 | fuente y registro E1 | este ciclo | revisión legal/privacidad documental | verde local / commit pendiente / sin cambio Cloud | basenames nominales al crear migrations |

## 3. Estado de adopción de las 27 políticas

| Grupo | Políticas | Estado final |
|---|---|---|
| Núcleo y acciones | SGE-00, BTN-01, HTD-01, MP-01 | adopción gradual; HTD tiene primer consumidor R3 y MP conserva sus gates propios |
| Auditoría | AUD-01, AUD-02 | AUD-01 cerrado; AUD-02 tiene E1 promovido y E2–E5 abiertos únicamente por slices separados |
| Visual y accesibilidad | VIS-01, VIS-02, A11Y-01, ICO-01 | VIS-02 cerrado; el resto continúa por consumidor; Bitácora amplía evidencia accesible sin declarar cobertura transversal |
| Búsqueda y creación | BUS-01, CRT-01 | dos buscadores reales conformes; CRT no aplica en esa muestra porque no crean entidades |
| Formularios y datos | FRM-01, NUM-01, TBL-01 | adopción parcial/gradual; NumericInput canonical; sin barrido masivo |
| Movimiento y calendario | MOT-01, DND-01, CAL-01, DAT-01 | DND conforme en Bitácora; timezone de CAL cerrado; reprogramación y DAT esperan modelo editable |
| Estado del sistema | ERR-01, LOD-01, PRG-01, WIZ-01 | cobertura parcial; se verificaron pending/error/rollback en los slices sin unificación masiva |
| Archivos | UPL-01 | flujo Docs muestreado conforme en límites, MIME, tenant, Storage privado y URL firmada; cuarentena queda como diseño no bloqueante |
| IA | IA-01 | muestra conforme: permisos/tenant, contenido no confiable, tools read-only y revisión humana |
| Componentes y plugin | CMP-01, PLG-01 | cuatro componentes registrados; plugin 0.1.2 reproducible, read-only y 7/7 |

AVS-01 permanece como contrato ya verificado y referencia histórica; no forma
parte de las 27 entradas actuales de la cápsula.

## 4. Verificación integral

| Gate | Resultado |
|---|---|
| lint focalizado por slice | verde, cero suppressions |
| lint completo / RSC / typecheck | verde |
| Vitest focalizado | 11/11 HTD, 7/7 DND, 12/12 CAL y 7/7 PLG |
| Vitest completo | 348 archivos, 4.355 pruebas, todo verde |
| E2E aplicable | 21 aprobadas; tres Tier 3 omitidas por falta de seed/credenciales |
| build | verde, Next.js 16.2.6 |
| docs / components / governance | verde; 4 componentes y 27 políticas |
| SQL efímero | 39 contratos verdes en PostgreSQL 17 |
| schema rebuild | 297 verificadas; 280 aplicadas + 17 solo-ledger; 219 tablas |
| migrations-applied | verde; 297 archivos / 306 ledger; ninguna migration nueva pendiente |
| plugin | 7/7 desde fuente y 7/7 desde caché; reinstalación por hash verde |
| `git diff --check` | verde por slice y antes del cierre |

La primera ejecución E2E sin variables falló exclusivamente al renderizar
cuatro rutas que requieren URL/clave anónima de Supabase. Se reejecutó el gate
completo cargando la `.env.local` existente solo como entorno de proceso, sin
copiar ni imprimir secretos: 19/19 pruebas aplicables pasaron.

Después de integrar sin conflictos siete commits nuevos de `origin/main`, se
repitieron build y `verify.mjs`: 21/21 E2E aplicables pasaron, incluidos los dos
escenarios nuevos de CBM. El build emitió una advertencia NFT no bloqueante en
la traza `next.config.ts` → `app/marca/asset/[name]/route.ts`; no se modificó
porque está fuera de las allowlists y el build terminó correctamente.

## 5. Git, Cloud y publicación

- Base de trabajo: `427072359aac8d54df5dc44a599b63bf2ae34fcd`.
- Rama: `codex/governance-final-adoption-close`.
- No hubo push intermedio.
- No se creó ni aplicó migration.
- Producción confirmó metadata-only `0270` y `0289`–`0296`.
- `0017_no_olvidar` y `0257_rates_expiry_alert` permanecen intencionalmente no
  aplicadas, fuera del alcance de Gobernanza 8.
- El SHA publicado, el deployment y el dominio se verifican después del único
  push final y se reportan en el cierre de la tarea; no se autorreferencian en
  esta fotografía previa a publicación.

## 6. Worktrees y cambios ajenos

El checkout principal y los worktrees históricos permanecen intactos. Ninguno
se retira sin demostrar simultáneamente ownership, status limpio, recuperabilidad
y equivalencia/integración con `origin/main`. Trabajo activo de redes sociales y
cualquier ruta con ownership dudoso se conservan como `LIMPIEZA BLOQUEADA`.

## 7. Promoción del gate E1

El 2026-07-31 el founder autorizó identificar y aprobar la fuente. El
[Calendario de retención v1.0](../../legal/retention-schedule-v1.md) registra:

1. jurisdicción;
2. clase de evento;
3. plazo;
4. inicio del cómputo;
5. disposición final;
6. responsable;
7. fundamento;
8. evidencia de aprobación.

La promoción habilita preparar E2–E5. No aplica migrations ni autoriza un lote
destructivo: cada basename mantiene autorización nominal y E5 exige aprobación
del lote después del dry-run.
