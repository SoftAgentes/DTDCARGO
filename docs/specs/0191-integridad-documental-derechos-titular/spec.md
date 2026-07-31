---
sdd: "0191"
title: "Integridad documental y derechos del titular"
status: proposed
author: "Sam (founder) + Claude"
created: 2026-07-30
updated: 2026-07-30
supersedes: null
superseded_by: null
related: ["0054", "0067", "0082", "0151", "0186"]
confidencialidad: interno
---

# SDD-0191 — Integridad documental y derechos del titular

## 1. Objetivo

Cerrar los hallazgos H-1, H-3, H-5, H-9, H-10 y H-13 de
[`docs/legal/privacidad/AUDITORIA-2026-07.md`](../../legal/privacidad/AUDITORIA-2026-07.md):
que la evidencia de aceptación selle el **contenido** y no una referencia, que la
política de privacidad tenga versión y hash como el Acuerdo, que el titular tenga
un camino real para ejercer sus derechos, y que el consentimiento de cookies deje
evidencia.

## 2. Contexto legal

Venezuela **no tiene ley especial de datos personales**. Las anclas son CRBV
arts. 28 y 60, la jurisprudencia vinculante de la Sala Constitucional del TSJ
(332/2001 y 759/2025), la Ley Especial contra los Delitos Informáticos y la Ley
sobre Mensajes de Datos y Firmas Electrónicas. No hay autoridad administrativa ni
multa: el riesgo es una **acción de habeas data** ante el Juzgado de Municipio en
lo Contencioso Administrativo del **domicilio del solicitante** (SC 759/2025) y,
en los supuestos de los arts. 20 a 22 de delitos informáticos, responsabilidad
**penal**.

Detalle en
[`.claude/skills/revisar-datos-ve/references/marco-legal-ve.md`](../../../.claude/skills/revisar-datos-ve/references/marco-legal-ve.md).

**Regla heredada de [SDD-0186](../0186-audit-retention-foundation/spec.md):** no
se inventan plazos legales. Todo plazo de conservación que aparezca acá o es una
fuente verificable registrada, o es una **decisión comercial declarada como tal**.

## 3. Hallazgos que abre el gate

| Hallazgo | Evidencia | Slice |
|---|---|---|
| El hash sella `docs:[{key,version}]`, no el texto | `lib/studio/legal/types.ts:343` | A |
| `legal_docs` sin hash de cuerpo ni trigger de inmutabilidad, con policies de `update`/`delete` para admin | `supabase/migrations/0102_capa_legal.sql:262,276` | A |
| La política promete borrado y hay 753 `deleted_at`; los buckets no se tocan | `app/privacidad/page.tsx:302` · `lib/studio/storage/receipt-orphans.ts:6` | B |
| `/privacidad` y `/cookies` sin versión ni hash, fuera de `legal_docs` | `app/privacidad/page.tsx:17` · `app/cookies/page.tsx:18` | C |
| Cero endpoints de acceso, supresión o portabilidad en el Portal | búsqueda en `app/portal/`, `app/api/`, `lib/portal/` | D |
| Consentimiento de cookies solo en la cookie del navegador, sin granularidad ni versión | `lib/cookie-consent.ts:32,46` | E |
| `name-match.ts` emite veredicto sobre una persona sin registrar score ni versión | `lib/studio/identity/name-match.ts` | F |

## 4. Slices

### Slice A · Sellar el contenido (⭐ primero)

**Qué.** Que el hash de una aceptación cubra el texto exacto que el cliente vio, y
que un documento publicado sea inmutable **en la base**, no solo por norma escrita.

1. Columna `body_sha256 text` en `legal_docs`, calculada al publicar.
2. Incluirla en `canonicalDocs()` de `lib/studio/legal/types.ts`, de modo que
   `acceptanceHashPayload` selle `{key, version, body_sha256}`.
