# Revisión de datos personales · Perfil con empresa y facturación (SDD-0487)

- **Fecha:** 2026-09-19
- **Alcance:** lo que agrega la SDD-0487. Diseño revisado sobre `main` `3f810366` y la rama de la SDD-0482; la implementación, en la rama `codex/portal-cliente-empresa-facturacion`.
- **Método:** skill `revisar-datos-ve`. Estados: `ENCONTRADO`, `CORRECTO` y `NO VERIFICABLE`. Cada afirmación lleva archivo y línea, o se declara no verificable. Nada se ejecutó contra producción, salvo una lectura de catálogo sin filas: la RPC 0405, la columna `avatar_path` y la configuración del bucket `client-docs`.
- **Para qué sirve:** es insumo técnico para que Sam decida con su abogada. **No es asesoría legal.**

## 1 · Resumen

| Estado | Puntos |
|---|---:|
| ENCONTRADO | 7 |
| CORRECTO | 3 |
| NO VERIFICABLE | 5 |

Marco aplicable: Venezuela (CRBV arts. 28 y 60, SC 332/2001, SC 759/2025, Ley
Especial contra los Delitos Informáticos arts. 20 a 22). La PIPL aplica en la
medida en que el equipo de Yiwu vea estos datos desde China (punto 8).

## 2 · Inventario de lo nuevo o tocado

| Tabla · campo | Qué es | Finalidad | Base | Conservación | Quién más lo ve |
|---|---|---|---|---|---|
| Empresa del cliente · razón social | Nombre de la empresa; en una firma personal es el nombre de una persona | Titular de la factura | Contrato + obligación tributaria | Mientras la cuenta exista; congelada en cada factura emitida | Equipo VE (Studio) · la factura |
| Empresa del cliente · RIF | RIF; si empieza por V o E identifica a una persona natural | Titular de la factura; unicidad entre clientes | Contrato + obligación tributaria | Igual | Equipo VE · Libro de Ventas |
| Empresa del cliente · domicilio fiscal (opcional) | Dirección; en una firma personal suele ser la de la persona | Sale impreso en la factura | Contrato + obligación tributaria | Igual | Equipo VE · la factura |
| Identidad personal de una cuenta registrada como empresa · nombre y cédula | Datos de la persona que opera la cuenta | Titular de la factura cuando elige «a mi nombre» | Contrato | Mientras la cuenta exista | Equipo VE |
| Preferencia «Facturar a nombre de» | persona / empresa | Titular por defecto al emitir | Contrato | Mientras la cuenta exista | Equipo VE |
| `invoices.client_name`, `client_rif`, `client_doc_kind` (0392) + domicilio fiscal (nuevo) | Titular congelado al emitir | Comprobante fiscal | Obligación tributaria | 🔵 CONSERVA; el plazo lo fija la abogada (`docs/legal/privacidad/mapa-de-borrado.md:106-108`) | Equipo VE · el cliente en el Portal |
| Elección del titular en el borrador (Studio) | Qué titular eligió el operador y si difiere de la preferencia | Trazabilidad | Obligación tributaria + interés legítimo | Igual que la factura | Auditoría |
| `client_profile_blocked_attempts` (0462) · nuevo campo `company_rif` | Intento bloqueado, **sin el valor** | Anti-enumeración y aviso al asesor | Interés legítimo en seguridad | ⬜ sin plazo (`registro-tratamiento.md:34`) | Servidor · asesor (sólo Shipping Marks) |
| `clients.avatar_path` + objeto `client-docs/{tenant}/{markbox}/avatar/*` (0199) | Foto de perfil: la propia imagen, normalmente el rostro | Identificar la cuenta en el Portal | Consentimiento (la sube el titular) | ⬜ | Servidor · el propio cliente (URL firmada, 1 h) |

## 3 · Hallazgos (por gravedad)

### H1 · ENCONTRADO · la foto de perfil se guarda con sus metadatos EXIF, GPS incluido

