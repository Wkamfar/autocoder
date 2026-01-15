/**
 * Email Service
 * 
 * Handles sending emails via Mailgun, SendGrid, AWS SES, SMTP, or console
 */

import axios from "axios";

export type EmailTemplateType =
  | "signup_confirmation"
  | "user_invitation"
  | "voice_enrollment_reminder"
  | "intent_approval_request"
  | "intent_executed"
  | "webhook_failure_alert"
  | "password_reset";

export interface EmailOptions {
  to: string;
  templateType: EmailTemplateType;
  subject: string;
  bodyHtml?: string;
  bodyText?: string;
  variables?: Record<string, string>;
}

/**
 * Send email using configured provider
 */
export async function sendEmail(options: EmailOptions): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  // Check which email provider is configured
  const emailProvider = process.env.EMAIL_PROVIDER || "console"; // console, mailgun, sendgrid, ses, smtp
  
  switch (emailProvider) {
    case "mailgun":
      return sendViaMailgun(options);
    case "sendgrid":
      return sendViaSendGrid(options);
    case "ses":
      return sendViaSES(options);
    case "smtp":
      return sendViaSMTP(options);
    case "console":
    default:
      // Log to console for development
      console.log("📧 EMAIL (console mode - NOT ACTUALLY SENT):", {
        to: options.to,
        subject: options.subject,
        template: options.templateType,
        body: options.bodyText || options.bodyHtml?.substring(0, 100),
        warning: "EMAIL_PROVIDER is set to 'console'. No email was actually sent. Set EMAIL_PROVIDER=mailgun to send real emails.",
      });
      return { success: true, messageId: `console_${Date.now()}` };
  }
}

/**
 * Send via Mailgun
 *
 * Env:
 * - EMAIL_PROVIDER=mailgun
 * - MAILGUN_API_KEY=...
 * - MAILGUN_DOMAIN=... (e.g. sandbox*.mailgun.org or your verified domain)
 * - MAILGUN_BASE_URL=https://api.mailgun.net (optional)
 * - FROM_EMAIL (optional, defaults to "noreply@<MAILGUN_DOMAIN>")
 * - FROM_NAME (optional)
 */
async function sendViaMailgun(options: EmailOptions): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  const baseUrl = (process.env.MAILGUN_BASE_URL || "https://api.mailgun.net").replace(/\/$/, "");
  if (!apiKey) {
    return { success: false, error: "Mailgun API key not configured" };
  }
  if (!domain) {
    return { success: false, error: "Mailgun domain not configured" };
  }

  // After guards, narrow types for strict TypeScript inside nested helpers.
  const mgApiKey: string = apiKey;
  const mgDomain: string = domain;

  const fromEmail: string = process.env.FROM_EMAIL || `noreply@${mgDomain}`;
  const fromName = process.env.FROM_NAME || "WIRE";
  const from = `${fromName} <${fromEmail}>`;
  const fallbackFrom = `${fromName} <postmaster@${mgDomain}>`;

  try {
    async function postMessage(payload: URLSearchParams) {
      return axios.post(`${baseUrl}/v3/${mgDomain}/messages`, payload, {
        auth: { username: "api", password: mgApiKey },
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 15_000,
        // Avoid throwing for 4xx so we can inspect and possibly retry.
        validateStatus: (s) => s >= 200 && s < 500,
      });
    }

    function buildForm(fromValue: string, includeReplyTo: boolean) {
      const form = new URLSearchParams();
      form.set("from", fromValue);
      form.set("to", options.to);
      form.set("subject", options.subject);
      if (options.bodyText) form.set("text", options.bodyText);
      if (options.bodyHtml) form.set("html", options.bodyHtml);
      if (includeReplyTo) {
        // Mailgun custom header syntax: h:Header-Name
        form.set("h:Reply-To", fromEmail);
      }
      return form;
    }

    // Attempt 1: honor configured FROM_EMAIL (e.g., noreply@wire.pose.xyz).
    const res1 = await postMessage(buildForm(from, false));
    if (res1.status >= 200 && res1.status < 300) {
      const id = (res1.data as any)?.id;
      return { success: true, ...(id ? { messageId: String(id) } : {}) };
    }

    // If Mailgun rejects the "from" domain (common while DNS verification is still propagating),
    // retry using the authorized Mailgun domain sender while preserving Reply-To as the desired address.
    const msg1 = String((res1.data as any)?.message || (res1.data as any)?.error || `Mailgun request failed (${res1.status})`);
    const looksLikeFromDomainRejection =
      res1.status === 400 &&
      /from/i.test(msg1) &&
      /(domain|address|not allowed|not authorized|must be)/i.test(msg1);

    if (looksLikeFromDomainRejection) {
      const res2 = await postMessage(buildForm(fallbackFrom, true));
      if (res2.status >= 200 && res2.status < 300) {
        const id = (res2.data as any)?.id;
        return {
          success: true,
          ...(id ? { messageId: String(id) } : {}),
        };
      }
      const msg2 = String((res2.data as any)?.message || (res2.data as any)?.error || `Mailgun request failed (${res2.status})`);
      return { success: false, error: msg2 };
    }

    return { success: false, error: msg1 };
  } catch (error: any) {
    return { success: false, error: error?.message || "Mailgun send failed" };
  }
}

