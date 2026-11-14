# SDD-0612 y SDD-0610 · Decisiones de Sam registradas (2026-11-14)

Solo documentos. Anota en las dos specs fusionadas las respuestas de Sam, dadas en la pantalla del
Subdirector SEO y relatadas al Director General, que las reconfirma.

- **0612 (avisos de Paperclip):** D1, D2, D4, D5 y D6 decididas con el texto elegido.
- **0610 (resumen del CRM):** D1, D2, D4, D5, D6, D8 y D9 decididas con el texto elegido.
- **Reconfirmadas por Sam el 2026-11-14** en el chat del Director General, texto literal
  «Sí, confirmo las tres decisiones»: 0612-D3 «Con título», 0610-D3 «Modelo de lenguaje» y 0610-D7
  «Solo sumarla». Ahora son decisiones de la spec.

## Reconciliaciones hechas en esta tarea (revisión independiente de d3c9258a3)
- 0612: Decisión 4, formato del resumen, paso de prueba, privacidad y criterio 2 ya dicen «con título»;
  el cómo se limita fue la pregunta D3b (a título tal cual, b recortado y sin datos, c solo tareas
  internas); Sam eligió (b) el 2026-11-14 («(b) Recortado, sin datos»).
- 0610: la regla «clasificador determinista» y «por qué no un modelo» dicen que D3 prevalece y el
  determinista queda como línea base; `privacidad.md` marca que D7 se decidió sin consulta.
- `docs/legal/privacidad/inventario-terceros.md`: Discord recibiría títulos de tareas.

## Pendiente de esta tarea
- Ninguno: D3b quedó decidida (b); el código de avisos con título ya se puede escribir en su PR.

## FUERA DE ALCANCE DETECTADO
- 0610-D3 «Modelo de lenguaje» reabre la medición previa y la revisión de privacidad propia en la
  PR de código; el inventario de terceros deberá contar al proveedor del modelo cuando se elija.

Allowlist: las dos specs, `docs/specs/0610-resumen-crm-marketing/privacidad.md`,
`docs/legal/privacidad/inventario-terceros.md` y este handoff. `docs:check` PASÓ; sin verify ni vitest.
