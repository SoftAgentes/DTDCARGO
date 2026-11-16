# Handoff · SDD-0637 Faro · revisión de datos personales (puerta de la fase 2)

- **Fecha:** 2026-11-16
- **Sesión:** Lumi (Worker). Director: Director General.
- **Rama:** `claude/0637-faro-revision-datos`, desde `origin/main` 2794b74a5.
- **Autorizaciones de Sam (2026-11-16):**
  - ante «¿Arranco ya la revisión de datos personales de la fase 2?», respondió «Sí, arráncala»;
  - ante «¿Apruebas la recomendación de Codex sobre memoria y novedades?», respondió «Sí, apruébala».

## Qué se hizo

Solo documentos. No hay código, migraciones ni cambios en producción.

| Archivo | Cambio |
|---|---|
| `docs/specs/0637-faro-asistente-ayuda/privacidad.md` | Nuevo: la revisión `revisar-datos-ve`. Inventario por finalidad, doce puntos (3 correctos, 9 encontrados, 5 no verificables) y plazos propuestos |
| `docs/specs/0637-faro-asistente-ayuda/spec.md` | §3: memoria acotada a la conversación en curso. §5: estante `novedades/` y la regla de guía y novedad en la misma PR. §6.4: tres finalidades, tablas nuevas, purga que borra filas y pregunta depurada. §6.5: gasto medido en `asistente_llamadas`. §10: corrección sobre Anthropic en el inventario y enlace a la revisión. §11: D-6 con propuesta, y D-9, D-10 y D-11 nuevas |

Insumo: una consulta de diseño a Codex, de solo lectura, pedida por Sam, sobre qué guardar, la memoria, el ciclo con
Hermes, los riesgos y las novedades. El Worker comprobó en el código nueve de sus afirmaciones antes de usarlas; las
nueve eran ciertas.

## Validaciones

| Comprobación | Resultado |
|---|---|
| `node scripts/build-docs-index.mjs --check` | PASÓ, 622 specs |
| `node scripts/check-numbering.mjs` | PASÓ |
| `pnpm verify` | NO APLICA: solo documentos |
| Revisión por otro modelo | PENDIENTE: la propia revisión la recomienda antes de la migración |

## Pendientes de esta tarea

1. Sam decide D-6 (plazos) y D-11 (equipo en China). D-4 y D-5 siguen con su recomendación.
2. Antes del primer envío real a un modelo: N-1 (retención del proveedor, por escrito) y N-2 (sumar Faro a la fila
   de Anthropic en `docs/legal/privacidad/inventario-terceros.md`).
3. Las condiciones E-1 a E-9 entran como criterios de la migración (fase 2) y del servidor (fase 3).

## FUERA DE ALCANCE DETECTADO

- La pantalla «Actualizaciones» del Studio es solo de Chatwoot; el ERP no tiene un registro general de novedades.
- `listFeatureFlags` vuelve a los valores por defecto si la lectura falla, y algunos están encendidos. No es un
  defecto de Faro, pero conviene que lo sepa quien use los flags para decidir qué mostrar.

## Impacto documental

La spec 0637 queda con las decisiones D-9 y D-10 registradas. El inventario de terceros no se tocó todavía (N-2).
