# No-Olvidar — Manual del admin (SDD-0025)

Política operacional de la caja fuerte interna. Los admins pueden aprobar recoveries y rotar la
KEK — es un rol de máxima confianza. Este documento es la fuente de verdad de **quién** es admin,
**qué** hacer ante incidentes y **dónde** están los backups.

> Este archivo va a git (es política, no secreto). **NUNCA** poner acá la KEK, passwords,
> recovery kits ni valores de secrets — solo referencias a dónde/quién.

---

## 1. Admins actuales

Mínimo 3 (para que M-of-N = 2 funcione aunque uno sea el solicitante).

| Nombre | Rol en DTD | Contacto (fuera de banda) | `user_id` | Admin desde |
|---|---|---|---|---|
| _(founder)_ | Founder | _(teléfono)_ | `<uuid>` | _(fecha)_ |
| _(socio)_ | Socio | _(teléfono)_ | `<uuid>` | _(fecha)_ |
| _(IT)_ | IT / Ops | _(teléfono)_ | `<uuid>` | _(fecha)_ |

> Completar al asignar los admins (runbook §4). Mantener actualizado.

Para ver los admins reales en la DB:

```sql
select user_id, role, created_at
from public.no_olvidar_user_keys
where role = 'admin';
```

---

## 2. Backups offline de la KEK

| Copia | Responsable | Ubicación física | Versión KEK | Fecha |
|---|---|---|---|---|
| USB #1 | Founder | _(caja fuerte / banco)_ | `v1` | _(fecha)_ |
| USB #2 | Socio | _(caja separada)_ | `v1` | _(fecha)_ |

- Cada rotación de KEK **exige rehacer ambos backups** y actualizar esta tabla.
- Verificar físicamente los USB al menos una vez al año (que sigan legibles).

---

## 3. Procedimiento: un admin deja DTD

Cuando un admin se va de la empresa (o pierde la confianza del rol):

1. **Quitarle el rol admin** de inmediato:
   ```sql
   update public.no_olvidar_user_keys set role = 'member' where user_id = '<uuid_saliente>';
   ```
2. **Asignar un reemplazo** para no bajar de 3 admins (runbook §4).
3. **Rotar la KEK** (runbook "Rotación de KEK"): el saliente pudo haber visto/copiado material.
   Re-envolver todos los items con la KEK nueva.
4. **Revisar el audit** de los últimos meses del saliente:
   ```sql
   select created_at, action, item_id, metadata
   from public.no_olvidar_access_log
   where user_id = '<uuid_saliente>'
   order by created_at desc;
   ```
5. Si tenía un **USB de backup de la KEK**, recuperarlo o considerarlo comprometido → la rotación
   del paso 3 ya lo invalida como acceso a los items nuevos.
6. Registrar el cambio en las tablas de arriba.

---

## 4. Procedimiento: se sospecha un breach

Ante cualquier indicio de compromiso (credenciales filtradas, acceso raro, alerta de anomalía):

1. **Rotar la KEK inmediatamente** (runbook). No esperar.
2. **Revisar el audit log** por accesos anómalos:
   ```sql
   select created_at, user_id, action, ip_address, metadata
   from public.no_olvidar_access_log
   where created_at > now() - interval '30 days'
   order by created_at desc;
   ```
   Buscar: ráfagas de `view`, `unlock` repetidos, IPs nuevas, accesos fuera de 06:00–23:00 VET.
   (El sistema ya levanta un banner de anomalías a los admins — `audit.getAnomalies`.)
3. **Notificar al founder** por canal seguro.
4. Si un user específico está comprometido, forzarle **re-2FA** (su sesión expira sola a los 30
   min) y considerar resetear su acceso vía recovery.
5. Documentar el incidente (fecha, indicio, acciones) — abajo.

---

## 5. Procedimiento: recovery M-of-N

Ver [recovery-procedure.md](recovery-procedure.md). Regla de oro: **verificar la identidad del
solicitante fuera de banda antes de aprobar.** Ante la duda, rechazar y escalar.

---

## 6. Anomalías que el sistema señala solo

`audit.getAnomalies` (banner para admins) detecta en las últimas 24 h:

- **≥5 `view`** del mismo item en 1 min → posible scraping.
- **≥3 `unlock`** de un user en 5 min → posible fuerza bruta del 2FA.
- **Accesos fuera de 06:00–23:00 VET** → posible compromiso.
- **IP nueva** (no vista en 30 días) → revisar.

No bloquean nada — son para revisión humana. Actuar según §4 si algo no cuadra.

---

## 7. Bitácora de incidentes

| Fecha | Tipo (breach / admin-baja / recovery dudoso) | Qué pasó | Acciones | Quién |
|---|---|---|---|---|
| | | | | |

---

## Recordatorio permanente

El No-Olvidar **no** sustituye higiene operacional. Asumí que cualquier secreto ahí adentro podría
filtrarse por cámara externa al monitor, malware en la máquina del user, o colusión total de
admins. La estrategia es **detección y contención rápida** (audit inmutable + alertas + rotación),
no prevención absoluta. Nunca le digas al equipo "los screenshots están bloqueados" — no lo están.
