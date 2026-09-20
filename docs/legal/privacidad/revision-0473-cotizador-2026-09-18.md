# Revisión de datos personales · Cotizador con documentos (SDD-0473)

- **Fecha:** 2026-09-18
- **Alcance:** el cotizador público `/cotizador` tal como quedaría encendido (`DOCUMENT_IMPORT_ENABLED=true`, `DOCUMENT_IMPORT_PORTAL_ENABLED` apagada). Rama `codex/encender-cotizador-0473`, commit `2575ac5e`, leída en modo solo lectura. Las rutas `archivo:línea` se refieren a ese commit.
- **Fuera del alcance:** los documentos ligados a compras del Portal, que siguen apagados.
- **Método:** skill `revisar-datos-ve`: inventario, los doce puntos y reporte. No se ejecutó nada contra producción ni contra Preview (Preview escribe en la base de producción).
- **Para qué sirve:** es insumo técnico para que Sam decida con su abogado. **No es asesoría legal.**

## Resumen

| Estado | Cantidad |
|---|---|
| ENCONTRADO | 8 |
| CORRECTO | 8 |
| NO VERIFICABLE | 6 |

**En una frase:** la parte técnica está bien resuelta: guarda poco, borra a las 24 h, no conserva la IP cruda y no escribe datos en los logs. **Lo que falta es informar.** Hoy el visitante sube el archivo sin que nada le diga que su documento completo se envía a un proveedor de IA en Estados Unidos, y la política pública no menciona el cotizador, a Anthropic ni el alojamiento fuera de Venezuela. En Venezuela, la base para esa transferencia es el consentimiento informado. Sin aviso, no hay consentimiento informado.

## 1. Inventario de datos

| Dato | Qué es | Finalidad | Base | Retención | Quién más lo ve |
|---|---|---|---|---|---|
| Archivo subido (PDF, XLSX o CSV) · bucket privado `document-imports` (`0457:103-105`), ruta `anonymous/<workspace>/<job>.<ext>` (`service.ts:150`) | El documento completo. Una proforma suele traer datos del **comprador** (nombre, RIF o cédula, dirección, teléfono), del **contacto del proveedor**, a veces **cuentas bancarias** y **firmas o sellos** | Leer productos, cajas, peso y volumen para cotizar | No documentada (ver hallazgo H1) | 24 h + como máximo 1 h de limpieza (`jobs.ts:117-130`, cron horario `document-import-cleanup/route.ts:15`) | **Anthropic**, que recibe el PDF entero (`anthropic.ts:42`) o todas las celdas de la hoja (`extract.ts:462-464`) |
| `document_import_jobs.file_name` (`0457:47`) | Nombre del archivo; puede contener nombres de personas o empresas | Mostrar el archivo y dejar evidencia de su origen | — | 24 h, en cascada (`0457:45`) | Anthropic, como metadato (`anthropic.ts:40-42`) |
| `document_workspaces.draft`, `document_workspace_versions.draft` y `document_import_jobs.result` (`0457:12,28,58`) | Borrador extraído. Incluye `supplier.{company, contact, email, wechat, phone, address, city}` (`anthropic.ts:15`) | Que el visitante revise y corrija antes de cotizar | — | 24 h, en cascada (`0457:26,45`) | — |
| `document_workspaces.anonymous_hash` (`0457:10`) | SHA-256 de un token aleatorio de 32 bytes (`access.ts:18-19`) | Autorizar al visitante sin cuenta | — | 24 h | — |
| `document_import_limits.scope` (`0457:66-71`) | HMAC de la IP con un secreto de al menos 32 caracteres (`access.ts:117-121`) | Limitar abusos | Interés en la seguridad del servicio | 2 días (`jobs.ts:140`) | — |
| `document_import_jobs.sha256` (`0457:52`) | Huella del contenido del archivo | Evitar leer (y pagar) dos veces el mismo archivo | — | 24 h | — |

