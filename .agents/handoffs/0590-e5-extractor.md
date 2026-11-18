# SDD-0590 · paso 5.3: extractor incremental con instante de corte (handoff)

Rama `codex/0590-e5-extractor`, worktree `DTD-worktrees/0590-e5-extractor`, desde `main` en `5373e6c81`.

## Encargo y puertas

- Sam, en el chat del Subdirector, el 2026-11-06 ~06:05Z: «¿Podemos ir trabajando con el resto del historial de Kommo?». Se avisó al Director General con esas palabras y la propuesta de seguir bajo SDD-0590.
- **Solo código y pruebas en local.** Sin token, sin llamar a Kommo, sin VPS ni producción.
- **Puertas que siguen siendo de Sam:**
  - correr el extractor contra Kommo, porque hace falta el token;
  - leer `clients` para 5.4, porque es PII;
  - crear la bandeja «Archivo Kommo» en Chatwoot;
  - el ensayo en copia (5.6);
  - la carga en producción (5.7).

## Qué quedó

`respaldar-historial.py` 1.2.0 con el modo incremental (`--base`, `--corte` y `--solape-horas`), 12 pruebas nuevas y 11 mutantes que caen. El detalle está en SDD-0590 §9 y el uso, en el README de la carpeta.

## Pendiente

- ~~La respuesta del Director General.~~ Hecho: va bajo SDD-0590, y la PR del 5.3 es la #386, en borrador.
- **5.4 y 5.5:** en la rama local `codex/0590-e5-vinculo`, encima de la #386 y sin subir, quedaron:
  - `extraer --corte`, completa hasta el corte;
  - `vincular`;
  - `preparar-carga`;
  - 49 pruebas y 26 mutantes.

  El diseño y lo que mide el ensayo están en SDD-0590 §10.
- **Cargador de Rails (5.5):** `cargar-archivo-kommo.rb` y `pruebas/prueba-cargador.sh` (sonda, generador inventado y overlay) están en la misma rama local, commit `34c50f43f` y siguientes. **La prueba en Docker no se ha corrido.** El turno de Docker del 2026-11-06 se cortó antes de levantar el stack: al encender Docker Desktop arrancaron solos los contenedores de loop-3d y el commit libre bajó de 6.058 a 771 MB. Se cerró Docker Desktop entero, y el turno volvió al Director General.
- **Director General, 2026-11-06 ~07:00Z:** correr la prueba en GitHub Actions, no en la PC ni en el VPS. Workflow con `pull_request` y `paths: infra/ops/kommo-historial/**`, sin secretos ni variables del repositorio, sin token y sin pedirle nada a Kommo, con los mutantes ahí mismo. La rama sube como PR en borrador apilada sobre la #386. Aceptó el salto de los números de conversación, con la condición de anotar en la spec el número antes y después de la carga.
- **Hecho para eso:** `.github/workflows/kommo-historial-cargador.yml`, el control M0 y 24 mutantes (`escenario-mutante.rb`). El cargador y la sonda se separaron para correr un escenario en un solo arranque de Rails. No choca con «Calidad continua»: esa corre solo contra `main`, y su contrato mira solo `quality.yml` e `infra/ops/tests`.
- **Pendiente de Sam:** quién entra como miembro del Archivo. Sin miembros, solo lo ven los administradores (SDD-0590 §10.9). En producción se agrega desde el panel, después de la carga.
- **Pendiente de esta tarea:** leer el CI de la PR.
- **Ensayo 5.6 (plan A, aprobado por el Director General el 2026-11-06 dentro del OK de Sam):** rama `codex/0590-e5-ensayo`, apilada sobre la #391 y en el worktree `DTD-worktrees/0590-e5-ensayo`.
  - Trae `ensayo-archivo.sh` (la copia efímera de la base de Chatwoot de producción, en tmpfs y aislada), `pruebas/sonda-ensayo.rb`, `pruebas/prueba-ensayo.sh` (la prueba contra una «producción» simulada, en el mismo workflow), y la spec §10.10 y §10.11.
  - Medido en solo lectura: producción tiene 2 cuentas y ningún rol de solo lectura.
  - **Pendiente:** leer el CI de esa PR. El ensayo real espera el token, la sonda incremental, la completa hasta el corte, la foto del ERP y el archivo de carga.
  - **Decidido por el Director General el 2026-11-06:**
    - la completa va con `--sin-adjuntos`;
    - la copia de las 2 cuentas se acepta, con la cuenta 2 (la de prueba) borrada de la copia antes de cargar (O1 y O2);
    - correos en 0, medido (SMTP1).
  - **Abierta, de Sam:** adjuntos en Chatwoot. Diseño de la 5.5b en la spec §10.12, sin programar hasta su respuesta. Si dice que sí antes de la completa, va una sola bajada en ese modo. Al cargar en producción, anotar en la spec el número de conversación antes y después (`HECHO secuencia=antes->después`).
- **Para decidir antes de producción:** el salto en los números de conversación, quién ve el Archivo y la búsqueda de mensajes viejos (SDD-0590 §10.9).
- **Primera corrida con token** (puerta de Sam): medir si Kommo acepta `filter[updated_at]` en notas y tareas (SDD-0590 §9.2).
- La fila 5.3 del checklist no se tocó.

## FUERA DE ALCANCE DETECTADO

- El README decía «17 pruebas»: eran 24 desde la #342. Corregido a 36.
