# SDD-0586 10.5 · PR de textos T1 a T4 (handoff del Worker, 2026-11-08)

- **Owner:** Worker (claim `worker-0586-textos`), por encargo del Subdirector de Chatwoot, que lo trae del DG.
- **Ruta y rama:** `DTD-worktrees/0586-textos-t1-t4`, rama `codex/0586-textos-t1-t4`, base `origin/main` en `efd7e70f6`.
- **SDD:** 0586 §10.5.12 (textos) y §10.5.16 («PR de textos»).
- **Permisos:** PR en borrador, sin fusionar. Pruebas solo con turno de máquina.

## OBJETIVO ORIGINAL

Publicar T1 a T4 **palabra por palabra**, copiados de §10.5.12. Sam los aprobó el 2026-11-07 a las 04:48Z, por el Director General: «Apruebo los cuatro». Si cambia una palabra, no se publica. Es la condición para encender el chat del portal (E10-D42).

## COMPLETADO

- **T1:** `app/portal/(app)/soporte/page.tsx:200`, con `{role} · Te responde en el día hábil`.
- **T2:** `app/privacidad/page.tsx:86`, al final de la fila «Portal del Cliente», después de «pagos reportados y comunicaciones con nuestro equipo.».
- **T3:** `app/privacidad/page.tsx:218-221`, en la finalidad «Gestionar tu cuenta».
- **T4:** `UPDATED` pasa a «8 de noviembre de 2026» (`app/privacidad/page.tsx:49`), con el comentario de la aprobación de Sam, como los anteriores. **La fecha la confirma el DG antes de fusionar:** es el día en que se publique.
- **No cambian** §4 «Con quién compartimos datos» ni §6 plazos, como dice la spec.

**Comprobaciones antes de editar:**
- Ninguna PR abierta toca `app/privacidad/page.tsx`, `app/portal/(app)/soporte/page.tsx` ni `app/__tests__/privacidad-chat.test.ts`. Se revisaron las PR abiertas, archivo por archivo.
- Las líneas citadas por la spec seguían en su sitio sobre `efd7e70f6`.

**Copia exacta, comprobada a máquina:** un `node -e` extrae las tres citas de §10.5.12 de la spec y las busca en los archivos editados, con los espacios normalizados y `**…**` como `<strong>…</strong>`. Dio IGUAL en las tres, y en el lugar correcto: T2 cierra la fila y T3 cierra el `<li>`. Ya no queda el texto viejo de T1 ni el de T3.

**Pruebas:**
- `app/__tests__/privacidad-chat.test.ts`: T2 y T3 exactos y en su lugar, más la fecha nueva.
- `app/__tests__/soporte-plazo-respuesta.test.ts`, nueva: T1 exacto. Ya no dice «en el día» a secas ni la variante descartada de la opción (b).
- `app/__tests__/faq-seguimiento-coherente.test.tsx:144`: la fecha que lee en la página renderizada.

## VALIDACIÓN

Se completa al correr; hace falta turno de máquina.

## FUERA DE ALCANCE DETECTADO

Ninguno.
