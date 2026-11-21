# Handoff · SDD-0704 · Pantalla «IA»: cadena de tres y costo (etapa 1)

- Fecha: 2026-11-21 · Worker para Dir_DTD
- Rama: `claude/sdd-0704-pantalla-ia-6b089b` · Base: `origin/main` `9ae885c88` · PR #758 (sin fusionar)
- Alcance de esta etapa: **solo la spec** `docs/specs/0704-ia-pantalla-cadena-y-costo/spec.md` y el índice. Sin
  código de producto, sin migraciones, sin producción.

## Versiones

- **v1** `c24353a6b`: la spec completa, con la Oficina (caminos A, B y C).
- **v2** `4da3a3f7a`: recortada a «solo el ERP». Salió de un mensaje de Dir_DTD que, por error suyo, atribuía ese
  alcance a Sam. **Anulada.**
- **v3** `34e5b4e3a`: vuelve al alcance de la v1, porque la respuesta real de Sam (22:14:56Z, según Dir_DTD) fue
  «dejalos aqui». Conserva de la v2 el costo con `modelo_usado` de la 0702, la tarifa más alta ante un modelo
  desconocido y la fase 1 con la cadena de A1 y A2 sin el motor. Aplica los 8 hallazgos del revisor independiente:
  1. todo lo que afloja el freno pide AAL2, comparado con el valor efectivo;
  2. dependencias de la 0638 explícitas por fase, con registro y aviso provisionales, y la tabla de status de Hermes
     (`http_500` no salta);
  3. proveedor en `ia_cadenas`, lista cerrada y catálogo en la base;
  4. la prueba de la D-2 cubre los tres puestos;
  5. dos citas corregidas;
  6. la fase 1 queda mínima (los cortacircuitos pasan a la fase 2);
  7. «subir» se mide contra el valor efectivo;
  8. la deduplicación del aviso pasa a ser la D-6.

  Frontera: la 0704 diseña y el ERP guarda la cadena; cualquier cambio en el VPS de Hermes lo ejecuta Ofi_Hermes.

## Comprobaciones

| Comprobación | Resultado |
|---|---|
| `pnpm docs:check` | PASÓ |
| `pnpm sdd:check` | PASÓ (solo los choques históricos ya conocidos) |
| `pnpm verify` | NO EJECUTADO (cambio solo de documentos; sin turno de PC) |
| Pruebas de producto | NO APLICA en la etapa 1 |

## Decisiones para Sam (spec §12)

- D-1 · Ubicación: tarjeta «IA» en Administración › PRO (recomendada) o una sección en la barra lateral.
- D-2 · Vuelta al 1.º: cada llamada empieza por el 1.º, con cortacircuito desde la fase 2 (recomendada), o pegajosa 24 h.
- D-3 · Oficina: A, el ERP pide el modelo en cada llamada (recomendada); B, sincronizar; C, solo mostrar.
- D-4 · Membresías: 0 USD, se cuentan llamadas y tokens, con tope de llamadas propio (recomendada), o además con tarifa
  de referencia.
- D-5 · Quién afloja el freno: solo el superadmin con AAL2 (recomendada), o Editar hace todo.
- D-6 · Avisos por salto: uno por función, puesto y día (recomendada); uno por cada salto, o un resumen diario.

## Pendiente de esta tarea

- Etapa 2 (implementación, fase 1): arranca solo con la confirmación de Dir_DTD de que la spec está aprobada y Sam
  decidió.
- Al aprobarse, ajustar los textos de la 0639 §3.4 («no es una cadena larga») y la 0703 §7 («sin tercer proveedor»).

## FUERA DE ALCANCE DETECTADO

- Fase 1b, que ejecuta Ofi_Hermes en el VPS (§6.3 de la spec):
  - medir si Hermes acepta un modelo o un alias por llamada;
  - medir qué status devuelve cuando el proveedor se cae y cuando rechaza la entrada;
  - crear alias por puesto sin chinos y quitar el respaldo propio del perfil;
  - pasar la causa del error del proveedor de fondo.
- `task_events` no guarda los tokens en columnas (solo en el texto del `resumen`); la 0704 lo propone como migración de
  la fase 1.
- El mes del gasto se mide en UTC (`office_gasto_del_mes`); no se propone cambiarlo.
- La 0638 (clasificador, `ia_eventos`, aviso) y la 0639 (motor) siguen sin implementar; la fase 1 de la 0704 depende de
  la fase 1 de la 0638.

## Impacto documental

- Nuevo: `docs/specs/0704-ia-pantalla-cadena-y-costo/spec.md`.
- Actualizado: `docs/specs/README.md` (índice generado).
