import pino from "pino";
export const logger = pino({
  level: process.env.LOG_LEVEL || "debug",
  redact: {
    remove: true,
    paths: ["pid", "hostname", "time"],
  },
});