3. Trigger `legal_docs_immutable_trg` que lance excepción ante `update` o `delete`
   sobre filas con `status = 'vigente'`, con el mismo patrón de
   `legal_acceptances_immutable()` (`0102_capa_legal.sql:125`).
4. Retirar o acotar las policies `"legal_docs update by admin"` y
   `"legal_docs delete by admin"` a filas `status = 'archivada'`.

**Por qué primero.** Es barato, no depende de nadie externo y es el que más riesgo
quita: convierte en verdad la cláusula 13.1 del Acuerdo, que hoy le promete al
cliente *"huella de integridad (hash)"*. **Sin PSC y sin costo.**

**Compatibilidad.** Las aceptaciones existentes se sellaron con el payload v2. El
cambio de payload exige subir `EVIDENCE_VERSION` a 3 en
`lib/studio/legal/seal.ts` y que `acceptanceRowValid` acepte v2 (histórico,
`body_sha256` ausente) y v3 (nuevo). **No se re-sella nada:** una aceptación
pasada vale por lo que era.

### Slice B · Mapa de borrado

**Qué.** Documento —no código— que enumere todos los destinos de un dato personal
y qué pasa con cada uno: las tablas con `deleted_at`, `entity_audit_log`, los 11
buckets, las colas de outbox, el espejo de Kommo y los proveedores externos.

Por cada destino, una de tres decisiones explícitas:
- **se borra** cuando el titular lo pide;
- **se conserva** por una obligación identificada, con su fuente y su plazo;
- **se anonimiza**.

**Regla dura, heredada de SDD-0186:** si no hay fuente verificable, el destino
queda marcado `sin fundamento` y **no se inventa un plazo**. Pero a diferencia de
los eventos de auditoría —donde no purgar es el estado preventivo correcto—, aquí
`sin fundamento` sobre PII de una persona que **no es cliente** (foto del receptor
de una entrega, cuenta bancaria de un candidato rechazado) es un hallazgo abierto,
no un estado estable: choca con el principio de **temporalidad** de SC 332/2001 y
con el derecho al olvido de SC 759/2025. Se escala al founder y a la abogada.

**Prerrequisito de C y D.** Sin este mapa, cualquier botón de "eliminar" vuelve a
prometer lo que el sistema no hace.

### Slice C · Política de privacidad versionada

**Qué.** Llevar `/privacidad` al mismo mecanismo que el Acuerdo: fila en
`legal_docs` con `key = 'privacidad'`, versión, `body_sha256` y `effective_date`.
Mostrar versión y fecha en la página. Igual para `/cookies` con
`key = 'cookies'`.

Reusa [`lib/studio/legal/seal.ts`](../../../lib/studio/legal/seal.ts) y el patrón
de migración de `0213_acuerdo_servicios_v3.sql`.

**Fuera de alcance de este slice:** decidir si la política **entra al acto de
aceptación** o queda como aviso enlazado. Es decisión legal (§7).

**Corrección de arrastre:** los comentarios de `app/cookies/page.tsx:139` y
`app/privacidad/page.tsx:71` dicen *"`noindex` sin tocar"* y no hay clave `robots`
en el metadata de ninguna. Se corrige el comentario, no la conducta: las políticas
públicas **deben** indexarse.

### Slice D · Derechos en el Portal

**Qué.** Sección "Mis datos" en `app/portal/(app)/perfil/`:

| Acción | Implementación |
|---|---|
| Ver qué datos hay | Vista de solo lectura desde el registro de tratamiento |
| **Exportar** | **JSON**, nunca PDF — un PDF no es operable por otro sistema |
| Rectificar | Ya existe vía `client_change_requests` (`0220`) |
| Solicitar supresión | Nueva solicitud, atada al mapa del Slice B |
| Retirar consentimiento de marketing | Ya existe vía `newsletter_subscribers.unsubscribed_at` |

Extender `client_change_requests` con `tipo`
(`acceso | rectificacion | supresion | confidencialidad`), `acuse_at` y
`resuelto_at`.

