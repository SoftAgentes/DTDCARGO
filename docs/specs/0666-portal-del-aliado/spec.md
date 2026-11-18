---
sdd: "0666"
title: "Portal del aliado: sus clientes, prealertas y marca blanca en hailuway.com"
status: proposed
author: "Claude Worker (Sam)"
created: 2026-11-18
updated: 2026-11-18
supersedes: null
superseded_by: null
related: ["0042", "0177", "0255", "0258", "0336", "0443", "0531", "0646", "0654", "0663"]
confidencialidad: interno
---

# SDD-0666 — Portal del aliado

> El aliado tiene un portal con extras: registra a sus clientes y subaliados, les hace prealertas y ve su cuenta por trabajo. Sus clientes finales tienen su propio portal con la marca del aliado, sin nada de DTD, en una dirección de `hailuway.com`.
> **Estado:** `proposed`. Solo spec: sin código ni migración. **El primer entregable es una maqueta navegable** que Sam aprueba antes de programar. Los números de migración los da el Director General.
> **Hermana:** la parte del Studio (sección Aliados, asignar códigos, estado de cuenta por trabajo) está en la [SDD-0663](../0663-subaliados-como-jobs/spec.md).
> Etiquetas: **C** código leído · **D** documento del repo · **I** inferencia · **NV** sin verificar.
> Los ejemplos usan nombres genéricos: «aliado A» (prefijo `AA`) y «subaliado M» (prefijo `MD`).

## 1. Pedido

Es la pieza que el programa «Aliados DTD» dejó prevista en julio de 2026 (`docs/marketing/adquisicion.md` §2c y §7; `docs/marketing/oferta-borradores.md` §4): un espacio propio del aliado, con lectura del tracking de sus clientes y codificación de letras propia. Sam la precisó el 2026-11-18:

- El portal del aliado es distinto al de un cliente normal: tiene una sección para registrar a sus clientes o subaliados y hacerles prealertas.
- Sus clientes finales pueden entrar a su propio portal con la marca del aliado.

## 2. Decisiones de Sam (2026-11-18)

### 2.1 Quién entra y qué hace

| Tema | Decisión |
|---|---|
| Quién usa el portal del aliado | Solo el aliado principal; los subaliados no tienen acceso propio |
| Usuarios del aliado | Varios. Los crea el propio aliado; todos con los mismos permisos |
| Datos al registrar un cliente | Nombre y teléfono |
| Fichas de sus clientes | Puede editar nombre y teléfono; no borra ni cambia códigos |
| Cliente final | Tiene acceso propio, con la marca del aliado |
| Invitación del cliente final | La hace el aliado, por link |
| Prealertas | Las crea el cliente final y también el aliado a su nombre |
| Dinero para el cliente final | Nada por ahora. Se deja la base para que más adelante el aliado ponga su precio de facturación a cada cliente |
| Avisos automáticos | Solo al aliado; nada al cliente final |
| Entrega en Venezuela | Depende del aliado: dato en su ficha (retira el aliado / DTD entrega al cliente final) |
| Términos para el cliente final | Ninguno de DTD; responde el aliado. El acuerdo con el aliado tiene que decirlo (abogado de Sam) |

### 2.2 Dirección web

| Tema | Decisión |
|---|---|
| Dominio | `hailuway.com`, de Sam, en Cloudflare, sin nada montado y sin enlace visible con DTD Cargo |
| Dirección de cada aliado | Las letras de su código junto a `hailuway.com`. Se diseña como subdominio (`aa.hailuway.com`); confirmar con Sam la forma exacta antes de configurar |
| Quién entra por ahí | El aliado, sus usuarios y sus clientes finales. Los clientes directos de DTD siguen en `dtdcargo.com` |
| Subaliado | Usa la marca y la dirección del aliado principal |
| `hailuway.com` sin letras | Página neutra de ingreso, sin marca de DTD |
| Correo de ingreso | Sale de `hailuway.com` con el nombre del aliado |
| QR de etiquetas y link del proveedor | Apuntan a la dirección del aliado |
| Más adelante | El dominio propio del aliado, que da acceso para configurarlo |

### 2.3 Aspecto gráfico

