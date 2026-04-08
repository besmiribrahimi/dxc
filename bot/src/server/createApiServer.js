const express = require("express");
const { resolveEventType } = require("../events");
const { validatePayload } = require("../validators/payloadValidators");
const { QueueFullError } = require("../queue/UpdateQueue");

function createApiServer({ config, queue, onAcceptedEvent }) {
  const app = express();

  app.use(express.json({ limit: "256kb" }));

  app.get("/health", (_req, res) => {
    return res.status(200).json({
      ok: true,
      queueSize: queue.size()
    });
  });

  app.post("/webhook/update", async (req, res) => {
    try {
      const providedSecret = String(req.header("x-webhook-secret") || "").trim();
      if (config.webhookSharedSecret && providedSecret !== config.webhookSharedSecret) {
        return res.status(401).json({ ok: false, error: "Unauthorized webhook request" });
      }

      const incomingPayload = req.body && typeof req.body === "object" ? req.body : {};
      const eventType = resolveEventType(incomingPayload);
      const validation = validatePayload(incomingPayload, eventType);

      if (!validation.ok) {
        return res.status(400).json({
          ok: false,
          error: "Invalid payload",
          details: validation.errors
        });
      }

      const queued = queue.enqueue(
        async () => onAcceptedEvent(validation.payload, eventType),
        { eventType, group: validation.payload.group }
      );

      return res.status(202).json({
        ok: true,
        message: "Update accepted and queued",
        queueJobId: queued.id,
        queuePosition: queued.position
      });
    } catch (error) {
      if (error instanceof QueueFullError) {
        return res.status(429).json({
          ok: false,
          error: "Too many pending updates",
          queueSize: queue.size()
        });
      }

      return res.status(500).json({
        ok: false,
        error: "Internal server error",
        detail: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  return app;
}

module.exports = {
  createApiServer
};