**Lo que NO se ofrece, y por qué:** **portabilidad y oposición no son derechos
reconocidos en Venezuela**. El export en JSON se ofrece igual, pero se declara
como cortesía y no como cumplimiento de un derecho — para no prometer un marco
que no aplica.

**Plazo.** Venezuela no fija plazo legal. El que se publique se vuelve exigible
por haberlo publicado. Propuesta a validar con la abogada: **acuse en 5 días
hábiles, respuesta en 20 días hábiles**. Hoy `/privacidad` §8 dice *"un plazo
razonable"*, que no se puede auditar.

### Slice E · Consentimiento de cookies con evidencia

**Qué.**
1. Versionar el valor de la cookie (`granted:v1` / `denied:v1`) para que un
   consentimiento viejo no cubra un pixel nuevo.
2. Persistir la decisión server-side con el patrón ya probado de
   `newsletter_subscribers`: `consent_text`, `consent_at`, `consent_ip_hash`,
   `user_agent`.
3. **Decidir una de dos** — o el banner separa analítica de publicidad, o la
   política dice que van juntas. Hoy la política presenta dos categorías (§3c y
   §3d) y `updateGtagConsent` mueve las cuatro señales juntas
   (`lib/cookie-consent.ts:46`). **La segunda opción es gratis** y honesta.

### Slice F · Trazabilidad de la verificación de identidad

**Qué.** Persistir `score`, `version_algoritmo` y `verdict` de
`lib/studio/identity/name-match.ts`, y declarar el camino de revisión humana.

El diseño advisory y el umbral conservador se conservan tal cual — el hallazgo no
es el algoritmo, es que el veredicto se guarda sin poder explicar cómo salió.

## 5. Allowlist

- `docs/specs/0191-integridad-documental-derechos-titular/spec.md`
- `supabase/migrations/0297_legal_docs_body_hash.sql` *(número a confirmar contra `origin/main` al crear)*
- `supabase/tests/0297_legal_docs_body_hash.test.sql`
- `lib/studio/legal/{types,seal,queries}.ts`
- `lib/portal/change-request-{queries,types}.ts`
- `lib/cookie-consent.ts`
- `lib/studio/identity/index.ts`
- `app/portal/(app)/perfil/**`
- `app/privacidad/page.tsx` · `app/cookies/page.tsx`
- `docs/legal/privacidad/**`

No incluye: Cloud, Auth, Vercel, ni lectura de filas de negocio o PII.

## 6. Aceptación

- [ ] `update` sobre una fila `legal_docs` con `status='vigente'` **revienta** —
      test contractual SQL con **mutación**: si se quita el trigger, el test cae.
- [ ] Alterar el `body` de un documento hace que el gate **rechace** la aceptación
      por hash.
- [ ] Una aceptación sellada con payload v2 sigue validando después del cambio.
- [ ] Un cliente puede descargar sus datos en JSON desde el Portal.
- [ ] Una solicitud de supresión queda registrada con `acuse_at`.
- [ ] La cookie de consentimiento lleva versión y hay fila server-side.
- [ ] `/privacidad` muestra versión y fecha, y su hash coincide con `legal_docs`.
- [ ] `node scripts/verify.mjs` en verde.

## 7. Fuera de alcance — decisiones de la abogada

1. Si `/privacidad` y `/cookies` **entran al acto de aceptación** o quedan como
   avisos incorporados por referencia. Nota técnica: hacer **firmar** la política
   sugiere que todo el tratamiento se apoya en consentimiento, y el día que el
   titular lo retire se queda sin base lo que se necesita para operar.
2. Los plazos de acuse y respuesta a publicar.
3. Reescribir la cláusula 11.3 del Acuerdo: dice *"Derechos ARCO"*, que es
   terminología **mexicana** y no existe en el derecho venezolano; empaqueta
   marketing con servicio; y mete la transferencia internacional en la aceptación
   general.
4. Qué se conserva por obligación tributaria, mercantil, laboral y aduanera, y por
   cuánto. Sin esto el Slice B no cierra.
