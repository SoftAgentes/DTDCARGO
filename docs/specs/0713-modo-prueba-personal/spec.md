---
sdd: "0713"
title: "Modo de prueba personal en Studio"
status: in-progress
author: "Codex (Worker)"
created: 2026-11-23
updated: 2026-11-24
supersedes: null
superseded_by: null
related: ["0154", "0155", "0697", "0072", "0540", "0544", "0589", "0635", "0637", "0681", "0690"]
confidencialidad: interno
---

# SDD-0713 — Modo de prueba personal en Studio

Una persona del equipo abre **Mi perfil → Entrar a modo de prueba** y encuentra una copia personal del Studio con carga y facturas inventadas. Puede equivocarse, ver las consecuencias, salir y volver, o repetir el ejercicio desde el comienzo. La primera entrega al equipo abarca **Facturación, Almacén China, Consolidado, Embarque y Recepción Venezuela**, en ese orden de prioridad.

El plan fue aprobado el 23 de noviembre. La [fase 1](fase-1.md) desarrolla la entrada, el aislamiento y la comprobación de la preorden. La apertura al equipo corresponde a la entrega de los cinco módulos.

## 1. La práctica que recibirá el equipo

| Momento | Comportamiento acordado |
|---|---|
| Entrar | Desde el perfil de cualquier cuenta interna activa, una acción abre el Studio de prueba con los permisos efectivos de esa persona. Si ya tiene práctica, recupera su avance. |
| Empezar en Facturación | Hay un envío inventado pendiente de facturar y, como segundo caso independiente, una factura emitida lista para practicar la anulación. Un rol que solo consulta puede ver sus efectos permitidos. |
| Seguir una carga | En un ejercicio de punta a punta, al registrar una recepción identificada en China se espera una preorden visible en Facturación para el rol autorizado. La carga conserva su identidad al entrar en un consolidado, seguir por Embarque y llegar a Recepción Venezuela. |
| Pedir ayuda | Junto a cada función del recorrido, a la derecha, el punto **ⓘ** abre un resumen de qué hace y qué cambiará. **Preguntarle a Faro** aparece en ese mismo punto cuando Faro esté activo y autorizado para esa persona en la práctica. |
| Practicar un contacto o un pago | El correo y WhatsApp muestran el contenido y destinatario ficticios en una vista previa marcada **Simulado**. Registrar un pago de ejemplo modifica el saldo de esa factura en la copia personal. |
| Reconocer y salir | La franja amarilla fija **Modo de prueba · Datos inventados** identifica las cinco secciones, con **Volver al Studio real** siempre accesible. Regresa al inicio del Studio real. La siguiente entrada recupera el último paso permitido y los cambios guardados. |
| Repetir | **Reiniciar mi práctica** explica qué avance se perderá, permite cancelar y exige confirmación. Al confirmar se recuperan los casos iniciales solo para esa persona. |

La prioridad de Facturación define dónde empieza el aprendizaje. La recepción física en China es el evento que debe originar la preorden en el ejercicio nuevo. En pantalla se conserva la etiqueta «Pre-orden». Ese documento queda pendiente de emisión. La fase 1 también caracterizará qué hace el ERP si la recepción llega sin cliente identificado. Una sola carga de ejemplo permite seguir las cinco etapas. Los casos preparados en distintos estados permiten que un empleado practique el paso que le corresponde aun cuando su rol no pueda ejecutar el paso anterior.

## 2. Qué existe y qué hay que demostrar

