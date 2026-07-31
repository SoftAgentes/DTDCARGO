---
sdd: "0192"
title: "POD sellado y aviso al receptor"
status: proposed
author: "Sam (founder) + Claude"
created: 2026-07-30
updated: 2026-07-30
supersedes: null
superseded_by: null
related: ["0029", "0030", "0054", "0067", "0070", "0186", "0191"]
confidencialidad: interno
---

# SDD-0192 — POD sellado y aviso al receptor

## 1. Objetivo

Cerrar los hallazgos H-2, H-4 y H-6 de
[`docs/legal/privacidad/AUDITORIA-2026-07.md`](../../legal/privacidad/AUDITORIA-2026-07.md):
que la prueba de entrega sea **inalterable**, que la persona a la que se le toma
la foto, el documento y la firma **sepa quién se los toma y para qué**, y que esos
datos **caduquen**.

## 2. La tensión que gobierna esta spec

Reforzar la prueba y proteger los datos empujan en direcciones opuestas. Más
fotos y más documentos = mejor defensa ante un reclamo **y** mayor exposición. No
se resuelve eligiendo un lado: se resuelve capturando lo justo, **sellándolo** para
que valga, **avisando** a quien se le captura y **borrándolo** a tiempo.

Por eso el orden de los slices no es negociable: **A antes que C**, y **B antes
que C**. Ampliar la captura sin sellarla ni avisarla sube el riesgo en vez de
bajarlo.

## 3. Contexto legal

**La firma dibujada en pantalla no equivale a la firma autógrafa.** Falla dos de
los tres requisitos del art. 16 de la Ley sobre Mensajes de Datos y Firmas
Electrónicas: un trazo **sí** puede producirse más de una vez, y **sí** puede
falsificarse copiándolo. Cae en el **art. 17**: *elemento de convicción valorable
conforme a las reglas de la sana crítica*.

Pero el **art. 4** manda promover los mensajes de datos como **pruebas libres**, y
bajo sana crítica el juez pesa **el conjunto**. La estrategia correcta no es
certificar la firma del receptor —imposible: un certificado de PSC por persona en
la puerta— sino el **haz convergente** que ya se captura, **hecho inalterable**.

**Y el papel vale más que su foto.** Cuando hay documento físico, esa firma sí es
autógrafa. Pero el art. 4 §2 dice que lo reproducido en formato impreso tiene la
eficacia de las *copias o reproducciones fotostáticas*: la foto es copia simple e
impugnable, el **original archivado** es prueba plena. Ver §7.

Del lado de datos: el rostro es **biométrico** y el GPS es **geolocalización**;
bajo PIPL art. 28 ambos son **información personal sensible**. En Venezuela, CRBV
art. 60 protege la **propia imagen**, y el art. 20 de la Ley Especial contra los
Delitos Informáticos tipifica la **obtención indebida** de data personal.

## 4. Hallazgos que abre el gate

| Hallazgo | Evidencia |
|---|---|
| `dispatch_pods` sin hash, sin trigger append-only y sin `deleted_at` | `supabase/migrations/0025_operario_roles_extend.sql` |
| Contraste: `legal_acceptances` sí tiene `legal_acceptances_immutable_trg` | `supabase/migrations/0102_capa_legal.sql:135` |
| `/privacidad` §1 enumera 7 momentos de captura y **el trabajo de campo no está** | `app/privacidad/page.tsx:35` |
| La cláusula *"si nos das datos de otra persona"* cubre lo que el cliente entrega, no lo que DTD captura directamente | `app/privacidad/page.tsx:144` |
| `received_doc` es **opcional** en el RPC | `supabase/migrations/0068_pod_partial_and_gps_addons.sql` |
| Cero retención: el único barrido borra **huérfanos** y está escrito para no borrar los referenciados | `lib/studio/storage/receipt-orphans.ts:6` |
| Mismo patrón sin aviso: `tms_drivers.emergency_contact` y `tms_truck_locations` con `driver_id` | `0011_tms_schema.sql` · `0066_foundation_v3.sql` |

## 5. Los tres escenarios reales

Confirmados por el founder. Los tres llevan **doble firma**.

| Escenario | Quién captura | Firma en papel | Firma en pantalla |
|---|---|---|---|
| Retiro en almacén | Almacenista | Sí | Sí |
| Retiro en almacén sin impresora | Almacenista | No → **fotos de persona + cédula** | Sí |
| Entrega por transportista tercero | Camionero externo con acceso al ERP | Sí (documento que DTD manda) | Sí |

El tercero es el de mayor exposición: **una persona externa a la nómina, con PIN
en `operario_pins`, fotografiando cédulas y rostros de clientes de DTD sin ningún
documento que regule la relación.** Ver §7.

## 6. Slices

### Slice A · Sellar el POD (⭐ primero)

**Qué.** Hash server-sellado + inmutabilidad, con el mismo patrón que
`legal_acceptances`.

1. Columnas `hash text not null` y `evidence_version int` en `dispatch_pods`.
2. Función de sellado en `lib/studio/dispatch/pod-seal.ts`, calcada de
   [`lib/studio/legal/seal.ts`](../../../lib/studio/legal/seal.ts): **pura**,
   recibe `ip`, `userAgent` y `now` por parámetro. El hash cubre
   `od_id`, `package_id`, `received_by`, `received_doc`, **sha256 del objeto de
   cada foto y de la firma**, `pod_lat/lng/accuracy_m/gps_status`,
   `created_by_operario_id` y `created_at`.
