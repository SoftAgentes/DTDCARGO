import React from "react";
import { createRoot } from "react-dom/client";
import { PortalAlertasHub } from "@/app/portal/(app)/envios/_components/PortalAlertasHub";
import { SuppliersClient } from "@/app/portal/(app)/proveedores/SuppliersClient";
import { DocumentsClient } from "@/app/portal/(app)/documentos/DocumentsClient";
import "@/app/globals.css";
const theme = new URLSearchParams(location.search).get("theme") || "light";
document.documentElement.setAttribute("data-portal-theme", theme);
const page = new URLSearchParams(location.search).get("page");
createRoot(document.getElementById("root")!).render(<main className="bg-paper text-ink min-h-screen p-4 sm:p-8">
{page === "suppliers" ? <SuppliersClient suppliers={[{id:"test",name:"Proveedor ficticio de prueba",supplierSeq:1,wechat:null,city:"Yiwu",contact:null,notes:null,orderCount:1,nextCode:"DTD-TEST-1-2"}]} addons={[]} markbox="DTD-TEST" /> : page === "documents" ? <DocumentsClient docs={[{id:"1",docType:"packing",typeLabel:"Packing list",typeShort:"PL",shipmentCode:null,purchaseCode:"DTD-TEST-1",meta:"Datos ficticios",url:"/portal/compras/DTD-TEST-1",kind:"abrir"},{id:"2",docType:"factura",typeLabel:"Factura",typeShort:"FAC",shipmentCode:"ENV-TEST",meta:"Datos ficticios",url:null}]} /> : <PortalAlertasHub items={[{key:"p-1",code:"DTD-TEST-1",title:"Proveedor ficticio de prueba",stage:"prealerta",meta:"2 cajas · esperando documentos",sortAt:"2026-09-05",shipmentId:null,prealertaId:"p1"}]} docs={{"p-1":{packing:false,factura:false,foto:false}}} trackGroups={[]} banner={null} markbox="DTD-TEST" />}
</main>);
