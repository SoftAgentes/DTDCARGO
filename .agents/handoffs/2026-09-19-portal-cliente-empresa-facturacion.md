# Handoff · SDD-0487 — el perfil del cliente: foto, empresa y «Facturar a nombre de»

| Campo | Valor |
|---|---|
| Fecha | 2026-09-19 |
| Owner / sesión | Worker Claude `dtdcargo-74` · claim `claude-dtdcargo74-0487` |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\portal-cliente-empresa-facturacion` |
| Rama / base | `codex/portal-cliente-empresa-facturacion`, desde `origin/main` `0a48b956` (con la #153) + cherry-pick de la reserva `12d192d4` |
| SDD | [0487](../../docs/specs/0487-portal-cliente-empresa-facturacion/spec.md) · `in-progress` |
| Migración | `0466_client_billing_identity` (reservada por dtdcargo-18) |
| Estado de tarea | en-progreso |
| Permisos | Sam autorizó commits y publicar la rama. Antes de abrir la PR hay que reportar a dtdcargo-18. **No** merge, deploy ni aplicar 0466. Nada de producción salvo lectura de catálogo. |

## Objetivo

- El cliente encuentra y cambia su foto.
- Agrega su empresa (o, si se registró como empresa, sus datos personales).
- Elige a nombre de quién se le factura.
- El Studio sella ese titular al emitir; las facturas emitidas no cambian.

## Decisiones de Sam

Están en la spec, con sus respuestas literales del 2026-09-19. En resumen:
- mockup aprobado;
- razón social y RIF obligatorios;
- una cuenta de empresa puede facturar a nombre personal;
- nada gasta cupo;
- RIF repetido: bloquear y avisar;
- el Studio puede cambiar el titular en el borrador;
- «Quitar foto» y «Quitar empresa»;
- purga a 90 días.

## Coordinación

- dtdcargo-18 aprobó:
  - el plan de la 0466 (sello en la base, sin ALTER de `clients`);
  - migrate-first con gate de símbolos;
  - el peor caso de locks, con aplicación en baja actividad.
- Worker de SDD-0488 (Cobranzas, 0467):
  - sus RPC no escriben el titular y su preflight no mira triggers;
  - su `void_collection_receipt` devuelve `parcial` → `emitida`, por eso el sello sólo corre desde `borrador`;
  - su semilla sin cliente sigue funcionando porque el trigger no falla sin ficha.

## Completado

- **Migración 0466:**
  - identidad secundaria y preferencia;
  - unicidad del documento entre clientes en los dos sentidos;
  - sello del titular en la base (cubre la RPC 0128) e inmutabilidad del titular emitido;
  - RPC del Portal por sesión;
  - lectura del Studio para accounting, admin y commercial;
  - DELETE para la purga.
- **Portal:**
  - foto de perfil visible (112/128 px, cámara de 44 px, botón de 48 px);
  - JPEG preparado en el navegador y sin metadatos en el servidor;
  - «Quitar foto»;
  - «Mi empresa» o «Tus datos personales», con pantalla propia;
  - «Facturar a nombre de»;
  - aviso al asesor con los Shipping Marks ante un bloqueo;
  - el PDF imprime el domicilio fiscal.
- **Studio:**
  - «Titular de la factura» en el borrador, con la vista «Así sale en la factura»;
  - ficha del cliente con la empresa y la preferencia;
  - el PDF imprime el domicilio.
- **Cron:** purga de intentos bloqueados a 90 días.
- **Privacidad:**
  - revisión revisar-datos-ve;
  - registro de tratamiento y mapa de borrado;
  - `/privacidad` en un commit aparte (`8c5c6c6a`), con el texto aprobado por Sam el 2026-09-19: «Apruebo el texto de privacidad».

## Validación

Está en la spec (§Verificación). En resumen:
- contrato de 0466: 45 aserciones, control rojo, preflight y 9/9 mutantes SQL;
- 10/10 mutantes TypeScript;
- Vitest del Portal, del Studio, del cron y de la copia legal en verde;
- typecheck, ESLint, rsc-boundary, símbolos (0 rojos, 2 amarillos), docs, sdd, components y governance: PASÓ;
- `/ui-check` con ajustes aplicados.
- Pendiente: `pnpm verify` completo, con turno del Director.

## Pendientes de esta tarea

1. `pnpm verify` completo, con turno de dtdcargo-18.
2. Reportar a dtdcargo-18 antes de abrir la PR, y después abrirla.
3. ~~OK de Sam sobre el texto nuevo de `/privacidad`~~: aprobado el 2026-09-19, «Apruebo el texto de privacidad».
4. OK nominal de Sam para `0466_client_billing_identity`. Migrate-first estricto: la aplica dtdcargo-18 en baja actividad, antes de integrar.
5. Smoke de Sam tras integrar:
   - agregar una empresa de prueba y elegir «a nombre de mi empresa»;
   - emitir un borrador de ese cliente en el Studio y ver el titular y el domicilio en el PDF;
   - intentar el RIF de otra ficha de prueba;
   - cambiar y quitar la foto desde la PC.
6. SDD-0487 a `done` sólo tras 4 y 5.
7. SDD-0482 a `done` cuando Sam confirme su smoke (pedido el 2026-09-19): se registra en esta PR.

## Fuera de alcance detectado

- El EXIF en la foto de la cédula (`lib/portal/client-photo.ts`, `uploadClientPhoto`): mismo patrón que tenía el avatar. Es un documento de identidad y lleva su propia decisión.
- El registro de empresa guarda el nombre del contacto en `clients.notes` en vez de `contact_name` (`app/registro/actions.ts`, alta del cliente).
- El borrado lógico de un cliente (0455) no alcanza Storage: la foto de perfil y la de identidad quedan.
- Dos cuentas que facturan a la misma empresa: hoy el asesor fusiona o corrige las fichas (decisión de Sam).
- La foto de perfil sólo se ve en `/portal/perfil`, no en el encabezado del Portal.
- El empresa-registrado no tiene dónde cargar el domicilio fiscal de su empresa principal: sólo la identidad secundaria lo lleva.
- Si el equipo de Yiwu lee hoy `clients.rif` en el Studio: NO VERIFICABLE, requiere revisar RBAC y RLS en producción.
