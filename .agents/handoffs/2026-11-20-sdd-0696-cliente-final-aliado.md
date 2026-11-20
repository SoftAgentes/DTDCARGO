# Handoff — SDD-0696 dirección de entrega del cliente final de un aliado

- **Owner:** el Worker `datos-duplicados-9e6364`, una sesión hija de Dir_DTD.
- **Ruta:** `DTD-worktrees/sdd-0696-cliente-final-aliado`.
- **Rama:** `codex/sdd-0696-cliente-final-aliado`, sobre la reserva `codex/sdd-reserve-0696` (e9a0aa2aa).
- **Objetivo:** el pedido de Sam del 2026-11-20. Que el aliado cargue la dirección de sus clientes en la
  marca blanca, o que les mande un enlace con su marca para que la llenen ellos.
- **SDD:** la 0696, asignada por Dir_DTD. Va después de la 0695 (PR #728) y depende de la 0694 (PR #725) y
  de la 0666.
- **Permisos:**
  - solo la spec;
  - la rama y una PR en borrador;
  - ni código, ni migraciones, ni producción.

## Hecho

- Medición del modelo de aliados en `main` (6a7787d08):
  - el cliente final es una ficha de `clients` con `aliado_id`;
  - el aliado tiene su ficha ancla;
  - no hay modo de entrega construido;
  - la 0666 y la 0255 prohíben hoy que el aliado cambie direcciones.
- La spec `docs/specs/0696-direccion-cliente-final-aliado/spec.md`, en estado `proposed`: el modo de
  entrega por aliado, la fuente única de siempre, la carga por RPC, el enlace de un solo uso con la marca
  del aliado, el aviso al aliado, las fases, la aceptación y las preguntas P-1 a P-7.

## Pendientes de esta tarea

1. Las respuestas de Sam a P-1 a P-7.
2. Al aprobarse, las notas de cambio en la 0666 (§2.1, §4.3 y D2) y en la 0255 §8.4 (spec §4.7).
3. La cláusula de la 0255 §8.5 y el aviso de privacidad del enlace (P-7). Los ve el abogado de Sam antes de
   la F-2.

## Fuera de alcance detectado

- Ninguno nuevo. Lo de la 0695 está en su handoff.

## Impacto documental

- La spec nueva y el índice `docs/specs/README.md`. Las enmiendas a la 0666 y la 0255 quedan pendientes de la
  aprobación.

## Revisión independiente (2026-11-20, sobre 8593ebdfd): CHANGES_REQUESTED, corregida

- **1. Marca:** se resuelve desde el token en `_peek`, falla cerrado (página neutra, nunca DTD) y exige
  `hide_dtd_brand` (§4.4.3).
- **2. Mecánica del enlace:**
  - las RPC `_create`, `_peek`, `_complete` y `_attempt`, con service_role donde corresponde;
  - el consumo atómico;
  - la escritura solo en la ficha del token;
  - un límite de intentos en la base, con el patrón de `brand_access_attempts` (0334);
  - `no-store` y `no-referrer`;
  - el token fuera de los logs (§4.4.1 a §4.4.4).
- **3.** El aviso diario no genera ni lleva enlaces (§4.5).
- **4.** La F-3 declara que depende de la F-2 (§5).
- **5.** Hay una RPC de lectura y otra de alta, con la comprobación de cadena y sin borrar ni editar (§4.3).
- **6.** La §7 suma las pruebas que faltaban:
  - el vencimiento a 14 días;
  - el doble envío;
  - el límite de intentos;
  - la respuesta idéntica;
  - el acceso entre aliados;
  - la marca ante un error;
  - las cabeceras;
  - los logs.
- **7.** `lib/studio/client-address-queries.ts` **sí existe** en `main` (6a7787d08:
  `insertClientDeliveryAddress:96`). Quedan nombrados los archivos de la F-3.
- **8.** `docs/specs/README.md` es generado: se regenera con `node scripts/build-docs-index.mjs` al
  integrar, en el orden que serialice Dir_DTD.
- **9.** La base de la medición es `6a7787d08`.
- **10.** La minimización queda como «diseño», con la nota del prefijo del código impreso.
