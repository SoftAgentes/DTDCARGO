import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CompanyPhotoCarousel } from "./CompanyPhotoCarousel";

vi.mock("next/image", () => ({
  default: ({ fill, alt, ...props }: { fill?: boolean; src: string; alt: string }) => {
    void fill;
    // eslint-disable-next-line @next/next/no-img-element -- isolated next/image test double
    return <img {...props} alt={alt} />;
  },
}));
afterEach(cleanup);

describe("CompanyPhotoCarousel", () => {
  it("renders useful initial content on the server", () => {
    const html = renderToString(<CompanyPhotoCarousel />);
    expect(html).toContain("Atención y planificación");
    expect(html).toContain("dtd-cargo-atencion-mapa.webp");
    expect(html).toContain("1");
  });
  it("wraps both directions and preserves the control focus", () => {
    render(<CompanyPhotoCarousel />);
    const previous = screen.getByRole("button", { name: "Foto anterior" });
    previous.focus();
    fireEvent.click(previous);
    expect(screen.getByText("8 de 8")).toBeVisible();
    expect(screen.getByText("Carga en un camión DTD Cargo")).toBeVisible();
    expect(previous).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Foto siguiente" }));
    expect(screen.getByText("1 de 8")).toBeVisible();
  });
  it("selects thumbnails and navigates with arrows, Home and End", () => {
    render(<CompanyPhotoCarousel />);
    const thumbnail = screen.getByRole("button", { name: /Ver foto 5:/ });
    fireEvent.click(thumbnail);
    expect(thumbnail).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("5 de 8")).toBeVisible();
    fireEvent.keyDown(thumbnail, { key: "ArrowRight" });
    expect(screen.getByText("6 de 8")).toBeVisible();
    fireEvent.keyDown(thumbnail, { key: "ArrowLeft" });
    expect(screen.getByText("5 de 8")).toBeVisible();
    fireEvent.keyDown(thumbnail, { key: "End" });
    expect(screen.getByText("8 de 8")).toBeVisible();
    fireEvent.keyDown(thumbnail, { key: "Home" });
    expect(screen.getByText("1 de 8")).toBeVisible();
  });
  it("accepts horizontal swipe and ignores vertical scroll and cancelled gestures", () => {
    render(<CompanyPhotoCarousel />);
    const frame = screen.getByTestId("company-photo-frame");
    fireEvent.touchStart(frame, { touches: [{ clientX: 250, clientY: 100 }] });
    fireEvent.touchEnd(frame, { changedTouches: [{ clientX: 100, clientY: 110 }] });
    expect(screen.getByText("2 de 8")).toBeVisible();
    fireEvent.touchStart(frame, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchEnd(frame, { changedTouches: [{ clientX: 250, clientY: 110 }] });
    expect(screen.getByText("1 de 8")).toBeVisible();
    fireEvent.touchStart(frame, { touches: [{ clientX: 250, clientY: 100 }] });
    fireEvent.touchEnd(frame, { changedTouches: [{ clientX: 200, clientY: 300 }] });
    expect(screen.getByText("1 de 8")).toBeVisible();
    fireEvent.touchStart(frame, { touches: [{ clientX: 250, clientY: 100 }] });
    fireEvent.touchCancel(frame);
    fireEvent.touchEnd(frame, { changedTouches: [{ clientX: 100, clientY: 110 }] });
    expect(screen.getByText("1 de 8")).toBeVisible();
  });
  it("does not advance when time passes", () => {
    vi.useFakeTimers();
    try {
      render(<CompanyPhotoCarousel />);
      vi.advanceTimersByTime(60_000);
      expect(screen.getByText("1 de 8")).toBeVisible();
    } finally { vi.useRealTimers(); }
  });
});
