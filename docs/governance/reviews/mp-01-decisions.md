# Aprobación de decisiones reservadas MP-01

| Control | Valor |
|---|---|
| Revisión | REV-MP-001 |
| Política | [MP-01 v1.1](../policies/mp-01.md) |
| Fecha | 2026-07-22 |
| Resultado técnico | aprobada y consolidada en MP-01 v1.1 |
| Estado normativo | REV-MP-001 aprobada; MP-D1 a MP-D7 son defaults obligatorios |
| Alcance | gobierno de datos y experiencia; sin código, migración ni purga |

## 1. Veredicto

Las siete decisiones reservadas se convierten en defaults operativos sin
presentar una recomendación técnica como dictamen legal. La norma separa:

1. mínimos sustentados por una fuente aplicable;
2. ventanas internas de restauración y cierre;
3. reglas conservadoras cuando la categoría o jurisdicción todavía no está
   determinada;
4. una futura validación con contador/abogada antes de activar purgas.

La aprobación explícita del founder mantiene el default conservador de
**no purgar; archivar, anular o conservar** hasta que cada implementación tenga
SDD y gate propios. Ningún plazo aprobado ejecuta disposición automática.

## 2. Fuentes y límites

| Fuente | Consecuencia para MP-01 |
|---|---|
| [Código de Comercio de Venezuela, art. 44](https://www.wipo.int/wipolex/en/legislation/details/4008) | Libros, comprobantes y correspondencia comercial: mínimo 10 años desde el último asiento. |
| [Código Orgánico Tributario de Venezuela, arts. 55–56](https://www.cebm.gob.ve/wp-content/uploads/2025/07/LEY-DEL-CODIGO-ORGANICO-TRIBUTARIO.pdf) | Prescripción general de 6 años y extensión a 10 años en ciertos supuestos; una interrupción, litigio o norma especial puede ampliar el horizonte. |
| [Constitución venezolana, art. 28](https://www.wipo.int/wipolex/es/legislation/details/3981) | La persona puede conocer el uso/finalidad y solicitar actualización, rectificación o destrucción de datos erróneos o lesivos; el ERP necesita un flujo de solicitud y decisión. |
| PIPL de China, [arts. 17 y 19](https://en.spp.gov.cn/2021-12/29/c_948419.htm) y [art. 47](https://en.spp.gov.cn/2021-12/29/c_948419_2.htm) | Debe informarse el plazo; fuera de una obligación legal, la conservación es la mínima necesaria y procede borrar al concluir propósito/plazo. Si la ley impide borrar todavía, solo se conserva y protege. |
| [Administración de archivos contables de China, arts. 14–19](https://www.mof.gov.cn/zcsjtsgb/gztsgb/201512/t20151211_3578376.htm) | Los archivos contables se clasifican como permanentes o por 10/30 años; el plazo es mínimo y no se destruyen obligaciones pendientes. |
| [Administración tributaria de China](https://fgk.chinatax.gov.cn/eng/c102962/c102967/c102998/c103018/c5245861/content.html) | Libros, comprobantes, estados, facturas y documentos tributarios se conservan 10 años, salvo regla especial. |
| [Ley de Comercio Electrónico de China, art. 31](https://www.samr.gov.cn/wljys/gzzd/art/2023/art_3e75434c954b4cb9bd14867dacff26d1.html) | El mínimo de 3 años para información de plataforma solo se aplica si la operación concreta califica como plataforma de comercio electrónico; no se presume para todo DTD Cargo. |
| [Políticas digitales DTD Cargo para revisión legal](../../legal/DTDCARGO_Politicas_Digitales_v3_para_abogada.md) | El proyecto mantiene el plazo público en términos genéricos y dejó el número fiscal sujeto a confirmación del contador; REV-MP-001 no debe publicarse como texto legal sin esa revisión. |

Esta revisión no sustituye la clasificación del contador en Venezuela/China ni
el análisis de contratos, aduanas, trabajo, reclamos, litigios o normas
especiales. Cuando dos plazos aplicables compitan, gobierna el más largo y un
hold suspende cualquier disposición.

## 3. Defaults normativos aprobados

### D1 — Retención por clase y jurisdicción

| Clase | Default aprobado | Disposición al vencer |
|---|---|---|
| Venezuela · libros, comprobantes y correspondencia comercial | 10 años mínimo desde el último asiento/cierre del expediente. | Revisión previa; anonimizar lo separable y purgar solo con calendario aprobado, cero hold y evento AUD. |
| Venezuela · obligación tributaria o fiscal | 10 años como default conservador; extender por interrupción, omisión, litigio o norma especial. | Nunca disponer por cronología simple: requiere validación contable del expediente. |
| China · documentos tributarios | 10 años mínimo, salvo categoría especial. | Revisión con responsable de China antes de disponer. |
| China · archivos contables | Clasificar en 10 años, 30 años o permanente según el catálogo oficial. Mientras no exista mapeo: P4, sin purga. | Dictamen de disposición y registro de destrucción; obligaciones pendientes continúan. |
| PII sin obligación legal/contractual vigente | El tiempo mínimo necesario para el propósito comunicado. | Eliminar o anonimizar; conservar solo evidencia no identificable de la solicitud/decisión. |
| Reclamo, deuda, investigación, litigio o hold | Plazo base + suspensión hasta cierre verificable. | Dos decisiones humanas para liberar hold; después vuelve al calendario base. |
| Auditoría clase A/P4 | Sin purga automática hasta implementar el calendario AUD-02 Corte E. | Job controlado, manifiesto y evento de disposición; nunca eliminación manual por fila. |
| Técnico efímero P0 sin PII, referencia ni valor probatorio | Máximo 30 días, con owner, métrica y job controlado. | Purga agregada; conservar solo métricas no identificables necesarias. |

Ningún plazo convierte automáticamente P3/P4 en eliminable. El vencimiento abre
una revisión de disposición; no ejecuta un `DELETE` por sí solo.

### D2 — Restauración P1/P2

| Ventana | Quién y cómo |
|---|---|
| 0–10 segundos | **Deshacer** por el actor original si conserva permiso y el estado no cambió. |
| 0–30 días | Restauración ordinaria por admin o responsable del dominio con capability explícita; valida unicidad, referencias, tenant y estado. |
| 31–90 días | Restauración excepcional solo por admin, con motivo obligatorio y evento AUD-01. |
| Después de 90 días | No existe restauración ordinaria. Si el registro sigue retenido, cualquier recuperación es un procedimiento excepcional/documentado, no un botón de UI. |

La ventana de restauración no es plazo de retención y no autoriza purgar al
vencer. Un registro P3 se corrige con reversión/compensación; P4 con una
rectificación anexada.

### D3 — Roles y control de purga

1. El actor original solo puede usar **Deshacer** durante la ventana inmediata.
2. Restaurar exige permiso de edición vigente más una capability específica de
   restauración; `admin` no evita las validaciones de negocio.
3. Restauración tardía exige admin, motivo y auditoría.
4. La purga excepcional no es una acción manual por fila. Solo la ejecuta un job
   autorizado sobre un lote elegible.
5. El lote exige dos decisiones humanas: responsable de datos/admin y founder o
   responsable legal/contable. Si son la misma persona, se registra excepción R3
   y una revisión posterior independiente.
6. Hold, deuda, reclamo, investigación, referencia activa o plazo no vencido
   bloquean la purga de forma fail-closed.

Los nombres técnicos de capabilities se crean únicamente en el SDD de
implementación; no se agregan de forma aspiracional a `rbac.ts`.

### D4 — Solicitudes relacionadas con PII

1. Registrar identidad del solicitante, datos/alcance pedidos, jurisdicción,
   propósito original y resultado; nunca copiar la PII completa al log.
2. Rectificar datos operativos sin reescribir evidencia P4; la corrección deja
   vínculo con el registro anterior.
3. Si no existe obligación ni propósito vigente: anonimizar o eliminar en
   sistemas activos y derivados.
4. Si existe obligación/hold: retirar de búsqueda y uso ordinario, limitar el
   tratamiento a conservación y seguridad, minimizar campos y registrar el
   fundamento de la negativa o diferimiento.
5. La solicitud se propaga a cachés, índices, exports temporales y proveedores.
   Backups no reintroducen datos eliminados al sistema activo; el plazo técnico
   máximo se fija después de inventariar la rotación real de cada proveedor.
6. Comunicar al solicitante qué se corrigió, eliminó, anonimizó o retuvo y por
   qué, sin revelar información de terceros.

### D5 — Cierre de tenant

| Momento | Comportamiento aprobado |
|---|---|
| Día 0 | Suspender acceso y mutaciones ordinarias; congelar estados y abrir expediente de cierre. |
| Días 0–30 | Ventana controlada para exportación autorizada y conciliación de obligaciones. |
| Día 31 | Separar archivo legal P3/P4 de datos operativos prescindibles; revocar accesos ordinarios y desactivar integraciones. |
| Vencimiento por clase | Anonimizar/purgar solo por calendario, sin hold/deuda/reclamo y con doble control. |

Cerrar un tenant nunca transfiere sus identificadores, consecutivos o datos a
otro tenant. La reactivación posterior es una decisión explícita, no el efecto
colateral de restaurar una fila.

### D6 — Fotos, adjuntos y documentos rechazados

| Caso | Resultado aprobado |
|---|---|
| Vinculado a factura, pago, inspección, reclamo, aduana, entrega o decisión | P4/versionado; hereda el plazo del expediente padre. |
| Borrador vinculado pero todavía no emitido | P2; 30 días de restauración. El objeto queda en cuarentena privada, no se borra best-effort al ocultar la fila. |
| Upload rechazado, incompleto o sin vínculo | Cuarentena máxima de 30 días; luego P0 por job si no tiene hold, referencia ni valor de seguridad. |
| Malware o abuso | Aislar; conservar hash/metadatos mínimos de seguridad. El archivo peligroso solo se retiene si una investigación/obligación lo exige. |
| Reemplazo de evidencia | Nueva versión; el original no se sobrescribe si ya sustentó una decisión. |

Storage y fila de metadatos deben compartir una máquina de estados verificable.
Un mensaje de éxito no se muestra hasta que la transición durable sea cierta.

### D7 — Borradores que nunca deben desaparecer

Un registro deja de ser purgable aunque su etiqueta siga diciendo “borrador” si
cumple al menos una condición:

- recibió código, consecutivo o identificador comunicado externamente;
- fue enviado, compartido, aprobado, aceptado o firmado;
- generó email, PDF, exportación, factura, pago, asiento o movimiento de inventario;
- fue usado por otra entidad, workflow, integración, IA o decisión humana;
- contiene evidencia de aduana, inspección, reclamo, entrega o seguridad;
- participa en una deuda, conciliación, investigación, hold o disputa;
- su desaparición rompería una referencia o volvería ambiguo el historial.

Solo un borrador interno, no enviado, sin consecutivo externo, sin hijos, sin
archivo probatorio y sin evento con efecto puede conservar P2 y eventualmente
ser elegible para disposición controlada.

## 4. Decisiones aprobadas

| ID | Default aprobado | Condición de aplicación |
|---|---|---|
| MP-D1 | Calendario anterior; Venezuela 10 años conservador y China por clase 10/30/permanente. | Clasificación contable y SDD antes de activar disposición. |
| MP-D2 | Restauración 10 s / 30 días / excepcional hasta 90 días. | Implementación y pruebas mediante SDD separado. |
| MP-D3 | Capability explícita y doble decisión para purga. | RBAC, job y gate de producción separados. |
| MP-D4 | Eliminar/anonimizar cuando pueda; si no, bloquear uso y conservar de forma restringida. | Inventario de backups y proveedores antes de fijar SLA técnico. |
| MP-D5 | Cierre de tenant con 30 días de conciliación/exportación y archivo legal separado. | Flujo, permisos y exportación mediante SDD separado. |
| MP-D6 | Evidencia hereda al padre; uploads sin vínculo quedan elegibles para P0 después de 30 días. | La purga requiere máquina de estados de Storage, job, SDD y gate separados. |
| MP-D7 | “Borrador” no permite borrar si ya produjo identidad, dependencia o efecto. | Clasificación por entidad/estado antes de cambiar acciones visibles. |

## 5. Registro de aprobación

El 2026-07-22, Sam (founder) aprobó REV-MP-001 con los defaults MP-D1 a MP-D7
mediante la siguiente decisión explícita:

> Apruebo REV-MP-001 con los defaults MP-D1 a MP-D7. La aprobación es normativa;
> toda implementación, plazo especial y purga conserva su SDD y gate separado.

La decisión consolida [MP-01 v1.1](../policies/mp-01.md). No autoriza:

- migraciones, cambios de RBAC o Storage;
- creación o ejecución de jobs de retención o purga;
- aplicación de plazos especiales no clasificados;
- cambios en producción;
- presentar los defaults como asesoría legal o contable.

## 6. Límite de esta revisión

Este documento actualiza únicamente el contrato normativo de MP-01. No
actualiza RBAC, no crea un calendario ejecutable, no elimina archivos, no
aplica migraciones y no constituye asesoría legal. Cada adopción requiere SDD,
pruebas, gate y evidencia propios.
