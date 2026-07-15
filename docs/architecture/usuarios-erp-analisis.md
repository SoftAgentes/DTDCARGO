# Análisis de cuentas del ERP (SDD-0136)

> Entregable que el stub SDD-0136 pedía **antes** de decidir si hace falta código.
> Fecha: 2026-07-14. Fuente: consulta directa a Supabase prod (`xpfuzq`).

## Foto de las cuentas (`auth.users` = 36)

| Grupo | Cuentas | Detalle |
|---|---|---|
| **Staff ERP** (en `user_tenants`) | **8** | 2 `admin` (ambos con login) · 2 `warehouse` · 1 `operations` · 1 `accounting` · 1 `marketing` · 1 `commercial` |
| **Clientes del portal** (matchean `clients` por email) | **27** | cuentas reales de clientes |
| **Suelta** (sin cliente, con login) | **1** | ni staff ni cliente reconocido — a revisar por el founder (posible test / email viejo) |

- De los 8 staff, solo los **2 admin han entrado**; los otros 6 son **altas recientes (SDD-0140 alta unificada) sin login todavía** = invitaciones pendientes de aceptar. **No son huérfanas.**
- **0 cuentas huérfanas nunca-logueadas fuera del sistema.** La higiene de cuentas está sana (contrasta con la foto vieja de "21 users, 94% sin entrar").

## Lo que el stub proponía como posible código — YA EXISTE

`app/studio/(app)/usuarios/actions.ts` (+ RPCs) ya cubre todo el alcance borrador de 0136:

| Función propuesta | Estado | Dónde |
|---|---|---|
| Alta por rol | ✅ existe | `studio_invite_user` + SDD-0140 alta unificada (empleado+usuario+rol) |
| Reasignar rol | ✅ existe | `studio_change_user_role` |
| Baja segura (soft) | ✅ existe | `studio_set_user_disabled` con **anti-lockout** (no deja desactivar al último admin) + reactivar + guardas contra reinvitar desactivados |

## Conclusión

**SDD-0136 NO requiere código.** Se cumple su propia cláusula: "si el análisis concluye que basta con configuración, pasa a `done`/`superseded` sin desarrollo". El único ítem operativo es que el founder **eyeballee la 1 cuenta suelta** y decida si se limpia.

**Acciones (founder, opcional, sin código):**
1. Identificar la cuenta suelta (1) y borrarla si es test/obsoleta.
2. Reenviar/seguir las 6 invitaciones de staff sin login si se quiere que entren.