**Titulares que no son usuarios:** el contacto del proveedor (normalmente en China) y cualquier otra persona que aparezca en el documento (quien firma, o el comprador si quien sube el archivo es un intermediario). Ver el punto 12.

**Datos sensibles:** el sistema no los pide. Una proforma podría traer firmas o sellos, y la IA recibe el documento completo. El prompt le ordena no extraerlos (`anthropic.ts:26`), pero **no impide que los reciba**.

## 2. Hallazgos, de mayor a menor gravedad

### H1 · ENCONTRADO — No hay aviso ni consentimiento antes de subir el archivo
- **Qué pasa:** el texto previo a la carga solo habla de formatos y tiempos de lectura (`DocumentImportPanel.tsx:373-431`). El espacio de trabajo se crea recién cuando el visitante elige el archivo (`DocumentImportPanel.tsx:274`), así que el único aviso existente, «se guarda temporalmente y se borra solo» (`CotizadorClient.tsx:241-248`), aparece **después** de la carga. No se registra ninguna aceptación.
- **Por qué importa:** el documento completo sale hacia Anthropic, en Estados Unidos. En Venezuela, la base de esa transferencia es el consentimiento **previo e informado** (SC 332/2001, principio de autonomía), y la carga de probarlo es de quien trata los datos.
- **Arreglo:** antes de la zona de carga, poner un aviso corto con enlace a `/privacidad`. Debe decir: «Tu archivo se envía a Anthropic (EE. UU.) para leerlo con IA; se guarda 24 h y se borra solo; no subas documentos con datos que no quieras compartir». Además, una casilla **no premarcada** que habilite la carga, y guardar en el workspace la versión del texto mostrado y la hora. Así queda evidencia del lado del servidor y no solo en el navegador.

### H2 · ENCONTRADO — La política pública no describe el cotizador
- **Qué pasa:**
  - La tabla «Qué datos recogemos y cuándo» no tiene el momento «Cotizador con documentos» (`app/privacidad/page.tsx:39-68`).
  - «Con quién compartimos» no menciona ningún proveedor de IA (`page.tsx:216-243`).
  - «Cuánto tiempo guardamos» no menciona las 24 h (`page.tsx:270-285`).
- **Norma:** CRBV art. 28 (derecho a conocer el uso y la finalidad); SC 332/2001. La política publicada obliga por haberse publicado.
- **Arreglo:** agregar la fila, el destinatario (Anthropic, lectura asistida de documentos), la retención de 24 h y la fecha de la nueva versión (hoy dice «5 de agosto de 2026», `page.tsx:21`). La redacción la revisa el abogado.

### H3 · ENCONTRADO — La política dice que los datos se tratan en Venezuela, y no es así *(existía antes del cotizador; el cotizador lo agrava)*
- **Qué pasa:** «Tus datos identificatorios —nombre, documento, dirección y teléfono— se tratan en Venezuela» (`page.tsx:254-256`). Pero Supabase, donde vive toda la base, está en `us-east-1`, EE. UU. (`docs/legal/privacidad/inventario-terceros.md:24`, verificado el 2026-09-04). El cotizador suma otro destino en EE. UU.: Anthropic.
- **Por qué importa:** es una afirmación pública falsa sobre el propio sistema, que es el peor caso según el punto 7 del checklist.
- **Arreglo:** reescribir la sección 5 con los destinos reales (Supabase en EE. UU., Anthropic en EE. UU., el equipo de China con Shipping Mark). Lo decide el abogado.

### H4 · ENCONTRADO — La política promete «accesibles solo con tu sesión», y el cotizador no usa sesión
- **Qué pasa:** «Los documentos que subes se guardan en almacenamiento seguro, accesibles solo con tu sesión» (`page.tsx:304-305`). En el cotizador, el acceso se autoriza con un **token anónimo**, no con una sesión (`access.ts:75-78`).
- **Arreglo:** ajustar el texto, por ejemplo «accesibles solo con tu sesión o, en el cotizador sin cuenta, con el enlace temporal de tu navegador».

