import { notFound } from "next/navigation";
import { configuracionPractica } from "@/lib/studio/practica/config";
import { PracticaPersonal } from "./PracticaPersonal";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mi práctica", robots: { index: false, follow: false } };

export default function PaginaPractica() {
  const cfg = configuracionPractica();
  if (cfg?.modo !== "destino") notFound();
  return <PracticaPersonal real={cfg.real} />;
}