3. Trigger `dispatch_pods_immutable_trg` que reviente ante `update` o `delete`.
4. `camionero_pod` sella y devuelve el hash.

**Por qué esto y no un certificado de PSC:** es lo que responde a *"¿cómo sé que
esa foto y esa firma no las montaron después?"*, que es el primer ataque bajo sana
crítica. Cuesta una migración; un PSC por receptor no existe como producto.

⚠️ **`accepted_at` con precisión de milisegundos**, no `default now()` — la misma
trampa documentada en `seal.ts` (Postgres guarda microsegundos y el recompute
trunca a ms, y el hash deja de matchear).

### Slice B · Aviso de privacidad en la captura

**Qué.** Texto corto en la PWA del camionero y del almacenista, **visible antes**
de pedir la firma:

- quién es DTD (nombre y RIF),
- qué se está capturando y para qué (prueba de entrega),
- cuánto tiempo se conserva,
- cómo ejercer sus derechos (`info@dtdcargo.com`, asunto "Privacidad").

**Se registra que se mostró**, no solo se muestra: `notice_version` y
`notice_shown_at` en `dispatch_pods`, dentro del hash del Slice A.

El texto lo redacta la abogada (§7). Sin este slice, el Slice C no se despliega.

### Slice C · Captura ampliada (depende de A y B)

**Decisión del founder:** tres fotos + `received_doc` obligatorio.

1. `photo_path` pasa a `photos jsonb` con roles: `persona`, `documento`,
   `entrega`.
2. `received_doc` pasa a obligatorio en `camionero_pod`.
3. La UI del operario guía las tres capturas.

**Justificación de necesidad**, que hay que poder sostener por escrito (SC
332/2001 y PIPL art. 28): la foto del rostro se captura **solo cuando no hay
documento físico firmado** — el escenario 2 de §5. Cuando el papel existe y se
archiva, el rostro no agrega fuerza probatoria suficiente para justificar
capturar un biométrico. **Esa condicionalidad va en el código, no en un manual.**

### Slice D · Retención

**Qué.** Plazo de vida de la foto del rostro, del documento y del GPS, con borrado
automático que alcance **tabla y bucket**.

**Regla heredada de [SDD-0186](../0186-audit-retention-foundation/spec.md):** no se
inventa un plazo. Se registra la fuente en su `sources.md`, o se declara como
**decisión comercial** firmada por el founder, y se dice cuál de las dos es.

⚠️ **Y donde SDD-0186 y esta spec divergen, a propósito:** para eventos de
auditoría, "no purgar hasta tener fundamento" es el estado preventivo correcto —
son evidencia de la propia empresa. Para el **rostro y la cédula de una persona
que no es cliente**, conservar sin fundamento **no** es neutro: choca de frente
con el principio de **temporalidad** de SC 332/2001 y con el derecho al olvido de
SC 759/2025. Si al cerrar el Slice B no hay fundamento, se escala al founder — no
se deja correr como estado estable.

## 7. Fuera de alcance — para la abogada

1. **El texto del aviso** del Slice B.
2. **El texto legal del comprobante físico**: qué dice el papel y qué implica
   firmarlo.
3. **Si el papel original se conserva** y por cuánto. El art. 4 §2 hace que la
   foto valga como copia simple; el original archivado es prueba plena. Si el
   proceso fotografía el papel y lo descarta, se está tirando la mejor prueba.
   **Es cambio de proceso operativo, no de código.**
4. **Anexo de tratamiento de datos para el transportista tercero.** Es el de mayor
   exposición **penal** del inventario (Delitos Informáticos arts. 20-22) y hoy no
   existe.
5. **Autorización de retiro por tercero** en el escenario de almacén.
6. **Plazo de retención** del Slice D.
7. Mismo tratamiento para `tms_drivers.emergency_contact` y para el rastreo GPS
   del chofer (`tms_truck_locations`): son el mismo problema en otra mesa.

## 8. Allowlist

- `docs/specs/0192-pod-sellado-aviso-receptor/spec.md`
- `supabase/migrations/0298_pod_seal.sql` *(número a confirmar contra `origin/main`)*
- `supabase/tests/0298_pod_seal.test.sql`
- `lib/studio/dispatch/pod-seal.ts`
- `lib/studio/dispatch-mobile-types.ts`
- `app/m/ve/**`
- `docs/legal/privacidad/**`

No incluye: Cloud, Auth, Vercel, ni lectura de filas de negocio o PII.

## 9. Aceptación

- [ ] `update` sobre una fila de `dispatch_pods` **revienta** — test contractual
      SQL con **mutación**: si se quita el trigger, el test cae.
- [ ] Alterar una foto en el bucket hace que el hash del POD **no valide**.
- [ ] El operario no puede confirmar una entrega sin haber visto el aviso, y queda
      `notice_version` registrada.
- [ ] `received_doc` vacío es rechazado por el RPC.
- [ ] La foto de rostro **no** se pide cuando hay documento físico firmado.
- [ ] `node scripts/verify.mjs` en verde.
