import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { enrollComplete, enrollStart, getPoseVoiceStatus, verifyVoice } from "../modules/poseVoice/service.js";

export const poseVoiceRoutes: FastifyPluginAsync = async (app) => {
  async function filePartToBuffer(part: any): Promise<Buffer> {
    if (!part) return Buffer.alloc(0);
    if (typeof part.toBuffer === "function") {
      return await part.toBuffer();
    }
    // @fastify/multipart provides part.file as a stream
    const stream = part.file ?? part;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  // Status: used by frontend to decide whether to run onboarding.
  app.get("/pose/voice/status", async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: "Authentication required" });
    return await getPoseVoiceStatus(req.user.id);
  });

  app.post("/pose/voice/enroll/start", async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: "Authentication required" });
    const res = await enrollStart({ userId: req.user.id });
    return res;
  });

  app.post("/pose/voice/enroll/complete", async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: "Authentication required" });

    if (!req.isMultipart()) {
      return reply.code(400).send({ error: "Expected multipart/form-data" });
    }

    try {
      const parts = req.parts();
      const fields: Record<string, any> = {};
      const files: Array<{ buffer: Buffer; filename?: string; mimeType?: string; fieldname: string }> = [];

      for await (const part of parts as any) {
        if (part.type === "file") {
          const buf = await filePartToBuffer(part);
          files.push({
            buffer: buf,
            filename: part.filename,
            mimeType: part.mimetype,
            fieldname: part.fieldname,
          });
        } else {
          fields[part.fieldname] = part.value;
        }
      }

      const schema = z.object({
        enrollment_id: z.string().min(1),
        pose_id: z.string().min(1),
        pose_challenge_id: z.string().min(1),
        client_metadata_json: z.string().default("{}"),
        consent_flags_json: z.string().default("{}"),
      });
      const body = schema.parse(fields);

      // Takes are uploaded as take_ihc, take_phrase, take_name (optional).
      const takeMap: Record<string, string> = {
        take_ihc: "ihc",
        take_phrase: "phrase",
        take_name: "name",
      };
      const takes = files
        .filter((f) => Boolean(takeMap[f.fieldname]))
        .map((f) => ({
          buffer: f.buffer,
          filename: f.filename,
          mimeType: f.mimeType,
          label: takeMap[f.fieldname]!,
        }));

      if (takes.length < 2) {
        return reply.code(400).send({ error: "Missing required audio takes" });
      }

      let clientMetadata: any = {};
      let consentFlags: any = {};
      try {
        clientMetadata = JSON.parse(body.client_metadata_json || "{}");
      } catch {
        return reply.code(400).send({ error: "Invalid client_metadata_json" });
      }
      try {
        consentFlags = JSON.parse(body.consent_flags_json || "{}");
      } catch {
        return reply.code(400).send({ error: "Invalid consent_flags_json" });
      }

      const res = await enrollComplete({
        userId: req.user.id,
        enrollmentId: body.enrollment_id,
        poseId: body.pose_id,
        poseChallengeId: body.pose_challenge_id,
        takes,
        clientMetadata,
        consentFlags,
      });

      return res;
    } catch (err: any) {
      // Convert common errors into product-grade 4xx responses (avoid generic 500 for user mistakes).
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: "Invalid request", code: "INVALID_REQUEST", details: err.errors });
      }
      const msg = err?.message ? String(err.message) : "Enrollment failed";
      // Most failures here are client-side (bad audio, wrong token, invalid state).
      return reply.code(400).send({ error: msg, code: "ENROLLMENT_FAILED" });
    }
  });

  app.post("/pose/voice/verify", async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: "Authentication required" });
    if (!req.isMultipart()) return reply.code(400).send({ error: "Expected multipart/form-data" });

    try {
      const parts = req.parts();
      const fields: Record<string, any> = {};
      let audio: Buffer | null = null;

      for await (const part of parts as any) {
        if (part.type === "file" && part.fieldname === "audio") {
          audio = await filePartToBuffer(part);
        } else if (part.type !== "file") {
          fields[part.fieldname] = part.value;
        }
      }

      if (!audio) return reply.code(400).send({ error: "Missing audio file" });

      const schema = z.object({
        pose_id: z.string().min(1),
        tone_duration_ms: z.string().optional(),
      });
      const body = schema.parse(fields);

      const tone = body.tone_duration_ms ? Number(body.tone_duration_ms) : null;
      const res = await verifyVoice({
        userId: req.user.id,
        poseId: body.pose_id,
        audio,
        toneDurationMs: tone && Number.isFinite(tone) ? tone : null,
      });
      return res;
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: "Invalid request", code: "INVALID_REQUEST", details: err.errors });
      }
      const msg = err?.message ? String(err.message) : "Verification failed";
      return reply.code(400).send({ error: msg, code: "VOICE_VERIFY_FAILED" });
    }
  });
};

