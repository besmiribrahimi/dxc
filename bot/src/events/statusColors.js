const STATUS_COLORS = {
  winner: 0x22c55e,
  eliminated: 0xef4444,
  info: 0x3b82f6
};

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function colorForStatus(status) {
  const normalized = normalizeStatus(status);
  return STATUS_COLORS[normalized] || STATUS_COLORS.info;
}

module.exports = {
  normalizeStatus,
  colorForStatus,
  STATUS_COLORS
};
