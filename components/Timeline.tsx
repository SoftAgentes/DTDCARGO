"use client";

import { useEffect, useRef } from "react";
import { TIMELINE } from "@/lib/design-tokens";

/** Velocidad del auto-scroll en px por frame (a 60fps ≈ 90 px/seg). */
const SCROLL_PX_PER_FRAME = 1.5;
/** Pausa breve al llegar al final antes de volver al inicio. */
const LOOP_PAUSE_MS = 1500;
/** Pausa después de una interacción tipo wheel/scroll del usuario. */
const WHEEL_PAUSE_MS = 1800;

/**
 * Línea de tiempo — 13 hitos (2008 → 2026).
 * Fuente: brochure DTD Cargo § "Nuestra Historia" v2.
 *
 * Comportamiento desktop:
 * - Auto-scroll continuo hacia la derecha (~90 px/seg)
 * - Al llegar al final, pausa 1.5s y vuelve al inicio (loop infinito)
 * - Pausa estricta mientras el usuario mantiene presionado (pointerdown → pointerup)
 * - Drag-to-scroll nativo: mantener apretado y mover el cursor arrastra el contenido
 *   (con `setPointerCapture` para que el drag no se rompa al salirse del elemento).
 *   El scrollbar de abajo refleja la posición en tiempo real.
 * - Wheel/trackpad pausa por 1.8s adicionales para no pelearle al usuario
 * - Cursor: `grab` / `grabbing` para señalar que se puede tomar
 * - Respeta `prefers-reduced-motion` — sin auto-scroll
 *
 * Mobile: stack vertical sin auto-scroll (no aplica).
 */