| Tema | Decisión |
|---|---|
| Qué personaliza el aliado | Logo, nombre y un color principal, cargados por él en su portal. El sistema corrige el color si no contrasta |
| Diseño base del cliente final | La versión simple del portal (SDD-0654), sin dinero ni nada de DTD |
| Seguimiento del cliente final | Etapas y fecha estimada; sin contenedor, buque, naviera ni mapa |
| Inicio del aliado | Resumen: clientes, cargas en camino por contenedor, prealertas pendientes y saldo con DTD, con accesos a registrar cliente y hacer prealerta |
| Pie de página | Solo el nombre del aliado |
| Etiquetas de cajas | Solo código corto y QR, sin logo de nadie |
| «Mis clientes» | Por cliente: carga con su etapa, m³ y lo que DTD le facturó al aliado por ese cliente |
| Antes de programar | Maqueta navegable que Sam aprueba |

## 3. Lo que hay

| Hecho | Fuente | Etiqueta |
|---|---|---|
| El portal es 1 usuario : 1 cliente: `unique(auth_user_id)` y `unique(tenant_id, client_id)` en `client_users`, y 36 políticas RLS de igualdad escalar, 12 de escritura | SDD-0255 §2 | D |
| La marca del portal se resuelve por el usuario autenticado y toma el aliado **directo** del cliente | SDD-0336, `get_portal_brand()` (migr 0401, 0451); `lib/studio/aliados/brand-resolve.ts` | D, C |
| Web, portal y Studio son una sola aplicación en `dtdcargo.com` | `docs/architecture/stack-tecnico.md` | D |
| `NEXT_PUBLIC_SITE_URL` (por defecto `dtdcargo.com`) arma los links de ingreso, comprobación de correo, registro por link y referidos | `app/entrar/actions.ts`, `lib/portal/correo-comprobacion.ts`, `lib/portal/registro-link-types.ts`, `app/portal/(app)/referidos/actions.ts` | C |
| El link del proveedor (`/p/[token]`) y `/verificar` cuelgan de ese dominio | `app/p/[token]/page.tsx`, `app/verificar/page.tsx` | C |
| Prealertas del cliente: sección «Compras», con etiquetas que ya usan la forma impresa del código de aliado | `app/portal/(app)/compras/`; `lib/studio/prealertas/types.ts`; SDD-0443 | C, D |
| Versión simple del portal | `app/portal/(app)/_simple/`; SDD-0654 | C, D |
| Invitación al portal por link | SDD-0646 | D |
| No existe la cláusula de tratamiento de datos para aliados | SDD-0255 §8.5 | D |

## 4. Propuesta

### 4.1 Portal del aliado

El portal de un cliente más un bloque «Aliado» que solo ve quien es aliado raíz:

- **Inicio de aliado** con el resumen de su operación.
- **Mis clientes**: sus clientes directos y, agrupados, los de cada subaliado. «Registrar cliente» (nombre, teléfono y a quién pertenece; el código lo da `next_markbox_aliado`) y «Registrar subaliado» (nombre comercial y letras; mismas guardas de prefijo que el Studio; ficha ancla sin correo). Editar nombre y teléfono.
- **Prealertas**: el flujo de «Compras» con un paso previo «¿Para quién es?».
- **Cuenta por trabajo**: el estado de cuenta por trabajo de la SDD-0663, con PDF completo o de un trabajo.
- **Mi marca**: logo, nombre y color.
- **Usuarios**: invitar y quitar a sus empleados.

### 4.2 Portal del cliente final

Sobre la versión simple del portal, con el menú recortado: Inicio, Mis envíos, Prealertas, Etiquetas y Mi perfil.

- Ve: marca del aliado, su código en forma impresa, sus envíos por etapa con fecha estimada, prealertas, etiquetas y el contacto del aliado.
- No ve: marca de DTD, tarifa, facturas ni estado de cuenta de DTD, club, referidos, academia, número de contenedor, buque, naviera ni mapa.
- No pasa por el gate de aceptación legal de DTD.

### 4.3 Base para el precio del aliado (se diseña, no se muestra)

