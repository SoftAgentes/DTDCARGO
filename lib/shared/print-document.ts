/** Select the printable surface synchronously; each print action is independent. */
export function printDocument(surface: "labels" | "packing-list") {
  document.documentElement.dataset.printSurface = surface;
  const pageStyle = document.createElement("style");
  pageStyle.textContent = `@media print { @page { size: A4 ${surface === "packing-list" ? "landscape" : "portrait"}; margin: 8mm; } }`;
  document.head.appendChild(pageStyle);
  const cleanup = () => {
    pageStyle.remove();
    delete document.documentElement.dataset.printSurface;
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup, { once: true });
  try {
    window.print();
  } catch (error) {
    cleanup();
    throw error;
  }
}
