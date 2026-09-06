# PR27 · foto de identidad y respuesta incierta

- Task: pr27-identity-photo-uncertain-response-20260906.
- Owner/sesión: 01a07370-bf34-7252-a63d-186ed7d4a407.
- Worktree: C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/pr27-photo-uncertain-response-20260906.
- Rama: codex/pr27-photo-uncertain-response-20260906.
- Base PR27 verificada por ls-remote: 82fc49ff0a81c88929fdd0493ded27e9e8c1f0a2.
- Base remota portalcliente: 4289efc317c060620a7de9335030e9cd612d9aec.
- Main verificado: 74bb52ab9677f96908cc032a15f2364ab9d94716.
- SDD: 0439-portal-cliente-edicion-de-perfil, in-progress.
- Estado: lista para revisión independiente, sin publicación.

## OBJETIVO ORIGINAL

Evitar borrar una foto referenciada cuando portal_set_identity_photo termina
su commit pero se pierde la respuesta. Reconciliar con autoridad server-side;
la incertidumbre no autoriza borrar ni afirmar éxito.

## Alcance y adopción

Instrucciones vigentes de AGENTS, Worker, runbook y reglas técnicas leídas desde
checkout principal (74bb52ab); sustituyen el procedimiento histórico presente
en esta base. Harness del principal invocado desde el nuevo worktree para
guard y claim, sin copiar archivos ni integrar main. No se toca PR30/fixture26268.
Allowlist de esta corrección: actions.ts y IdentityPhotoAction.test.ts del
perfil, spec0439 y este handoff. Sin PR26/0446, UI, schema ni cambios0447.
Autorizados tests focales offline y commits selectivos locales; no push, main,
Cloud, datos reales, build ni verify masivo mientras otro Worker tiene el slot.

## Aceptación

- Commit con respuesta perdida nunca deja puntero sin objeto por rollback.
- Rechazo explícito sin commit limpia sólo el objeto nuevo autorizado.
- Lectura fallida/concurrente o autoridad incierta conserva y no afirma éxito.
- Mantener sesión/principal, tenant/prefijo, guard de reemplazo, cuota y primera foto.
- RED en base y GREEN con SDK real y transporte simulado offline; cleanup fallido.

## COMPLETADO

La respuesta incierta conserva el objeto y reconcilia por el cliente nuevamente
resuelto por sesión, id, tenant, markbox y deleted_at. Sólo el mismo puntero
confirmado permite éxito. La lectura null/distinta después de transporte fallido
no permite cleanup: una transacción puede seguir en vuelo. Un rechazo exacto
PostgreSQL/HTTP4xx y una lectura autorizada sin referencia a la carga nueva sí
permiten limpieza; remove error/throw devuelve soporte, sin éxito falso.
Logs nuevos sólo tienen reason estable, sin paths ni error SQL crudo.

Allowlist de rechazo y fundamento: P0001 para bloqueo0447, cuota y cliente
inexistente; 22023 para path inválido/objeto inexistente; 42501 para sesión.
Son RAISE EXCEPTION sin manejador que continúe el commit en 0445:345-386 y
0447:35-38. Código+mensaje exactos y HTTP4xx se exigen juntos; no se confía en
substring, error genérico, excepción fetch ni HTTP500. Postlectura null no
prueba ausencia de referencia futura por sí sola. La certeza usada en cleanup
es el rechazo de ESA mutación junto al UUID generado server-side, no una
promesa de atomicidad entre SELECT y Storage. No se reenvía el setter.

## VALIDACIÓN

Evidencia del auditor en
DTD-backups/director-goal-20260905/profile-chain-evidence/storage-results.json
y storage-runner.cjs; SDK real con fetch offline y Storage espía, no DB real.

| Comprobación | Resultado |
|---|---|
| RED actions82fc49ff + nuevos tests | FALLÓ esperado: 14 fallos/7 pasan; commit-response-loss elimina objeto comprometido |
| GREEN inicial SDK real | PASÓ 21/21 |
| Final SDK real + cuota | PASÓ 27/27: 24 identidad + 3 cuota, 2 archivos |
| ESLint dos archivos y diff --check | PASÓ |
| docs:check, governance:check, components:check | PASÓ, 28 políticas/5 fuentes |
| TypeScript noEmit | PASÓ exit 0; handle95975 terminal, log sin errores |
| build/verify masivo y Cloud/E2E hosted | NO EJECUTADO: encargo focal, slot reservado a PR28 y sin permiso Cloud |

