const fs = require("fs");
const path = require("path");

const AUDIT_FILE_PATH = path.resolve(__dirname, "..", "..", "ticket-audit.log");

function appendTicketAudit(event) {
  const record = {
    at: new Date().toISOString(),
    ...(event && typeof event === "object" ? event : {})
  };

  fs.appendFileSync(AUDIT_FILE_PATH, `${JSON.stringify(record)}\n`, "utf8");
  return record;
}

module.exports = {
  AUDIT_FILE_PATH,
  appendTicketAudit
};