| Evidencia del repositorio | Consecuencia para este diseño |
|---|---|
| El perfil tiene un modal «Mi perfil». El aviso general de prueba depende del entorno y su franja actual deja pasar los clics. [Perfil](../../../app/studio/_components/wiring/ProfileModal.tsx) · [Aviso](../../../components/AvisoEntornoPrueba.tsx) | La entrada pertenece al perfil. El control de salida debe poder pulsarse y recibir foco dentro de Studio. La prueba de aceptación incluye la franja en móvil y con teclado. |
| El historial documenta una carga real excepcional en staging. El runbook describe acceso restringido, un reset de la base completa y una integración de Chatwoot en prueba. [SDD-0540 §10](../0540-entorno-prueba-staging/spec.md) · [Operación del entorno](../../runbooks/entorno-prueba.md) | Usar el entorno existente requiere evidencia reciente de un destino de práctica exclusivamente sintético y un acceso individual apto para el equipo. La apertura conserva la protección del staging técnico. El reset personal opera sobre una sola copia. |
| Studio resuelve membresía activa, rol, alcance de almacén y ajustes de acceso. [Control de acceso](../../../lib/studio/rbac-guard.ts) | Comparar lectura y escritura con los permisos efectivos de la cuenta para cada módulo. Se incluye la baja o el cambio de permisos después de abrir la práctica. |
| En el alta de recepción de China se intenta vincular la compra y su orden de venta. Al consolidar existe otro camino que puede emitir una factura si se reúnen los requisitos. En Embarques se pueden emitir ciertas preórdenes existentes. [Recepción en China](../../../app/studio/(app)/cn/actions.ts) · [Autoemisión](../0072-orden-venta-sales-order/spec.md) · [Preorden en Embarques](../0690-embarques-facturar-emite-borrador/spec.md) | La fase 1 comprobó tres variantes de alta en Studio y tres caminos móviles con el esquema completo. Las seis recepciones quedaron registradas, con **cero facturas nuevas al recibir**, incluidos borradores. Operaciones espera una Pre-orden para la carga identificada. Corresponde acordar ese cambio del ERP antes de enseñarlo en la práctica. [Resultado de fase 1](fase-1.md#cuándo-aparece-el-documento-en-facturación) |
| Staging simula los envíos del cliente de correo. Existen guías de Facturación y un diseño de Faro con permisos. [Correo](../../../lib/studio/mail/resend-api.ts) · [Guía de Facturación](../../../lib/studio/asistente/contenido/guias/invoices.ts) · [Faro](../0637-faro-asistente-ayuda/spec.md) | Verificar por separado WhatsApp, pagos y tareas en segundo plano. El resumen local debe seguir disponible si Faro está apagado o si no se puede contactar con su proveedor. |

El diseño inicial se contrastó con código y documentos. La fase 1 añadió ensayos en Chromium, PostgREST y PostgreSQL con datos inventados. El contenido y las reglas de red del servidor de prueba y la disponibilidad efectiva de Faro quedan por verificar en su fase.

## 3. Diseño técnico propuesto

**Dos entornos y una identidad de práctica por persona.** La base, la autenticación, los archivos y las credenciales usados para los ejercicios pertenecen al entorno de prueba. Se propone un espacio de datos propio por persona dentro de una base exclusivamente sintética. Si el staging técnico sigue atendiendo cargas excepcionales o ensayos que requieren resets globales, la apertura necesita un destino limpio dedicado dentro de la infraestructura de prueba y coordinado con el Director. En la fase 1 se comprobará si un tenant de prueba por persona cubre tablas, consultas globales, archivos, búsquedas, exportaciones, cachés y tareas programadas, incluidos los roles administrativos. El control se aplica también a lecturas y escrituras mediante la API y a funciones de servidor con privilegios elevados. [Control por fila en Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security)

Si alguna ruta necesaria permite cruzar copias, esa ruta queda cerrada hasta corregir su alcance o acordar un aislamiento más fuerte. La fase 1 ensaya además el alta en China con un caso nuevo y registra si existe la preorden antes de consolidar.

**Entrada desde el perfil.** El servidor del Studio real valida la membresía y los permisos vigentes y entrega un pase breve, de un solo uso, con destino fijo al Studio de prueba. Este emite su propia sesión con una identidad opaca. Se mantienen separadas las cookies, credenciales y sesiones de los dos sitios. El acceso individual debe funcionar desde las redes del equipo sin divulgar la clave compartida del staging ni relajar el acceso al entorno técnico. El intercambio utiliza un canal autenticado. La URL, los registros y la telemetría deben quedar libres de pases, secretos, nombres y correos. El cliente nunca decide rol, propietario ni destino. La baja de cuenta o un recorte de permisos afecta también a una práctica abierta antes de permitir la siguiente operación protegida. Si el destino o el acceso no se pueden validar, se mantiene a la persona en el perfil con un mensaje que explica cómo reintentar.

**Creación, reanudación y reinicio.** La primera entrada prepara una semilla versionada y enlaza una sola copia a su propietario. Dos entradas simultáneas deben recuperar el mismo espacio listo. Se propone preparar una versión nueva y cambiar la copia activa de forma atómica tras confirmar el reinicio. Las operaciones abiertas en otra pestaña detectan la versión vencida. Si falla la preparación, la copia anterior sigue disponible. El rastro mínimo de creación y reinicio queda en prueba, separado de los registros de negocio del ejercicio. La anulación de la factura conserva su historia y usa la regla vigente de reverso. [Permanencia](../../governance/policies/mp-01.md) · [Auditoría](../../governance/policies/aud-01.md)

**Datos y simuladores.** La semilla se construye desde cero. Clientes, proveedores, documentos, contactos y comprobantes son inventados. Los ejercicios con adjuntos ofrecen muestras sintéticas y las entradas de cliente se eligen del catálogo ficticio. Importar hojas de trabajo, adjuntar archivos personales o consultar el directorio real quedan fuera del recorrido. Las previsualizaciones, los comprobantes y los saldos se guardan en el espacio que los originó. La barrera de salida incluye notificaciones de recepción, colas, reintentos, webhooks y tareas de cobro. Los emisores de práctica deben quedar desvinculados de proveedores de mensajería y pagos antes de exponer operaciones. Se verificará que los contadores y documentos de producción quedan fuera de cualquier operación de práctica.

**Ayuda y regreso.** El punto tiene un nombre accesible asociado a la función, admite teclado y tacto, y devuelve el foco al cerrar. El resumen describe el resultado real de la acción permitida. Faro, cuando corresponda, recibe únicamente la pregunta, la sección y contexto autorizado y sintético. La ayuda recuerda usar datos inventados. Ante un dato personal en la pregunta, se pide reformularla antes de enviarla al proveedor. La conversación y el historial se aíslan de producción y de otros usuarios. El botón de regreso termina la sesión de práctica, conserva el avance y lleva al inicio real o a su acceso normal si la sesión real venció. Se probará también el botón Atrás. [Accesibilidad](../../governance/policies/a11y-01.md) · [IA](../../governance/policies/ia-01.md)

## 4. Plan por fases

Contrato local y allowlist de Facturación: [fase 2](fase-2.md). La implementación
no habilita el acceso ni instala SQL en servidores compartidos.

Cada fila de implementación se entrega en una PR propia. Las primeras PR preparan el recorrido con el acceso al equipo cerrado. La apertura de la primera versión exige las cinco etapas completas.

| Fase | Entrega | Demostración para la revisión |
|---|---|---|
| 1 · Acceso y aislamiento | Destino limpio, entrada desde el perfil, identidad de práctica, permisos vigentes, salida al inicio real y barrera de comunicaciones y pagos. | Dos cuentas de igual rol y una de rol restringido. Cada una accede solo a su copia y a las acciones permitidas. Un administrador tampoco accede a prácticas ajenas. Destino indisponible, cuenta desactivada y permisos recortados tienen resultado comprobable. |
| 2 · Facturación | Semilla personal, emisión, anulación, correo y WhatsApp de muestra, pago ficticio, conservación del avance, reinicio y ayuda ⓘ en Facturación. | Una persona emite, otra anula su propio ejemplo, y se comparan los estados. Un pago actualiza el saldo una sola vez. Cancelar el reinicio conserva el avance. Confirmar lo restablece incluso si se reintenta. |
| 3 · Almacén China y Consolidado | Caso nuevo de recepción con preorden visible y vínculo con la misma carga al consolidar. Ayuda local en ambas etapas. | Registrar con permisos, abrir la preorden desde Facturación, reintentar la recepción y consolidar. Se espera una sola preorden asociada a la recepción y ninguna factura duplicada al continuar. |
| 4 · Embarque y Recepción Venezuela | Recorrido con las pantallas existentes, trazabilidad de la carga y ayuda en los dos pasos finales. Conexión de los puntos ⓘ con Faro cuando esté disponible. | Seguir el mismo envío hasta Venezuela, cerrar y reanudar. Probar texto local con Faro apagado y, si está activo en prueba, preguntas limitadas al rol y a la copia. |

**Dependencia de Embarque.** Se propone presentar la ayuda desde la estructura común de Studio y consumir las pantallas actuales. Si se necesita editar Embarques, se detiene esa parte y se comunica a Sam el archivo y el motivo para coordinarla con el Director. La misma exclusión cubre la Bandeja de Chatwoot, Clientes y su fusión, estilos globales, web pública, configuración de Next y entrada de cifras.

## 5. Aceptación de la primera versión

- [ ] Con una cuenta interna activa se entra desde el perfil. El acceso por una cuenta ajena al equipo o desactivada se deniega. El rol, almacén y permisos efectivos de lectura y edición se respetan en servidor y en pantalla.
- [ ] Dos compañeros tienen las mismas plantillas con identidades distintas. No comparten registros, archivos, resultados de búsqueda, avisos, saldos, cachés ni conversaciones. Dos pestañas del mismo usuario pueden reanudar la misma copia.
- [ ] Están disponibles el envío pendiente y la factura emitida. Una recepción nueva crea una preorden identificable en ese momento. La prueba sigue el documento y la carga hasta Recepción Venezuela, incluyendo consolidado y embarque.
- [ ] Una factura puede emitirse y otra anularse con sus consecuencias visibles. Un pago ficticio cambia el saldo de su copia. Correo y WhatsApp tienen vista previa. En una prueba con transportes instrumentados se observan cero entregas, cobros y tareas pendientes de entrega externa, incluso tras reintentar.
- [ ] La franja amarilla, el texto y el regreso son accesibles en las cinco etapas en escritorio y móvil. Salir recupera el inicio real. Volver a entrar reanuda la práctica. Se distinguen salida, anulación de factura y reinicio.
- [ ] Tras cancelar un reinicio el avance coincide con el anterior. Tras confirmarlo vuelven los casos iniciales. Un reinicio concurrente o fallido conserva un estado consistente. La otra persona conserva íntegro su avance.
- [ ] Los cinco módulos tienen ayuda ⓘ operable con teclado y tacto. Con Faro apagado o indisponible, el resumen continúa funcionando. Con Faro habilitado y permitido, se puede preguntar desde la función y solo se recibe contexto de esa práctica.
- [ ] La evidencia de aceptación usa únicamente datos inventados. La apertura requiere evidencia reciente de aislamiento, de integraciones simuladas y de los permisos efectivos del destino de práctica.

## 6. Alcance de la PR de diseño

Esta fase admite los siguientes tres archivos.

- `docs/specs/0713-modo-prueba-personal/spec.md`
- `docs/specs/README.md` (índice generado)
- `.agents/handoffs/sdd-0713-modo-prueba-personal.md`

La lista de archivos de producto se concretará en cada fase sobre su base revisada. La evidencia de esta PR acredita el **cumplimiento documental** de trazabilidad, alcance y criterios de aceptación. La comprobación de comportamiento queda pendiente de implementación. Las migraciones en prueba o producción y la publicación requieren su autorización específica.

Contrato operativo local y límites financieros de China/Consolidado: [fase 3](fase-3.md).

Contrato de Embarques y Venezuela: [fase 4](fase-4.md).

## Recorrido completo de China en la fase 3
El ejercicio aditivo usa cuatro cajas anunciadas de una compra: tres llegan,
dos se montan en A, quedan una recibida y una por llegar; tras la segunda llegada,
las dos restantes se montan en B con la misma identidad. Se distinguen recepción
parcial (0154) y lote partido de estiba (0155, sucesora de 0152); 0673 es otro caso.
Incluye consulta por etiqueta DTD-B mediante QR/teclado/entrada manual sin escribir,
confirmación y recibo, Frágil sin cobro y tarea documental según 0697. Recibir
enseña la llegada física vigente: los seis ensayos no crearon preorden automática.
La preorden avanzada sigue preparada para enseñar Facturación. Contrato y
permisos en [fase-3-china-contrato.md](fase-3-china-contrato.md).
