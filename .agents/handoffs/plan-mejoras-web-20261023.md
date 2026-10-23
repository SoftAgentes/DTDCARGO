# Handoff — plan de mejoras de la web, 2026-10-23

Dueño: Director de planificación de esta conversación.
Estado: plan preparado; pendiente de ejecución autorizada e integración.
Fecha: 2026-10-23 · America/Caracas.
Task ID: `plan-mejoras-web-20261023`.
Owner del claim: `director-plan-web-20261023`.
Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/plan-mejoras-web-20261023`.
Rama: `codex/plan-mejoras-web-20261023`.
Base: `d410ab2e23e74e5bcf7fdc7cc595371b24cc03a8` (`origin/main` tras fetch sin prune).

## OBJETIVO ORIGINAL

Preparar un plan concreto para aplicar las mejoras recomendadas, por prioridad, empezando por promesas de seguimiento, móvil y medición Ads, sin tocar producción. No se autorizó implementar producto ni publicar.

## COMPLETADO

- [Plan canónico](../../docs/marketing/plan-mejoras-web-2026-10-23.md): prioridades, alcance candidato, dependencias, responsables, aceptación, estimaciones y condiciones para no aplicar un parche.
- P1 separa FAQ/fuente Kommo/privacidad de las SDD-0521/0528 ya integradas. P2 exige reproducir clipping antes de corregir. P3 distingue CSP local de recepción/atribución remota.
- Se conserva la decisión editorial previa de llms; su frase de seguimiento es ambigüedad para P4, no una regresión confirmada.
- Se añade el plan al índice de marketing sin cambiar sus estados históricos.
- Revisión independiente incorporada: aislamiento de red transversal a navegador, servidor, build y verify. Se aclara que «Te avisaremos apenas esté activo» es texto previamente aprobado en 0521, no nueva autorización de notificación.
- Ningún SDD nuevo reservado ni Worker de producto iniciado. Subagentes internos solo revisaron fuentes.
- Se revisó el segundo enlace de AI Studio y sus diez justificaciones. Se incorporó al plan el contraste: conserva errores y añade métricas sin respaldo; no cambia las prioridades ni autoriza más implementación.

## VALIDACIÓN

- PASÓ: `node scripts/build-docs-index.mjs --check`, índice sincronizado con 556 specs.
- PASÓ: comprobación de 80 enlaces locales de los tres documentos; cero destinos faltantes.
- PASÓ: `git diff --check` y comprobación del alcance documental. El diff final se revisa antes del commit selectivo.

- `git fetch origin`: ejecutado sin prune; base local y origin/main coinciden.
- `node scripts/director-status.mjs`: iniciado e interrumpido tras varios minutos sin salida; inventario global incompleto. Sustituido para este plan por inventario focal y `gh pr list`: 18 PRs abiertas, incluidas bases ajenas a main. No se declara ausencia de conflictos ni actividad de sesiones.
- Conector GitHub: NO DISPONIBLE, sesión no conectada. Fallback `gh` de solo lectura sí respondió y resolvió el repositorio a `SoftAgentes/DTDCARGO`.
- `gh pr list` con archivos: no devolvió coincidencias para los siete archivos runtime/índice revisados focalmente. Eso no certifica que el resto de los contratos o las sesiones estén libres de conflicto. `git ls-remote origin refs/heads/main` confirmó el SHA de la base.
- `pnpm knowledge:status`: interrumpido porque el lanzador empezó a preparar dependencias locales automáticamente. Se usó la alternativa documentada `node scripts/knowledge-sync.mjs status`; devolvió exit 0 con `ok:false`, estructura CURRENT y semántica global PENDING. No equivale a cobertura completa.
- La preparación de pnpm alcanzó a añadir dependencias ignoradas bajo `node_modules` del principal; no se limpiaron ni movieron archivos preexistentes y no cambió ningún archivo rastreado del principal. No se repite instalación en el worktree documental.
- Estado de conocimiento al cierre del worktree: comando ejecutado con exit 0, `ok:false`, estructura INVALID y semántica PENDING. No se prepararon derivados locales; no equivale al estado CURRENT estructural del principal ni a un fallo del contenido del plan. No se publican derivados ni se declara cobertura completa.
- `pnpm verify`, UI y eventos Ads nuevos: NO EJECUTADOS; esta entrega solo modifica documentación.

## PERMISOS Y PR / BRANCH

Solo documentación y commit local de esta tarea. Sin push, PR, merge, deploy, acceso a clientes/PII, cuentas Ads/GA/Kommo, campañas, envío de mensajes ni DB/migraciones. La publicación automática desde main impide tratar un merge documental como inocuo para producción.

## COMMITS

El commit que contiene este documento conserva exclusivamente el plan, este handoff y el enlace del README de marketing. El hash definitivo se entrega en la conversación; no hay PR ni publicación remota.

## CONOCIMIENTO

Documento guardado en la tarea y enlazado desde marketing. Integración PENDIENTE. No se regeneró Graphify ni se certificó semántica del nuevo documento. Archify no se cambió. No se publicó la bóveda Obsidian ni se abrió su UI. El estado global previo no se atribuye a esta tarea. La futura integración debe revisar los derivados según el runbook.

## FUERA DE ALCANCE DETECTADO

- Drift de documentación SDD-0413 frente a archivos nonce ausentes en la base: no se reimplementó seguridad privada.
- FAQ de registro y fuente Kommo difieren sobre aprobación del asesor: requiere verificar flujo real antes de cambiar esa promesa.
- Fechas, identidad legal y ambigüedad de llms; PWA manifest y tabla comercial: presupuestados para P4, sin cambio silencioso.
- Semántica global y enlaces históricos del conocimiento pendientes: no reparados en una tarea de planificación de marketing.

## SIGUIENTE PASO

Cuando se encargue ejecución local, Director revalida PRs/refs/worktrees, reserva SDD y entrega un contrato completo por tarea. Prioridad de entrega P1, luego P2; diagnóstico P3a puede avanzar en paralelo. No confundir el plan preparado con implementación o autorización de publicación.
