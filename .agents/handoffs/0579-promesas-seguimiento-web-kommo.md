# Handoff — SDD-0579 · Promesas de seguimiento

- Fecha: 2026-10-23.
- Task ID / owner: `0579-promesas-seguimiento-web-kommo` / `worker-0579-promesas-seguimiento`.
- Sesión: subagente Worker aislado del Director de esta tarea.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/0579-promesas-seguimiento-web-kommo`.
- Rama: `codex/0579-promesas-seguimiento-web-kommo`.
- Base: `d410ab2e23e74e5bcf7fdc7cc595371b24cc03a8`; reserva: `1dac0816dc78f9233be428a90ab62088acc1e30f`.
- Spec: [SDD-0579](../../docs/specs/0579-promesas-seguimiento-web-kommo/spec.md), `done` para aceptación local, sin integración/publicación.
- Estado de tarea: lista-para-revision local; gate global FALLÓ/INCOMPLETO conservado.

## OBJETIVO ORIGINAL

Sam autorizó implementar y probar localmente P1 con un Worker aislado: corregir promesas de seguimiento, sin push, merge, despliegue ni cambios en Kommo.

## COMPLETADO

- Cinco respuestas de `lib/faqs.ts` utilizan la constante existente. Con `true` describen seguimiento del Portal en construcción y consulta por WhatsApp; con `false` restauran sus literales previos. Se conservan las 42 preguntas, categorías, widgets, anclas, rutas y demás respuestas.
- «Te avisaremos apenas esté activo» conserva aprobación de SDD-0521. No se agrega fecha, canal, automatización ni envío.
- Cuatro cláusulas equivalentes por capacidad de la KB, su nota de fuente preparada localmente y el beneficio de la infografía alineados. **Fuente Kommo preparada localmente / subida NO EJECUTADA**. No se generó DOCX ni imágenes/PDF de la infografía.
- Privacidad cambia sólo la descripción factual de la fila Seguimiento de envío: Shipping Mark/número indicado al equipo. Fecha de vigencia, finalidades, tratamiento histórico, retención, base jurídica y derechos intactos.
- Matriz antes/después, nueva prueba, tres capturas reales locales, README/SEO e índice de specs actualizados. El Director revisó el diff de producto, las pruebas y las tres capturas sin observaciones bloqueantes.
- [QA reproducible y límites](../../docs/specs/0579-promesas-seguimiento-web-kommo/qa.md). La allowlist exacta de 16 archivos está respetada.

## VALIDACIÓN

| Comprobación | Estado / evidencia |
|---|---|
| Aislamiento, guard y claim | PASÓ, raíz/rama propias y árbol inicialmente limpio; sin copiar .env reales |
| Dependencias frozen/offline | PASÓ, 817 reutilizadas / 0 descargas; lockfile intacto |
| Suite focal | PASÓ, 41 pruebas / 4 archivos: nueva suite 10, contrato FAQ, 0521 y 0528 |
| UI y JSON-LD reales | PASÓ, Chromium 1280×900: /faq42, /shipping-mark8, /puerta-a-puerta6, privacidad; cero intentos remotos inesperados en corrida final |
| Revisión visual | PASÓ, Worker y Director revisaron tres PNG locales; copy completo y legible |
| Gate canónico | **FALLÓ / INCOMPLETO**, exit1; 12/17 pasos ejecutados; no se convierte en verde por los rechecks |
| Harness original | FALLÓ, 216/237 pasaron y 21 fallaron por incompatibilidades del guard propio; ver QA |
| Suite general original | FALLÓ, 859 archivos pasaron /2 fallaron /1 omitido; 12284 pruebas pasaron /4 fallaron /1 omitida, 630,97s |
| Retry automático de suite | Interrumpido sólo árbol Vitest propio PID23556→verify64196, por instrucción Director; gate siguió a build |
| Rechecks de auxiliares | PASÓ: numeración 21/21; actions 17/17; puertos 12/12; watchdog 15/15 |
| Guards negativos | PASÓ: fetch/socket e hijo remotos denegados; connect 0.0.0.0 denegado; Git HTTPS rechazado antes de transporte; promisify stdout/stderr y promise.child conservados |
| Lint / RSC / tipos | PASÓ en gate canónico |
| Docs / numbering / constantes | PASÓ en gate; seis banderas coincidentes, valor real de tracking sigue true |
| Componentes / gobernanza | PASÓ, cinco fuentes de componentes y 28 políticas aprobadas |
| Símbolos de migraciones | PASÓ, 0 rojo y1 amarillo preexistente; sin aplicar nada |
| Build de release + Norte | **PASÓ**, optimización, TypeScript, generación y postbuild; tsconfig restaurado y salida temporal retirada |
| Edge | NO EJECUTADO / SKIP, sin herramienta/red autorizada |
| Ledger de producción | NO EJECUTADO / SKIP, sin service-role, ninguna consulta |
| SQL / schema | NO EJECUTADO / SKIP, no Docker ni DB |
| E2E general | NO EJECUTADO / SKIP, carece del route guard de esta prueba; UI acotada no sustituye cobertura global |
| Producción, Ads/GA real, Kommo, datos clientes | NO EJECUTADO, excluidos del encargo |

Los fallos de harness/test no son cambios del producto ni se etiquetan como flakiness ajena: el guard propio bloqueó fixtures Git de protocolo file, un lookup de bind literal y perdió inicialmente promisify.custom; el runner imponía SITE_URL local contra una expectativa de URL canónica. Se corrigieron únicamente esos auxiliares, con rechecks focales y sin alterar el harness ni debilitar sus aserciones. Los controles Node/navegador son barreras del ensayo, no aislamiento universal del SO.

Log original: `.codex/qa/verify.log`, SHA-256 `eb84c19073e809fa7e653ff7546e928dacd93549aeffad6901d72bea7437ee90`. Logs focales/fixtures ignorados junto a él.

## COMMITS

- `1dac0816dc78f9233be428a90ab62088acc1e30f`: reserva local coordinada de SDD-0579.
- `206728c5a4eca131a6240a67144be3749039b4fc`: implementación, pruebas, fuentes y capturas.
- Commit que contiene este documento: cierre de QA, contratos del guard y estado final local. El SHA final lo comunica Worker al Director sin recursión de commits.

## PR / BRANCH

Sin push ni PR. Rama/worktree anteriores, base main verificada arriba. La rama no tiene respaldo remoto nuevo. No se mergeó, desplegó ni tocó cuenta de Kommo. Integración y publicación requieren autorización posterior; main puede disparar producción automáticamente.

## PENDIENTES DE ESTA TAREA

Ninguno de implementación P1 o aceptación local. Conservan límites explícitos para revisión/publicación futura: gate canónico completo no verde, cinco comprobaciones omitidas, código aún sin integrar/publicar, fuente Kommo aún sin cargar y capas de conocimiento siguientes pendientes. No se autoriza intentar release para cerrar esos puntos.

## Impacto documental y conocimiento

Canónicos actualizados en la rama: spec/QA propios, KB local, fuente de infografía, índices de specs y marketing/SEO; handoff propio. Decisiones previas 0514/0521/0528 conservadas; no se introduce regla nueva.

Graphify 0.9.61 regeneró estructura del worktree (43778 nodos /79870 relaciones), sin proveedores/keys ni extracción remota. Dos advertencias de extracción parcial de Studio legal ajenas se conservan. Ediciones posteriores de QA/handoff fuera piloto dejan estructura PENDING; Director indicó no regenerar globalmente otra vez sólo por ese cierre.

README marketing leído completo y fragmento semántico preparado (9 nodos/8 relaciones; hechos fechados; revisión de ausencia de YAML). Archivos ignorados `graphify-out/sdd0579-marketing.fragment.json` y `sdd0579-marketing.review.json`; check de importación **RECHAZADO** por estructura no CURRENT. No se forzó ni se certificó piloto/global: recibo e importación pendientes para Director.

Archify 2.16.0 build/check **PASÓ / CURRENT** observado sobre 206728c5a, nueve checks/once fuentes, copiando sólo runtime local inmutable validado por lock; declara estructura/semántica PENDING. La revisión final cambia HEAD/documentos y los recibos conservan su revisión observada. QA contiene hashes y recibos en `.codex/qa/knowledge-visual-*.json`.

Obsidian preview intentada: **CANCELADA / SOURCE_CHANGED** por cambios de QA/spec durante la exportación; preview PENDING, sin forzar salida ni repetir tareas pesadas. Bóveda compartida y apertura visible de Obsidian: NO EJECUTADO.

## FUERA DE ALCANCE DETECTADO

- KB mantiene textos históricos de newsletter y alta/aprobación de cuenta; no fueron corregidos ni confirmados como vigentes.
- Graphify advierte extracción parcial en `app/studio/(app)/legal/_components/LegalClient.tsx` y `app/studio/(app)/legal/expediente/[code]/page.tsx`; no se cambian.
- P2 móvil y P3 Ads/CSP no se iniciaron.

## HANDOFF AL DIRECTOR

Entrega local lista para revisar por SHA final: diff, matriz, prueba y capturas. Director conserva revisión de integración/publicación posterior y capas de conocimiento pendientes. No hay otra sesión consumidora del worktree asignada en esta tarea. Worker termina escritura, libera su claim al cerrar y conserva rama/worktree. El servidor UI, navegador y fixtures propios se cerraron mediante finally; se confirma puerto 45790 libre al cierre. No se cerraron procesos ajenos.