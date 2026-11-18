/**
 * Núcleo del smoke de la guía dentro de Chatwoot (SDD-0589, paso 9.4).
 *
 * `resolverAnclas` busca cada ancla de `lib/studio/guia/chatwoot-selectores.json`
 * en un documento, con la misma regla que el script del panel
 * (`infra/chatwoot/panel/guia-panel.html`): el primer selector que encuentra un
 * elemento con rectángulo, subiendo con `closest(cerca)` si hace falta. Un
 * selector inválido cuenta como no encontrado.
 *
 * No usa nada de afuera: Playwright la manda tal cual a la página con
 * `page.evaluate(resolverAnclas, archivo)`. Las pruebas la corren sobre un DOM
 * sintético y comparan con lo que mide el script.
 */

export function resolverAnclas(archivo, doc) {
  var d = doc || document;
  var salida = [];
  var anclas = (archivo && archivo.anclas) || {};
  for (var ancla in anclas) {
    if (!Object.prototype.hasOwnProperty.call(anclas, ancla)) continue;
    var a = anclas[ancla];
    var selector = null;
    for (var i = 0; i < a.css.length && selector === null; i += 1) {
      var el = null;
      try {
        el = d.querySelector(a.css[i]);
      } catch (x) {
        el = null;
      }
      if (el && a.cerca) el = el.closest(a.cerca) || el;
      if (el && el.getClientRects().length > 0) selector = a.css[i];
    }
    salida.push({
      ancla: ancla,
      obligatoria: a.obligatoria === true,
      condicion: a.condicion || "",
      encontrada: selector !== null,
      selector: selector,
    });
  }
  return salida;
}

/** Resultado del smoke: falla si falta una obligatoria; las condicionales solo avisan. */
export function resumir(resultados) {
  const faltanObligatorias = resultados.filter((r) => r.obligatoria && !r.encontrada).map((r) => r.ancla);
  const faltanCondicionales = resultados.filter((r) => !r.obligatoria && !r.encontrada).map((r) => r.ancla);
  return { ok: faltanObligatorias.length === 0, faltanObligatorias, faltanCondicionales };
}

/** Tabla para el handoff de la subida de versión. */
export function formatear(resultados, version) {
  const lineas = [`Selectores medidos para ${version}:`];
  for (const r of resultados) {
    const estado = r.encontrada ? "OK" : r.obligatoria ? "FALTA" : "FALTA (condicional)";
    lineas.push(`  ${estado.padEnd(20)} ${r.ancla}${r.encontrada ? "" : `  · necesita: ${r.condicion}`}`);
  }
  return lineas.join("\n");
}
