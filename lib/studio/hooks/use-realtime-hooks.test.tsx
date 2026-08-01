import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRealtimeRefresh } from "./use-realtime-refresh";
import { useRealtimeTable } from "./use-realtime-table";

const refresh = vi.fn();
const unsubscribe = vi.fn(async () => undefined);
let changeHandler: ((payload: unknown) => void) | undefined;
let statusHandler: ((status: string) => void) | undefined;
const channel = {
  on: vi.fn((_event, _config, handler) => {
    changeHandler = handler;
    return channel;
  }),
  subscribe: vi.fn((handler) => {
    statusHandler = handler;
    return channel;
  }),
  unsubscribe,
};
const channelFactory = vi.fn(() => channel);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("@/lib/db/client", () => ({
  createClient: () => ({ channel: channelFactory }),
}));

describe("hooks realtime — estado verdadero", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    changeHandler = undefined;
    statusHandler = undefined;
  });

  it("reinicia connecting al cambiar de filtro y limpia el canal anterior", () => {
    const { result, rerender, unmount } = renderHook(
      ({ filter }) =>
        useRealtimeRefresh({ table: "shipments", filter, debounceMs: 0 }),
      { initialProps: { filter: "tenant_id=eq.a" } },
    );
    expect(result.current.status).toBe("connecting");
    act(() => statusHandler?.("SUBSCRIBED"));
    expect(result.current.status).toBe("connected");

    const cleanupsBeforeFilterChange = unsubscribe.mock.calls.length;
    rerender({ filter: "tenant_id=eq.b" });
    expect(result.current.status).toBe("connecting");
    expect(unsubscribe.mock.calls.length).toBeGreaterThan(cleanupsBeforeFilterChange);
    act(() => statusHandler?.("SUBSCRIBED"));
    expect(result.current.status).toBe("connected");

    const cleanupsBeforeUnmount = unsubscribe.mock.calls.length;
    unmount();
    expect(unsubscribe.mock.calls.length).toBeGreaterThan(cleanupsBeforeUnmount);
  });

  it("absorbe un initial nuevo y aplica el siguiente payload sobre ese dataset", () => {
    const first = [{ id: "a", value: 1 }];
    const second = [{ id: "b", value: 2 }];
    const { result, rerender } = renderHook(
      ({ initial }) => useRealtimeTable({ table: "items", initial }),
      { initialProps: { initial: first } },
    );
    expect(result.current.data).toEqual(first);

    rerender({ initial: second });
    expect(result.current.data).toEqual(second);
    act(() =>
      changeHandler?.({
        eventType: "INSERT",
        new: { id: "c", value: 3 },
        old: {},
      }),
    );
    expect(result.current.data).toEqual([
      { id: "c", value: 3 },
      { id: "b", value: 2 },
    ]);
  });

  it("permanece idle y no abre canal cuando está deshabilitado", () => {
    const { result } = renderHook(() =>
      useRealtimeTable({ table: "items", initial: [], disabled: true }),
    );
    expect(result.current.status).toBe("idle");
    expect(channelFactory).not.toHaveBeenCalled();
  });
});
