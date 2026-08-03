# Evaluación previa · proveedor de respaldo externo para adjuntos

| Campo | Valor |
|---|---|
| Estado | **NO VERIFICABLE · integración bloqueada** |
| Candidatos | AWS S3 · Cloudflare R2 · Backblaze B2 · Azure Blob |
| Finalidad | Recuperación independiente de adjuntos del ERP |
| Fecha | 2026-08-01 |
| Evaluador técnico | Codex, con aprobación documental de Sam |
| SDD | [SDD-0224](../../specs/0224-adjuntos-seguros-reanudables/spec.md) |

Este documento es una evaluación técnica preliminar. No autoriza crear una
cuenta, compartir datos, configurar credenciales ni contratar un proveedor. No
es asesoría legal.

## 1 · Datos que recibiría

| Categoría | ¿Es necesaria para restaurar? | Minimización propuesta |
|---|:-:|---|
| Binario del adjunto | sí | cifrado; object key seudónimo; sin nombre original en el path |
| Tenant, entidad y versión | sí | UUID; no marca comercial, nombre, cédula ni Shipping Mark |
| SHA-256, tamaño y MIME canónico | sí | metadata técnica mínima |
| Nombre original | no para restaurar bytes | conservar solo en Postgres; no copiar como object key |
| Actor/uploader | no | conservar solo en auditoría del ERP |
| Tokens y URLs firmadas | no | prohibido enviarlos o persistirlos |

El binario puede contener identidad, firma, rostro, voz, geolocalización,
información financiera, contratos, documentos aduaneros y datos de terceros no
usuarios. Cifrar o seudonimizar el path no elimina el carácter personal del
contenido.

## 2 · Necesidad y alcance

La finalidad propuesta es restaurar evidencia cuando Supabase, una cuenta o una
operación administrativa no pueda recuperarla. La copia no se usa para
analítica, entrenamiento, publicidad ni mejora del producto del proveedor.

El servicio debe recibir únicamente bytes cifrados, object key seudónimo y
metadata técnica indispensable. La aplicación de negocio no debe entregar
perfiles completos de clientes ni payloads de entidades.

## 3 · Rol y contrato

Estado: **NO VERIFICABLE**.

Antes de conectar deben verificarse y documentarse:

- identidad legal y contacto del proveedor;
- contrato o anexo con finalidad, plazo, método, categorías y medidas;
- prohibición de uso propio de los datos;
- subcontratistas, países y mecanismo de notificación de cambios;
- devolución/exportación y eliminación al terminar;
- tiempos y evidencia de notificación de incidentes;
- acceso humano, soporte y logs administrativos;
- responsabilidad por mala configuración y exclusiones del SLA.

Para Venezuela el contrato es el mecanismo práctico para delimitar obligaciones
y responsabilidades. Para tratamiento sujeto a PIPL, el art. 21 exige pactar y
supervisar finalidad, plazo, método, categorías y medidas.

## 4 · Ubicación y transferencia

Estado: **NO VERIFICABLE**.

Se debe registrar:

- país y región primaria;
- réplicas, soporte y subcontratistas por país;
- capacidad de fijar residencia;
- nombre y contacto del receptor extranjero;
- mecanismo aplicable para salida desde China;
- forma de ejercicio de derechos frente al receptor.

Como DTD Cargo tiene operación y equipo propio en China, un adjunto tratado allí
puede quedar bajo PIPL. Cuando exista transferencia fuera de China se deben
resolver los mecanismos del art. 38 y la información/consentimiento separado del
art. 39. La evaluación de impacto previa de los arts. 55–56 también debe cubrir
datos sensibles, tercero y transferencia.

Mientras esos puntos sigan sin evidencia, la integración queda bloqueada.

## 5 · Independencia operativa

El proveedor solo califica como respaldo independiente si cumple todo lo
siguiente:

- cuenta, organización, facturación y MFA separados de Supabase y Vercel;
- credenciales write-only para backup y credenciales de restore separadas;
- ninguna credencial de borrado disponible en el runtime normal de la app;
- no sincronizar deletes del origen como eliminación de la copia protegida;
- Object Lock o inmutabilidad aplicada desde el primer PUT;
- legal hold por objeto/versión;
- logs de cambios de retención e intentos de borrado;
- restore a infraestructura nueva sin depender de Supabase.

