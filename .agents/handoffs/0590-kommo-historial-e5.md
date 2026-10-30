# Handoff — SDD-0590 · E5 «Historial de Kommo», pasos 5.1 y 5.2 (programa SDD-0582)

- **Owner:** Claude Worker (sesión lanzada por el Director «CRM Chatwoot»), claim `claude-0582-e5`
- **Ruta:** `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\nostalgic-ishizaka-d59700`
- **Rama:** `codex/0582-e5-historial`, base `origin/main` `6d022e94b` (E0 ya integrada)
- **SDD:** 0590 (hija de la 0582), reservada el 2026-10-30 con `sdd:next --reserve kommo-historial-e5` (stub `cd25b03ce`, traído por cherry-pick)
- **PR:** [SoftAgentes/DTDCARGO#342](https://github.com/SoftAgentes/DTDCARGO/pull/342), borrador contra `main` (rama publicada con push normal, autorizado por el encargo)
- **Objetivo:** 5.1 (respaldo completo del historial de Kommo, cifrado con `age`, fuera de Git, en el VPS) y 5.2 (volumen por año y tipo, actividad en 12 meses, estimación de carga y tamaño en Chatwoot, revisar-datos-ve y recomendación de alcance), sin pausar entre ellos. **No** se carga nada en Chatwoot: eso es 5.3 en adelante y lleva otro OK de Sam.
- **Aceptación:** filas 5.1 y 5.2 en `entregado` con evidencia PASÓ / FALLÓ / NO EJECUTADO; script en el repo; respaldo `.age` en el VPS con sha256; informe de conteos sin datos personales; recomendación «todo» o acotado con el porqué.
- **Alcance:** `infra/ops/kommo-historial/`, `docs/specs/0590-kommo-historial-e5/`, filas 5.1 y 5.2 de `docs/specs/0582-chatwoot-piloto/checklist.md`, este handoff, `docs/specs/README.md` (índice generado). No se toca Chatwoot, Meta, la base de producción de Studio ni ningún otro módulo.
- **Permisos de esta tarea:** lectura de Kommo con datos personales (OK de Sam, abajo). Publicar rama y PR en borrador: autorizado por el encargo. Sin merge ni despliegue. Nada pesado sin turno del Director (hay cola de `pnpm verify`).

## Autorizaciones registradas

- Sam, 2026-10-30, por el selector (texto que pasó el Director): «¿Qué historial de Kommo pasamos a Chatwoot (bandeja "Archivo Kommo", solo lectura)?» → **«Todo el historial»**. «¿Autorizas leer el historial de Kommo (con datos personales) para medir el volumen y preparar esa carga?» → **«Sí, autorizo la lectura»**. Cubre leer y contar; el alcance «todo» es la preferencia de Sam y lo confirma el Director con los números. No cubre cargar en Chatwoot.

## Estado

| Paso | Estado | Qué hay | Qué falta |
|---|---|---|---|
| 5.1 | en curso | Script `infra/ops/kommo-historial/respaldar-historial.py` con 17 pruebas (verde local y en el VPS); copia en `/srv/ops/kommo-historial/`; destino `/srv/backups/kommo/`; cifrado para `/srv/ops/backup/age-recipients.txt` (Sam-2026-10-29 y Emergencia-2026-10-29) | El token de larga duración de la integración «DTD 0582 historial (solo lectura)»: lo genera Sam en Kommo y lo pega con `pegar-token-kommo-e5-0582.ps1` (notas compartidas). Ensayo corto, corrida completa, sha256 y manifiesto |
| 5.2 | en curso | `informe` del script (conteos por año y tipo, actividad 12 meses, estimación Chatwoot); revisar-datos-ve redactado en la spec §6 (inventario, 12 puntos, retención propuesta) a falta de los conteos | Correrlo sobre el respaldo; completar §5 y §6 con los números; recomendación §7 |

## Lo que se hizo en sistemas externos

- VPS (lectura y archivos propios): `ls` de `/srv/ops`, `/srv/backups`, `/dev/shm`; herramientas; prueba de round-trip de `age` con llave efímera en `/dev/shm`; copia de `infra/ops/kommo-historial/` a `/srv/ops/kommo-historial/` (0700); carpeta `/srv/backups/kommo/` (0700). No se tocó `/dev/shm/k0582` (54 bytes, de otra sesión, no es un token de Kommo).
- Kommo: nada todavía (el token no ha llegado).

## Cierre

Pendiente: se completa al terminar 5.2.