### H5 · ENCONTRADO — Anthropic recibe el documento entero, no solo lo necesario
- **Qué pasa:** el PDF va completo, en base64 (`anthropic.ts:41-42`), y en las hojas de cálculo que requieren lectura asistida van todas las celdas (`extract.ts:462-464`). El prompt ordena no extraer la identidad del comprador, cuentas ni firmas (`anthropic.ts:26`), lo que minimiza la **salida**, no la **entrada**.
- **Norma:** SC 332/2001 (finalidad y calidad).
- **Arreglo:** redactar automáticamente un PDF es difícil y poco fiable; la vía proporcionada es **informar** (H1) y verificar las condiciones del proveedor (H6). En hojas de cálculo sí se puede minimizar: enviar solo el rango de productos y totales cuando el parser local lo identifica.

### H6 · NO VERIFICABLE — Condiciones de Anthropic para este uso
- **Qué falta mirar:** `inventario-terceros.md:28` lista a Anthropic con contrato, subprocesadores y retención en «❓», y solo para bitácora y agentes; **no incluye el cotizador**. Falta confirmar:
  - qué retiene Anthropic de las entradas de la API y por cuánto tiempo,
  - si las usa para entrenar,
  - qué acuerdo de tratamiento de datos está aceptado en la cuenta,
  - si aplica retención cero.
- **Norma:** Ley Especial contra los Delitos Informáticos, arts. 20-22: la responsabilidad es penal y de personas; el contrato con el tercero delimita quién responde.
- **Arreglo:** que Sam o su abogado revisen los términos comerciales de la cuenta de API y agregar la fila del cotizador en `inventario-terceros.md`.

### H7 · ENCONTRADO — El visitante no puede borrar su documento antes de las 24 h
- **Qué pasa:** las acciones disponibles son `open`, `estimate`, `upload`, `uploaded`, `apply`, `save` y `confirm` (`http.ts:77-93`). No existe `delete`.
- **Norma:** CRBV art. 28 (destrucción); SC 759/2025.
- **Mitigación actual:** la retención automática de 24 h (`jobs.ts:117-130`).
- **Arreglo:** una acción «Borrar ahora» que reutilice `cleanupImports` para ese workspace, autorizada con el mismo token anónimo.

### H8 · ENCONTRADO — Datos de terceros (contactos del proveedor) sin mención
- **Qué pasa:** el borrador guarda nombre, correo, WeChat, teléfono y dirección del contacto del proveedor (`anthropic.ts:15`). La cláusula «Datos de terceros que nos aportas» solo nombra referidos y destinatarios de la entrega (`page.tsx:150-157`).
- **Norma:** CRBV arts. 28 y 60; SC 332/2001.
- **Arreglo:** incluir en esa cláusula los datos del proveedor que aparecen en los documentos que sube el usuario, con su finalidad y sus 24 h.

### H9 · ENCONTRADO (bajo) — La limpieza tiene tope por corrida
- **Qué pasa:** `cleanupImports` borra hasta 50 workspaces vencidos por corrida (`jobs.ts:120`). Con la bandera apagada solo corre el cron horario, así que si en una hora vencen más de 50, el resto espera.
- **Encendido:** el drenaje limpia en cada tick (según el comentario de `document-import-cleanup/route.ts:15-17`), y el tope no importa.
- **Arreglo:** repetir el lote mientras queden vencidos y el tiempo lo permita, o subir el tope.

## 3. Correcto (con evidencia)