/**
 * Send via SendGrid
 */
async function sendViaSendGrid(options: EmailOptions): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    return { success: false, error: "SendGrid API key not configured" };
  }
  
  try {
    const response = await axios.post(
      "https://api.sendgrid.com/v3/mail/send",
      {
        personalizations: [
          {
            to: [{ email: options.to }],
            subject: options.subject,
          },
        ],
        from: {
          email: process.env.FROM_EMAIL || "noreply@wire.pose.xyz",
          name: process.env.FROM_NAME || "WIRE",
        },
        content: [
          ...(options.bodyHtml
            ? [{ type: "text/html", value: options.bodyHtml }]
            : []),
          ...(options.bodyText
            ? [{ type: "text/plain", value: options.bodyText }]
            : []),
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );
    
    return { success: true, messageId: response.headers["x-message-id"] };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.errors?.[0]?.message || error.message,
    };
  }
}

/**
 * Send via AWS SES
 */
async function sendViaSES(options: EmailOptions): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  // TODO: Implement AWS SES integration
  return { success: false, error: "AWS SES not yet implemented" };
}

/**
 * Send via SMTP
 */
async function sendViaSMTP(options: EmailOptions): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  // TODO: Implement SMTP integration
  return { success: false, error: "SMTP not yet implemented" };
}

/**
 * Generate email template HTML
 */