Dónde guardaría el aliado su precio por cliente o por envío, separado de las facturas de DTD y sin acceso de DTD a esa cuenta. Se define el modelo para que la pantalla de dinero se encienda después sin rehacerlo. No se construye en esta spec.

### 4.4 Cómo se hace sin abrir huecos

- **No se tocan las 36 políticas del portal.** Todo lo del aliado va por RPC `security definer` que derivan la identidad de `auth.uid()` (patrón de `get_portal_brand()`): listar mis clientes, registrar cliente, registrar subaliado, editar nombre y teléfono, crear prealerta a nombre de, y leer envíos de mis clientes. Cada una comprueba que el cliente cuelga de la cadena del aliado que llama.
- El aliado no reporta pagos ni cambia direcciones de entrega de sus clientes (SDD-0255 §8.4).
- **Varios usuarios por aliado**: migración propia sobre `client_users`, con el amarre del primer ingreso cubierto (SDD-0258 §6.1: `portal_bind_session` resuelve con `limit 1` entre invitaciones que comparten correo).

### 4.5 Marca blanca técnica en `hailuway.com`

- **Marca por host**: el aliado se resuelve por la dirección antes del login, además de `get_portal_brand()` después. Un usuario que entra por la dirección de otro aliado no pasa.
- **La marca sube al aliado raíz.** Hoy se toma el aliado directo del cliente; con la decisión de Sam, un subaliado usa la marca de su raíz. Afecta portal y comprobantes.
- **URL base por petición**: los cuatro usos de `SITE_URL`, el link del proveedor, `/verificar` y el QR toman la dirección del aliado.
- **Sesión**: las cookies no cruzan dominios; el ingreso y el callback de Supabase Auth necesitan `hailuway.com` y sus direcciones en la lista de redirecciones permitidas.
- **Marca que sube el aliado**: validar formato y tamaño del logo, contraste del color y Storage por tenant. La oficina tiene un «restablecer marca» en el Studio.
- **Infraestructura** (tarea de ops con OK de Sam, fuera de esta spec): registro comodín en Cloudflare hacia el servidor, certificado comodín y dominio de envío de correo en `hailuway.com` (SPF y DKIM).
- **Dominio propio del aliado**, más adelante: el mismo mecanismo, con una tabla de hosts por aliado.

## 5. Fases

| Fase | Qué entrega | Migración |
|---|---|---|
| M | Maqueta navegable (Artifact privado y copia en `maqueta/`, sin nombres reales). Sam la aprueba | No |
| P1 | Estado de cuenta por trabajo en el portal (función de la SDD-0663 F3) | No |
| P2 | Mis clientes y registrar cliente o subaliado | Sí (RPC) |
| P3 | Prealerta a nombre de un cliente | Sí (RPC) |
| P4 | Varios usuarios por aliado | Sí |
| P5 | Marca por host en `hailuway.com`, página neutra, URL base por petición y correo | Posible |
| P6 | Portal del cliente final e invitación por link | Sí |
| P7 | Mi marca (logo, nombre, color) | Sí (Storage) |

Dependen de la SDD-0663 F1 a F3.

## 6. Requisitos antes de producción

- Nombre y teléfono de clientes de un tercero son datos personales: pasa por `.claude/skills/revisar-datos-ve/SKILL.md`.
- Hace falta la **cláusula de tratamiento de datos para aliados** (SDD-0255 §8.5) y que el acuerdo con el aliado diga que él responde ante su cliente final. Es tarea legal de Sam; frena la salida a producción, no la construcción.
- La infraestructura de `hailuway.com` necesita el OK de Sam.

## 7. Por confirmar con Sam

- La forma exacta de la dirección del aliado (`aa.hailuway.com`).

## 8. Fuera de alcance

- Acceso propio de los subaliados.
- Avisos automáticos al cliente final y plantillas con la marca del aliado.
- Mostrar dinero al cliente final.
- El dominio propio de cada aliado.
- Consultas o cambios en producción.

## 9. Aceptación de esta spec

- [ ] Sam aprueba la spec.
- [ ] Sam aprueba la maqueta navegable (fase M).
- [ ] El Director General asigna las fases y los números de migración.
