// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const io=vi.hoisted(()=>({ admin:vi.fn() }));
vi.mock("@/lib/db/admin",()=>({createAdminClient:io.admin}));
import { postBillJournalEntry } from "../bill-posting";
import { postReceiptJournalEntry, postUnidentifiedReceiptJournalEntry, postReceiptReclassEntry } from "../receipt-posting";
import { postSupplierPaymentJournalEntry } from "../supplier-payment-posting";
import { postExpenseJournalEntry } from "../expense-posting";
import { postClaimIndemnityEntry } from "../claim-posting";
import { postReferralCreditJournalEntry } from "../referral-credit-posting";
import { postSettlementJournalEntry } from "../settlement-posting";

function setup(cross=false) {
  const headers:Record<string,unknown>[]=[];
  const lines:Record<string,unknown>[]=[];
  let first=true;
  const crossClock=()=>{if(first&&cross)vi.setSystemTime(new Date("2026-10-21T04:00:00Z"));first=false;};
  io.admin.mockReturnValue({rpc:vi.fn(async()=>{crossClock();return {data:"JE-C1",error:null};}),from(table:string){
    let values:unknown=null, codes:string[]=[];const filters=new Map<string,unknown>();
    const execute=()=>{
      crossClock();
      if(values){if(table==="journal_entries")headers.push(values as Record<string,unknown>);else if(table==="journal_lines")lines.push(...values as Record<string,unknown>[]);return {data:{id:"entry"},error:null,count:0};}
      if(table==="accounts")return {data:codes.length?codes.map(code=>({id:code,code,is_postable:true})):{id:filters.get("id")??filters.get("code")??"account",is_postable:true},error:null,count:0};
      if(table==="journal_entries")return {data:null,error:null,count:0};
      throw Error("Unexpected table "+table);
    };
    const q={select:()=>q,eq:(k:string,v:unknown)=>{filters.set(k,v);return q;},is:()=>q,neq:()=>q,in:(_k:string,v:string[])=>{codes=v;return q;},
      insert:(v:unknown)=>{values=v;return q;},update:()=>q,delete:()=>q,maybeSingle:async()=>execute(),single:async()=>execute(),
      then:(resolve:(v:ReturnType<typeof execute>)=>unknown)=>Promise.resolve(execute()).then(resolve)};
    return q;
  }});
  return {headers,lines};
}
const base={tenantId:"tenant",amount:10.25,amountUsd:10.25,currency:"USD",cashAccountId:"cash"};
const posters:[string,(date?:string)=>Promise<{ok:boolean}>][]=[
  ["bill",entryDate=>postBillJournalEntry({...base,billId:"b",billCode:"B",expenseAccountId:"cost",entryDate})],
  ["receipt",entryDate=>postReceiptJournalEntry({...base,receiptId:"r",receiptCode:"R",entryDate})],
  ["unidentified",entryDate=>postUnidentifiedReceiptJournalEntry({...base,receiptId:"u",receiptCode:"U",entryDate})],
  ["supplier-payment",entryDate=>postSupplierPaymentJournalEntry({...base,paymentId:"p",paymentCode:"P",entryDate})],
  ["expense",entryDate=>postExpenseJournalEntry({...base,expenseId:"e",expenseCode:"E",accountId:"cost",method:"cash",entryDate})],
  ["claim",entryDate=>postClaimIndemnityEntry({...base,claimId:"c",claimCode:"C",method:"transfer",entryDate})],
  ["referral-credit",entryDate=>postReferralCreditJournalEntry({...base,referralId:"r",referralCode:"REF",referrerMarkbox:"DTD-TEST",invoiceId:"i",invoiceCode:"F",entryDate})],
  ["settlement",entryDate=>postSettlementJournalEntry({...base,settlementId:"s",settlementCode:"S",employeeName:"Sintético",netUsd:10.25,entryDate})],
];
beforeEach(()=>{vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(new Date("2026-10-21T03:59:59.999Z"));});
afterEach(()=>vi.useRealTimers());
// La factura ya no tiene fallback en JS: desde la 0497 el asiento lo crea la RPC
// atómica post_invoice_journal_entry_atomic con entry_date = issued_at persistido
// (invoice-posting-reverso.test.ts). Quedan los ocho fallbacks de siete posters.
describe("C1 · ocho fallbacks de siete posters reales",()=>{
  it.each(posters)("%s captura día antes del primer await; posted_at sigue instante UTC",async(_name,post)=>{
    const state=setup(true);
    expect(await post()).toMatchObject({ok:true});
    expect(state.headers).toHaveLength(1);
    expect(state.headers[0]).toMatchObject({entry_date:"2026-10-20",posted_at:"2026-10-21T04:00:00.000Z"});
    expect(state.lines.reduce((sum,l)=>sum+Number(l.debit),0)).toBe(10.25);
    expect(state.lines.reduce((sum,l)=>sum+Number(l.credit),0)).toBe(10.25);
  });
  it.each(posters)("%s conserva fecha explícita",async(_name,post)=>{
    const state=setup();expect(await post("2024-02-29")).toMatchObject({ok:true});
    expect(state.headers[0].entry_date).toBe("2024-02-29");
  });
  it("identificación conserva fecha real de recepción, no fecha actual",async()=>{
    const state=setup(true);
    expect(await postReceiptReclassEntry({...base,receiptId:"r",receiptCode:"R",entryDate:"2024-02-29"})).toMatchObject({ok:true});
    expect(state.headers[0].entry_date).toBe("2024-02-29");
  });
});
