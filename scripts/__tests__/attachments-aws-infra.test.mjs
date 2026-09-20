// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const template = JSON.parse(readFileSync(resolve("infra/attachments-aws/cloudformation.json"), "utf8"));
const resources = template.Resources;

describe("infraestructura AWS de adjuntos", () => {
  it("mantiene ambos buckets privados, cifrados y versionados", () => {
    for (const name of ["ScanBucket", "BackupBucket"]) {
      const properties = resources[name].Properties;
      expect(properties.VersioningConfiguration.Status).toBe("Enabled");
      expect(properties.PublicAccessBlockConfiguration).toEqual({
        BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true,
      });
      expect(properties.BucketEncryption.ServerSideEncryptionConfiguration[0]
        .ServerSideEncryptionByDefault.SSEAlgorithm).toBe("aws:kms");
    }
  });

  it("retiene el bucket WORM y exige COMPLIANCE por diez años", () => {
    expect(resources.BackupBucket.DeletionPolicy).toBe("Retain");
    expect(resources.BackupBucket.UpdateReplacePolicy).toBe("Retain");
    expect(resources.BackupBucket.Properties.ObjectLockEnabled).toBe(true);
    expect(resources.BackupBucket.Properties.ObjectLockConfiguration.Rule.DefaultRetention)
      .toEqual({ Mode: "COMPLIANCE", Years: 10 });
  });

  it("protege scan/v1 y validation pero entrega al worker solo scan/v1", () => {
    expect(resources.MalwareProtectionPlan.Properties.ProtectedResource.S3Bucket.ObjectPrefixes)
      .toEqual(["scan/v1/", "validation/"]);
    expect(resources.ScanResultRule.Properties.EventPattern["detail-type"])
      .toEqual(["GuardDuty Malware Protection Object Scan Result"]);
    expect(resources.ScanResultRule.Properties.EventPattern.detail.s3ObjectDetails.objectKey)
      .toEqual([{ prefix: "scan/v1/" }]);
  });

  it("usa SQS cifrada, DLQ durable y política cerrada a la regla", () => {
    expect(resources.ScanResultQueue.Properties.SqsManagedSseEnabled).toBe(true);
    expect(resources.ScanResultQueue.Properties.RedrivePolicy.maxReceiveCount).toBe(8);
    expect(resources.ScanDeadLetterQueue.Properties.MessageRetentionPeriod).toBe(1_209_600);
    const statement = resources.ScanResultQueuePolicy.Properties.PolicyDocument.Statement[0];
    expect(statement.Principal).toEqual({ Service: "events.amazonaws.com" });
    expect(statement.Condition.ArnEquals["aws:SourceArn"]).toEqual({ "Fn::GetAtt": ["ScanResultRule", "Arn"] });
  });

  it("separa privilegios del worker y del simulacro de borrado", () => {
    const workerActions = resources.WorkerPolicy.Properties.PolicyDocument.Statement.flatMap((item) => item.Action);
    const validationActions = resources.ValidationPolicy.Properties.PolicyDocument.Statement.flatMap((item) => item.Action);
    expect(workerActions).not.toContain("s3:DeleteObjectVersion");
    expect(validationActions).toContain("s3:DeleteObjectVersion");
  });

  it("crea presupuesto con alertas 50, 75 y pronóstico 90", () => {
    const notices = resources.MonthlyBudget.Properties.NotificationsWithSubscribers;
    expect(notices.map((item) => item.Notification.Threshold)).toEqual([50, 75, 90]);
    expect(notices.at(-1).Notification.NotificationType).toBe("FORECASTED");
  });

  it("alerta backlog mayor a treinta minutos y cualquier mensaje en la DLQ", () => {
    expect(resources.ScanQueueAgeAlarm.Properties).toMatchObject({
      MetricName: "ApproximateAgeOfOldestMessage", Threshold: 1800,
    });
    expect(resources.ScanDeadLetterAlarm.Properties).toMatchObject({
      MetricName: "ApproximateNumberOfMessagesVisible", Threshold: 1,
    });
    expect(resources.AlarmTopic.Properties.Subscription[0].Protocol).toBe("email");
  });
});
