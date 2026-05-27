"use client";

/**
 * useGeolocation · hook React para browser geolocation API.
 *
 * Manejo de estados:
 *   - idle:        sin pedir todavía (default)
 *   - loading:     getCurrentPosition en curso
 *   - granted:     lat/lng disponibles
 *   - denied:      user rechazó · sin lat/lng
 *   - unavailable: browser sin geo API (raro hoy) · sin lat/lng
 *   - error:       falló por otra razón (timeout, etc)
 *
 * Lazy: NO pide permiso al mount · solo cuando se llama request().
 *
 * Usado por Mobile ERP ClientsScreen para sortear por distancia
 * haversine cuando user toca "Cerca tuyo".
 */

import { useCallback, useState } from "react";

export type GeoStatus =
  | "idle"
  | "loading"
  | "granted"
  | "denied"
  | "unavailable"
  | "error";

export interface GeoState {
  status: GeoStatus;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  error: string | null;
}

const INITIAL: GeoState = {
  status: "idle",
  lat: null,
  lng: null,
  accuracy: null,
  error: null,
};

export function useGeolocation(): GeoState & { request: () => void } {
  const [state, setState] = useState<GeoState>(INITIAL);

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({
        status: "unavailable",
        lat: null,
        lng: null,
        accuracy: null,
        error: "Browser sin soporte de geolocation API.",
      });
      return;
    }

    setState((s) => ({ ...s, status: "loading", error: null }));

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          status: "granted",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          error: null,
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setState({
            status: "denied",
            lat: null,
            lng: null,
            accuracy: null,
            error: "Permiso denegado por el navegador.",
          });
          return;
        }
        setState({
          status: "error",
          lat: null,
          lng: null,
          accuracy: null,
          error: err.message || "Error al obtener ubicación.",
        });
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 60_000, // cache 1 min
      },
    );
  }, []);

  return { ...state, request };
}

// ─────────────────────────────────────────────────────────────
// Haversine · distancia entre 2 puntos en km
// ─────────────────────────────────────────────────────────────

/**
 * Distancia great-circle en km entre 2 coords (haversine formula).
 * Margen de error <0.5% para distancias <1000km (suficiente para uso
 * humano "este cliente está a X km de mí").
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // radio Tierra km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}