Los tests usan Supabase2.106.1 real con fetch totalmente offline y helper upload
real. Simulan commit confirmado antes de perder respuesta, commit posterior a
lectura null, lectura denegada/throw/fila ausente/retirada/concurrente, cambio de
tenant/mark/cuenta, errores parecidos no autorizados, rechazo0447/cuota y cleanup
error/throw. Primera foto con remaining_count0 y payloads hostiles conserva
identidad/prefijo server-side. No prueban transacción real PostgreSQL ni sesión
hosted. Evidencias RED/GREEN/logs/JSON bajo
`C:/Users/AKX generator/Desktop/Developer/DTD-backups/pr27-photo-uncertain-response-20260906`.

Dependencias propias: pnpm install --frozen-lockfile --ignore-scripts PASÓ;
node_modules directorio real, lockSHA256
22C6DA9D75CA6423471AE0C8CBB406165858D73606A2F46B927C3CFCEB261678 intacto.
El junction inicialmente creado a engineering-director-worker se retiró sólo
como enlace tras validar identidad y ausencia de procesos consumidores propios,
por instrucción del Director; su target no se modificó. Sin .env ni secretos.

## Privacidad y gobernanza de esta corrección

Inventario acotado: clients.cedula_photo_path y objeto privado client-docs son
foto de documento para verificación; tenant_id/markbox/id scopean la cuenta,
deleted_at permite rechazar una cuenta retirada. Base jurídica, plazos de
retención y accesos reales no se verifican con esta simulación.

| Estado | Evidencia |
|---|---|
| CORRECTO | actions.ts:125 revalida cliente de sesión; :143 compara tenant/prefijo/retirada; :150 conserva puntero comprometido |
| CORRECTO | actions.ts:159 exige rechazo exacto y :172 retira sólo up.path; :112 conserva incertidumbre sin falso éxito |
| NO VERIFICABLE | SQL y Storage reales, retención/hold/acceso regional y operaciones posteriores; no se accedió a Cloud |

ERR-01/SGE-00: cumplimiento para estado honesto y recuperación a soporte;
UPL-01/MP-01: cumplimiento acotado a compensación segura, retención regional
sigue no conformidad contenida por0447. AUD-01: no cambia la transacción ni su
evento SQL; AUD-02: logs nuevos minimizados. A11Y/UI no aplica, sin cambio visual.
Revisión técnica, no asesoría legal ni declaración global de cumplimiento.

## COMMITS

Código y pruebas: d7717861936bb2b4a5538c76811d2e2a9df3bcac.
Actualización del resultado TypeScript: commit documental que contiene esta
versión; SHA final comunicado al Director. Código inmutable enviado al auditor.

## PR / BRANCH

Corrección para PR27; rama aislada arriba. No publicación autorizada.

## PENDIENTES DE ESTA TAREA

Revisión independiente por auditor asignado y validación combinada que coordina
Director. No repetir verify individual: Director reservó próxima pesada para
la combinación PR26+23+27 después de revisión y SHAs finales.

## FUERA DE ALCANCE DETECTADO

Retención/purga/hold regional siguen sin activarse; conservar contención0447.
En lectura de cierre PID26268 ya no estaba disponible; esta tarea no lo detuvo
ni modificó fixture/worktreePR30. Informado al Director, sin reinicio unilateral.

## HANDOFF AL DIRECTOR

Se solicita revisión independiente del SHA final, especialmente allowlist SQL,
revalidación de autoridad y carrera postlectura. No integración automática.
Auditor 01a073c1-7226-76a1-b60e-810754458ad0 recibió d7717861 y evidencia;
su revisión sigue pendiente al registrar este cierre técnico. Claim se libera
tras commit documental y se retoma si el auditor solicita corrección. Conservar
worktree/dependencias propias; liberación no autoriza limpieza.