- **Evidencia:** `lib/portal/client-photo.ts:119-121` sube los bytes originales del archivo (`Buffer.from(await file.arrayBuffer())`, `contentType: file.type`). Una foto tomada con el teléfono suele llevar la ubicación GPS en el EXIF.
- **Por qué importa:** es geolocalización (dato sensible según el checklist, punto 1) escondida dentro de una foto cosmética, sin finalidad. SC 332/2001: finalidad y calidad.
- **Arreglo en 0487:** el navegador vuelve a codificar la foto a JPEG con canvas, lo que descarta el EXIF. El servidor además quita los segmentos APP1 del JPEG antes de subirlo, porque no puede confiar en el navegador. Con eso quedan resueltos también el tope de 4,5 MB de Vercel y el HEIC que sólo muestra Safari.
- **Fuera de alcance:** la foto de la cédula tiene el mismo patrón (`client-photo.ts:77-79`). Lleva su propia decisión, porque es un documento de identidad.

### H2 · ENCONTRADO · el cliente no puede quitar su foto de perfil, sólo reemplazarla

- **Evidencia:** `app/portal/(app)/perfil/AvatarEditor.tsx:55-86` sólo ofrece subir, y `avatar-actions.ts:26-86` sólo actualiza.
- **Por qué importa:** la foto es la propia imagen (CRBV art. 60), y la destrucción es un derecho (CRBV art. 28; SC 759/2025).
- **Arreglo en 0487:** acción «Quitar foto», que borra el objeto del bucket y deja `avatar_path` en `null`.

### H3 · ENCONTRADO · la foto de perfil no está en el registro de tratamiento ni en el mapa de borrado

- **Evidencia:** `docs/legal/privacidad/registro-tratamiento.md` y `mapa-de-borrado.md` no mencionan `avatar` (0 coincidencias).
- **Por qué importa:** CRBV art. 28: conocer el uso y la finalidad.
- **Arreglo en 0487:** una fila en §1 del registro y en el mapa de borrado.

### H4 · ENCONTRADO · la política pública no dice que se tratan datos de la empresa del cliente para facturar

- **Evidencia:** `app/privacidad/page.tsx:168-170` sólo menciona que se envían «comprobantes o facturas».
- **Por qué importa:** SC 332/2001: el consentimiento es informado sólo si la política dice la verdad. No se inventa texto: se deriva del inventario de §2.
- **Arreglo en 0487:** una línea en «Para qué usamos tus datos», con el texto revisado por Sam: la razón social, el RIF y el domicilio fiscal que agregas se usan para emitir tus facturas y quedan en ellas.

### H5 · ENCONTRADO · el registro como empresa guarda el nombre del contacto en texto libre

- **Evidencia:** `app/registro/actions.ts:270-275` escribe `notes: "Contacto: …"`, aunque existe `clients.contact_name` (`lib/studio/client-types.ts`, SDD-0131).
- **Por qué importa:** el titular no puede ver ni rectificar un dato enterrado en `notes`. SC 332/2001: calidad.
- **Relación con 0487:** la identidad personal de una cuenta de empresa nace vacía, y se le pide al cliente en el Portal.
- **Fuera de alcance:** corregir el registro.

### H6 · ENCONTRADO · el borrado de un cliente no alcanza sus fotos en Storage

- **Evidencia:** `supabase/migrations/0455_borrado_cliente_auditado.sql` no referencia Storage, `avatar_path` ni `cedula_photo_path`.
- **Por qué importa:** CRBV art. 28 (destrucción) y SC 759/2025.
- **Fuera de alcance:** ya está en `mapa-de-borrado.md` §9 para `client-docs`. Aquí se agrega el avatar.

### H7 · ENCONTRADO · los intentos bloqueados no tienen plazo de conservación, y 0487 los reusa