export function Timeline() {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reducedMotion) return;

    let rafId = 0;
    let isPointerDown = false;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartScrollLeft = 0;
    let lastWheelAt = 0;
    let isWaitingAtEnd = false;
    let waitStartedAt = 0;

    function isPaused(now: number) {
      if (isPointerDown) return true;
      if (now - lastWheelAt < WHEEL_PAUSE_MS) return true;
      return false;
    }

    function tick(now: number) {
      if (!el) return;

      if (isPaused(now)) {
        // Reset estado de wait si el usuario interfiere antes del loop
        isWaitingAtEnd = false;
        rafId = requestAnimationFrame(tick);
        return;
      }

      const maxScroll = el.scrollWidth - el.clientWidth;

      if (isWaitingAtEnd) {
        if (now - waitStartedAt >= LOOP_PAUSE_MS) {
          el.scrollLeft = 0;
          isWaitingAtEnd = false;
        }
      } else {
        el.scrollLeft += SCROLL_PX_PER_FRAME;
        if (el.scrollLeft >= maxScroll - 1) {
          el.scrollLeft = maxScroll;
          isWaitingAtEnd = true;
          waitStartedAt = now;
        }
      }

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);

    function onPointerDown(e: PointerEvent) {
      isPointerDown = true;
      // En touch dejamos que el scroll nativo (con inercia) maneje el arrastre.
      // El pause se mantiene igual vía `isPointerDown` + `touchmove → onWheel`.
      if (e.pointerType === "touch") return;

      isDragging = true;
      dragStartX = e.clientX;
      dragStartScrollLeft = el!.scrollLeft;
      // Capturamos el puntero para seguir recibiendo `pointermove` aunque el
      // cursor se salga del elemento — drag suave sin "soltarse" en los bordes.
      try {
        el!.setPointerCapture(e.pointerId);
      } catch {
        // setPointerCapture puede tirar si el pointer ya fue capturado — silencio.
      }
    }

    function onPointerMove(e: PointerEvent) {
      if (!isDragging) return;
      // Drag-to-scroll: el contenido sigue al cursor. Mover el cursor a la derecha
      // (deltaX positivo) hace que scrollLeft baje (el contenido se desplaza a la
      // derecha como si lo agarraras y tiraras).
      const deltaX = e.clientX - dragStartX;
      el!.scrollLeft = dragStartScrollLeft - deltaX;
      // Mantener el "wheel pause" fresco para que cuando soltemos no resuma de golpe.
      lastWheelAt = performance.now();
    }

    function onPointerUp(e: PointerEvent) {
      isPointerDown = false;
      if (isDragging) {
        isDragging = false;
        try {
          el!.releasePointerCapture(e.pointerId);
        } catch {
          // releasePointerCapture puede tirar si ya se liberó — silencio.
        }
        // Pausa breve adicional al soltar — evita resumir instantáneo y deja
        // que el usuario "vea" dónde quedó parado antes del auto-scroll.
        lastWheelAt = performance.now();
      }
    }

    function onWheel() {
      lastWheelAt = performance.now();
    }

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("wheel", onWheel, { passive: true });
    el.addEventListener("touchmove", onWheel, { passive: true });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchmove", onWheel);
    };
  }, []);

  return (
    <section className="py-20 lg:py-25 bg-paper" id="historia">
      <div className="wrap">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-end gap-10 mb-14">
          <div>
            <span className="eyebrow">Nuestra historia</span>
            <h2 className="h-section mt-4">
              Más de 15 años
              <br />
              <span style={{ color: "var(--color-wine)" }}>nos respaldan.</span>
            </h2>
          </div>
          <p className="lead max-w-[40ch]">
            Desde nuestros inicios como importadores hasta convertirnos en
            referente logístico entre China y América Latina, cada hito
            responde a una necesidad real de nuestros clientes.
          </p>
        </div>

        {/* Mobile: stack vertical */}
        <div className="lg:hidden flex flex-col gap-8 relative">
          <div
            className="absolute left-[7px] top-2 bottom-2 w-[2px]"
            style={{ background: "var(--color-grey-200)" }}
          />
          {TIMELINE.map((hito) => (
            <div key={hito.year} className="relative pl-8">
              <div
                className="absolute left-0 top-1 w-4 h-4 rounded-full"
                style={{
                  background: "var(--color-wine)",
                  boxShadow: "0 0 0 4px var(--color-paper)",
                }}
              />
              <div
                className="text-[28px] leading-none mb-2"
                style={{
                  fontFamily: "var(--font-archivo-black)",
                  color: "var(--color-wine)",
                  letterSpacing: "-0.03em",
                }}
              >
                {hito.year}
              </div>
              <h3 className="text-[17px] font-extrabold leading-[1.2] tracking-[-0.01em] text-ink mb-2">
                {hito.title}
              </h3>
              <p className="text-[14px] leading-[1.55] text-grey-500 max-w-[44ch]">
                {hito.copy}
              </p>
            </div>
          ))}
        </div>

        {/* Desktop: scroll horizontal con auto-loop */}
        <div
          ref={scrollRef}
          className="hidden lg:block overflow-x-auto pb-6 -mb-6 cursor-grab active:cursor-grabbing select-none"
          style={{ scrollbarWidth: "thin" }}
          aria-label="Línea de tiempo — avanza automáticamente, presiona para detener"
        >
          <div className="flex gap-10 min-w-max relative pr-8">
            <div
              className="absolute left-0 right-0 top-[50px] h-[2px]"
              style={{ background: "var(--color-grey-200)" }}
            />

            {TIMELINE.map((hito) => (
              <div
                key={hito.year}
                className="w-[260px] flex-shrink-0 relative"
              >
                <div
                  className="text-[42px] leading-none"
                  style={{
                    fontFamily: "var(--font-archivo-black)",
                    color: "var(--color-wine)",
                    letterSpacing: "-0.03em",
                  }}
                >
                  {hito.year}
                </div>
                <div className="mt-3 relative z-10 mb-6">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{
                      background: "var(--color-wine)",
                      boxShadow: "0 0 0 4px var(--color-paper)",
                    }}
                  />
                </div>
                <h3 className="text-[17px] font-extrabold leading-[1.2] tracking-[-0.01em] text-ink mb-2">
                  {hito.title}
                </h3>
                <p className="text-[14px] leading-[1.55] text-grey-500">
                  {hito.copy}
                </p>
              </div>
            ))}
          </div>
        </div>

        <p className="hidden lg:block mt-6 text-[12.5px] text-grey-500">
          ✦ Avanza automáticamente · Presiona para detener · Arrastra para explorar
        </p>
      </div>
    </section>
  );
}
