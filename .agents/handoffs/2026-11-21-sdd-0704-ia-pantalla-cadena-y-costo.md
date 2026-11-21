# Handoff · SDD-0704 · Pantalla «IA»: cadena de tres y costo (etapa 1)

- Fecha: 2026-11-21 · Worker para Dir_DTD
- Rama: `claude/sdd-0704-pantalla-ia-6b089b` · Base: `origin/main` `9ae885c88`
- Alcance de esta etapa: **solo la spec** `docs/specs/0704-ia-pantalla-cadena-y-costo/spec.md` y el índice. Sin
  código de producto, sin migraciones, sin producción.

## Hecho

- Spec 0704 escrita: amplía la 0639 (principal + respaldo → cadena de hasta 3 puestos) y suma el costo en la misma
  pantalla. Cubre pantalla, cambio automático, regla D-2 en tres capas, tipo de cobro por cuenta, tarifa por modelo,
  tope con techo en el código, gasto del mes, auto-pausa, permisos, migraciones (con OK nominal de Sam), fases y
  pruebas.
- **v2, alcance de Sam** («Sí: aquí solo el ERP; la parte de Hermes de la 0703 y la 0704 pasa a Ofi_Hermes», vía
  Dir_DTD): se quitó cómo gobernar la cadena de Hermes (antes §6, D-3 y fase 1b). La Oficina queda en una fila de solo
  lectura; su costo (tope, tarifa por modelo con `modelo_usado` de la 0702, tipo de cobro) sigue completo. La fase 1
  pasa a ser: costo completo + cadena de A1 y A2 con modelos de Anthropic (nivel 1 de la 0639, sin el motor).
- Número 0704 verificado libre en refs remotos y en `docs/specs/` antes de escribir.
- `pnpm docs:index` regeneró el índice; `pnpm docs:check` PASÓ; `pnpm sdd:check` PASÓ (solo los choques históricos ya
  conocidos).
- Bocetos con montos inventados; no se cita la tarifa ni el tope reales del `.env` de producción.

## Comprobaciones

| Comprobación | Resultado |
|---|---|
| `pnpm docs:check` | PASÓ |
| `pnpm sdd:check` | PASÓ |
| `pnpm verify` | NO EJECUTADO (cambio solo de documentos; sin turno de PC) |
| Pruebas de producto | NO APLICA en la etapa 1 |

## Decisiones para Sam (spec §12)

- D-1 · Ubicación: tarjeta «IA» en Administración › PRO (recomendada) o sección en la barra.
- D-2 · Vuelta al 1.º: cada llamada empieza por el 1.º con cortacircuito (recomendada) o pegajosa 24 h.
- D-3 · Membresías: 0 USD, cuenta llamadas y tokens, tope de llamadas propio (recomendada) o con tarifa de referencia.
- D-4 · Subir el tope: solo superadmin con AAL2; Editar solo baja (recomendada) o Editar sube y baja.

## Pendiente de esta tarea

- Etapa 2 (implementación, fase 1): arranca solo con la confirmación de Dir_DTD de que la spec está aprobada y Sam
  decidió.
- Al aprobarse, ajustar los textos de la 0639 §3.4 («no es una cadena larga») y la 0703 §7 («sin tercer proveedor»).

## FUERA DE ALCANCE DETECTADO

- La cadena de modelos de la Oficina (y la parte Hermes de la 0703) es del Director Ofi_Hermes, por decisión de Sam.
- `task_events` no guarda tokens como columnas (solo en el texto del `resumen`); la 0704 lo propone como migración de
  la fase 1.
- El mes del gasto se mide en UTC (`office_gasto_del_mes`); no se propone cambiarlo.
- La 0638 (clasificador, `ia_eventos`) y la 0639 (motor) siguen sin implementar; las fases 2 y 3 de la 0704 dependen
  de ellas.

## Impacto documental

- Nuevo: `docs/specs/0704-ia-pantalla-cadena-y-costo/spec.md`.
- Actualizado: `docs/specs/README.md` (índice generado).
