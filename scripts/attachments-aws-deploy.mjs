#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  CloudFormationClient,
  CreateStackCommand,
  DescribeStacksCommand,
  UpdateStackCommand,
  waitUntilStackCreateComplete,
  waitUntilStackUpdateComplete,
} from "@aws-sdk/client-cloudformation";
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import { assertExternalEvidencePath } from "./attachments-aws-evidence.mjs";

if (process.env.DTD_ATTACHMENTS_AWS_DEPLOY_ALLOW !== "1") {
  throw new Error("Despliegue AWS bloqueado: define DTD_ATTACHMENTS_AWS_DEPLOY_ALLOW=1.");
}

const required = [
  "DTD_ATTACHMENTS_AWS_ACCOUNT_ID",
  "DTD_ATTACHMENTS_SCAN_REGION",
  "DTD_ATTACHMENTS_AWS_STACK_NAME",
  "DTD_ATTACHMENTS_AWS_BUDGET_EMAIL",
  "DTD_ATTACHMENTS_AWS_DEPLOY_EVIDENCE_PATH",
];
const missing = required.filter((key) => !process.env[key]?.trim());
if (missing.length) throw new Error(`Despliegue AWS bloqueado: faltan ${missing.join(", ")}.`);

const accountId = process.env.DTD_ATTACHMENTS_AWS_ACCOUNT_ID.trim();
const region = process.env.DTD_ATTACHMENTS_SCAN_REGION.trim();
const stackName = process.env.DTD_ATTACHMENTS_AWS_STACK_NAME.trim();
const environment = process.env.DTD_ATTACHMENTS_AWS_ENVIRONMENT?.trim() || "lab";
const monthlyBudget = Number(process.env.DTD_ATTACHMENTS_AWS_MONTHLY_BUDGET_USD ?? (environment === "prod" ? "75" : "10"));
if (!/^\d{12}$/.test(accountId)) throw new Error("DTD_ATTACHMENTS_AWS_ACCOUNT_ID debe contener 12 dígitos.");
if (!/^[a-z][a-z0-9-]{2,127}$/.test(stackName)) throw new Error("DTD_ATTACHMENTS_AWS_STACK_NAME no es válido.");
if (!new Set(["lab", "prod"]).has(environment)) throw new Error("DTD_ATTACHMENTS_AWS_ENVIRONMENT debe ser lab o prod.");
if (environment === "prod" && process.env.DTD_ATTACHMENTS_PRODUCTION_CONFIRMED !== "1") {
  throw new Error("Despliegue productivo bloqueado: falta DTD_ATTACHMENTS_PRODUCTION_CONFIRMED=1.");
}
if (!Number.isFinite(monthlyBudget) || monthlyBudget < 1) throw new Error("El presupuesto mensual AWS no es válido.");

const evidencePath = assertExternalEvidencePath(process.env.DTD_ATTACHMENTS_AWS_DEPLOY_EVIDENCE_PATH);
const templateBody = await readFile(resolve("infra/attachments-aws/cloudformation.json"), "utf8");
const client = new CloudFormationClient({ region });
const sts = new STSClient({ region });
const caller = await sts.send(new GetCallerIdentityCommand({}));
if (caller.Account !== accountId) throw new Error("La identidad STS pertenece a otra cuenta AWS.");

const stackInput = {
  StackName: stackName,
  TemplateBody: templateBody,
  Capabilities: ["CAPABILITY_NAMED_IAM"],
  Parameters: [
    { ParameterKey: "ProjectName", ParameterValue: "dtdcargo-attachments" },
    { ParameterKey: "Environment", ParameterValue: environment },
    { ParameterKey: "BudgetNotificationEmail", ParameterValue: process.env.DTD_ATTACHMENTS_AWS_BUDGET_EMAIL.trim() },
    { ParameterKey: "MonthlyBudgetUsd", ParameterValue: String(monthlyBudget) },
  ],
  Tags: [
    { Key: "Project", Value: "DTDCargo" },
    { Key: "DataClassification", Value: "restricted-attachments" },
    { Key: "ManagedBy", Value: "cloudformation" },
  ],
};

let action = "create";
try {
  await client.send(new DescribeStacksCommand({ StackName: stackName }));
  action = "update";
} catch (error) {
  if (error?.name !== "ValidationError") throw error;
}

if (action === "create") {
  await client.send(new CreateStackCommand({ ...stackInput, EnableTerminationProtection: environment === "prod" }));
  const waited = await waitUntilStackCreateComplete({ client, maxWaitTime: 1800, minDelay: 5, maxDelay: 30 }, { StackName: stackName });
  if (waited.state !== "SUCCESS") throw new Error(`CloudFormation no completó create: ${waited.state}.`);
} else {
  try {
    await client.send(new UpdateStackCommand(stackInput));
    const waited = await waitUntilStackUpdateComplete({ client, maxWaitTime: 1800, minDelay: 5, maxDelay: 30 }, { StackName: stackName });
    if (waited.state !== "SUCCESS") throw new Error(`CloudFormation no completó update: ${waited.state}.`);
  } catch (error) {
    if (error?.name === "ValidationError" && /No updates are to be performed/i.test(error.message ?? "")) {
      action = "no-change";
    } else {
      throw error;
    }
  }
}

const described = await client.send(new DescribeStacksCommand({ StackName: stackName }));
const stack = described.Stacks?.[0];
if (!stack || !new Set(["CREATE_COMPLETE", "UPDATE_COMPLETE"]).has(stack.StackStatus)) {
  throw new Error(`Stack AWS no está listo: ${stack?.StackStatus ?? "ausente"}.`);
}
const outputs = Object.fromEntries((stack.Outputs ?? []).map((item) => [item.OutputKey, item.OutputValue]));
const receipt = {
  schemaVersion: 1,
  ok: true,
  deployedAt: new Date().toISOString(),
  accountId,
  callerArn: caller.Arn,
  region,
  stackName,
  stackId: stack.StackId,
  stackStatus: stack.StackStatus,
  environment,
  action,
  outputs,
};
await writeFile(evidencePath, `${JSON.stringify(receipt, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
console.log(JSON.stringify({ ok: true, action, stackName, stackStatus: stack.StackStatus, evidencePath }));
