import "server-only";
import ExcelJS from "exceljs";
import { computeDocumentTotals, type DocumentDraft } from "@/lib/shared/document-import";

/** Values are assigned as strings/numbers, never executable formulas or hyperlinks. */
export async function exportDocument(draft:DocumentDraft,context:{markbox:string;code:string;confirmed:boolean;revision:number}) {
  const wb=new ExcelJS.Workbook();wb.creator="DTD Cargo";
  const ws=wb.addWorksheet("Packing List + Factura",{pageSetup:{orientation:"landscape",paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:"1:9"}});
  ws.columns=[{width:12},{width:20},{width:28},{width:16},{width:12},{width:12},{width:12},{width:14},{width:14},{width:18},{width:18},{width:14},{width:14},{width:20}];
  ws.addRow(["DTD Cargo · 装箱单 + 商业发票 / Packing List + Factura"]);ws.mergeCells("A1:N1");
  ws.addRow([context.confirmed?"已确认 / Confirmado":"草稿 / Borrador — pendiente de confirmación",`Rev. ${context.revision}`]);
  ws.addRow(["Shipping Mark",context.markbox,"Compra",context.code]);
  ws.addRow(["供应商 / Proveedor",draft.supplier.company,"联系人 / Contacto",draft.supplier.contact]);
  ws.addRow(["Email",draft.supplier.email,"WeChat",draft.supplier.wechat,"Tel",draft.supplier.phone]);
  ws.addRow(["地址 / Dirección",draft.supplier.address,"City",draft.supplier.city]);
  ws.addRow(["Fecha",draft.docDate??"","Moneda",draft.currency??"Pendiente"]);
  ws.addRow([]);
  ws.addRow(["箱组 / Grupo","品名 / Producto","品名中文 / Nombre chino","编码 / Código","件数 / Cajas","数量 / Cantidad TOTAL","单位 / Unidad","单价 / Precio","金额 / Importe","毛重 kg / Peso bruto TOTAL del grupo","体积 m³ / CBM TOTAL del grupo","货币 / Moneda","品牌 / Marca","材质 / Material"]);
  const assigned=new Map<string,number>();
  for(const group of draft.groups) {
    for(let i=0;i<group.items.length;i++) {
      const item=group.items[i],product=draft.products.find(p=>p.id===item.productId);if(!product)continue;
      assigned.set(product.id,(assigned.get(product.id)??0)+(item.quantity??0));
      ws.addRow([group.label||group.id,product.name,product.nameZh,product.code,i===0?group.cartons:null,item.quantity,product.unit??"pcs",product.unitPrice,
        item.quantity!==null&&product.unitPrice!==null?Number((item.quantity*product.unitPrice).toFixed(2)):null,
        i===0?group.grossWeightKg:null,i===0?group.cbm:null,product.currency??draft.currency??"Pendiente",product.brand,product.material]);
    }
    if(!group.items.length)ws.addRow([group.label,"Productos pendientes","","",group.cartons,null,"",null,null,group.grossWeightKg,group.cbm]);
  }
  for(const p of draft.products){const remainder=p.quantity===null?null:p.quantity-(assigned.get(p.id)??0);
    if(!assigned.has(p.id)||(remainder!==null&&remainder>0))ws.addRow(["Sin asignar",p.name,p.nameZh,p.code,null,remainder,p.unit??"pcs",p.unitPrice,remainder!==null&&p.unitPrice!==null?remainder*p.unitPrice:null,null,null,p.currency??draft.currency??"Pendiente",p.brand,p.material]);}
  const totals=computeDocumentTotals(draft);
  ws.addRow(["总计 / Totales","","","",totals.cartons,totals.quantity,"","","",totals.grossWeightKg,totals.cbm]);
  for(const [currency,amount] of Object.entries(totals.amounts))ws.addRow(["货值 / Mercancía",currency,amount]);
  if(!draft.groups.length)ws.addRow(["Totales declarados; distribución por caja pendiente"]);
  ws.addRow(["Los pesos y volúmenes corresponden al grupo y se cuentan una sola vez."]);
  const navy="FF0F1E3D",wine="FF7F0F1A",cream="FFFBFAF7";
  ws.eachRow((row,num)=>{row.font={name:"Archivo",size:num===1?16:10,color:{argb:navy}};row.alignment={vertical:"middle",wrapText:true};row.height=num===1?30:28;
    if(num===1||num===9){row.fill={type:"pattern",pattern:"solid",fgColor:{argb:num===1?navy:wine}};row.font={...row.font,bold:true,color:{argb:cream}};}});
  ws.autoFilter={from:"A9",to:`N${Math.max(9,ws.rowCount-2)}`};
  ws.views=[{state:"frozen",ySplit:9}];
  return new Uint8Array(await wb.xlsx.writeBuffer());
}
