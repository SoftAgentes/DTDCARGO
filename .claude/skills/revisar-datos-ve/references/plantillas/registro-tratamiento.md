# Registro de actividades de tratamiento

Documento vivo. Se llena una vez y se actualiza cada vez que agregas un campo, una
finalidad o un proveedor.

No es un trámite: es la evidencia de que sabes qué datos tratas. Cuando alguien
—un titular, un cliente empresa, un tribunal en un habeas data— pregunte, esto es
lo que enseñas.

**Quien trata los datos:** _(razón social y RIF)_
**Representante legal:**
**Contacto para titulares:** _(correo o formulario público)_
**Representante en China,** si aplica PIPL art. 53:
**Versión:** 1.0 · **Última actualización:**

---

## 1 · Qué datos tratamos

| Tabla y campo | Qué es | Sensible | Obligatorio | Finalidad | Base | Conservación | Quién más lo ve |
|---|---|---|---|---|---|---|---|
| | | sí / no | sí / no | | contrato · consentimiento · obligación legal | | |

> **Sensible** incluye: salud, origen racial, afiliación política, convicciones
> religiosas, vida sexual, identidad de género, **biométricos** (rostro, huella,
> firma tratada para identificar), perfil biológico y **geolocalización**.
>
> **Obligatorio:** si la finalidad del campo es comercial, no puede serlo. Marca
> los que están `required` sin necesidad de servicio.
>
> Si un campo no tiene finalidad clara, no lo dejes en blanco: escribe
> `sin finalidad identificada` y ponlo en la lista de candidatos a eliminar.

### 1-bis · Archivos, no solo columnas

| Bucket / carpeta | Qué guarda | Sensible | Finalidad | Conservación | ¿Se borra cuando se borra la fila? |
|---|---|---|---|---|---|
| | | | | | sí / no |

> Los documentos de identidad, recibos y fotografías casi nunca están en una
> tabla. Y el borrado de la fila casi nunca borra el archivo.

## 2 · De dónde vienen

| Origen | Qué datos | Cómo se informó al titular |
|---|---|---|
| Formulario de registro | | |
| Captura en campo (entrega, almacén, inspección) | | |
| Importación de un tercero | | |
| Fuente de acceso público (registros oficiales) | | |
| Generados por el sistema (scoring, verificación, perfil) | | |

## 3 · Titulares que no son usuarios

La tabla que casi nadie llena, y donde suele estar el mayor riesgo.

| Quién | Qué se le captura | Quién lo captura | ¿Se le avisa? | Conservación | ¿Cómo ejerce sus derechos? |
|---|---|---|---|---|---|
| Receptor de una entrega | | | | | |
| Contacto de un proveedor | | | | | |
| Contacto de emergencia de un empleado | | | | | |
| Referido | | | | | |
| Pagador tercero | | | | | |

## 4 · A dónde van

| Destinatario | Qué recibe | País | Base o mecanismo | Contrato | Qué pasa al terminar |
|---|---|---|---|---|---|
| | | | | sí / no | |

> Aquí entran el proveedor de modelos de lenguaje, el hosting, la base de datos
> gestionada, el CRM, la analítica, el monitoreo de errores, el correo
> transaccional, la mensajería, el geocodificador y **las personas externas con
> credenciales del sistema** (transportistas, contratistas, aliados). Casi siempre
> son más de los que uno recuerda.
>
> **Venezuela** no tiene régimen de transferencia internacional: la base es lo que
> se informó en la política y el consentimiento del titular. **China (PIPL)** sí
> lo tiene: si el dato sale de China hace falta consentimiento separado + informar
> al receptor + un mecanismo (evaluación CAC, certificación o contrato estándar).

## 5 · Decisiones automatizadas

| Decisión | Qué datos usa | Efecto sobre la persona | Versión del modelo/algoritmo | Se le informa | Cómo pide revisión humana |
|---|---|---|---|---|---|
| | | | | sí / no | |

## 6 · Evidencia de aceptación

| Documento | Versión vigente | ¿Se sella el texto o solo la referencia? | ¿Inmutable en la base? | ¿Append-only? | Escalón probatorio |
|---|---|---|---|---|---|
| | | | sí / no | sí / no | art. 4 · art. 17 · arts. 16 y 18 (PSC) |

> Ver el punto 11 del checklist. Si la interfaz dice "firmado" y el escalón es el
> art. 17, hay que corregir el texto de la interfaz.

## 7 · Medidas de seguridad

Describe lo que existe hoy, no lo que te gustaría tener.

- **Control de acceso:**
- **Cifrado en tránsito y en reposo:**
- **Seudonimización o anonimización:**
- **Respaldos y prueba de restauración:** _(¿cuándo fue la última vez que
  restauraste un respaldo de verdad?)_
- **Registro de accesos:**
- **Revisión periódica de la eficacia de estas medidas:**

## 8 · Menores de edad

- ¿El servicio puede ser usado por menores?
- ¿Cómo se obtiene el consentimiento de quien ejerce la patria potestad?
- ¿Se capturan datos de menores en campo (fotos, documentos)?

## 9 · Solicitudes recibidas

| Fecha | Titular | Derecho ejercido | Acuse | Respuesta | Resultado |
|---|---|---|---|---|---|
| | | acceso · conocer uso y finalidad · actualización · rectificación · destrucción · confidencialidad | | | |

> **Venezuela no fija un plazo legal.** Si la organización publica uno, se vuelve
> exigible por haberlo publicado. Anota acá el plazo publicado y mídete contra él:
>
> **Plazo de acuse publicado:** ____ · **Plazo de respuesta publicado:** ____

---

*Plantilla de apoyo, no un documento legal. Que un abogado revise el resultado.*
