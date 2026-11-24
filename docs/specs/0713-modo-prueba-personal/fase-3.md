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

## Evidencia de cierre local
La cabeza de producto `1ee827116666f55844536eca388b389bebba8b89` pasó 12/12
pruebas dirigidas sin omisiones con Chromium a 390/1280 px, claro/oscuro.
Incluye reinicio operativo cancelado y confirmado, pestaña vencida, otra persona
intacta (handler/SQL), y selección de preorden con descarte. Capturas y límites
en `.agents/handoffs/task_0f561f5002cb.md`. Build y suite general están asignados
a Calidad en GitHub por el Director; no se repiten localmente. La aceptación
integral y activación siguen pendientes; #812 depende de las correcciones de #811.

## Corrección independiente de permisos y salida
Base revisada: `8b2dabdac98f9e58efdb58eb21f8beb4949fa514`.
Allowlist exacta de esta corrección: `app/studio/practica/ChinaPractica.tsx`,
`app/studio/practica/PracticaPersonal.tsx`, `lib/studio/practica/servidor.ts`,
`lib/studio/practica/__tests__/acceso.test.ts`, este documento y
`.agents/handoffs/task_7e63f8aeb111.md`.
El padre combina motivos independientes de bloqueo financiero y operativo;
la salida comprueba también el bloqueo antes de iniciar la revocación de sesión.
Toda respuesta China devuelve los permisos vigentes cn/naviera por separado.
Una lectura puede continuar por el otro módulo autorizado si perdió el solicitado;
las escrituras siguen requiriendo exactamente el permiso de su operación.
Recargar sustituye los permisos operativos de la pantalla, conservando las lecturas
permitidas y retirando las acciones no autorizadas. ERR-01/A11Y-01: pendiente
visible, control de salida deshabilitado y lectura de solo consulta explícita.

## Unión autorizada con fase 2
Se incorporó por merge normal `fbc5ca252fee8a5e9700dc16be78f276ea1b2330`
en `17487914f50ffabe403a9b4a896f6688b0f1986c`, sin reset ni reescritura.
Se preservaron el editor NumericInput y sus errores, límite financiero de 24 KiB,
ruta financiera separada de la de acceso/China (2 KiB), y revalidación de identidad
con editor montado y oculto durante la consulta. La selección de documento,
reinicio y bloqueos por motivo de fase 3 se conservaron semánticamente.
La unión autorizada añade a la allowlist los archivos provenientes de #811:
`app/api/practica/[operacion]/route.ts`, `app/studio/practica/FacturacionPractica.tsx`,
`infra/ops/staging/practica-traefik.yml.tmpl`, `infra/ops/tests/practica-frontera.mjs`,
`infra/ops/tests/practica-p2.node.ts`, `lib/studio/practica/cuerpo.ts`,
`docs/specs/0713-modo-prueba-personal/fase-2.md` y su handoff
`.agents/handoffs/task_e275a30d5f9a.md` (conservado, sin reescribirlo).
Cabeza combinada de producto: `e0b8f6ea1ae786e17f5a3b3322a9d85b78dc38f2`.
Sintaxis de seis archivos y diff check pasaron; nuevas pruebas de navegador,
API/SQL, Traefik y typecheck aún NO EJECUTADAS en esa cabeza por turno ocupado.
Los resultados de SHAs anteriores no acreditan esta versión. Suite/build van en CI.
El defecto de recuperación de conexión de #811 se mantiene fuera de esta corrección;
su autor lo resolverá y el Director coordina su incorporación posterior.

## Seguimiento CI de la unión con recuperación de identidad
Unión normal autorizada de #811 exacta `0c0b5a8ed81127cce21e4f9c51c695441720175f`.
Allowlist de la unión: los archivos del diff de esa cabeza frente a fbc5ca252,
con resolución propia únicamente en PracticaPersonal.tsx y acceso.test.ts;
se añade `.agents/handoffs/task_a0bcc3a01712.md`. Se conserva la recuperación
por red/503/identidad, el gate focal que rechaza submatrices y el recibo Chromium
por viewport/tema, junto con negativas cn/naviera, selección y reinicio.
La salida confirmada de recuperación puede descartar edición financiera oculta,
pero ninguna vía de salida puede interrumpir una petición operativa pendiente.
La evidencia final se registra en la PR #812 y el recibo Orca sobre el SHA publicado,
sin añadir después un commit solo documental que cambie la cabeza probada.

## China completa · ampliación autorizada del recorrido
Contrato aditivo para fase 4: [lectura por caja, consolidado e historial](fase-3-china-contrato.md).
SDD-0152 es antecedente, sucede SDD-0155 §3/0246; SDD-0154 gobierna recepción
por compra y segunda llegada. SDD-0673 (partir entre clientes) no es este caso.
Las seis recepciones ensayadas acreditan llegada física sin preorden automática;
se conserva el caso avanzado preparado para Facturación. Frágil y la tarea
Marca sin autorización siguen los efectos y los límites de SDD-0697.
Allowlist exacta de ampliación:
- docs/specs/0713-modo-prueba-personal/fase-3.md
- docs/specs/0713-modo-prueba-personal/spec.md
- docs/specs/0713-modo-prueba-personal/fase-3-china-contrato.md
- .agents/handoffs/task_a0bcc3a01712.md
- lib/studio/practica/ejercicio-china.ts
- lib/studio/practica/china.ts
- lib/studio/practica/servidor.ts
- lib/studio/practica/identidad.ts
- lib/studio/practica/contrato.ts
- lib/studio/practica/__tests__/ejercicio-china.test.ts
- lib/studio/practica/__tests__/acceso.test.ts
- app/api/practica/[operacion]/route.ts
- app/studio/practica/ChinaPractica.tsx
- app/studio/practica/EjercicioChina.tsx
- package.json
- pnpm-lock.yaml
Dependencia de decodificación QR solo para pruebas, si resulta necesaria.
Sin SQL compartido, apertura, canales reales, cámara obligatoria ni cambios de ERP.

La ampliación incluye `infra/ops/staging/practica-china.sql` para que una lectura
sin documento devuelva el estado vacío sin insertar una fila; solo la escritura
inicial crea el documento bajo el bloqueo de espacio. SQL de ensayo local/CI,
jamás aplicado en servidor compartido. La identidad deriva región de user_tenants.region,
no de warehouse_scope; datos sin región/capacidad no habilitan las nuevas acciones.

La UI aditiva usa `EjercicioChina.tsx` dentro de la entrada existente de China.
Se añade `.github/workflows/practica-personal.yml` a la allowlist únicamente para
conservar capturas sintéticas por SHA como artefacto del focal, sin quitar gates.
El parser y el payload DTD-B siguen siendo los aprobados; la comparación de
reintentos usa campos canónicos, no el orden de claves JSON/JSONB.