- **Bucket privado sin policies** para `anon` ni `authenticated` (`0457:103-105`; ninguna policy de `storage.objects` en la migración). Solo `service_role` accede.
- **Tablas sin privilegios para la API:** `revoke all` y RLS en las siete tablas (`0457:93-99`).
- **La IP no se guarda cruda:** es un HMAC con secreto de al menos 32 caracteres (`access.ts:117-121`), y los cupos se borran a los 2 días (`jobs.ts:140`).
- **Retención con borrado real:** primero se borran los archivos del bucket y después el workspace, con cascada a versiones, comandos y jobs (`jobs.ts:117-130`; `0457:26,36,45`). El documento deja de ser accesible exactamente al vencer (`access.ts:66-74`).
- **El cron de retención no depende de la bandera:** apagar la lectura no apaga el borrado (`document-import-cleanup/route.ts:9-13`).
- **Logs sin datos:** solo un código de evento (`http.ts:99-100`), y el texto de los errores del proveedor no se guarda (`jobs.ts:107-108`, `anthropic.ts:55-56`).
- **Revisión humana obligatoria** del resultado de la IA (`anthropic.ts:85`), y el precio en firme lo cierra un asesor (`page.tsx`, descripción). No es una decisión automatizada sobre una persona (punto 10).
- **Token del visitante solo en memoria:** no se guarda en `localStorage` (`document-client.ts:22`).

## 4. No verificable (qué falta mirar y dónde)

1. **Anthropic:** retención, entrenamiento, acuerdo de tratamiento y retención cero (H6). Está en los términos de la cuenta, no en el código.
2. **Supabase:** contrato, subprocesadores, retención de respaldos y PITR. Un archivo borrado del bucket puede seguir en respaldos (`inventario-terceros.md:81-99`, ya pendiente).
3. **Vercel:** retención de logs de request. Según el código no se escriben datos personales (`http.ts:99-100`), pero la plataforma registra IP y URL.
4. **Verificación contra datos (paso 3 del método):** subir un archivo con un valor rastreable, esperar el vencimiento y buscarlo en tablas, bucket y logs. **No se hizo**, porque Preview escribe en la base de producción. Se puede hacer en local con la base de pruebas de la SDD-0479, o en producción solo con autorización nominal de Sam.
5. **Variables de Preview:** si `ANTHROPIC_API_KEY` y `DOCUMENT_IMPORT_ENABLED` existen en Preview, las pruebas desde Preview envían documentos reales a Anthropic y dejan filas en producción. Esto se revisa en el panel de Vercel.
6. **PIPL:** el flujo del cotizador no pasa por el equipo de Yiwu: los workspaces anónimos no tienen tenant y solo los ve `service_role` (`0457:19`, `0457:93-99`), así que no se ve el supuesto 1 del art. 3. Los contactos del proveedor son personas en China, pero no se les ofrecen servicios ni se analiza su comportamiento (supuesto 2). **El abogado debe confirmar que la PIPL no aplica.**

## 5. Para el abogado (fuera del alcance técnico)

- **Base de licitud del cotizador:** ¿alcanza el consentimiento informado con una casilla previa, o se apoya en la ejecución de lo que el visitante pide? Esta decisión define el texto de H1.
- **Redacción de las secciones 1, 4, 5, 6 y 7 de `/privacidad`,** y su nueva versión con fecha.
- **Términos de Anthropic** y, en general, de los proveedores en EE. UU. (Supabase, Vercel).
- **Si hace falta decir algo sobre los datos de terceros** que el usuario sube dentro de sus documentos.
- **Si la PIPL aplica o no** a los contactos de proveedores chinos que aparecen en las proformas.

## Orden sugerido antes de encender

1. H6: revisar los términos de Anthropic. Si retienen o entrenan, cambia todo lo demás.
2. H1: aviso y casilla previa, con evidencia en el servidor. Es código y lo asigna el Director.
3. H2, H3, H4 y H8: nueva versión de `/privacidad`, redactada por el abogado desde este inventario y sin prometer nada que el sistema no haga.
4. H5, H7 y H9: mejoras de código, que no bloquean si se cumplen 1 a 3.

---

*Esta revisión es un inventario técnico con evidencia, no asesoría legal. Conviene que otro modelo audite el mismo alcance como segunda opinión: un modelo no encuentra sus propios puntos ciegos.*
