# Fase 3 · China y Consolidado

Base exacta: `0f9215395c9a2c28df1621a5c50c06a9e3129bd4` (fase 2 sin aceptación).
Acceso apagado. Solo destino sintético local; no cambia la regla financiera ERP.
Las seis recepciones de fase 1 produjeron cero facturas nuevas. Preorden inmediata
sigue siendo criterio pendiente de decisión; el caso avanzado PRA-EMB-001 ya
trae PRA-PRE-001 preparada por fase 2. Los casos nuevos no crean documentos.

Contrato: documento operativo separado, CAS por espacio, generación financiera
compartida. Reiniciar Facturación invalida el documento operativo atómicamente.
La siguiente lectura siembra casos nuevos; pestañas viejas fallan por revisión.
China y Consolidado comparten envío y cajas estables. Embarques debe consumir
este documento y su revisión/generación, sin copiar cargas ni crear facturas.
La proyección operativa contiene códigos, nunca importes ni líneas financieras.

Allowlist exacta:
- docs/specs/0713-modo-prueba-personal/fase-3.md
- docs/specs/0713-modo-prueba-personal/spec.md
- .agents/handoffs/task_0f561f5002cb.md
- lib/studio/practica/china.ts
- lib/studio/practica/servidor.ts
- lib/studio/practica/__tests__/china.test.ts
- infra/ops/staging/practica-china.sql
- app/api/practica/[operacion]/route.ts
- app/studio/practica/ChinaPractica.tsx
- app/studio/practica/PracticaPersonal.tsx

Gobernanza R3: MP-01 conserva carga, AUD-01 evento con snapshots, ERR-01
conflicto explícito, A11Y-01 ayuda nativa por sección, VIS-01 estilos existentes.
Cumplimiento sujeto a verificación. IA no aplica (ayuda local). No se agregan
transportes, datos reales, estilos globales ni rutas del ERP.

## Controles de entrada incluidos
Se agregan a la allowlist `lib/studio/practica/config.ts`,
`infra/ops/staging/practica-traefik.yml.tmpl`,
`infra/ops/tests/practica-frontera.mjs` y
`lib/studio/practica/__tests__/acceso.test.ts` para permitir China por ambas fronteras.
Consolidar solo registra la transición operativa del ejercicio. La autoemisión
condicional del ERP no está simulada: se explica expresamente en la ayuda.
No se presenta el caso preparado como consecuencia de una recepción nueva.

Se incluye `app/studio/practica/FacturacionPractica.tsx` para comunicar el reinicio
de cargas y refrescar la vista operativa tras confirmar. El historial operativo
previo se conserva como snapshot de reinicio en el almacén sintético privado.

El caso avanzado empieza recibido para que quien solo tiene Consolidado pueda
practicar sin permisos China. Los casos nuevos empiezan pendientes. La proyección
usa marcas inventadas, sin nombres de cliente, incluso en roles de almacén.
La operación de Consolidado representa asignación operativa de carga de Naviera
(`assignLooseCargo`), cuyo permiso es naviera; no es `updateReceiptStatusAction`
de China, que usa cn y puede disparar autoemisión. Ambos caminos reales se
inspeccionaron; la ayuda no equipara sus efectos financieros.

## Ajustes del recorrido operativo (revisión del Director)
Allowlist conserva los archivos existentes; se amplía el contrato de china con
reiniciar para quien tiene edición cn o naviera, sin abrir el detalle financiero.
El servidor relee permisos y genera la semilla financiera internamente; una RPC
serializada compara revisiones de ambos documentos y reinicia la copia completa.
Cancelación no envía comandos. La generación y la revisión vencen otras pestañas.
La referencia de preorden solicita selección explícita en Facturación; si hay
conceptos sin guardar se usa su confirmación existente antes de cambiar documento.
