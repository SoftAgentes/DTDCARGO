#!/usr/bin/env node

import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { DescribeStacksCommand, CloudFormationClient } from "@aws-sdk/client-cloudformation";
import {
  GetBucketEncryptionCommand,
  GetBucketVersioningCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  GetObjectLockConfigurationCommand,
  GetObjectRetentionCommand,
  GetObjectTaggingCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { GetQueueAttributesCommand, SQSClient } from "@aws-sdk/client-sqs";
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import {
  assertExternalEvidencePath,
  readExternalJson,
  validateContractEvidence,
  validateLiveValidationReceipt,
  validatePiplEvidence,
} from "./attachments-aws-evidence.mjs";

if (process.env.DTD_ATTACHMENTS_AWS_POSTFLIGHT_ALLOW !== "1") {
  throw new Error("Postflight AWS bloqueado: define DTD_ATTACHMENTS_AWS_POSTFLIGHT_ALLOW=1.");
}
const required = [
  "DTD_ATTACHMENTS_AWS_ACCOUNT_ID",
  "DTD_ATTACHMENTS_SCAN_REGION",
  "DTD_ATTACHMENTS_AWS_STACK_NAME",
  "DTD_ATTACHMENTS_AWS_LIVE_EVIDENCE_PATH",
  "DTD_ATTACHMENTS_AWS_CONTRACT_EVIDENCE_PATH",
  "DTD_ATTACHMENTS_PIPL_EVIDENCE_PATH",
  "DTD_ATTACHMENTS_AWS_ACTIVATION_EVIDENCE_PATH",
];
const missing = required.filter((key) => !process.env[key]?.trim());
if (missing.length) throw new Error(`Postflight AWS bloqueado: faltan ${missing.join(", ")}.`);

const accountId = process.env.DTD_ATTACHMENTS_AWS_ACCOUNT_ID.trim();
const region = process.env.DTD_ATTACHMENTS_SCAN_REGION.trim();
const stackName = process.env.DTD_ATTACHMENTS_AWS_STACK_NAME.trim();
const outputPath = assertExternalEvidencePath(process.env.DTD_ATTACHMENTS_AWS_ACTIVATION_EVIDENCE_PATH);
const sts = new STSClient({ region });
const caller = await sts.send(new GetCallerIdentityCommand({}));
if (caller.Account !== accountId) throw new Error("La identidad STS pertenece a otra cuenta AWS.");

const cloudformation = new CloudFormationClient({ region });
const described = await cloudformation.send(new DescribeStacksCommand({ StackName: stackName }));
const stack = described.Stacks?.[0];
if (!stack || !new Set(["CREATE_COMPLETE", "UPDATE_COMPLETE"]).has(stack.StackStatus)) {
  throw new Error(`Stack AWS no está listo: ${stack?.StackStatus ?? "ausente"}.`);
}
const outputs = Object.fromEntries((stack.Outputs ?? []).map((item) => [item.OutputKey, item.OutputValue]));
for (const key of ["ScanBucket", "ScanQueueUrl", "BackupBucket", "GuardDutyPlanId", "GuardDutyPlanStatus"]) {
  if (!outputs[key]) throw new Error(`Stack AWS no publicó ${key}.`);
}
if (outputs.Region !== region || outputs.GuardDutyPlanStatus !== "ACTIVE") {
  throw new Error("Stack AWS no acredita región y plan GuardDuty ACTIVE.");
}

const s3 = new S3Client({ region });
for (const bucket of [outputs.ScanBucket, outputs.BackupBucket]) {
  const versioning = await s3.send(new GetBucketVersioningCommand({ Bucket: bucket }));
  if (versioning.Status !== "Enabled") throw new Error(`Bucket ${bucket} no tiene versionado Enabled.`);
  const encryption = await s3.send(new GetBucketEncryptionCommand({ Bucket: bucket }));
  const algorithm = encryption.ServerSideEncryptionConfiguration?.Rules?.[0]?.ApplyServerSideEncryptionByDefault?.SSEAlgorithm;
  if (algorithm !== "aws:kms") throw new Error(`Bucket ${bucket} no usa SSE-KMS.`);
}
const lock = await s3.send(new GetObjectLockConfigurationCommand({ Bucket: outputs.BackupBucket }));
const defaultRetention = lock.ObjectLockConfiguration?.Rule?.DefaultRetention;
if (lock.ObjectLockConfiguration?.ObjectLockEnabled !== "Enabled"
    || defaultRetention?.Mode !== "COMPLIANCE" || defaultRetention?.Years !== 10) {
  throw new Error("Backup bucket no acredita Object Lock COMPLIANCE por diez años.");
}

const sqs = new SQSClient({ region });
const queue = await sqs.send(new GetQueueAttributesCommand({
  QueueUrl: outputs.ScanQueueUrl,
  AttributeNames: ["QueueArn", "RedrivePolicy", "SqsManagedSseEnabled"],
}));
if (!queue.Attributes?.QueueArn?.includes(`:${accountId}:`)) throw new Error("SQS pertenece a otra cuenta.");
if (queue.Attributes?.SqsManagedSseEnabled !== "true") throw new Error("SQS no acredita cifrado administrado.");
let redrive;
try {
  redrive = JSON.parse(queue.Attributes?.RedrivePolicy ?? "{}");
} catch {
  throw new Error("SQS publicó RedrivePolicy inválida.");
}
if (Number(redrive.maxReceiveCount) !== 8 || !redrive.deadLetterTargetArn) {
  throw new Error("SQS no acredita DLQ con maxReceiveCount 8.");
}

const now = new Date();
const live = await readExternalJson(process.env.DTD_ATTACHMENTS_AWS_LIVE_EVIDENCE_PATH);
const liveResult = validateLiveValidationReceipt(live.document, {
  accountId, region, scanBucket: outputs.ScanBucket, backupBucket: outputs.BackupBucket,
}, { now });

for (const [label, object, expectedStatus] of [
  ["clean", liveResult.cleanObject, "NO_THREATS_FOUND"],
  ["eicar", liveResult.eicarObject, "THREATS_FOUND"],
]) {
  const tagging = await s3.send(new GetObjectTaggingCommand({
    Bucket: outputs.ScanBucket, Key: object.key, VersionId: object.versionId,
  }));
  const status = tagging.TagSet?.find((tag) => tag.Key === "GuardDutyMalwareScanStatus")?.Value;
  if (status !== expectedStatus) throw new Error(`Postflight AWS no confirmó tag ${label}: ${expectedStatus}.`);
}
const liveRetention = await s3.send(new GetObjectRetentionCommand({
  Bucket: outputs.BackupBucket,
  Key: liveResult.backupObject.key,
  VersionId: liveResult.backupObject.versionId,
}));
if (liveRetention.Retention?.Mode !== "COMPLIANCE"
    || !liveRetention.Retention.RetainUntilDate
    || liveRetention.Retention.RetainUntilDate.getTime() < Date.parse(liveResult.retainUntil) - 5 * 60 * 1_000) {
  throw new Error("Postflight AWS no confirmó retención COMPLIANCE vigente en la versión del simulacro.");
}
const restored = await s3.send(new GetObjectCommand({
  Bucket: outputs.BackupBucket,
  Key: liveResult.backupObject.key,
  VersionId: liveResult.backupObject.versionId,
}));
if (!restored.Body) throw new Error("Postflight AWS no pudo restaurar la versión del simulacro.");
const restoredHash = createHash("sha256").update(Buffer.from(await restored.Body.transformToByteArray())).digest("hex");
if (restoredHash !== liveResult.restoreSha256) throw new Error("Postflight AWS obtuvo otro checksum al restaurar.");
let deleteDenied = false;
try {
  await s3.send(new DeleteObjectCommand({
    Bucket: outputs.BackupBucket,
    Key: liveResult.backupObject.key,
    VersionId: liveResult.backupObject.versionId,
  }));
} catch (error) {
  deleteDenied = error?.name === "AccessDenied" || error?.$metadata?.httpStatusCode === 403;
}
if (!deleteDenied) throw new Error("Postflight AWS no reprodujo la denegación de borrado Object Lock.");

const contract = await readExternalJson(process.env.DTD_ATTACHMENTS_AWS_CONTRACT_EVIDENCE_PATH);
const contractResult = await validateContractEvidence(contract.document, { accountId }, { now });
const pipl = await readExternalJson(process.env.DTD_ATTACHMENTS_PIPL_EVIDENCE_PATH);
const piplResult = await validatePiplEvidence(pipl.document, { accountId }, { now });

const verifiedAt = now.toISOString();
const receipt = {
  schemaVersion: 1,
  ok: true,
  verifiedAt,
  accountId,
  callerArn: caller.Arn,
  region,
  stackName,
  stackId: stack.StackId,
  guardDutyPlanId: outputs.GuardDutyPlanId,
  scanBucket: outputs.ScanBucket,
  backupBucket: outputs.BackupBucket,
  queueUrl: outputs.ScanQueueUrl,
  sourceEvidence: {
    live: { sha256: live.sha256, completedAt: liveResult.completedAt, rpoMs: liveResult.rpoMs, rtoMs: liveResult.rtoMs },
    contract: { sha256: contract.sha256, acceptedAt: contractResult.acceptedAt, reviewedAt: contractResult.reviewedAt },
    pipl: { sha256: pipl.sha256, decidedAt: piplResult.decidedAt, mechanism: piplResult.mechanism },
  },
  gates: {
    DTD_ATTACHMENTS_GUARDDUTY_PLAN_VERIFIED_AT: verifiedAt,
    DTD_ATTACHMENTS_AV_EICAR_VERIFIED_AT: liveResult.completedAt,
    DTD_ATTACHMENTS_OBJECT_LOCK_VERIFIED_AT: liveResult.completedAt,
    DTD_ATTACHMENTS_RESTORE_DRILL_VERIFIED_AT: liveResult.completedAt,
    DTD_ATTACHMENTS_AWS_CONTRACT_VERIFIED_AT: contractResult.reviewedAt,
    DTD_ATTACHMENTS_PIPL_TRANSFER_VERIFIED_AT: piplResult.decidedAt,
  },
};
await writeFile(outputPath, `${JSON.stringify(receipt, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
console.log(JSON.stringify({ ok: true, verifiedAt, stackName, rpoMs: liveResult.rpoMs, rtoMs: liveResult.rtoMs, outputPath }));
