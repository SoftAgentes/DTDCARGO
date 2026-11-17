# Handoff · SDD-0626 · 0558: casillas con tres estados y cierre por conversación

**Pedido:** el Director General, tras cerrar en verde la prueba F del Paso 3b (17/11/2026), con decisiones tomadas por
delegación de Sam («ponle los criterios que tú creas»), revisables por él. Va en una PR nueva desde main, después de
la #604. El contraste del borrador (H1) ya fue en la #604.

## Qué decidió el DG

- **H2 = la variante.** Pantalla «marca lo que falló» con «Falló» y «No evaluado» por criterio. En la base: sin marca =
  `true`, «Falló» = `false`, «No evaluado» = `null`. Un rechazo exige al menos un «Falló» y el motivo (check en la
  0558). Aprobar sigue exigiendo `true` en «Cero datos inventados» y en «No repite datos personales». La pantalla dice,
  junto a los botones, que guardar sin marcas significa «revisé y cumple».
- **H3 = la propuesta de Hermes.** Cada mensaje se revisa con 4 criterios. El cierre («Cierre o escalado en 3
  intercambios o menos») se registra una vez por conversación, al cerrarla o escalarla, con una fila de cierre. En la
  etapa 2 solo cuentan las conversaciones con cierre registrado.
- **Filas viejas:** la 0558 no las toca y el conteo ignora las revisiones anteriores a la 0558.
- **La F no cuenta para la etapa 1** (los clics fueron del DG).
- **Correr la etapa 1 en producción** con la bandeja de prueba y Sam entrando como él: NO lo decide el DG (es encender
  algo en producción); lo lleva a Sam aparte. Esta PR deja el envío apagado por defecto.

## Qué se hizo

- **`supabase/migrations/0558_oficina_casillas_tres_estados.sql`** (sin aplicar; la 0549, ya en producción, no se toca):
  - `office_revisiones.regla_casillas` (1 = regla de la 0549, default; 2 = la de la 0558). Así
    `office_revisar_borrador` de la 0549 sigue escribiendo filas de regla 1 sin tocarla, y el conteo solo mira las de
    regla 2. Las 5 casillas pasan a admitir `null`. Checks: regla válida; regla 1 con las 5 casillas; regla 2 sin
    `c_cierre_3`; regla 2 aprobada (respuesta) con cero inventados y sin datos personales en `true`; regla 2 rechazada
    con al menos un `false`.
  - `office_cierres`: uno por conversación y etapa, solo se agregan filas (disparadores ALWAYS de la 0541), RLS sin
    policies, service_role solo SELECT.
  - Funciones (search_path vacío, SECURITY DEFINER, EXECUTE solo authenticated, `is_platform_admin()` adentro):
    `office_revisar_borrador_v2` (4 criterios; el rechazo sin fallo da el código `OFR01`),
    `office_registrar_cierre`, `office_conversaciones_por_cerrar` y `office_conteo_revisiones` reemplazada (misma
    firma y columnas).
  - Conteo: correcta = todas sus revisiones aprobadas con los 4 criterios en `true` (null no basta) y sin un cierre
    que falló; inventada = `c_cero_inventados = false` explícito; etapa 2 = solo conversaciones con cierre, y el cierre
    tiene que cumplir.
- **`supabase/desarmes/0558_desarme.sql`:** quita los cierres, las funciones nuevas y los checks de regla 2, y vuelve
  `office_conteo_revisiones` al cuerpo de la 0549. No vuelve las casillas a NOT NULL (las filas de regla 2 tienen null).
- **Pruebas:** `supabase/tests/0558_oficina_casillas_tres_estados.test.sql` (bloques 1 a 6, con null ≠ false) y
  `lib/studio/__tests__/oficina-casillas.migration.test.ts` (contrato en PGlite, control rojo, 11 mutantes y el
  desarme). `lib/studio/oficina/__tests__/casillas-0558.test.ts` (el mapeo de marcas → true/false/null y los códigos).
- **La página** (`app/studio/(app)/admin/oficina/`): `TarjetaBorrador` con «marca lo que falló» y el aviso junto a los
  botones; `TarjetaCierre` y la sección «Conversaciones por cerrar»; `registrarCierreAction` con los mismos dos candados
  al tope (`moduleEditDenial` + `platformAdminDenial`). Sin la 0558: «Falta la migración 0558», no se guarda nada.
- **Control de la espera:** `migrations-baseline.json` (pendingBelowCutoff de la 0558) y
  `pending-migration-symbol-declarations.json` (declaración de la 0558; la de la 0549 queda con su sitio vigente).
  `rbac-actions-guard.test.ts`: 478 → 479 acciones.
- **Docs:** spec v0.6 (§3.5 y §9) y runbook §11.

## Lo que falta (no es de esta PR)

1. Revisión del DG y fusión por su portón, después de la #604.
2. Aplicar la 0558: staging con OK de Sam y aviso al DG; producción con el OK nominal de Sam para este archivo y el
   runbook aplicar-migraciones-prod, con el DG. Hasta entonces la página no guarda revisiones nuevas.
3. La decisión de Sam sobre correr la etapa 1 en producción (bandeja de prueba).
4. Las 10 conversaciones de la etapa 1, con los clics de Sam.
