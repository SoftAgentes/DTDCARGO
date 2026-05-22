import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { renderBolded } from "@/lib/text";

/**
 * Tests del reemplazo seguro de `dangerouslySetInnerHTML + regex` que vivía
 * en `/glosario` y `/noticias/[slug]`. La diferencia clave: aunque entre
 * un string con tags maliciosos, NO debe haber ejecución ni inyección — JSX
 * los renderiza como texto literal.
 */
describe("renderBolded", () => {
  it("renderiza texto sin <b> como texto plano", () => {
    const { container } = render(<p>{renderBolded("Hola mundo")}</p>);
    expect(container.textContent).toBe("Hola mundo");
    expect(container.querySelector("strong")).toBeNull();
  });

  it("envuelve <b>...</b> en <strong class='text-ink'>", () => {
    const { container } = render(
      <p>{renderBolded("Hola <b>mundo</b>")}</p>,
    );
    const strong = container.querySelector("strong");
    expect(strong).not.toBeNull();
    expect(strong?.textContent).toBe("mundo");
    expect(strong?.className).toContain("text-ink");
  });

  it("maneja múltiples <b> en el mismo párrafo", () => {
    const { container } = render(
      <p>{renderBolded("<b>uno</b> dos <b>tres</b>")}</p>,
    );
    const strongs = container.querySelectorAll("strong");
    expect(strongs.length).toBe(2);
    expect(strongs[0].textContent).toBe("uno");
    expect(strongs[1].textContent).toBe("tres");
  });

  it("NO ejecuta <script> embebido — JSX lo escapa", () => {
    const evil = '<script>window.HACKED=true</script>';
    const { container } = render(<p>{renderBolded(evil)}</p>);
    // El texto literal aparece, pero NO debe haber un <script> tag.
    expect(container.querySelector("script")).toBeNull();
    // El contenido debe estar como texto, no como HTML parseado.
    expect(container.textContent).toContain("<script>");
  });

  it("NO permite atributos via inyección (ej. onerror)", () => {
    const evil = '<img src=x onerror=alert(1)>';
    const { container } = render(<p>{renderBolded(evil)}</p>);
    // No se debe haber creado ningún <img> real.
    expect(container.querySelector("img")).toBeNull();
    // El texto literal sí aparece.
    expect(container.textContent).toContain("<img");
  });

  it("trata tags distintos a <b> como texto literal", () => {
    const input = "Algo <i>itálico</i> y <em>énfasis</em>";
    const { container } = render(<p>{renderBolded(input)}</p>);
    // Solo se reconoce <b>, los demás quedan crudos en el texto.
    expect(container.querySelector("i")).toBeNull();
    expect(container.querySelector("em")).toBeNull();
    expect(container.textContent).toContain("<i>");
  });
});
