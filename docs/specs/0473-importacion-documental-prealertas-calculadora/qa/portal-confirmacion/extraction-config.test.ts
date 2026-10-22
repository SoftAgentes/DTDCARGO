// @vitest-environment node
import { describe,expect,it } from "vitest";
import { configureQaExtraction,QaExtractionConfigurationError,GLM_TEST_CANONICAL_LEDGER_ROOT } from "./extraction-config";

const configured=()=>({QA_PDF_EXTRACTION_ENABLED:"true",ANTHROPIC_API_KEY:"synthetic-test-key",DOCUMENT_IMPORT_MODEL:"synthetic-model"});

describe("S3 separate Standard GLM launch configuration",()=>{
  const env=()=>({QA_GLM_TEST_ENABLED:"true",QA_GLM_TEST_LEDGER_ROOT:GLM_TEST_CANONICAL_LEDGER_ROOT,QA_GLM_TEST_GO:"synthetic-go-01",ANTHROPIC_API_KEY:"must-remove",DOCUMENT_IMPORT_MODEL:"must-remove"});
  it("requires the dedicated backend port and returns only non-secret launch controls",()=>{
    const values=env(), result=configureQaExtraction(values,{port:4323});
    expect(result).toEqual({pdfEnabled:true,glmTest:{canonicalRoot:GLM_TEST_CANONICAL_LEDGER_ROOT,goId:"synthetic-go-01"}});
    expect(values).not.toHaveProperty("ANTHROPIC_API_KEY");expect(values).not.toHaveProperty("DOCUMENT_IMPORT_MODEL");
    expect(JSON.stringify(result)).not.toContain("must-remove");
  });
  it.each([4320,4321,4322,4324])("does not activate GLM in port %s",port=>{expect(()=>configureQaExtraction(env(),{port})).toThrow(QaExtractionConfigurationError);});
  it("rejects mixed providers, proxy backends and missing explicit GO",()=>{
    expect(()=>configureQaExtraction({...env(),QA_PDF_EXTRACTION_ENABLED:"true"},{port:4323})).toThrow(QaExtractionConfigurationError);
    expect(()=>configureQaExtraction(env(),{port:4323,backend:"http://127.0.0.1:4320"})).toThrow(QaExtractionConfigurationError);
    expect(()=>configureQaExtraction({...env(),QA_GLM_TEST_GO:""},{port:4323})).toThrow(QaExtractionConfigurationError);
  });
});

describe("SDD-0473 PDF QA · configuración explícita",()=>{
  it("la demo por defecto elimina las credenciales heredadas y no las devuelve",()=>{
    const env:Record<string,string|undefined>={ANTHROPIC_API_KEY:"synthetic-test-key",DOCUMENT_IMPORT_MODEL:"synthetic-model",UNRELATED:"preserved"};
    const result=configureQaExtraction(env,{port:4320});
    expect(result).toEqual({pdfEnabled:false});expect(env).toEqual({UNRELATED:"preserved"});
    expect(JSON.stringify(result)).not.toMatch(/synthetic|ANTHROPIC|MODEL/);
  });
  it("un valor distinto de true no habilita la lectura ni conserva una clave",()=>{
    const env={...configured(),QA_PDF_EXTRACTION_ENABLED:"TRUE"};
    expect(configureQaExtraction(env,{port:4322})).toEqual({pdfEnabled:false});
    expect(env).not.toHaveProperty("ANTHROPIC_API_KEY");expect(env).not.toHaveProperty("DOCUMENT_IMPORT_MODEL");
  });
  it("el opt-in mantiene la configuración sólo en el proceso y devuelve una capacidad sin secretos",()=>{
    const env=configured(),before={...env};const result=configureQaExtraction(env,{port:4322});
    expect(env).toEqual(before);expect(result).toEqual({pdfEnabled:true});expect(Object.isFrozen(result)).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/synthetic|ANTHROPIC|MODEL/);
  });
  it.each(["ANTHROPIC_API_KEY","DOCUMENT_IMPORT_MODEL"])("falla antes de iniciar sin %s",key=>{
    const env:Record<string,string|undefined>=configured();delete env[key];
    expect(()=>configureQaExtraction(env,{port:4322})).toThrow(QaExtractionConfigurationError);
  });
  it.each(["ANTHROPIC_API_KEY","DOCUMENT_IMPORT_MODEL"])("falla antes de iniciar con %s vacío",key=>{
    const env:Record<string,string|undefined>=configured();env[key]="   ";
    expect(()=>configureQaExtraction(env,{port:4322})).toThrow(QaExtractionConfigurationError);
  });
  it.each([4320,4321,Number.NaN,65536])("no habilita una instancia en el puerto %s",port=>{
    expect(()=>configureQaExtraction(configured(),{port})).toThrow(QaExtractionConfigurationError);
  });
  it("rechaza el proxy al caso existente aun con clave y modelo presentes",()=>{
    expect(()=>configureQaExtraction(configured(),{port:4322,backend:"http://127.0.0.1:4320"})).toThrow(QaExtractionConfigurationError);
  });
  it("un nuevo root de lote no reinicia la autoridad del ledger GLM",()=>{
    expect(()=>configureQaExtraction({QA_GLM_TEST_ENABLED:"true",QA_GLM_TEST_GO:"synthetic-go-01",QA_GLM_TEST_LEDGER_ROOT:"C:/tmp/new-batch-output"},{port:4323})).toThrow(QaExtractionConfigurationError);
  });
  it("el error de inicio no incorpora los valores de configuración",()=>{
    try{configureQaExtraction(configured(),{port:4321});throw new Error("expected configuration failure");}
    catch(error){expect(error).toBeInstanceOf(QaExtractionConfigurationError);expect(String(error)).not.toMatch(/synthetic|ANTHROPIC_API_KEY|DOCUMENT_IMPORT_MODEL/);}
  });
});
