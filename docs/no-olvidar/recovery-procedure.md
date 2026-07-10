# No-Olvidar — Procedimiento de recovery M-of-N (SDD-0025)

Qué hacer cuando un empleado pierde el acceso al No-Olvidar (olvidó la master password y/o perdió
el recovery kit). El recovery es **custodial con doble firma**: hacen falta **2 admins distintos**
(configurable, `recovery_approvals_required`) para restablecer el acceso. Ningún admin puede
hacerlo solo, y **nadie puede aprobar su propio pedido**.

---

## Cuándo aplica cada capa

1. **Solo olvidó la master password, tiene el recovery kit** → el user se restablece con las 24
   palabras BIP39. No necesita admins.
2. **Perdió master password Y recovery kit** → recovery admin M-of-N (este documento).
3. **Perdió acceso y además está bloqueado por intentos fallidos** → igual: el recovery limpia el
   lockout.

> En V1 los items se cifran con el KEK (del servidor), no con la master password. Por eso
> restablecer la master password **restaura el acceso completo** — el admin nunca ve los items,
> solo habilita el reset.

---

## Flujo paso a paso

### Paso 1 — El user solicita el recovery

- Entra a `/studio/no-olvidar/recovery` (o el endpoint público si está deslogueado).
- Completa el **motivo** (mínimo 20 caracteres — los admins lo necesitan para decidir).
- Al enviar se crea un pedido `pending` con vencimiento a **24 h** y queda registrado en el audit
  (`recovery_requested`).

### Paso 2 — Los admins revisan y aprueban (necesitan 2)

- Cada admin entra a `/studio/no-olvidar/admin` → cola de recoveries pendientes.
- **Verificar la identidad del solicitante por un canal fuera de banda** (llamada, en persona) —
  no aprobar solo porque el pedido existe. El motivo ayuda pero no alcanza.
- Si es legítimo → **Aprobar**. Si no → **Rechazar** (con razón).
- Reglas que el sistema fuerza:
  - Un admin **no puede aprobar su propio** pedido.
  - Un admin **cuenta una sola vez** (aprobar dos veces no suma).
  - Con `recovery_approvals_required` aprobaciones el pedido pasa a `approved`.

### Paso 3 — El user fija su nueva master password

- Cuando el pedido está `approved`, el user ve "tu recovery fue aprobado" y define una **nueva
  master password** (mínimo 12 caracteres, 3 de 4 clases: mayúscula/minúscula/número/símbolo).
- Al confirmar (`executeRecovery`): se resetea el verifier + salt, se limpian intentos fallidos y
  lockout, y el pedido queda `completed`. Se registra `recovery_executed` en el audit.
- El user vuelve a entrar con su nuevo password + su 2FA TOTP de siempre.

### Paso 4 — Cierre

- Confirmar con el user que puede entrar.
- Si el motivo fue un dispositivo perdido/robado, considerar además una **rotación de KEK**
  (ver [runbook.md](runbook.md)) si hay sospecha de que algún secreto pudo quedar expuesto.

---

## Estados del pedido

| Estado | Significa |
|---|---|
| `pending` | Esperando aprobaciones (o vencimiento a 24 h) |
| `approved` | Alcanzó el quórum; el user ya puede fijar la nueva master password |
| `completed` | El user ya reseteó su acceso |
| `rejected` | Un admin lo rechazó |
| `expired` | Pasaron 24 h sin quórum |

---

## Señales de abuso (cuándo NO aprobar)

- El solicitante no confirma su identidad fuera de banda.
- Pedidos repetidos en poco tiempo para el mismo user (ver el audit).
- El motivo no tiene sentido o presiona por urgencia sospechosa.
- Un admin insiste en que aprobes rápido sin verificar → doble chequeo.

Ante la duda, **rechazar** y escalar al founder. Un recovery mal aprobado es acceso indebido a
los secretos de otra persona.

---

## Rastro de auditoría

Todo el flujo queda en `no_olvidar_access_log` (inmutable): `recovery_requested`,
`recovery_approved` (los rechazos quedan como `recovery_approved` con `metadata.rejected = true`),
`recovery_executed`. Para revisar un caso:

```sql
select created_at, action, metadata
from public.no_olvidar_access_log
where action like 'recovery_%'
order by created_at desc;
```