- **Evidencia:** `docs/legal/privacidad/registro-tratamiento.md:34` dice «sin plazo definido».
- **Por qué importa:** SC 332/2001: temporalidad. El límite anti-enumeración sólo mira 24 h.
- **Arreglo en 0487:** Sam decidió el 2026-09-19 que se borren a los 90 días. Se implementa en el cron diario de purga. Después de aplicar y desplegar, el registro de tratamiento pasa a «90 días».

## 4 · Correcto (con evidencia)

- **C1 · Mensaje genérico ante un dato de otra ficha.** No revela que el dato exista: `lib/portal/profile-direct-edit.ts:89-90` (rama de 0482). 0487 lo reusa para el RIF de la empresa.
- **C2 · El intento bloqueado se guarda sin el valor intentado, y el asesor sólo recibe Shipping Marks.** Migración `0462` (tabla `client_profile_blocked_attempts`) y `registro-tratamiento.md:34`.
- **C3 · La factura congela el titular al emitir.** Una corrección posterior no reescribe comprobantes: `app/studio/(app)/facturacion/actions.ts:376-380` y `:547-550`, y migración `0392`. 0487 extiende lo congelado al titular elegido y al domicilio fiscal.

## 4.1 · Qué resolvió la implementación

- **H1:** `lib/portal/avatar-image.ts` recodifica la foto a JPEG en el navegador, y `lib/portal/jpeg-metadata.ts` quita APP1 (EXIF/XMP), APP13 y COM en el servidor (`app/portal/(app)/perfil/avatar-actions.ts`).
- **H2:** `removeAvatarAction` borra el objeto y después el puntero.
- **H3:** filas nuevas en `registro-tratamiento.md` y en `mapa-de-borrado.md`.
- **H4:** una línea nueva en `/privacidad`, pendiente del OK de Sam sobre el texto.
- **H7:** el cron `purge-throttle` borra a los 90 días; el DELETE lo da la 0466.
- **Requisitos:**
  - la empresa no se sincroniza con Kommo;
  - lectura sólo para accounting, admin y commercial (RLS de la 0466);
  - la auditoría del override queda sin PII (contrato de la 0466, mutante incluido).

## 5 · Requisitos de diseño derivados (van a la spec)

1. Kommo recibe hoy `rif` y `doc_kind` (`supabase/functions/kommo-push-client/index.ts:158`). La empresa y el domicilio fiscal de 0487 **no** se agregan a Kommo, por minimización (punto 8).
2. Los datos fiscales de la empresa se muestran sólo en pantallas VE del Studio (clientes y facturación), no en módulos CN (PIPL: tratamiento en China).
3. El Portal pide «tu nombre y tu cédula» a la persona que opera la cuenta, no los de un tercero (punto 12).
4. El override del titular en el borrador se audita sin PII: tipo elegido, preferencia vigente, actor y hora.

## 6 · No verificable

- Si el equipo de Yiwu puede leer hoy `clients.rif` en el Studio. Hay que revisar RBAC y RLS por rol en producción.
- El cifrado en reposo del proyecto Supabase, que depende del panel.
- La policy de Storage de `0091`: lectura y borrado para miembros del tenant sin distinguir VE de CN (`mapa-de-borrado.md` §9). Producción no se revisó.
- Si la empresa que carga el cliente es realmente suya. El bloqueo sólo cubre el RIF de otra ficha, no el de una empresa ajena que nunca se registró. La verificación contra SENIAT (`lib/studio/identity`) queda como decisión aparte.
- El borrado verificado contra datos reales (paso 3 de la skill): no se ejecutó, porque requiere un entorno con datos y autorización.

## 7 · Fuera de alcance (abogada)

- El plazo de conservación de las facturas y del domicilio fiscal congelado.
- La redacción final de la política pública.
- Si facturar a una empresa exige alguna declaración de representación.

Esto no es asesoría legal. Conviene pedir una segunda revisión con otro modelo.
