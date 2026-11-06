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

- La respuesta del Director General: SDD, orden y si la PR se abre ahora o espera.
- **5.4 y 5.5, en código:** E.164, vínculo con el ERP y deduplicación; modo de importación sin efectos, bandeja «Archivo Kommo» y cargador. Después del 5.3.
- **Primera corrida con token** (puerta de Sam): medir si Kommo acepta `filter[updated_at]` en notas y tareas (SDD-0590 §9.2).
- La fila 5.3 del checklist no se tocó.

## FUERA DE ALCANCE DETECTADO

- El README decía «17 pruebas»: eran 24 desde la #342. Corregido a 36.
