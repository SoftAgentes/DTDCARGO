# No-Olvidar — Runbook de operación (SDD-0025)

Pasos operacionales (NO código). **Sin esto el No-Olvidar no está seguro por más bien que esté
implementado el crypto.** Requiere acceso al SQL Editor de Supabase con rol de superusuario.

> Orden macro: **(0)** pasar el code review crypto → mergear → **(1)** aplicar migraciones →
> **(2)** crear la KEK → **(3)** backup offline → **(4)** asignar admins → **(5)** configurar →
> **(6)** verificar.

---

## 0. Prerequisito duro: code review crypto

No se despliega nada hasta pasar el review externo (§7.6). Ver [review-bundle/README.md](review-bundle/README.md).
Bundle listo con `node scripts/no-olvidar-review-bundle.mjs`.

---

## 1. Aplicar migraciones

Aplicar en orden, con OK explícito del founder (regla dura: migraciones a prod nunca en automático):

1. `supabase/migrations/0017_no_olvidar.sql` — schema, RLS, audit inmutable, RPCs base.
2. `supabase/migrations/0224_no_olvidar_hardening.sql` — RPCs atómicos (increment + create_kek_secret).

Prereq: la extensión **`vault`** de Supabase habilitada (para el KEK) y **`pgcrypto`** (para
`gen_random_bytes`, normalmente en el schema `extensions`).

Verificación mínima tras aplicar:

```sql
-- 6 tablas creadas
select tablename from pg_tables where tablename like 'no_olvidar%' order by 1;
-- audit log inmutable: estas policies deben existir con USING(false)
select polname from pg_policies where tablename = 'no_olvidar_access_log';
-- RPCs presentes
select proname from pg_proc where proname like 'no_olvidar%' order by 1;
```

---

## 2. Crear la KEK inicial (una sola vez)

⚠️ **La KEK se guarda en Vault como base64 de 32 bytes.** El código (`key-manager.ts`) la lee con
`fromBase64`, así que el secret DEBE ir en base64 — NO bytea crudo. *(La spec §7.1 muestra
`gen_random_bytes(32)` sin `encode(...)`; usar la forma de abajo, con `encode`.)*

```sql
-- 1) crear el secret en Vault (base64 de 32 bytes aleatorios)
select vault.create_secret(
  encode(extensions.gen_random_bytes(32), 'base64'),
  'no_olvidar_kek_v1',
  'KEK maestra del No-Olvidar DTD-CARGO — NO ELIMINAR'
);

-- 2) registrar la versión activa (poné el uuid del founder en created_by)
insert into public.no_olvidar_kek_versions (version, kek_secret_name, status, created_by, notes)
values (1, 'no_olvidar_kek_v1', 'active', '<founder_uuid>', 'KEK inicial creada en el deploy');
```

Verificar:

```sql
select length(decode(decrypted_secret, 'base64')) as bytes  -- debe dar 32
from vault.decrypted_secrets where name = 'no_olvidar_kek_v1';

select public.no_olvidar_get_active_kek_version();  -- debe devolver 1
```

---

## 3. Backup OFFLINE de la KEK (paso que salva la empresa)

Sin esto, un evento catastrófico en Supabase = pérdida total del No-Olvidar, irrecuperable.

1. **Founder** exporta el valor base64 del secret y lo guarda en un **USB físico cifrado**
   (VeraCrypt o equivalente), junto con la fecha y la versión (`v1`).
2. **Un socio** hace lo mismo en un **USB separado**.
3. Los dos USB van a **cajas físicas separadas** (caja fuerte, caja bancaria…).
4. Registrar en [admin-handbook.md](admin-handbook.md): quién tiene cada USB y la fecha.

Para obtener el valor a respaldar:

```sql
select decrypted_secret from vault.decrypted_secrets where name = 'no_olvidar_kek_v1';
```

> Tratá ese string como el activo más sensible de DTD. No lo pegues en chat, mail ni notas.

---

## 4. Asignar admins iniciales (mínimo 3)

M-of-N default = 2. Con solo 2 admins, si uno necesita recovery, el otro queda con 1 voto y no
alcanza. **Mínimo 3.**

```sql
update public.no_olvidar_user_keys
   set role = 'admin'
 where user_id in ('<founder_uuid>', '<socio_uuid>', '<it_uuid>');
```

(La fila en `no_olvidar_user_keys` la crea automáticamente el trigger al registrarse el usuario
con `tenant = 'dtd-cargo'`; si no existe, el usuario aún no pasó por el alta.)

---

## 5. Configurar `no_olvidar_config`

Los defaults ya vienen sembrados por la migración. Ajustar solo si hace falta:

```sql
update public.no_olvidar_config set
  recovery_approvals_required = 2,
  session_timeout_minutes     = 30,
  failed_attempts_lockout     = 5,
  lockout_minutes             = 15,
  require_2fa                 = true,
  clipboard_clear_seconds     = 30,
  reveal_auto_hide_seconds    = 3,
  hold_to_reveal              = true,
  blur_on_window_blur         = true,
  forensic_watermark          = true,
  block_copy_event            = true,
  char_by_char_reveal         = false,
  updated_by                  = '<founder_uuid>'
where id = 1;
```

---

## 6. Verificación final

- [ ] `no_olvidar_get_active_kek_version()` → `1`
- [ ] `vault.decrypted_secrets` tiene `no_olvidar_kek_v1` con 32 bytes al decodificar base64
- [ ] ≥ 3 filas con `role = 'admin'` en `no_olvidar_user_keys`
- [ ] Backup offline de la KEK hecho por founder + socio, registrado en el handbook
- [ ] Un intento de `update`/`delete` sobre `no_olvidar_access_log` FALLA (incluso con service_role)

Prueba de inmutabilidad del audit (debe dar 0 filas afectadas / error de policy):

```sql
update public.no_olvidar_access_log set action = 'view' where true;   -- 0 filas
delete from public.no_olvidar_access_log where true;                  -- 0 filas
```

---

## Rotación de KEK (cada ~12 meses o ante sospecha de breach)

Recomendado anual, o **inmediato** si se sospecha compromiso. El flujo está en el código
(`key-manager.rotateKek` + `reEncryptAllItems`), disparado por un admin desde la UI de admin
(Fase 3). Manualmente el orden es:

1. `rotateKek(actor)` → genera `no_olvidar_kek_v{n+1}` en Vault (vía RPC `no_olvidar_create_kek_secret`),
   marca la vieja `legacy`, registra `kek_rotated` en el audit.
2. `reEncryptAllItems(fromVersion, toVersion)` → re-envuelve el DEK de cada item con la KEK nueva
   (NO re-cifra el payload). Idempotente.
3. Cuando 0 items quedan en la versión vieja, marcarla `revoked` (no se borra).
4. **Rehacer el backup offline** de la KEK nueva (paso 3 de arriba) y actualizar el handbook.

> No borrar nunca una versión de KEK vieja mientras existan items que la usen: se perderían.
