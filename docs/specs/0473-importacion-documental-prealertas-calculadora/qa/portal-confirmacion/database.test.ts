// @vitest-environment node
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createDemoDatabase, IDS, QA_CASES } from "./database";
import { getWorkspace, applyImport, saveWorkspace, getDocumentLabels } from "@/lib/studio/document-import/service";
import { emptyDocumentDraft, projectSupplierDocument, computeDocumentTotals } from "@/lib/shared/document-import";
import { estimateDocuments } from "@/lib/studio/document-import/estimate";
import { QA_RATE_SNAPSHOT } from "./server";

describe("S3 fictitious PGlite uses real apply, save, confirm and calculator", () => {
  it("rejects an estimate snapshot atomically when the real row changes before persistence",async()=>{
    const database=await createDemoDatabase(process.cwd(),{separateGlmCases:true});
    try{
      const prior=await getWorkspace(database.db,database.workspaceId);
      await saveWorkspace(database.db,prior,{kind:"client",id:IDS.user},{draft:prior.draft,expectedRevision:prior.revision,commandId:randomUUID()});
      const result=await database.saveEstimateSnapshot(prior,{inputs:{revision:prior.revision},rates:QA_RATE_SNAPSHOT,result:{fictitious:true}});
      expect(result).toBeNull();expect((await database.pg.query<{count:number}>("select count(*)::integer count from document_estimate_snapshots")).rows[0].count).toBe(0);
      const latest=await getWorkspace(database.db,prior.id);
      const saved=await database.saveEstimateSnapshot(latest,{inputs:{revision:latest.revision},rates:QA_RATE_SNAPSHOT,result:{fictitious:true}});expect(saved).toBeTruthy();
      expect(await database.saveEstimateSnapshot({...latest,client_id:"99999999-9999-4999-8999-999999999999"},{inputs:{},rates:{},result:{}})).toBeNull();
      expect((await database.pg.query<{count:number}>("select count(*)::integer count from document_estimate_snapshots")).rows[0].count).toBe(1);
    }finally{await database.pg.close();}
  });
  it("returns the known completed job for identical SHA/context and rejects another revision context",async()=>{
    const database=await createDemoDatabase(process.cwd());
    try{
      const first={id:randomUUID(),workspaceId:database.workspaceId,fileName:"synthetic.xlsx",kind:"combined",size:1,sha256:"a".repeat(64),context:"b".repeat(64),result:emptyDocumentDraft()};
      expect(await database.storeJob(first)).toBe(first.id);
      expect(await database.storeJob({...first,id:randomUUID()})).toBe(first.id);
      await expect(database.storeJob({...first,id:randomUUID(),context:"c".repeat(64)})).rejects.toMatchObject({code:"qa_glm_context_conflict"});
      expect((await database.pg.query<{count:number}>("select count(*)::integer count from document_import_jobs")).rows[0].count).toBe(1);
    }finally{await database.pg.close();}
  });
  it("keeps two purchases isolated and reloads the real supplier revision and physical codes", async () => {
    const database = await createDemoDatabase(process.cwd(), { separateGlmCases: true });
    try {
      expect(database.caseWorkspaces?.pdf).not.toBe(database.caseWorkspaces?.xlsx);
      const w = await getWorkspace(database.db, database.workspaceId), otherId = database.caseWorkspaces!.xlsx;
      const draft = emptyDocumentDraft(); draft.supplier.company = "Proveedor ficticio"; draft.supplier.wechat = "fictitious-wechat"; draft.currency = "USD";
      draft.transportDeclarations = { battery: false, specialCargo: false };
      draft.products = [{ id: "synthetic-cup", name: "Taza ficticia", nameZh: "", code: "F-1", brand: "", material: "", quantity: 20, unit: "pcs", unitPrice: 2, currency: "USD" }];
      draft.groups = [{ id: "synthetic-group", label: "Grupo ficticio", cartons: 2, grossWeightKg: 30, netWeightKg: 24, cbm: 0.2, items: [{ productId: "synthetic-cup", quantity: 20 }] }];
      draft.declaredTotals = { cartons: 2, grossWeightKg: 30, netWeightKg: 24, cbm: 0.2, amount: 40 };
      const jobId = randomUUID(); await database.storeJob({ id: jobId, workspaceId: w.id, fileName: "synthetic-only.xlsx", kind: "combined", size: 1, sha256: "d".repeat(64), context: "e".repeat(64), result: draft });
      const client = { kind: "client" as const, id: IDS.user }, supplier = { kind: "supplier" as const, id: "supplier:demo" };
      await expect(applyImport(database.db, await getWorkspace(database.db, otherId), client, { jobId, expectedRevision: 0, commandId: randomUUID() })).rejects.toMatchObject({ status: 404 });
      const receipt = await applyImport(database.db, w, client, { jobId, expectedRevision: w.revision, commandId: randomUUID() });
      expect(receipt.workspace.id).toBe(w.id); expect(receipt.revision).toBe(w.revision + 1);
      let latest = await getWorkspace(database.db, w.id);
      const editable = projectSupplierDocument(latest.draft as typeof draft); editable.transportDeclarations = { battery: false, specialCargo: false };
      // Human edits, distinct from extraction answers; the server reconciles against its real prior.
      editable.groups[0].grossWeightKg = 32; editable.groups[0].cbm = 0.24;
      editable.declaredTotals.grossWeightKg = 32; editable.declaredTotals.cbm = 0.24;
      const resolvedIssueIds = editable.issues.filter(issue => issue.code === "review_required" && ["supplier.company", "supplier.wechat"].includes(issue.path)).map(issue => issue.id);
      expect(resolvedIssueIds).toHaveLength(2);
      const saved = await saveWorkspace(database.db, latest, supplier, { draft: editable, resolvedIssueIds, expectedRevision: latest.revision, commandId: randomUUID() });
      latest = await getWorkspace(database.db, w.id); expect(latest.revision).toBe(saved.revision);
      const confirmed = await saveWorkspace(database.db, latest, supplier, { draft: projectSupplierDocument(latest.draft as typeof draft), expectedRevision: latest.revision, commandId: randomUUID() }, true);
      latest = await getWorkspace(database.db, w.id); expect(confirmed.confirmed).toBe(true); expect(latest.confirmed_revision).toBe(latest.revision);
      const labels = await getDocumentLabels(database.db, latest, latest.revision);
      expect(labels.labels).toHaveLength(2); expect(new Set(labels.labels.map(label => label.boxCode)).size).toBe(2);
      expect(labels.labels.every(label => label.code === QA_CASES.pdf.code)).toBe(true);
      const estimate = estimateDocuments([latest], { cityId: "maracaibo" }, QA_RATE_SNAPSHOT.rates);
      expect(estimate.totals).toMatchObject({ cartons: 2, grossWeightKg: 32, cbm: 0.24 });
      expect(computeDocumentTotals((await getWorkspace(database.db, otherId)).draft as typeof draft).quantity).toBeNull();
    } finally { await database.pg.close(); }
  });
});
