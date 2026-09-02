"use client";

/**
 * Contenedor canónico para tabs ARIA del Studio.
 *
 * Conserva el diseño y el estado de cada consumidor, pero centraliza el
 * contrato de teclado que antes se copiaba —o se omitía— en cada módulo:
 * un solo tab stop, flechas, Home y End. La delegación funciona también
 * cuando el botón vive dentro de un componente hijo como <TabButton>.
 */

import {
  useCallback,
  useLayoutEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
} from "react";

const ENABLED_TAB_SELECTOR =
  '[role="tab"]:not([disabled]):not([aria-disabled="true"])';
const TAB_SELECTOR = '[role="tab"]';

type RovingTabListProps = Omit<
  ComponentPropsWithoutRef<"div">,
  "role"
>;

function enabledTabs(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(ENABLED_TAB_SELECTOR));
}

function syncTabStops(root: HTMLElement): void {
  const allTabs = Array.from(root.querySelectorAll<HTMLElement>(TAB_SELECTOR));
  const tabs = enabledTabs(root);
  const selected =
    tabs.find((tab) => tab.getAttribute("aria-selected") === "true") ?? tabs[0];

  for (const tab of allTabs) {
    tab.tabIndex = tab === selected ? 0 : -1;
  }
}

export function RovingTabList({
  children,
  onKeyDown,
  ...props
}: RovingTabListProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    syncTabStops(root);
    const observer = new MutationObserver(() => syncTabStops(root));
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["aria-selected", "aria-disabled", "disabled"],
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [children]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(event);
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      ) {
        return;
      }

      const direction =
        event.key === "ArrowRight" || event.key === "ArrowDown"
          ? 1
          : event.key === "ArrowLeft" || event.key === "ArrowUp"
            ? -1
            : null;
      if (direction == null && event.key !== "Home" && event.key !== "End") {
        return;
      }

      const root = event.currentTarget;
      const target =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>('[role="tab"]')
          : null;
      if (!target || !root.contains(target)) return;

      const tabs = enabledTabs(root);
      if (tabs.length === 0) return;
      const currentIndex = tabs.indexOf(target);
      if (currentIndex < 0) return;

      const nextIndex =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? tabs.length - 1
            : (currentIndex + direction! + tabs.length) % tabs.length;
      const next = tabs[nextIndex];

      event.preventDefault();
      for (const tab of tabs) tab.tabIndex = tab === next ? 0 : -1;
      next.focus();
      next.click();
    },
    [onKeyDown],
  );

  return (
    <div
      {...props}
      ref={rootRef}
      role="tablist"
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}
