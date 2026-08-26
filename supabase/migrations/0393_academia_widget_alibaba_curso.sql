-- ─────────────────────────────────────────────────────────────
-- 0393 · SDD-0099 · Academia — widget de lección `alibaba_curso`
--
-- Habilita un segundo valor en `academy_lessons.widget` para embeber la GUÍA
-- INTERACTIVA completa de compra en Alibaba (`public/guias/comprar-en-alibaba.html`)
-- dentro de una lección del portal, igual que hoy se embebe la guía de dirección.
--
--   alibaba_address  (0149) → componente <AlibabaAddressGuide/>: SOLO la dirección
--                             de la bodega de Yiwu, campo por campo.
--   alibaba_curso    (acá)  → componente <AlibabaCursoGuide/>: las 9 etapas
--                             completas, con calculadoras y captura de avance.
--
-- Es un cambio de CHECK y nada más: sin tablas, sin funciones, sin policies, sin
-- grants. La lectura de `academy_lessons` ya está resuelta por 0145 (catálogo) y
-- 0149 (progreso); este valor viaja por la MISMA columna que ya se lee, así que
-- no abre superficie nueva.
--
-- ⚠️ EL CONSTRAINT SE LLAMA `academy_lessons_widget_chk`, NO `..._widget_check`.
-- El runbook `docs/runbooks/academia-guia-alibaba-interactiva.md` traía el nombre
-- adivinado: con ese nombre el `drop` no borra nada y el `add` revienta por
-- duplicado. Verificado contra 0149 antes de escribir esto.
--
-- Idempotente: se puede correr dos veces. NO aplicar a prod desde la rama — la
-- aplica coordinación con el OK del founder NOMBRANDO esta migración
-- (docs/runbooks/aplicar-migraciones-prod.md).
-- ─────────────────────────────────────────────────────────────

do $$
begin
  -- El CHECK viejo sólo admite 'alibaba_address'. Se reemplaza por el que admite
  -- los dos. Se borra por el nombre REAL que puso 0149.
  if exists (
    select 1 from pg_constraint
    where conname = 'academy_lessons_widget_chk'
      and conrelid = 'public.academy_lessons'::regclass
  ) then
    alter table public.academy_lessons drop constraint academy_lessons_widget_chk;
  end if;

  alter table public.academy_lessons
    add constraint academy_lessons_widget_chk
    check (widget is null or widget in ('alibaba_address', 'alibaba_curso'));
end $$;

comment on column public.academy_lessons.widget is
  'Herramienta interactiva embebida en la lección (SDD-0093 · ampliado por SDD-0099). NULL = lección normal. Valores: alibaba_address (guía de dirección de bodega Yiwu + MARKBOX) · alibaba_curso (guía interactiva completa de compra en Alibaba, 9 etapas).';