Estado actual: **NO VERIFICABLE**.

## 6 · Integridad, retención y restore

Requisitos técnicos:

- SHA-256 end-to-end calculado nuevamente desde el objeto de origen;
- comparación de hash, tamaño y versión después de copiar;
- inventory API o manifiesto reconciliable;
- versiones anteriores preservadas;
- multipart incompleto identificado y no declarado protegido;
- simulacro de un archivo, una entidad, un tenant y pérdida total del origen;
- restore byte a byte con checksum idéntico;
- evidencia mensual de integridad y trimestral de restauración.

Objetivos de diseño aprobados por SDD-0224:

- RPO menor o igual a 1 hora;
- RTO de evidencia crítica menor o igual a 4 horas.

### Brecha específica de Backblaze B2

La documentación oficial de Object Lock indica una retención entre 1 y 3.000
días. MP-D1 usa diez años como default conservador para ciertas evidencias.
Por tanto, una configuración única de B2 Object Lock no demuestra por sí sola el
plazo completo.

Antes de elegir B2 debe probarse una de estas opciones:

1. renovación inmutable sin crear una ventana borrable;
2. legal hold gobernado con separación de privilegios;
3. una combinación contractual/técnica equivalente;
4. otro proveedor que cubra el plazo completo.

Referencia consultada el 2026-07-31:
[Backblaze Object Lock](https://www.backblaze.com/docs/cloud-storage-object-lock).

## 7 · Cifrado y claves

Estado: **NO VERIFICABLE**.

Preguntas obligatorias:

- ¿cifra en tránsito y reposo?;
- ¿permite claves administradas separadamente?;
- ¿quién rota, revoca y recupera las claves?;
- ¿un administrador del proveedor puede descifrar?;
- ¿la pérdida de la cuenta Supabase afecta las claves del backup?;
- ¿cómo se restaura si el gestor principal de secretos también está caído?;

## 8 · Costos y salida

Antes de contratar deben simularse:

- costo mensual de almacenamiento y versiones;
- egress de restore parcial y total;
- operaciones API, inventarios y legal hold;
- soporte urgente durante desastre;
- exportación completa manteniendo hashes, versiones, locks y timestamps;
- eliminación o devolución comprobable al terminar el contrato.

Estado: **NO VERIFICABLE**.

## 9 · Veredicto

- [ ] Adelante
- [ ] Adelante con condiciones
- [x] **No conectar todavía**

Motivos:

1. no hay proveedor, cuenta, región ni contrato verificados;
2. no se resolvió transferencia desde China;
3. no se demostró retención de diez años;
4. no existe restore drill con checksum;
5. ningún proveedor ha demostrado todavía que pueda satisfacer RPO/RTO.

El gate se reabre únicamente con evidencia contractual, técnica, de privacidad y
de restauración. La revisión legal corresponde a un abogado.

## 10 · Comparativo técnico actualizado

| Opción | Inmutabilidad | Antivirus | Nivel gratuito útil | Ajuste al worker actual | Veredicto |
|---|---|---|---|---|---|
| AWS S3 + GuardDuty | Object Lock WORM por versión | administrado; 1.000 objetos y 1 GB/mes de scanning en free tier | limitado; storage/requests aparte | alto | ⭐ preferida con control de costos |
| Cloudflare R2 + ClamAV | bucket locks | autogestionado | 10 GB-mes Standard + operaciones/egress incluidos | requiere adaptar lock + operar AV | económica con trabajo adicional |
| Backblaze B2 + ClamAV | Object Lock sin recargo específico | autogestionado | primeros 10 GB | API S3 compatible, pero lock máximo 3.000 días | no cubre diez años por sí sola |
| Azure Blob + Defender | WORM/immutability | administrado por GB | no asumido | requiere adaptador nuevo | alternativa empresarial |

**Recomendación técnica:** AWS S3 Object Lock en modo Compliance más GuardDuty
Malware Protection for S3. Coincide con el contrato del worker, evita operar
firmas AV y puede cubrir diez años. Antes de contratar: presupuesto, región,
contrato, transferencia VE/China y restore drill.

La alternativa de menor costo es R2 + ClamAV, pero no se debe confundir
“software gratis” con servicio administrado: DTD asumiría VPS, actualizaciones,
colas, disponibilidad, alertas y respuesta a incidentes.
