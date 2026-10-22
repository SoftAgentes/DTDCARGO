import "server-only";
import ExcelJS from "exceljs";
import { computeDocumentTotals, type DocumentDraft, type DocumentProduct } from "@/lib/shared/document-import";

/** La columna «箱组 / Grupo» reserva este texto para los productos que no están en ninguna caja. */
const UNASSIGNED="Sin asignar";
/** Un grupo bautizado igual que el centinela viaja entrecomillado: crudo, la relectura lo confunde
 *  con productos sueltos y el grupo pierde sus cajas, su peso y su CBM. Y una caja sin número sale
 *  vacía: el id interno del grupo no es un dato del documento. */
const groupLabel=(label:string)=>label.trim()===UNASSIGNED?`«${label.trim()}»`:label;
/** Columna de dinero: dos decimales. 3 × 1,10 no se publica como 3,3000000000000003. */
const money=(value:number)=>Number(value.toFixed(2));

/** Values are assigned as strings/numbers, never executable formulas or hyperlinks. */
export async function exportDocument(draft:DocumentDraft,context:{markbox:string;code:string;confirmed:boolean;revision:number}) {
  const wb=new ExcelJS.Workbook();wb.creator="DTD Cargo";
  const ws=wb.addWorksheet("Packing List + Factura",{pageSetup:{orientation:"landscape",paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:"1:9"}});
  ws.columns=[{width:12},{width:20},{width:28},{width:16},{width:12},{width:12},{width:12},{width:14},{width:14},{width:18},{width:18},{width:14},{width:14},{width:20},{width:18}];
  ws.addRow(["DTD Cargo · 装箱单 + 商业发票 / Packing List + Factura"]);ws.mergeCells("A1:O1");
  ws.addRow([context.confirmed?"已确认 / Confirmado":"草稿 / Borrador — pendiente de confirmación",`Rev. ${context.revision}`]);
  ws.addRow(["Shipping Mark",context.markbox,"Compra",context.code]);
  ws.addRow(["供应商 / Proveedor",draft.supplier.company,"联系人 / Contacto",draft.supplier.contact]);
  ws.addRow(["Email",draft.supplier.email,"WeChat",draft.supplier.wechat,"Tel",draft.supplier.phone]);
  ws.addRow(["地址 / Dirección",draft.supplier.address,"City",draft.supplier.city]);
  ws.addRow(["Fecha",draft.docDate??"","Moneda",draft.currency??"Pendiente"]);
  ws.addRow([]);
  ws.addRow(["箱组 / Grupo","品名 / Producto","品名中文 / Nombre chino","编码 / Código","件数 / Cajas","数量 / Cantidad TOTAL","单位 / Unidad","单价 / Precio","金额 / Importe","毛重 kg / Peso bruto TOTAL del grupo","体积 m³ / CBM TOTAL del grupo","货币 / Moneda","品牌 / Marca","材质 / Material","净重 kg / Peso neto TOTAL del grupo"]);
  const assigned=new Map<string,number>();
  // El pie resume LO QUE MUESTRA LA HOJA: cantidad e importe se acumulan de las mismas filas que se
  // escriben, así un borrador que mete en las cajas más unidades de las que declara el producto no
  // publica filas sumando 12 bajo un pie que dice 10.
  let shown=0;const shownAmounts=new Map<string,number>();
  /** Única fila de producto, para el grupo y para «Sin asignar»: mismo redondeo del importe en las
   *  dos y un solo sitio donde se cuenta lo publicado. */
  function productRow(label:string,p:DocumentProduct,quantity:number|null,cartons:number|null,grossWeightKg:number|null,cbm:number|null,netWeightKg:number|null=null) {
    const currency=p.currency??draft.currency,amount=quantity!==null&&p.unitPrice!==null?money(quantity*p.unitPrice):null;
    if(quantity!==null)shown+=quantity;
    if(currency!==null&&amount!==null)shownAmounts.set(currency,(shownAmounts.get(currency)??0)+amount);
    ws.addRow([label,p.name,p.nameZh,p.code,cartons,quantity,p.unit??"pcs",p.unitPrice,amount,grossWeightKg,cbm,currency??"Pendiente",p.brand,p.material,netWeightKg]);
  }
  for(const group of draft.groups) {
    const label=groupLabel(group.label);
    for(let i=0;i<group.items.length;i++) {
      const item=group.items[i],product=draft.products.find(p=>p.id===item.productId);if(!product)continue;
      assigned.set(product.id,(assigned.get(product.id)??0)+(item.quantity??0));
      productRow(label,product,item.quantity,i===0?group.cartons:null,i===0?group.grossWeightKg:null,i===0?group.cbm:null,i===0?group.netWeightKg??null:null);
    }
    if(!group.items.length)ws.addRow([label,"Productos pendientes","","",group.cartons,null,"",null,null,group.grossWeightKg,group.cbm,null,null,null,group.netWeightKg??null]);
  }
  for(const p of draft.products){const remainder=p.quantity===null?null:p.quantity-(assigned.get(p.id)??0);
    if(!assigned.has(p.id)||(remainder!==null&&remainder>0))productRow(UNASSIGNED,p,remainder,null,null,null);}
  const totals=computeDocumentTotals(draft);
  // Qué se puede sumar lo decide el contrato compartido (unidades heterogéneas o huecos siguen
  // vacíos, y una moneda con precios incompletos no publica valor); cuánto, las filas de arriba.
  ws.addRow(["总计 / Totales","","","",totals.cartons,totals.quantity===null?null:Number(shown.toFixed(4)),"","","",totals.grossWeightKg,totals.cbm,null,null,null,totals.netWeightKg??null]);
  for(const currency of Object.keys(totals.amounts))ws.addRow(["货值 / Mercancía",currency,money(shownAmounts.get(currency)??0)]);
  if(!draft.groups.length)ws.addRow(["Totales declarados; distribución por caja pendiente"]);
  ws.addRow(["Los pesos y volúmenes corresponden al grupo y se cuentan una sola vez."]);
  const navy="FF0F1E3D",wine="FF7F0F1A",cream="FFFBFAF7";
  ws.eachRow((row,num)=>{row.font={name:"Archivo",size:num===1?16:10,color:{argb:navy}};row.alignment={vertical:"middle",wrapText:true};row.height=num===1?30:28;
    if(num===1||num===9){row.fill={type:"pattern",pattern:"solid",fgColor:{argb:num===1?navy:wine}};row.font={...row.font,bold:true,color:{argb:cream}};}});
  ws.autoFilter={from:"A9",to:`O${Math.max(9,ws.rowCount-2)}`};
  ws.views=[{state:"frozen",ySplit:9}];
  return new Uint8Array(await wb.xlsx.writeBuffer());
}