export function generateEmailTemplate(
  templateType: EmailTemplateType,
  variables: Record<string, string>
): { subject: string; bodyHtml: string; bodyText: string } {
  switch (templateType) {
    case "signup_confirmation":
      return {
        subject: "Welcome to WIRE — your secure sign‑in link",
        bodyHtml: `
          <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="padding: 12px 0 8px 0;">
                <div style="font-size: 13px; letter-spacing: 0.08em; color: #666;">WIRE</div>
                <h1 style="margin: 10px 0 0 0; font-size: 22px; line-height: 1.2;">You're in. One click to open your secure wire console.</h1>
              </div>
              <p style="margin-top: 14px;">Hi ${variables.name || "there"},</p>
              <p>Welcome${variables.orgName ? ` to <strong>${variables.orgName}</strong>` : ""}. We set up your workspace and prepared a secure sign‑in link.</p>

              <div style="margin: 18px 0;">
                <a href="${variables.confirmationUrl}" style="background: #000; color: #fff; padding: 12px 18px; text-decoration: none; border-radius: 10px; display: inline-block; font-weight: 600;">
                  Open WIRE
                </a>
              </div>

              <div style="background: #f6f6f6; padding: 12px 14px; border-radius: 10px;">
                <div style="font-weight: 600; margin-bottom: 6px;">Why this feels instant</div>
                <ul style="margin: 0; padding-left: 18px; color: #333;">
                  <li>Short‑lived secure link (expires in ~15 minutes)</li>
                  <li>Opens directly into your dashboard — no copy/paste</li>
                  <li>Works even if your email security tools pre‑scan links</li>
                </ul>
              </div>

              <p style="margin-top: 16px; color: #444;">
                If the button doesn't work, paste this into your browser:
                <br />
                <a href="${variables.confirmationUrl}" style="color: #000; word-break: break-all;">${variables.confirmationUrl}</a>
              </p>

              ${
                variables.fallbackUrl
                  ? `<p style="color:#666; font-size: 13px; margin-top: 10px;">Prefer password sign‑in? Use <a href="${variables.fallbackUrl}" style="color:#000;">${variables.fallbackUrl}</a></p>`
                  : ""
              }

              <hr style="border: none; border-top: 1px solid #eee; margin: 18px 0;" />
              <p style="color: #666; font-size: 13px; line-height: 1.4;">
                Didn’t request this? You can ignore this email — nothing will change. If you believe this was sent in error, reply to this message and we’ll help.
              </p>
              <p style="color: #666; font-size: 13px;">— The WIRE Team</p>
            </body>
          </html>
        `,
        bodyText:
          `WIRE — secure sign-in link\n\n` +
          `Hi ${variables.name || "there"},\n\n` +
          `You're in${variables.orgName ? ` for ${variables.orgName}` : ""}. Open WIRE using this secure one-time link (expires in ~15 minutes):\n` +
          `${variables.confirmationUrl}\n\n` +
          (variables.fallbackUrl ? `Prefer password sign-in? ${variables.fallbackUrl}\n\n` : "") +
          `If you didn't request this, ignore this email.`,
      };
      
    case "user_invitation":
      return {
        subject: `You've been invited to join ${variables.orgName || "WIRE"}`,
        bodyHtml: `
          <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1>You've been invited!</h1>
              <p>Hi there,</p>
              <p>${variables.inviterName || "Someone"} has invited you to join ${variables.orgName || "their organization"} on WIRE.</p>
              <p>Your role will be: <strong>${variables.role || "MEMBER"}</strong></p>
              <p><a href="${variables.acceptUrl}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Accept Invitation</a></p>
              <p>This invitation expires on ${variables.expiresAt || "soon"}.</p>
              <p>Best regards,<br>The WIRE Team</p>
            </body>
          </html>
        `,
        bodyText: `You've been invited to join ${variables.orgName || "WIRE"}!\n\nAccept: ${variables.acceptUrl}`,
      };
      
    case "voice_enrollment_reminder":
      return {
        subject: "Complete Your Voice Enrollment",
        bodyHtml: `
          <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1>Complete Your Voice Enrollment</h1>
              <p>Hi ${variables.name || "there"},</p>
              <p>To use WIRE's voice verification features, please complete your voice enrollment.</p>
              <p><a href="${variables.enrollmentUrl}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Enroll Now</a></p>
              <p>Best regards,<br>The WIRE Team</p>
            </body>
          </html>
        `,
        bodyText: `Complete your voice enrollment: ${variables.enrollmentUrl}`,
      };
      
    case "intent_approval_request":
      return {
        subject: `Approval Required: ${variables.amount || "Transfer"}`,
        bodyHtml: `
          <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6;">
              <div style="background-color: #f8f8f8; padding: 20px; border-radius: 8px;">
                <h1 style="color: #111; font-size: 22px; margin: 0 0 10px;">Approval Required</h1>
                <p style="color: #333; margin: 0 0 12px;">Hi ${variables.name || "there"},</p>
                <p style="color: #333; margin: 0 0 12px;">
                  ${variables.initiatorName || "A team member"} has requested approval for a transfer:
                </p>
                <div style="background: #fff; padding: 16px; border-radius: 6px; margin: 16px 0;">
                  <ul style="margin: 0; padding-left: 20px; color: #333;">
                    <li><strong>Amount:</strong> ${variables.amount || "N/A"}</li>
                    <li><strong>Beneficiary:</strong> ${variables.beneficiary || "N/A"}</li>
                    <li><strong>Purpose:</strong> ${variables.purpose || "N/A"}</li>
                    ${variables.requiredApprovals ? `<li><strong>Required Approvals:</strong> ${variables.requiredApprovals}</li>` : ""}
                  </ul>
                </div>
                <p style="text-align: center; margin: 18px 0 22px;">
                  <a href="${variables.approvalUrl}" style="background: #000; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: bold; display: inline-block;">
                    Review & Approve
                  </a>
                </p>
                <p style="color: #666; font-size: 12px; margin: 0;">
                  This approval request will expire if not reviewed promptly.
                </p>
                <p style="color: #777; font-size: 14px; margin-top: 18px;">— The WIRE Team</p>
              </div>
            </body>
          </html>
        `,
        bodyText: `Approval Required\n\nHi ${variables.name || "there"},\n\n${variables.initiatorName || "A team member"} has requested approval for:\nAmount: ${variables.amount || "N/A"}\nBeneficiary: ${variables.beneficiary || "N/A"}\nPurpose: ${variables.purpose || "N/A"}\n${variables.requiredApprovals ? `Required Approvals: ${variables.requiredApprovals}\n` : ""}\nReview: ${variables.approvalUrl}`,
      };
      
    case "intent_executed":
      return {
        subject: `Transfer Executed: ${variables.amount || "Transfer"}`,
        bodyHtml: `
          <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1>Transfer Executed</h1>
              <p>Hi ${variables.name || "there"},</p>
              <p>Your transfer has been successfully executed:</p>
              <ul>
                <li><strong>Amount:</strong> ${variables.amount || "N/A"}</li>
                <li><strong>Beneficiary:</strong> ${variables.beneficiary || "N/A"}</li>
                <li><strong>Reference:</strong> ${variables.reference || "N/A"}</li>
              </ul>
              <p><a href="${variables.viewUrl}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Details</a></p>
              <p>Best regards,<br>The WIRE Team</p>
            </body>
          </html>
        `,
        bodyText: `Transfer executed: ${variables.amount || "N/A"}. View: ${variables.viewUrl}`,
      };
      
    case "webhook_failure_alert":
      return {
        subject: "Webhook Delivery Failed",
        bodyHtml: `
          <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1>Webhook Delivery Failed</h1>
              <p>A webhook delivery has failed after multiple retry attempts.</p>
              <ul>
                <li><strong>Webhook:</strong> ${variables.webhookName || "N/A"}</li>
                <li><strong>Event:</strong> ${variables.eventType || "N/A"}</li>
                <li><strong>URL:</strong> ${variables.webhookUrl || "N/A"}</li>
              </ul>
              <p>Please check your webhook configuration.</p>
              <p>Best regards,<br>The WIRE Team</p>
            </body>
          </html>
        `,
        bodyText: `Webhook delivery failed: ${variables.webhookName || "N/A"}`,
      };
      
    case "password_reset":
      return {
        subject: "Reset your WIRE password (secure one‑time link)",
        bodyHtml: `
          <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6;">
              <div style="background-color: #f8f8f8; padding: 20px; border-radius: 8px;">
                <h1 style="color: #111; font-size: 22px; margin: 0 0 10px;">Reset your password</h1>
                <p style="color: #333; margin: 0 0 12px;">Hi ${variables.name || "there"},</p>
                <p style="color: #333; margin: 0 0 12px;">
                  We received a request to reset your WIRE password. Use the secure button below to set a new one.
                </p>
                <p style="text-align: center; margin: 18px 0 22px;">
                  <a href="${variables.resetUrl}" style="background: #000; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: bold; display: inline-block;">
                    Set new password
                  </a>
                </p>
                <p style="color: #333; font-size: 12px; margin: 0 0 10px;">
                  <strong>Security details</strong>: This link is one‑time and expires in 60 minutes${variables.expiresAt ? ` (about ${variables.expiresAt})` : ""}.
                </p>
                <p style="color: #333; font-size: 12px; margin: 0 0 10px;">
                  If the button doesn't work, copy and paste this URL into your browser:<br/>
                  <a href="${variables.resetUrl}" style="color: #000; word-break: break-all;">${variables.resetUrl}</a>
                </p>
                <p style="color: #333; font-size: 12px; margin: 0;">
                  If you didn’t request this, you can ignore this email. Your account remains protected.
                </p>
                <p style="color: #777; font-size: 14px; margin-top: 18px;">— The WIRE Security Team</p>
              </div>
            </body>
          </html>
        `,
        bodyText:
          `Reset your WIRE password\n\n` +
          `Use this one-time link to set a new password (expires in 60 minutes):\n` +
          `${variables.resetUrl}\n\n` +
          `If you didn’t request this, ignore this email.\n`,
      };
      
    default:
      return {
        subject: "Notification from WIRE",
        bodyHtml: `<p>${variables.message || "You have a notification from WIRE."}</p>`,
        bodyText: variables.message || "You have a notification from WIRE.",
      };
  }
}
