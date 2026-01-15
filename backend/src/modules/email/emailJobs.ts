import { enqueueJob } from "../../jobs/jobQueue.js";
import { JOB_TYPES } from "../../jobs/jobTypes.js";
import type { EmailOptions } from "./emailService.js";
import { sha256Hex } from "../../lib/sha256.js";

export async function enqueueEmail(params: EmailOptions & { orgId?: string; userId?: string }) {
  const dedupe = sha256Hex(
    JSON.stringify({
      to: params.to,
      templateType: params.templateType,
      subject: params.subject,
      bodyHtml: params.bodyHtml,
      bodyText: params.bodyText,
      variables: params.variables,
      orgId: params.orgId,
      userId: params.userId,
    })
  );

  await enqueueJob({
    type: JOB_TYPES.EMAIL_SEND,
    payload: {
      to: params.to,
      templateType: params.templateType,
      subject: params.subject,
      bodyHtml: params.bodyHtml,
      bodyText: params.bodyText,
      variables: params.variables,
      orgId: params.orgId,
      userId: params.userId,
    },
    // email retries/backoff handled at job layer
    maxAttempts: 8,
    uniqueKey: dedupe,
  });
}

