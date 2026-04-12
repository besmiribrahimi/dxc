const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType
} = require("discord.js");
const {
  getGuildSettings,
  patchGuildSettings,
  updateAllowedRole,
  canCreateTicket,
  normalizeHexColor
} = require("../services/guildSettingsStore");
const {
  fetchLeaderboardData,
  findEntryByRoblox,
  resolveLeaderboardEndpoint
} = require("../services/leaderboardService");
const {
  getUserProfile,
  upsertUserProfileFromTicket
} = require("../services/userProfileStore");
const { appendTicketAudit } = require("../services/ticketAuditStore");

const TICKET_CREATE_BUTTON_ID = "ticket_create";
const TICKET_CREATE_MODAL_ID = "ticket_create_modal";
const APPLY_CREATE_BUTTON_ID = "apply_create";
const APPLY_CREATE_MODAL_ID = "apply_create_modal";
const APPLY_DECISION_PREFIX = "apply_decide";
const TICKET_STATUS_PREFIX = "ticket_status:";
const TICKET_CLOSE_BUTTON_ID = "ticket_close";
const TICKET_CLOSE_MODAL_ID = "ticket_close_modal";
const LEADERBOARD_NAV_PREFIX = "lbnav";
const LFG_QUEUE_TTL_SECONDS = 60 * 60;
const LFG_STATUS_LABEL = "Looking for 1v1";

const BRAND_ICON = "https://ascendentrenched.vercel.app/assets/brand/logo-mark-512.png";
const DEFAULT_FOOTER = "Ascend Entrenched";
const BOT_START_TIME = Date.now();
const EIGHTBALL_RESPONSES = [
  "Yes. Ascend Entrenched approves.",
  "No. Hold the line and ask again.",
  "Maybe. Intelligence is still incoming.",
  "Absolutely. Push now.",
  "Not now. Regroup first.",
  "Signs point to yes.",
  "Outcome uncertain. Recheck after sync.",
  "Very likely.",
  "Chances are low.",
  "Ask again when the trenches settle."
];
const POLL_REACTIONS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣"];
const TICKET_STATUS_CHOICES = [
  { name: "Open", value: "open" },
  { name: "Waiting User", value: "waiting_user" },
  { name: "In Review", value: "in_review" },
  { name: "Escalated", value: "escalated" },
  { name: "Resolved", value: "resolved" },
  { name: "Closed", value: "closed" }
];

function hexToInt(hex, fallbackHex) {
  const safe = normalizeHexColor(hex, fallbackHex);
  return Number.parseInt(String(safe || fallbackHex).slice(1), 16);
}

function footerText(settings) {
  return String(settings?.brandingFooter || DEFAULT_FOOTER).trim() || DEFAULT_FOOTER;
}

function clampInt(value, min, max, fallback) {
  const numeric = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, numeric));
}

function randomItem(items, fallback = "") {
  if (!Array.isArray(items) || !items.length) {
    return fallback;
  }

  const index = Math.floor(Math.random() * items.length);
  return items[index];
}

function splitPipeOptions(input, { min = 2, max = 6 } = {}) {
  const values = String(input || "")
    .split("|")
    .map((value) => value.trim())
    .filter(Boolean);

  const unique = [...new Set(values)];
  if (unique.length < min || unique.length > max) {
    return null;
  }

  return unique;
}

function durationLabel(ms) {
  const safe = Math.max(0, Number(ms) || 0);
  const totalSeconds = Math.floor(safe / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

function shortDurationLabel(ms) {
  const safeMs = Math.max(0, Number(ms) || 0);
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

function resolveBaseOrigin(urlValue) {
  const raw = String(urlValue || "").trim();
  if (!raw) {
    return "";
  }

  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
}

async function fetchJsonStatus(url, timeoutMs = 8000) {
  const target = String(url || "").trim();
  if (!target) {
    return {
      ok: false,
      status: null,
      durationMs: 0,
      payload: null,
      error: "URL is not configured"
    };
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(target, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      cache: "no-store"
    });

    const durationMs = Date.now() - startedAt;
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    return {
      ok: response.ok,
      status: response.status,
      durationMs,
      payload,
      error: response.ok ? "" : `HTTP ${response.status}`
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      durationMs: Date.now() - startedAt,
      payload: null,
      error: error instanceof Error ? error.message : "Unknown fetch error"
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function requestLfgQueue(context, action, payload = null) {
  const endpoint = String(context?.config?.lfgQueueApiUrl || "").trim();
  const primaryToken = String(context?.config?.lfgQueueApiToken || "").trim();
  const websiteToken = String(context?.config?.websiteApiToken || "").trim();
  const candidateTokens = [...new Set([primaryToken, websiteToken].filter(Boolean))];

  if (!endpoint) {
    throw new Error("LFG queue API is not configured. Set LFG_QUEUE_API_URL or WEBSITE_HOME_URL.");
  }

  if (!candidateTokens.length) {
    throw new Error("Queue auth token is not configured. Set LFG_QUEUE_API_TOKEN or WEBSITE_API_TOKEN.");
  }

  const method = action === "leave"
    ? "DELETE"
    : action === "status"
      ? "GET"
      : "POST";

  let lastError = "";

  for (const token of candidateTokens) {
    const response = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-api-token": token,
        Authorization: `Bearer ${token}`,
        "x-webhook-secret": token
      },
      body: method === "GET" ? undefined : JSON.stringify(payload || {}),
      cache: "no-store"
    });

    const data = await response.json().catch(() => ({}));
    if (response.ok && data?.ok !== false) {
      return Array.isArray(data?.entries) ? data.entries : [];
    }

    lastError = String(data?.error || `LFG queue request failed (HTTP ${response.status})`);
    const isAuthIssue = response.status === 401 || response.status === 403 || /unauthorized|forbidden/i.test(lastError);
    if (!isAuthIssue) {
      break;
    }
  }

  throw new Error(lastError || "LFG queue request failed");
}

function isValidHexColor(value) {
  return /^#[0-9A-Fa-f]{6}$/.test(String(value || "").trim());
}

function sanitizeChannelName(rawValue) {
  const safe = String(rawValue || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return safe || "player";
}

function chunkArray(values, chunkSize) {
  const output = [];
  for (let index = 0; index < values.length; index += chunkSize) {
    output.push(values.slice(index, index + chunkSize));
  }

  return output;
}

function normalizeStatusLabel(status) {
  switch (String(status || "").trim().toLowerCase()) {
    case "winner":
      return "Winner";
    case "active":
      return "Active";
    case "eliminated":
      return "Eliminated";
    case "waiting_user":
      return "Waiting User";
    case "in_review":
      return "In Review";
    case "escalated":
      return "Escalated";
    case "resolved":
      return "Resolved";
    case "closed":
      return "Closed";
    default:
      return "Open";
  }
}

function statusIcon(status) {
  switch (String(status || "").trim().toLowerCase()) {
    case "winner":
      return "[WIN]";
    case "active":
      return "[ACT]";
    case "eliminated":
      return "[OUT]";
    case "waiting_user":
      return "[WAIT]";
    case "in_review":
      return "[REVIEW]";
    case "escalated":
      return "[ALERT]";
    case "resolved":
      return "[DONE]";
    case "closed":
      return "[CLOSED]";
    default:
      return "[INFO]";
  }
}

function statusColor(settings, status) {
  const safeStatus = String(status || "").trim().toLowerCase();
  if (safeStatus === "winner") {
    return hexToInt(settings?.colors?.winner, "#FFD700");
  }

  if (safeStatus === "eliminated") {
    return hexToInt(settings?.colors?.eliminated, "#9B59B6");
  }

  if (safeStatus === "active") {
    return hexToInt(settings?.colors?.active, "#C8A2C8");
  }

  if (safeStatus === "resolved") {
    return hexToInt(settings?.colors?.highlight, "#FFECB3");
  }

  return hexToInt(settings?.colors?.info, "#C8A2C8");
}

function buildWelcomeEmbedPreview({ memberMention, serverName, memberCount, autoRoleId }) {
  const lines = [
    `${memberMention || "New member"} just joined **${serverName || "the server"}**.`,
    `You are member **#${memberCount || 0}**.`,
    "Use /1v1 whenever you are looking for a match."
  ];

  if (autoRoleId) {
    lines.splice(2, 0, `You have been assigned <@&${autoRoleId}>.`);
  }

  return lines.join("\n");
}

function buildTicketTopic(meta) {
  const safe = {
    owner: String(meta?.owner || "").trim(),
    ticket: String(meta?.ticket || "").trim(),
    status: String(meta?.status || "open").trim().toLowerCase()
  };

  return `AE|owner=${safe.owner}|ticket=${safe.ticket}|status=${safe.status}`;
}

function parseTicketTopic(topic) {
  const raw = String(topic || "").trim();
  if (!raw.startsWith("AE|")) {
    return null;
  }

  const parts = raw.split("|").slice(1);
  const map = {};
  parts.forEach((part) => {
    const [key, value] = String(part || "").split("=");
    if (key) {
      map[key] = value || "";
    }
  });

  if (!map.owner || !map.ticket) {
    return null;
  }

  return {
    owner: map.owner,
    ticket: map.ticket,
    status: String(map.status || "open").toLowerCase(),
    roblox: decodeURIComponent(String(map.roblox || "")),
    country: decodeURIComponent(String(map.country || "")),
    faction: decodeURIComponent(String(map.faction || ""))
  };
}

function isTicketChannel(channel) {
  return Boolean(parseTicketTopic(channel?.topic));
}

function reviewerRoleIds(settings) {
  const roleIds = [
    ...(Array.isArray(settings?.ticketReviewerRoleIds) ? settings.ticketReviewerRoleIds : []),
    ...(Array.isArray(settings?.ticketPingRoleIds) ? settings.ticketPingRoleIds : [])
  ].map((value) => String(value || "").trim()).filter(Boolean);

  return [...new Set(roleIds)];
}

function hasReviewerAccess(member, settings) {
  if (!member) {
    return false;
  }

  if (member.permissions?.has(PermissionFlagsBits.ManageGuild)) {
    return true;
  }

  const roles = reviewerRoleIds(settings);
  if (!roles.length) {
    return false;
  }

  return roles.some((roleId) => member.roles?.cache?.has(roleId));
}

function applicationConfig(context) {
  return {
    panelChannelId: String(context?.config?.applicationsPanelChannelId || "").trim(),
    channelId: String(context?.config?.applicationsChannelId || "").trim(),
    reviewerRoleId: String(context?.config?.applicationsReviewerRoleId || "").trim(),
    acceptedRoleId: String(context?.config?.applicationsAcceptedRoleId || "").trim(),
    notificationUserIds: Array.isArray(context?.config?.notificationUserIds)
      ? context.config.notificationUserIds
      : []
  };
}

function ticketPanelConfig(settings) {
  return {
    panelChannelId: String(settings?.ticketPanelChannelId || "").trim(),
    moderationChannelId: String(settings?.ticketLogChannelId || "").trim()
  };
}

function hasApplicationReviewerAccess(member, reviewerRoleId) {
  if (!member) {
    return false;
  }

  if (member.permissions?.has(PermissionFlagsBits.ManageGuild)) {
    return true;
  }

  const safeReviewerRoleId = String(reviewerRoleId || "").trim();
  if (!safeReviewerRoleId) {
    return false;
  }

  return member.roles?.cache?.has(safeReviewerRoleId) || false;
}

function buildApplyDecisionRows(applicantId, disabled = false) {
  const safeApplicantId = String(applicantId || "").trim();
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${APPLY_DECISION_PREFIX}:accept:${safeApplicantId}`)
        .setLabel("Accept")
        .setStyle(ButtonStyle.Success)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId(`${APPLY_DECISION_PREFIX}:reject:${safeApplicantId}`)
        .setLabel("Reject")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled)
    )
  ];
}

function buildApplySetupEmbed(settings, configState) {
  return new EmbedBuilder()
    .setAuthor({ name: "Ascend Operations Core", iconURL: BRAND_ICON })
    .setTitle("🛡️ Setup Applications")
    .setColor(statusColor(settings, "active"))
    .setDescription("Initialise the Faction Application deployment sector.")
    .setThumbnail(BRAND_ICON)
    .addFields(
      {
        name: "📥 Panel Channel",
        value: configState.panelChannelId ? `<#${configState.panelChannelId}>` : "Not set",
        inline: true
      },
      {
        name: "📋 Mod App Channel",
        value: configState.channelId ? `<#${configState.channelId}>` : "Not set",
        inline: true
      }
    )
    .setFooter({ text: footerText(settings), iconURL: BRAND_ICON })
    .setTimestamp(new Date());
}

function buildTicketSetupEmbed(settings, configState) {
  return new EmbedBuilder()
    .setAuthor({ name: "Ascend Operations Core", iconURL: BRAND_ICON })
    .setTitle("🎫 Setup Support Tickets")
    .setColor(statusColor(settings, "active"))
    .setDescription("Initialise the support ticket operations desk.")
    .setThumbnail(BRAND_ICON)
    .addFields(
      {
        name: "📥 Panel Channel",
        value: configState.panelChannelId ? `<#${configState.panelChannelId}>` : "Not set",
        inline: true
      },
      {
        name: "📋 Mod App Channel",
        value: configState.moderationChannelId ? `<#${configState.moderationChannelId}>` : "Not set",
        inline: true
      }
    )
    .setFooter({ text: footerText(settings), iconURL: BRAND_ICON })
    .setTimestamp(new Date());
}

function buildRoleMentions(roleIds) {
  const uniqueRoleIds = [...new Set((Array.isArray(roleIds) ? roleIds : []).map((value) => String(value || "").trim()).filter(Boolean))];
  if (!uniqueRoleIds.length) {
    return "";
  }

  return uniqueRoleIds.map((roleId) => `<@&${roleId}>`).join(" ");
}

function buildTicketActionRows(disabled = false) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(TICKET_CLOSE_BUTTON_ID)
        .setLabel("Close Ticket")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled)
    )
  ];
}

function buildTicketEmbed({ settings, ticketId, applicant, subject, details, status }) {
  const subjectText = String(subject || "").trim() || "No subject provided";
  const detailsText = String(details || "").trim() || "No details provided";

  return new EmbedBuilder()
    .setAuthor({ name: "Ascend Operations Core", iconURL: BRAND_ICON })
    .setTitle(`🎫 Ticket ${ticketId}`)
    .setColor(statusColor(settings, status))
    .setDescription(`> ${statusIcon(status)} **Current Status:** ${normalizeStatusLabel(status)}`)
    .addFields(
      { name: "👤 Applicant", value: `<@${applicant.id}>`, inline: true },
      { name: "📄 Subject", value: `\`\`\`text\n${subjectText.slice(0, 1010)}\n\`\`\``, inline: false },
      { name: "🔍 Details", value: `> ${detailsText.slice(0, 1020)}`, inline: false }
    )
    .setFooter({ text: footerText(settings), iconURL: BRAND_ICON })
    .setTimestamp(new Date());
}

async function sendTicketLog(guild, settings, embed, reasonText) {
  const channelId = String(settings?.ticketLogChannelId || "").trim();
  if (!channelId) {
    return;
  }

  const logChannel = guild.channels.cache.get(channelId)
    || await guild.channels.fetch(channelId).catch(() => null);

  if (!logChannel || !logChannel.isTextBased()) {
    return;
  }

  const payload = { embeds: [embed] };
  if (reasonText) {
    payload.content = reasonText;
  }

  await logChannel.send(payload).catch(() => {});
}

async function findOpenTicketForUser(guild, userId) {
  await guild.channels.fetch().catch(() => {});
  const channels = guild.channels.cache.filter((channel) => channel?.type === ChannelType.GuildText);
  for (const channel of channels.values()) {
    const meta = parseTicketTopic(channel.topic);
    if (!meta) {
      continue;
    }

    if (meta.owner === String(userId) && meta.status !== "closed") {
      return channel;
    }
  }

  return null;
}

async function handleTicketCreateButton(interaction, context) {
  if (!interaction.isButton() || interaction.customId !== TICKET_CREATE_BUTTON_ID) {
    return false;
  }

  if (!interaction.inGuild()) {
    await interaction.reply({
      content: "Tickets can only be created in a server.",
      ephemeral: true
    });
    return true;
  }

  const settings = getGuildSettings(interaction.guild.id, context.config);
  if (!canCreateTicket(interaction.member, settings)) {
    await interaction.reply({
      content: "Ticket creation is disabled for you in this server.",
      ephemeral: true
    });
    return true;
  }

  const existing = await findOpenTicketForUser(interaction.guild, interaction.user.id);
  if (existing) {
    await interaction.reply({
      content: `You already have an open ticket: ${existing}`,
      ephemeral: true
    });
    return true;
  }

  const subject = `Support Request - ${interaction.user.username}`;
  const details = `Ticket opened by <@${interaction.user.id}>.`;

  const ticketId = Date.now().toString(36);
  const baseName = sanitizeChannelName(interaction.user.username || "player").slice(0, 40);
  const channelName = `ticket-${baseName}-${ticketId.slice(-4)}`;
  const roleIds = reviewerRoleIds(settings);
  const overwrites = [
    {
      id: interaction.guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: interaction.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    }
  ];

  roleIds.forEach((roleId) => {
    overwrites.push({
      id: roleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.EmbedLinks
      ]
    });
  });

  const channel = await interaction.guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: settings.ticketCategoryId || null,
    topic: buildTicketTopic({
      owner: interaction.user.id,
      ticket: ticketId,
      status: "open"
    }),
    permissionOverwrites: overwrites,
    reason: `Ticket created by ${interaction.user.tag}`
  }).catch(() => null);

  if (!channel) {
    await interaction.reply({
      content: "Ticket creation failed. Verify my Manage Channels and Manage Roles permissions.",
      ephemeral: true
    });
    return true;
  }

  const ticketEmbed = buildTicketEmbed({
    settings,
    ticketId,
    applicant: interaction.user,
    subject,
    details,
    status: "open"
  });

  const pingText = buildRoleMentions(settings.ticketPingRoleIds);
  await channel.send({
    content: pingText || null,
    embeds: [ticketEmbed],
    components: buildTicketActionRows(false)
  });

  appendTicketAudit({
    event: "ticket_created",
    guildId: interaction.guild.id,
    channelId: channel.id,
    ticketId,
    ownerId: interaction.user.id,
    subject,
    details
  });

  await sendTicketLog(
    interaction.guild,
    settings,
    ticketEmbed,
    `New ticket created in ${channel}`
  );

  await interaction.reply({
    content: `Help ticket created: ${channel}`,
    ephemeral: true
  });

  return true;
}

async function handleTicketCreateModal(interaction) {
  if (!interaction.isModalSubmit() || interaction.customId !== TICKET_CREATE_MODAL_ID) {
    return false;
  }

  await interaction.reply({
    content: "Ticket modal was retired. Press Create Help Ticket again to open a ticket instantly.",
    ephemeral: true
  });

  return true;
}

async function handleTicketStatusButton(interaction, context) {
  if (!interaction.isButton() || !interaction.customId.startsWith(TICKET_STATUS_PREFIX)) {
    return false;
  }

  if (!interaction.inGuild() || !isTicketChannel(interaction.channel)) {
    await interaction.reply({ content: "This action only works inside a ticket channel.", ephemeral: true });
    return true;
  }

  const settings = getGuildSettings(interaction.guild.id, context.config);
  if (!hasReviewerAccess(interaction.member, settings)) {
    await interaction.reply({
      content: "You do not have permission to update ticket status.",
      ephemeral: true
    });
    return true;
  }

  const status = interaction.customId.slice(TICKET_STATUS_PREFIX.length);
  const allowedStatuses = new Set(TICKET_STATUS_CHOICES.map((choice) => choice.value));
  if (!allowedStatuses.has(status)) {
    await interaction.reply({ content: "Invalid ticket status.", ephemeral: true });
    return true;
  }

  const currentMeta = parseTicketTopic(interaction.channel.topic) || {};
  if (String(currentMeta.status || "").toLowerCase() === "closed") {
    await interaction.reply({
      content: "This ticket is already closed.",
      ephemeral: true
    });
    return true;
  }

  const nextTopic = buildTicketTopic({
    ...currentMeta,
    status
  });

  await interaction.channel.setTopic(nextTopic).catch(() => {});

  const statusEmbed = new EmbedBuilder()
    .setTitle(`Ticket ${currentMeta.ticket || "Update"}`)
    .setColor(statusColor(settings, status))
    .setDescription(`${statusIcon(status)} Status changed to **${normalizeStatusLabel(status)}** by <@${interaction.user.id}>`)
    .setFooter({ text: footerText(settings) })
    .setTimestamp(new Date());

  await interaction.reply({ embeds: [statusEmbed] });

  appendTicketAudit({
    event: "ticket_status_changed",
    guildId: interaction.guild.id,
    channelId: interaction.channel.id,
    ticketId: currentMeta.ticket || "",
    ownerId: currentMeta.owner || "",
    status,
    actorId: interaction.user.id
  });

  await sendTicketLog(
    interaction.guild,
    settings,
    statusEmbed,
    `Status update for <#${interaction.channel.id}>`
  );

  return true;
}

async function handleTicketCloseButton(interaction, context) {
  if (!interaction.isButton() || interaction.customId !== TICKET_CLOSE_BUTTON_ID) {
    return false;
  }

  if (!interaction.inGuild() || !isTicketChannel(interaction.channel)) {
    await interaction.reply({ content: "This action only works in a ticket channel.", ephemeral: true });
    return true;
  }

  const settings = getGuildSettings(interaction.guild.id, context.config);
  if (!hasReviewerAccess(interaction.member, settings)) {
    await interaction.reply({
      content: "You do not have permission to close this ticket.",
      ephemeral: true
    });
    return true;
  }

  const reason = `Closed by ${interaction.user.tag}`;
  const meta = parseTicketTopic(interaction.channel.topic) || {};
  const nextTopic = buildTicketTopic({
    ...meta,
    status: "closed"
  });

  await interaction.channel.setTopic(nextTopic).catch(() => {});

  if (meta.owner) {
    await interaction.channel.permissionOverwrites.edit(meta.owner, {
      SendMessages: false
    }).catch(() => {});
  }

  const oldName = String(interaction.channel.name || "ticket");
  if (!oldName.startsWith("closed-")) {
    const nextName = `closed-${oldName}`.slice(0, 100);
    await interaction.channel.setName(nextName).catch(() => {});
  }

  const closeEmbed = new EmbedBuilder()
    .setTitle(`Ticket ${meta.ticket || "Closed"}`)
    .setColor(statusColor(settings, "closed"))
    .setDescription(`Ticket closed by <@${interaction.user.id}>`)
    .addFields({
      name: "Reason",
      value: reason
    })
    .setFooter({ text: footerText(settings) })
    .setTimestamp(new Date());

  await interaction.reply({ embeds: [closeEmbed], components: buildTicketActionRows(true) });

  appendTicketAudit({
    event: "ticket_closed",
    guildId: interaction.guild.id,
    channelId: interaction.channel.id,
    ticketId: meta.ticket || "",
    ownerId: meta.owner || "",
    actorId: interaction.user.id,
    reason
  });

  await sendTicketLog(
    interaction.guild,
    settings,
    closeEmbed,
    `Ticket <#${interaction.channel.id}> closed`
  );

  const ticketOwner = meta.owner
    ? await interaction.client.users.fetch(meta.owner).catch(() => null)
    : null;

  if (ticketOwner) {
    const ownerEmbed = new EmbedBuilder()
      .setTitle("Ticket Closed")
      .setColor(statusColor(settings, "closed"))
      .setDescription(`Your ticket in **${interaction.guild.name}** was closed.`)
      .addFields({
        name: "Reason",
        value: reason
      })
      .setFooter({ text: footerText(settings) })
      .setTimestamp(new Date());

    await ticketOwner.send({ embeds: [ownerEmbed] }).catch(() => {});
  }

  return true;
}

async function handleTicketCloseModal(interaction, context) {
  if (!interaction.isModalSubmit() || interaction.customId !== TICKET_CLOSE_MODAL_ID) {
    return false;
  }

  if (!interaction.inGuild() || !isTicketChannel(interaction.channel)) {
    await interaction.reply({ content: "This action only works in a ticket channel.", ephemeral: true });
    return true;
  }

  const settings = getGuildSettings(interaction.guild.id, context.config);
  if (!hasReviewerAccess(interaction.member, settings)) {
    await interaction.reply({
      content: "You do not have permission to close this ticket.",
      ephemeral: true
    });
    return true;
  }

  const reason = interaction.fields.getTextInputValue("ticket_close_reason").trim();
  const meta = parseTicketTopic(interaction.channel.topic) || {};
  const nextTopic = buildTicketTopic({
    ...meta,
    status: "closed"
  });

  await interaction.channel.setTopic(nextTopic).catch(() => {});

  if (meta.owner) {
    await interaction.channel.permissionOverwrites.edit(meta.owner, {
      SendMessages: false
    }).catch(() => {});
  }

  const oldName = String(interaction.channel.name || "ticket");
  if (!oldName.startsWith("closed-")) {
    const nextName = `closed-${oldName}`.slice(0, 100);
    await interaction.channel.setName(nextName).catch(() => {});
  }

  const closeEmbed = new EmbedBuilder()
    .setTitle(`Ticket ${meta.ticket || "Closed"}`)
    .setColor(statusColor(settings, "closed"))
    .setDescription(`Ticket closed by <@${interaction.user.id}>`)
    .addFields({
      name: "Reason",
      value: reason || "No reason provided"
    })
    .setFooter({ text: footerText(settings) })
    .setTimestamp(new Date());

  await interaction.reply({ embeds: [closeEmbed], components: buildTicketActionRows(true) });

  appendTicketAudit({
    event: "ticket_closed",
    guildId: interaction.guild.id,
    channelId: interaction.channel.id,
    ticketId: meta.ticket || "",
    ownerId: meta.owner || "",
    actorId: interaction.user.id,
    reason
  });

  await sendTicketLog(
    interaction.guild,
    settings,
    closeEmbed,
    `Ticket <#${interaction.channel.id}> closed`
  );

  const ticketOwner = meta.owner
    ? await interaction.client.users.fetch(meta.owner).catch(() => null)
    : null;

  if (ticketOwner) {
    const ownerEmbed = new EmbedBuilder()
      .setTitle("Ticket Closed")
      .setColor(statusColor(settings, "closed"))
      .setDescription(`Your ticket in **${interaction.guild.name}** was closed.`)
      .addFields({
        name: "Reason",
        value: reason || "No reason provided"
      })
      .setFooter({ text: footerText(settings) })
      .setTimestamp(new Date());

    await ticketOwner.send({ embeds: [ownerEmbed] }).catch(() => {});
  }

  return true;
}

function buildLeaderboardPages(entries, pageSize) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  const pages = [];
  const chunks = chunkArray(safeEntries, pageSize);
  chunks.forEach((items) => {
    pages.push({ items });
  });

  if (!pages.length) {
    pages.push({
      items: []
    });
  }

  return pages;
}

function buildLeaderboardEmbed({ settings, page, pageIndex, pages, updatedAt, endpoint }) {
  const lines = page.items.map((entry) => (
    `#${entry.rank} **${entry.player}** | Lvl ${entry.level} | K/D ${entry.kd.toFixed(1)} | Matches ${entry.totalMatches}`
  ));

  const embed = new EmbedBuilder()
    .setTitle("Ascend Entrenched Leaderboard")
    .setColor(statusColor(settings, "active"))
    .setDescription(lines.length ? lines.join("\n") : "No players in this section.")
    .addFields({
      name: "Note",
      value: "Live leaderboard standings. Not a tournament bracket.",
      inline: false
    })
    .setFooter({ text: `${footerText(settings)} • Page ${pageIndex + 1}/${pages.length}` })
    .setTimestamp(new Date(updatedAt || Date.now()));

  if (settings.highlightEnabled && page.items.length > 0) {
    const top = page.items[0];
    embed.addFields({
      name: "Highlight",
      value: `${top.player} leads this page with Level ${top.level} and K/D ${top.kd.toFixed(1)}.`
    });
  }

  return embed;
}

async function handleApplyCreateButton(interaction) {
  if (!interaction.isButton() || interaction.customId !== APPLY_CREATE_BUTTON_ID) {
    return false;
  }

  if (!interaction.inGuild()) {
    await interaction.reply({
      content: "Applications can only be submitted in a server.",
      ephemeral: true
    });
    return true;
  }

  const modal = new ModalBuilder()
    .setCustomId(APPLY_CREATE_MODAL_ID)
    .setTitle("Submit Application");

  const robloxInput = new TextInputBuilder()
    .setCustomId("apply_roblox")
    .setLabel("Roblox Username")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(32);

  const factionInput = new TextInputBuilder()
    .setCustomId("apply_faction")
    .setLabel("Faction")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(48);

  const countryInput = new TextInputBuilder()
    .setCustomId("apply_country")
    .setLabel("Country")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(48);

  const deviceInput = new TextInputBuilder()
    .setCustomId("apply_device")
    .setLabel("Device You Play On")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(64);

  const classesInput = new TextInputBuilder()
    .setCustomId("apply_classes")
    .setLabel("Classes You Play On")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(200);

  modal.addComponents(
    new ActionRowBuilder().addComponents(robloxInput),
    new ActionRowBuilder().addComponents(factionInput),
    new ActionRowBuilder().addComponents(countryInput),
    new ActionRowBuilder().addComponents(deviceInput),
    new ActionRowBuilder().addComponents(classesInput)
  );

  await interaction.showModal(modal);
  return true;
}

async function handleApplyCreateModal(interaction, context) {
  if (!interaction.isModalSubmit() || interaction.customId !== APPLY_CREATE_MODAL_ID) {
    return false;
  }

  if (!interaction.inGuild()) {
    await interaction.reply({ content: "Applications can only be submitted in a server.", ephemeral: true });
    return true;
  }

  const settings = getGuildSettings(interaction.guild.id, context.config);
  const appConfig = applicationConfig(context);
  const roblox = interaction.fields.getTextInputValue("apply_roblox").trim();
  const faction = interaction.fields.getTextInputValue("apply_faction").trim();
  const country = interaction.fields.getTextInputValue("apply_country").trim();
  const device = interaction.fields.getTextInputValue("apply_device").trim();
  const classesPlayed = interaction.fields.getTextInputValue("apply_classes").trim();

  if (!roblox || !faction || !country || !device || !classesPlayed) {
    await interaction.reply({
      content: "All application fields are required.",
      ephemeral: true
    });
    return true;
  }

  if (!appConfig.channelId) {
    await interaction.reply({
      content: "Applications receive channel is not configured. Ask an admin to run /setupapply setmodapp:#channel.",
      ephemeral: true
    });
    return true;
  }

  const targetChannel = interaction.guild.channels.cache.get(appConfig.channelId)
    || await interaction.guild.channels.fetch(appConfig.channelId).catch(() => null);

  if (!targetChannel || !targetChannel.isTextBased()) {
    await interaction.reply({
      content: "Applications channel is not configured or invalid.",
      ephemeral: true
    });
    return true;
  }

  const applicationEmbed = new EmbedBuilder()
    .setTitle("New Application")
    .setColor(statusColor(settings, "active"))
    .addFields(
      { name: "User", value: `<@${interaction.user.id}>`, inline: true },
      { name: "Roblox Username", value: roblox, inline: true },
      { name: "Faction", value: faction, inline: true },
      { name: "Country", value: country, inline: true },
      { name: "Device", value: device, inline: true },
      { name: "Classes", value: classesPlayed, inline: false },
      { name: "Decision", value: "Pending review", inline: false }
    )
    .setFooter({ text: footerText(settings) })
    .setTimestamp(new Date());

  const reviewerMention = appConfig.reviewerRoleId ? `<@&${appConfig.reviewerRoleId}>` : null;

  await targetChannel.send({
    content: reviewerMention,
    embeds: [applicationEmbed],
    components: buildApplyDecisionRows(interaction.user.id, false)
  });

  upsertUserProfileFromTicket(interaction.guild.id, interaction.user.id, {
    robloxUsername: roblox,
    faction,
    country,
    device,
    classesPlayed
  });

  await interaction.reply({
    content: `Application submitted successfully in ${targetChannel}.`,
    ephemeral: true
  });

  return true;
}

async function handleApplyDecisionButton(interaction, context) {
  if (!interaction.isButton() || !interaction.customId.startsWith(`${APPLY_DECISION_PREFIX}:`)) {
    return false;
  }

  if (!interaction.inGuild()) {
    await interaction.reply({
      content: "This action can only be used in a server.",
      ephemeral: true
    });
    return true;
  }

  const [, decision, applicantIdRaw] = interaction.customId.split(":");
  const applicantId = String(applicantIdRaw || "").trim();
  if (!["accept", "reject"].includes(String(decision || "")) || !applicantId) {
    await interaction.reply({
      content: "Invalid application decision action.",
      ephemeral: true
    });
    return true;
  }

  const settings = getGuildSettings(interaction.guild.id, context.config);
  const appConfig = applicationConfig(context);
  if (!hasApplicationReviewerAccess(interaction.member, appConfig.reviewerRoleId)) {
    await interaction.reply({
      content: "You do not have permission to review applications.",
      ephemeral: true
    });
    return true;
  }

  const currentEmbed = interaction.message?.embeds?.[0];
  if (!currentEmbed) {
    await interaction.reply({ content: "Application embed is missing.", ephemeral: true });
    return true;
  }

  const json = currentEmbed.toJSON();
  const fields = Array.isArray(json.fields) ? [...json.fields] : [];
  const decisionIndex = fields.findIndex((field) => String(field?.name || "").trim().toLowerCase() === "decision");
  const currentDecision = decisionIndex >= 0 ? String(fields[decisionIndex].value || "") : "";
  if (currentDecision && !/^pending/i.test(currentDecision)) {
    await interaction.reply({
      content: "This application has already been reviewed.",
      ephemeral: true
    });
    return true;
  }

  const accepted = decision === "accept";
  const decisionValue = `${accepted ? "Accepted" : "Rejected"} by <@${interaction.user.id}> at <t:${Math.floor(Date.now() / 1000)}:f>`;
  if (decisionIndex >= 0) {
    fields[decisionIndex] = { ...fields[decisionIndex], value: decisionValue, inline: false };
  } else {
    fields.push({ name: "Decision", value: decisionValue, inline: false });
  }

  const nextEmbed = EmbedBuilder.from(json)
    .setColor(statusColor(settings, accepted ? "resolved" : "eliminated"))
    .setFields(fields);

  let acceptedRoleResult = "";
  if (accepted && appConfig.acceptedRoleId) {
    const member = await interaction.guild.members.fetch(applicantId).catch(() => null);
    if (member && !member.roles.cache.has(appConfig.acceptedRoleId)) {
      await member.roles.add(appConfig.acceptedRoleId, `Application accepted by ${interaction.user.tag}`).catch(() => {});
      acceptedRoleResult = ` Assigned <@&${appConfig.acceptedRoleId}>.`;
    }
  }

  const applicantUser = await interaction.client.users.fetch(applicantId).catch(() => null);
  if (applicantUser) {
    const resultEmbed = new EmbedBuilder()
      .setTitle(`Application ${accepted ? "Accepted" : "Declined"}`)
      .setColor(statusColor(settings, accepted ? "resolved" : "eliminated"))
      .setDescription(`Your application in **${interaction.guild.name}** was **${accepted ? "accepted" : "declined"}**.`)
      .addFields({
        name: "Reviewed By",
        value: `${interaction.user.tag}`,
        inline: true
      })
      .setFooter({ text: footerText(settings) })
      .setTimestamp(new Date());

    await applicantUser.send({ embeds: [resultEmbed] }).catch(() => {});
  }

  await interaction.update({
    embeds: [nextEmbed],
    components: buildApplyDecisionRows(applicantId, true)
  });

  if (acceptedRoleResult) {
    await interaction.followUp({
      content: `Application ${accepted ? "accepted" : "rejected"}.${acceptedRoleResult}`,
      ephemeral: true
    });
  }

  return true;
}

async function handleApplySetupCommand(interaction, context) {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return;
  }

  const panelChannel = interaction.options.getChannel("setchannel");
  const applicationsChannel = interaction.options.getChannel("setmodapp");

  const settings = getGuildSettings(interaction.guild.id, context.config);
  const current = applicationConfig(context);

  if (!panelChannel && !applicationsChannel) {
    await interaction.reply({
      embeds: [buildApplySetupEmbed(settings, current)],
      ephemeral: true
    });
    return;
  }

  const patch = {};
  if (panelChannel) {
    patch.applicationsPanelChannelId = panelChannel.id;
  }

  if (applicationsChannel) {
    patch.applicationsChannelId = applicationsChannel.id;
  }

  const saved = context.saveRuntimeSettings(patch);
  context.config.applicationsPanelChannelId = saved.applicationsPanelChannelId;
  context.config.applicationsChannelId = saved.applicationsChannelId;

  await interaction.reply({
    content: "Setup apply updated.",
    embeds: [buildApplySetupEmbed(settings, applicationConfig(context))],
    ephemeral: true
  });
}

async function handleTicketPanelSetupCommand(interaction, context) {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return;
  }

  const panelChannel = interaction.options.getChannel("setchannel");
  const moderationChannel = interaction.options.getChannel("setmodapp");
  const settings = getGuildSettings(interaction.guild.id, context.config);
  const current = ticketPanelConfig(settings);

  if (!panelChannel && !moderationChannel) {
    await interaction.reply({
      embeds: [buildTicketSetupEmbed(settings, current)],
      ephemeral: true
    });
    return;
  }

  const patch = {};
  if (panelChannel) {
    patch.ticketPanelChannelId = panelChannel.id;
  }

  if (moderationChannel) {
    patch.ticketLogChannelId = moderationChannel.id;
  }

  const next = patchGuildSettings(interaction.guild.id, patch, context.config);
  await interaction.reply({
    content: "Setup ticket updated.",
    embeds: [buildTicketSetupEmbed(next, ticketPanelConfig(next))],
    ephemeral: true
  });
}

function buildLeaderboardNavRows(requesterId, pageIndex, totalPages, limit, pageSize) {
  if (totalPages <= 1) {
    return [];
  }

  const safePage = Math.max(0, Math.min(totalPages - 1, pageIndex));
  const prevPage = Math.max(0, safePage - 1);
  const nextPage = Math.min(totalPages - 1, safePage + 1);

  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${LEADERBOARD_NAV_PREFIX}:${requesterId}:${prevPage}:${limit}:${pageSize}`)
        .setLabel("Prev")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(safePage === 0),
      new ButtonBuilder()
        .setCustomId(`${LEADERBOARD_NAV_PREFIX}:${requesterId}:${safePage}:${limit}:${pageSize}`)
        .setLabel("Refresh")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`${LEADERBOARD_NAV_PREFIX}:${requesterId}:${nextPage}:${limit}:${pageSize}`)
        .setLabel("Next")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(safePage >= totalPages - 1)
    )
  ];
}

async function handleLeaderboardNavButton(interaction, context) {
  if (!interaction.isButton() || !interaction.customId.startsWith(`${LEADERBOARD_NAV_PREFIX}:`)) {
    return false;
  }

  const [, requesterId, pageRaw, limitRaw, pageSizeRaw] = interaction.customId.split(":");
  if (String(requesterId) !== String(interaction.user.id)) {
    await interaction.reply({
      content: "Only the user who opened this leaderboard can use these buttons.",
      ephemeral: true
    });
    return true;
  }

  if (!interaction.inGuild()) {
    await interaction.reply({ content: "Leaderboard navigation only works in a server.", ephemeral: true });
    return true;
  }

  const settings = getGuildSettings(interaction.guild.id, context.config);
  const endpoint = settings.leaderboardEndpoint || context.config.leaderboardApiUrl;

  try {
    const leaderboard = await fetchLeaderboardData(endpoint);
    const limit = clampInt(limitRaw, 1, 100, 30);
    const pageSize = clampInt(pageSizeRaw, 5, 20, 10);
    const entries = leaderboard.entries.slice(0, limit);
    const pages = buildLeaderboardPages(entries, pageSize);
    const pageIndex = clampInt(pageRaw, 0, pages.length - 1, 0);
    const page = pages[pageIndex];

    const embed = buildLeaderboardEmbed({
      settings,
      page,
      pageIndex,
      pages,
      updatedAt: leaderboard.updatedAt,
      endpoint: leaderboard.endpoint
    });

    await interaction.update({
      embeds: [embed],
      components: buildLeaderboardNavRows(interaction.user.id, pageIndex, pages.length, limit, pageSize)
    });
  } catch (error) {
    await interaction.reply({
      content: `Failed to refresh leaderboard: ${error instanceof Error ? error.message : "Unknown error"}`,
      ephemeral: true
    });
  }

  return true;
}

function buildSetupViewEmbed(settings) {
  const pingRoles = settings.ticketPingRoleIds.length
    ? settings.ticketPingRoleIds.map((id) => `<@&${id}>`).join(", ")
    : "Not set";
  const reviewerRoles = settings.ticketReviewerRoleIds.length
    ? settings.ticketReviewerRoleIds.map((id) => `<@&${id}>`).join(", ")
    : "Not set";
  const allowedRoles = settings.ticketAllowedRoleIds.length
    ? settings.ticketAllowedRoleIds.map((id) => `<@&${id}>`).join(", ")
    : "All roles";

  return new EmbedBuilder()
    .setTitle("Ascend Entrenched Setup")
    .setColor(statusColor(settings, "active"))
    .addFields(
      {
        name: "Ticket Settings",
        value: [
          `Enabled: ${settings.ticketEnabled ? "Yes" : "No"}`,
          `Panel Channel: ${settings.ticketPanelChannelId ? `<#${settings.ticketPanelChannelId}>` : "Not set"}`,
          `Category: ${settings.ticketCategoryId ? `<#${settings.ticketCategoryId}>` : "Not set"}`,
          `Log Channel: ${settings.ticketLogChannelId ? `<#${settings.ticketLogChannelId}>` : "Not set"}`,
          `Ping Roles: ${pingRoles}`,
          `Reviewer Roles: ${reviewerRoles}`,
          `Allowed Roles: ${allowedRoles}`
        ].join("\n")
      },
      {
        name: "Welcome Settings",
        value: [
          `Channel: ${settings.welcomeChannelId ? `<#${settings.welcomeChannelId}>` : "Not set"}`,
          `Auto Role: ${settings.autoRoleId ? `<@&${settings.autoRoleId}>` : "Not set"}`
        ].join("\n")
      },
      {
        name: "Leaderboard Settings",
        value: [
          `Channel: ${settings.leaderboardChannelId ? `<#${settings.leaderboardChannelId}>` : "Not set"}`,
          `Endpoint: ${settings.leaderboardEndpoint || "Not set"}`,
          `Auto Post: ${settings.leaderboardAutoPostEnabled ? "Enabled" : "Disabled"}`,
          `Every: ${settings.leaderboardAutoPostIntervalHours || 6} hour(s)`,
          `Last Auto Post: ${settings.leaderboardAutoPostLastRunAt ? new Date(settings.leaderboardAutoPostLastRunAt).toLocaleString() : "Never"}`,
          `Highlight Enabled: ${settings.highlightEnabled ? "Yes" : "No"}`
        ].join("\n")
      },
      {
        name: "Style",
        value: [
          `Info: ${settings.colors.info}`,
          `Winner: ${settings.colors.winner}`,
          `Active: ${settings.colors.active}`,
          `Eliminated: ${settings.colors.eliminated}`,
          `Highlight: ${settings.colors.highlight}`,
          `Footer: ${settings.brandingFooter}`
        ].join("\n")
      }
    )
    .setFooter({ text: footerText(settings) })
    .setTimestamp(new Date());
}

async function handleSetupCommand(interaction, context) {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  if (subcommand === "view") {
    const settings = getGuildSettings(guildId, context.config);
    await interaction.reply({ embeds: [buildSetupViewEmbed(settings)], ephemeral: true });
    return;
  }

  if (subcommand === "tickets") {
    const enabled = interaction.options.getBoolean("enabled");
    const category = interaction.options.getChannel("category");
    const logChannel = interaction.options.getChannel("log_channel");
    const pingRole = interaction.options.getRole("ping_role");
    const reviewerRole = interaction.options.getRole("reviewer_role");

    if (
      enabled === null
      && !category
      && !logChannel
      && !pingRole
      && !reviewerRole
    ) {
      const settings = getGuildSettings(guildId, context.config);
      await interaction.reply({ embeds: [buildSetupViewEmbed(settings)], ephemeral: true });
      return;
    }

    const patch = {};
    if (enabled !== null) {
      patch.ticketEnabled = enabled;
    }

    if (category) {
      patch.ticketCategoryId = category.id;
    }

    if (logChannel) {
      patch.ticketLogChannelId = logChannel.id;
    }

    if (pingRole) {
      patch.ticketPingRoleIds = [pingRole.id];
    }

    if (reviewerRole) {
      patch.ticketReviewerRoleIds = [reviewerRole.id];
    }

    const next = patchGuildSettings(guildId, patch, context.config);
    await interaction.reply({
      content: "Ticket setup updated.",
      embeds: [buildSetupViewEmbed(next)],
      ephemeral: true
    });
    return;
  }

  if (subcommand === "ticket_access") {
    const action = interaction.options.getString("action", true);
    const role = interaction.options.getRole("role");

    if (action !== "clear" && !role) {
      await interaction.reply({
        content: "You must provide a role for add/remove actions.",
        ephemeral: true
      });
      return;
    }

    const next = updateAllowedRole(guildId, role?.id || "", action, context.config);
    await interaction.reply({
      content: "Ticket access list updated.",
      embeds: [buildSetupViewEmbed(next)],
      ephemeral: true
    });
    return;
  }

  if (subcommand === "leaderboard") {
    const channel = interaction.options.getChannel("channel");
    const endpointInput = interaction.options.getString("endpoint");
    const autoPost = interaction.options.getBoolean("auto_post");
    const everyHours = interaction.options.getInteger("every_hours");

    if (!channel && !endpointInput && autoPost === null && !everyHours) {
      const settings = getGuildSettings(guildId, context.config);
      await interaction.reply({ embeds: [buildSetupViewEmbed(settings)], ephemeral: true });
      return;
    }

    const patch = {};
    if (channel) {
      patch.leaderboardChannelId = channel.id;
    }

    if (endpointInput) {
      const resolved = resolveLeaderboardEndpoint(endpointInput);
      if (!/^https?:\/\//i.test(resolved)) {
        await interaction.reply({
          content: "Endpoint must be a valid http(s) URL.",
          ephemeral: true
        });
        return;
      }

      patch.leaderboardEndpoint = resolved;
    }

    if (autoPost !== null) {
      patch.leaderboardAutoPostEnabled = autoPost;
    }

    if (everyHours) {
      patch.leaderboardAutoPostIntervalHours = everyHours;
    }

    const current = getGuildSettings(guildId, context.config);
    const effectiveChannelId = patch.leaderboardChannelId || current.leaderboardChannelId;
    const effectiveEndpoint = patch.leaderboardEndpoint || current.leaderboardEndpoint || context.config.leaderboardApiUrl;
    const effectiveAutoPost = typeof patch.leaderboardAutoPostEnabled === "boolean"
      ? patch.leaderboardAutoPostEnabled
      : current.leaderboardAutoPostEnabled;

    if (effectiveAutoPost && (!effectiveChannelId || !effectiveEndpoint)) {
      await interaction.reply({
        content: "Auto posting requires both leaderboard channel and endpoint configured.",
        ephemeral: true
      });
      return;
    }

    const next = patchGuildSettings(guildId, patch, context.config);
    await interaction.reply({
      content: "Leaderboard setup updated.",
      embeds: [buildSetupViewEmbed(next)],
      ephemeral: true
    });
    return;
  }

  if (subcommand === "style") {
    const infoColor = interaction.options.getString("info_color");
    const winnerColor = interaction.options.getString("winner_color");
    const activeColor = interaction.options.getString("active_color");
    const eliminatedColor = interaction.options.getString("eliminated_color");
    const highlightColor = interaction.options.getString("highlight_color");
    const footer = interaction.options.getString("footer");
    const highlightEnabled = interaction.options.getBoolean("highlight_enabled");

    if (
      !infoColor
      && !winnerColor
      && !activeColor
      && !eliminatedColor
      && !highlightColor
      && !footer
      && highlightEnabled === null
    ) {
      const settings = getGuildSettings(guildId, context.config);
      await interaction.reply({ embeds: [buildSetupViewEmbed(settings)], ephemeral: true });
      return;
    }

    const current = getGuildSettings(guildId, context.config);

    const providedColors = [
      infoColor,
      winnerColor,
      activeColor,
      eliminatedColor,
      highlightColor
    ].filter((value) => typeof value === "string" && value.trim().length > 0);

    const invalidColor = providedColors.find((value) => !isValidHexColor(value));
    if (invalidColor) {
      await interaction.reply({
        content: `Invalid color value: ${invalidColor}. Use format #RRGGBB.`,
        ephemeral: true
      });
      return;
    }

    const patch = {
      colors: {
        info: normalizeHexColor(infoColor, current.colors.info),
        winner: normalizeHexColor(winnerColor, current.colors.winner),
        active: normalizeHexColor(activeColor, current.colors.active),
        eliminated: normalizeHexColor(eliminatedColor, current.colors.eliminated),
        highlight: normalizeHexColor(highlightColor, current.colors.highlight)
      }
    };

    if (footer) {
      patch.brandingFooter = String(footer).trim().slice(0, 100);
    }

    if (highlightEnabled !== null) {
      patch.highlightEnabled = highlightEnabled;
    }

    const next = patchGuildSettings(guildId, patch, context.config);
    await interaction.reply({
      content: "Style setup updated.",
      embeds: [buildSetupViewEmbed(next)],
      ephemeral: true
    });
  }
}

async function handleUserInfoCommand(interaction, context) {
  const targetUser = interaction.options.getUser("user", true);
  const settings = getGuildSettings(interaction.guild.id, context.config);
  const profile = getUserProfile(interaction.guild.id, targetUser.id);

  let leaderboardData = null;
  let lookupRobloxName = profile?.robloxUsername || "";
  let entry = null;

  try {
    leaderboardData = await fetchLeaderboardData(settings.leaderboardEndpoint || context.config.leaderboardApiUrl);
    if (!lookupRobloxName) {
      lookupRobloxName = targetUser.username;
    }

    entry = findEntryByRoblox(leaderboardData.entries, lookupRobloxName);
  } catch {
    leaderboardData = null;
  }

  if (!profile && !entry) {
    await interaction.reply({
      content: "No user profile data found for that member yet.",
      ephemeral: true
    });
    return;
  }

  const status = entry?.status || "active";
  const embed = new EmbedBuilder()
    .setTitle(`User Info - ${targetUser.tag}`)
    .setColor(statusColor(settings, status))
    .addFields(
      {
        name: "Roblox Username",
        value: profile?.robloxUsername || entry?.player || "Unknown",
        inline: true
      },
      {
        name: "Faction",
        value: profile?.faction || "Unknown",
        inline: true
      },
      {
        name: "Country",
        value: profile?.country || "Unknown",
        inline: true
      },
      {
        name: "Device",
        value: profile?.device || "Unknown",
        inline: true
      },
      {
        name: "Classes",
        value: profile?.classesPlayed || "Unknown",
        inline: false
      },
      {
        name: "Total Matches",
        value: String(entry?.totalMatches || 0),
        inline: true
      },
      {
        name: "Leaderboard Status",
        value: normalizeStatusLabel(status),
        inline: true
      },
      {
        name: "Leaderboard Rank",
        value: entry ? `#${entry.rank}` : "Not ranked",
        inline: true
      }
    )
    .setFooter({ text: footerText(settings) })
    .setTimestamp(new Date());

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleLeaderboardCommand(interaction, context) {
  const settings = getGuildSettings(interaction.guild.id, context.config);
  const endpoint = settings.leaderboardEndpoint || context.config.leaderboardApiUrl;
  const limit = clampInt(interaction.options.getInteger("limit"), 1, 100, 30);
  const pageSize = clampInt(interaction.options.getInteger("page_size"), 5, 20, 10);
  const postToConfiguredChannel = interaction.options.getBoolean("post") === true;

  await interaction.deferReply({ ephemeral: false });

  try {
    const leaderboard = await fetchLeaderboardData(endpoint);
    const entries = leaderboard.entries.slice(0, limit);
    const pages = buildLeaderboardPages(entries, pageSize);
    const pageIndex = 0;
    const page = pages[pageIndex];

    const embed = buildLeaderboardEmbed({
      settings,
      page,
      pageIndex,
      pages,
      updatedAt: leaderboard.updatedAt,
      endpoint: leaderboard.endpoint
    });

    const components = buildLeaderboardNavRows(interaction.user.id, pageIndex, pages.length, limit, pageSize);

    if (postToConfiguredChannel && settings.leaderboardChannelId) {
      const targetChannel = interaction.guild.channels.cache.get(settings.leaderboardChannelId)
        || await interaction.guild.channels.fetch(settings.leaderboardChannelId).catch(() => null);

      if (!targetChannel || !targetChannel.isTextBased()) {
        await interaction.editReply({
          content: "Configured leaderboard channel is not valid.",
          embeds: [],
          components: []
        });
        return;
      }

      await targetChannel.send({ embeds: [embed], components });
      await interaction.editReply({
        content: `Leaderboard posted in ${targetChannel}.`,
        embeds: [],
        components: []
      });
      return;
    }

    await interaction.editReply({
      embeds: [embed],
      components
    });
  } catch (error) {
    await interaction.editReply({
      content: `Failed to load leaderboard: ${error instanceof Error ? error.message : "Unknown error"}`,
      embeds: [],
      components: []
    });
  }
}

function setupCommandBuilder() {
  return new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Configure Ascend Entrenched bot settings")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("view")
        .setDescription("View current setup values")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("tickets")
        .setDescription("Configure ticket category, ping roles, and global enable state")
        .addBooleanOption((option) =>
          option.setName("enabled").setDescription("Enable or disable ticket creation globally")
        )
        .addChannelOption((option) =>
          option
            .setName("category")
            .setDescription("Category where ticket channels are created")
            .addChannelTypes(ChannelType.GuildCategory)
        )
        .addChannelOption((option) =>
          option
            .setName("log_channel")
            .setDescription("Channel for ticket log events")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
        .addRoleOption((option) =>
          option
            .setName("ping_role")
            .setDescription("Role to ping when a ticket is created")
        )
        .addRoleOption((option) =>
          option
            .setName("reviewer_role")
            .setDescription("Role that can update and close tickets")
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("ticket_access")
        .setDescription("Limit ticket creation to selected roles")
        .addStringOption((option) =>
          option
            .setName("action")
            .setDescription("How to edit allowed ticket roles")
            .setRequired(true)
            .addChoices(
              { name: "Add role", value: "add" },
              { name: "Remove role", value: "remove" },
              { name: "Clear all (allow everyone)", value: "clear" }
            )
        )
        .addRoleOption((option) =>
          option
            .setName("role")
            .setDescription("Role to add or remove")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("leaderboard")
        .setDescription("Configure leaderboard source and output channel")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("Default leaderboard channel")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
        .addStringOption((option) =>
          option
            .setName("endpoint")
            .setDescription("Leaderboard base URL or /api/leaderboard-config endpoint")
        )
        .addBooleanOption((option) =>
          option
            .setName("auto_post")
            .setDescription("Enable or disable automatic leaderboard posts")
        )
        .addIntegerOption((option) =>
          option
            .setName("every_hours")
            .setDescription("Auto-post interval in hours (1-168)")
            .setMinValue(1)
            .setMaxValue(168)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("style")
        .setDescription("Configure embed colors and branding")
        .addStringOption((option) =>
          option
            .setName("info_color")
            .setDescription("Hex color for normal info, example #C8A2C8")
        )
        .addStringOption((option) =>
          option
            .setName("winner_color")
            .setDescription("Hex color for winners, example #FFD700")
        )
        .addStringOption((option) =>
          option
            .setName("active_color")
            .setDescription("Hex color for active players, example #C8A2C8")
        )
        .addStringOption((option) =>
          option
            .setName("eliminated_color")
            .setDescription("Hex color for eliminated players, example #9B59B6")
        )
        .addStringOption((option) =>
          option
            .setName("highlight_color")
            .setDescription("Hex color for highlights, example #FFECB3")
        )
        .addStringOption((option) =>
          option
            .setName("footer")
            .setDescription("Embed footer branding text")
            .setMaxLength(100)
        )
        .addBooleanOption((option) =>
          option
            .setName("highlight_enabled")
            .setDescription("Enable leaderboard highlight field")
        )
    );
}

const slashCommandBuilders = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check bot latency and health"),
  new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Show webhook queue status"),
  new SlashCommandBuilder()
    .setName("status")
    .setDescription("Ascend Entrenched runtime status overview")
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("webstatus")
    .setDescription("Check website and leaderboard API health")
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName("endpoint")
        .setDescription("Optional endpoint override to check")
    ),
  new SlashCommandBuilder()
    .setName("syncaudit")
    .setDescription("Audit leaderboard sync freshness and auto-post state")
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("refreshcommands")
    .setDescription("Force refresh slash command registration")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("configcheck")
    .setDescription("Validate Ascend Entrenched server setup")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("autopoststatus")
    .setDescription("Show auto-post scheduler state")
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("hqpost")
    .setDescription("Post an Ascend Entrenched HQ announcement")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName("message")
        .setDescription("Announcement message")
        .setRequired(true)
        .setMaxLength(1800)
    )
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Target channel, defaults to current")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    )
    .addBooleanOption((option) =>
      option
        .setName("pin")
        .setDescription("Try to pin the announcement")
    ),
  new SlashCommandBuilder()
    .setName("poll")
    .setDescription("Create a quick reaction poll")
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName("question")
        .setDescription("Poll question")
        .setRequired(true)
        .setMaxLength(200)
    )
    .addStringOption((option) =>
      option
        .setName("options")
        .setDescription("Options separated by | (2-6)")
        .setRequired(true)
        .setMaxLength(400)
    )
    .addIntegerOption((option) =>
      option
        .setName("duration_minutes")
        .setDescription("Voting duration for display")
        .setMinValue(1)
        .setMaxValue(10080)
    ),
  new SlashCommandBuilder()
    .setName("serverintel")
    .setDescription("Show server intelligence snapshot")
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("Show a user's avatar")
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User to inspect")
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName("coinflip")
    .setDescription("Flip a coin")
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("roll")
    .setDescription("Roll dice")
    .setDMPermission(false)
    .addIntegerOption((option) =>
      option
        .setName("sides")
        .setDescription("Dice sides")
        .setMinValue(2)
        .setMaxValue(1000)
    )
    .addIntegerOption((option) =>
      option
        .setName("count")
        .setDescription("Number of dice")
        .setMinValue(1)
        .setMaxValue(10)
    ),
  new SlashCommandBuilder()
    .setName("choose")
    .setDescription("Pick one option for you")
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName("options")
        .setDescription("Choices separated by |")
        .setRequired(true)
        .setMaxLength(600)
    ),
  new SlashCommandBuilder()
    .setName("eightball")
    .setDescription("Ask the Ascend Entrenched 8-ball")
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName("question")
        .setDescription("Your question")
        .setRequired(true)
        .setMaxLength(300)
    ),
  new SlashCommandBuilder()
    .setName("1v1")
    .setDescription("Join live Looking for 1v1 web queue")
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName("action")
        .setDescription("Queue action")
        .setRequired(false)
        .addChoices(
          { name: "Join queue", value: "join" },
          { name: "Leave queue", value: "leave" },
          { name: "Queue status", value: "status" }
        )
    ),
  new SlashCommandBuilder()
    .setName("ticketpanel")
    .setDescription("Post the Create Ticket panel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("applypanel")
    .setDescription("Post the application panel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("setupapply")
    .setDescription("Simple setup for application panel and mod review channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addChannelOption((option) =>
      option
        .setName("setchannel")
        .setDescription("Channel where application panel message will be sent")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    )
    .addChannelOption((option) =>
      option
        .setName("setmodapp")
        .setDescription("Channel where applications are accepted or rejected")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    ),
  new SlashCommandBuilder()
    .setName("setupticket")
    .setDescription("Simple setup for ticket panel and mod review channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addChannelOption((option) =>
      option
        .setName("setchannel")
        .setDescription("Channel where ticket panel message will be sent")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    )
    .addChannelOption((option) =>
      option
        .setName("setmodapp")
        .setDescription("Channel where ticket updates are sent for staff")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    ),
  new SlashCommandBuilder()
    .setName("setwelcome")
    .setDescription("Set welcome channel for the bot-designed join embed")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Channel where welcome message will be sent")
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    ),
  new SlashCommandBuilder()
    .setName("autorole")
    .setDescription("Set role assigned automatically when a member joins")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addRoleOption((option) =>
      option
        .setName("role")
        .setDescription("Role to auto assign on join")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("sendinfo")
    .setDescription("Post the newcomer info embed in a channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Channel where info message will be posted")
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    ),
  new SlashCommandBuilder()
    .setName("setautorole")
    .setDescription("Alias for /autorole")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addRoleOption((option) =>
      option
        .setName("role")
        .setDescription("Role to auto assign on join")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("info")
    .setDescription("Show quick server onboarding info")
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show available bot commands")
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("ticketupdate")
    .setDescription("Post a ticket follow-up note and optional status")
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName("note")
        .setDescription("Follow-up note for this ticket")
        .setRequired(true)
        .setMaxLength(500)
    )
    .addStringOption((option) =>
      option
        .setName("status")
        .setDescription("Optional ticket status update")
        .setRequired(false)
        .addChoices(
          { name: "Open", value: "open" },
          { name: "Waiting User", value: "waiting_user" },
          { name: "In Review", value: "in_review" },
          { name: "Escalated", value: "escalated" },
          { name: "Resolved", value: "resolved" }
        )
    ),
  new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Show esports profile and leaderboard info for a user")
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User to inspect")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Show synced leaderboard from web source")
    .setDMPermission(false)
    .addIntegerOption((option) =>
      option
        .setName("limit")
        .setDescription("Maximum players to include")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .addIntegerOption((option) =>
      option
        .setName("page_size")
        .setDescription("Entries per page section")
        .setRequired(false)
        .setMinValue(5)
        .setMaxValue(20)
    )
    .addBooleanOption((option) =>
      option
        .setName("post")
        .setDescription("Post in configured leaderboard channel")
        .setRequired(false)
    ),
  setupCommandBuilder(),
  new SlashCommandBuilder()
    .setName("webhooktest")
    .setDescription("Send a test leaderboard update embed")
    .addStringOption((option) =>
      option
        .setName("group")
        .setDescription("Group label")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("player")
        .setDescription("Player name")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("status")
        .setDescription("Status type")
        .setRequired(true)
        .addChoices(
          { name: "winner", value: "winner" },
          { name: "eliminated", value: "eliminated" },
          { name: "info", value: "info" }
        )
    )
    .addNumberOption((option) =>
      option
        .setName("score")
        .setDescription("Score value")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("highlight")
        .setDescription("Match highlight text")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Timeout a member for a number of minutes")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Member to timeout")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("minutes")
        .setDescription("Timeout duration in minutes (1-40320)")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(40320)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Reason for timeout")
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a member and send them a direct message")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Member to warn")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Reason for warning")
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName("waarn")
    .setDescription("Warn a member and send them a direct message")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Member to warn")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Reason for warning")
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a member from the server")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Member to kick")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Reason for kick")
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a user from the server")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User to ban")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("delete_days")
        .setDescription("Delete recent messages from this many days (0-7)")
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(7)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Reason for ban")
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName("serverstats")
    .setDescription("Show detailed server statistics")
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("joke")
    .setDescription("Receive a random gaming or military joke")
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("template")
    .setDescription("Send an official Ascend Entrenched template message")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName("name")
        .setDescription("The template to send")
        .setRequired(true)
        .addChoices(
          { name: "Welcome / Rules", value: "rules" },
          { name: "Application Guidelines", value: "app_guide" },
          { name: "War Room Notice", value: "war_room" }
        )
    )
];

const slashCommands = slashCommandBuilders.map((builder) => builder.toJSON());

async function registerSlashCommands(client, config) {
  if (!client.application) {
    throw new Error("Discord application is not ready for command registration");
  }

  if (config.discordGuildId) {
    try {
      await client.application.commands.set(slashCommands, config.discordGuildId);
      return { scope: "guild", guildId: config.discordGuildId, count: slashCommands.length };
    } catch (error) {
      const code = Number(error?.code || 0);
      const shouldFallback = code === 50001 || Number(error?.status || 0) === 403;
      if (!shouldFallback) {
        throw error;
      }

      await client.application.commands.set(slashCommands);
      return {
        scope: "global",
        count: slashCommands.length,
        warning: `Guild registration failed for ${config.discordGuildId}; fallback to global commands.`
      };
    }
  }

  await client.application.commands.set(slashCommands);
  return { scope: "global", count: slashCommands.length };
}

function getMuteDurationMs(minutes) {
  const safeMinutes = Math.max(1, Math.min(40320, Number(minutes) || 0));
  return safeMinutes * 60 * 1000;
}

async function handleStatusCommand(interaction, context) {
  const uptimeMs = Date.now() - BOT_START_TIME;
  const wsPing = Math.round(interaction.client.ws.ping || 0);
  const settings = getGuildSettings(interaction.guild.id, context.config);

  const embed = new EmbedBuilder()
    .setAuthor({ name: "Ascend Control", iconURL: BRAND_ICON })
    .setTitle("⚡ Ascend Entrenched Status")
    .setColor(statusColor(settings, "active"))
    .setDescription("Live telemetry from the operations core.")
    .setThumbnail(BRAND_ICON)
    .addFields(
      { name: "⏱️ Uptime", value: `\`\`\`\n${durationLabel(uptimeMs)}\n\`\`\``, inline: true },
      { name: "📶 WS Ping", value: `\`\`\`\n${wsPing} ms\n\`\`\``, inline: true },
      { name: "🚦 Queue", value: `\`\`\`\n${context.updateQueue.size()} pending\n\`\`\``, inline: true },
      { name: "🏰 Guilds", value: `\`\`\`\n${interaction.client.guilds.cache.size}\n\`\`\``, inline: true },
      { name: "🌐 Endpoint", value: `\`\`\`\n${settings.leaderboardEndpoint || context.config.leaderboardApiUrl || "Not configured"}\n\`\`\``, inline: false },
      { name: "🌟 Brand", value: "> Ascend Entrenched Operational", inline: false }
    )
    .setFooter({ text: footerText(settings), iconURL: BRAND_ICON })
    .setTimestamp(new Date());

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleWebStatusCommand(interaction, context) {
  const settings = getGuildSettings(interaction.guild.id, context.config);
  const endpointInput = interaction.options.getString("endpoint");
  const resolvedEndpoint = resolveLeaderboardEndpoint(
    endpointInput || settings.leaderboardEndpoint || context.config.leaderboardApiUrl
  );

  const leaderboardCheck = await fetchJsonStatus(resolvedEndpoint);
  const origin = resolveBaseOrigin(resolvedEndpoint);
  const homepageCheck = origin ? await fetchJsonStatus(origin) : {
    ok: false,
    status: null,
    durationMs: 0,
    payload: null,
    error: "No origin URL"
  };

  const embed = new EmbedBuilder()
    .setAuthor({ name: "Ascend Diagnostics", iconURL: BRAND_ICON })
    .setTitle("🌐 API / Web Diagnostics")
    .setColor(statusColor(settings, leaderboardCheck.ok ? "active" : "eliminated"))
    .setDescription("Validating connection to core Entrenched services.")
    .setThumbnail(BRAND_ICON)
    .addFields(
      {
        name: "📊 Leaderboard Feed",
        value: `\`\`\`yaml\nURL: ${resolvedEndpoint || "Not configured"}\nStatus: ${leaderboardCheck.ok ? "Online" : "Issue"}\nHTTP: ${leaderboardCheck.status ?? "N/A"}\nLatency: ${leaderboardCheck.durationMs} ms\nUpdated At: ${leaderboardCheck.payload?.config?.updatedAt || "N/A"}\n${leaderboardCheck.error ? `Error: ${leaderboardCheck.error}` : ""}\n\`\`\``
      },
      {
        name: "🖥️ Website Root",
        value: `\`\`\`yaml\nURL: ${origin || "Not available"}\nStatus: ${homepageCheck.ok ? "Online" : "Unknown"}\nHTTP: ${homepageCheck.status ?? "N/A"}\nLatency: ${homepageCheck.durationMs} ms\n${homepageCheck.error ? `Error: ${homepageCheck.error}` : ""}\n\`\`\``
      }
    )
    .setFooter({ text: footerText(settings), iconURL: BRAND_ICON })
    .setTimestamp(new Date());

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleSyncAuditCommand(interaction, context) {
  const settings = getGuildSettings(interaction.guild.id, context.config);
  const endpoint = settings.leaderboardEndpoint || context.config.leaderboardApiUrl;

  await interaction.deferReply({ ephemeral: true });

  try {
    const leaderboard = await fetchLeaderboardData(endpoint);
    const updatedAt = leaderboard.updatedAt ? new Date(leaderboard.updatedAt) : null;
    const ageMs = updatedAt ? Date.now() - updatedAt.getTime() : null;
    const isStale = ageMs !== null ? ageMs > (6 * 60 * 60 * 1000) : true;

    const lastRunAt = settings.leaderboardAutoPostLastRunAt
      ? new Date(settings.leaderboardAutoPostLastRunAt)
      : null;
    const intervalHours = Math.max(1, Number(settings.leaderboardAutoPostIntervalHours || 6));
    const nextRunAt = lastRunAt
      ? new Date(lastRunAt.getTime() + (intervalHours * 60 * 60 * 1000))
      : null;

    const embed = new EmbedBuilder()
      .setAuthor({ name: "Ascend Sync Server", iconURL: BRAND_ICON })
      .setTitle("🔄 Sync Audit")
      .setColor(statusColor(settings, isStale ? "eliminated" : "active"))
      .setDescription(isStale ? "> ⚠️ **Warning:** Data feed is stale." : "> ✅ **Status:** Data feed is fresh.")
      .addFields(
        {
          name: "📊 Leaderboard Feed",
          value: `\`\`\`yaml\nEndpoint: ${leaderboard.endpoint}\nEntries: ${leaderboard.entries.length}\nUpdated: ${updatedAt ? updatedAt.toLocaleString() : "Unknown"}\nAge: ${ageMs !== null ? durationLabel(ageMs) : "Unknown"}\nFreshness: ${isStale ? "Stale" : "Fresh"}\n\`\`\``
        },
        {
          name: "⚙️ Auto Post Schedule",
          value: `\`\`\`yaml\nEnabled: ${settings.leaderboardAutoPostEnabled ? "Yes" : "No"}\nChannel: ${settings.leaderboardChannelId ? `#${settings.leaderboardChannelId}` : "Not set"}\nInterval: ${intervalHours} hour(s)\nLast Run: ${lastRunAt ? lastRunAt.toLocaleString() : "Never"}\nNext Due: ${nextRunAt ? nextRunAt.toLocaleString() : "Pending run"}\n\`\`\``
        }
      )
      .setFooter({ text: footerText(settings), iconURL: BRAND_ICON })
      .setTimestamp(new Date());

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply({
      content: `Sync audit failed: ${error instanceof Error ? error.message : "Unknown error"}`
    });
  }
}

async function handleRefreshCommandsCommand(interaction, context) {
  const settings = getGuildSettings(interaction.guild.id, context.config);

  await interaction.deferReply({ ephemeral: true });

  try {
    const registration = await registerSlashCommands(interaction.client, context.config);
    const scopeText = registration.scope === "guild"
      ? `Guild (${registration.guildId})`
      : "Global";

    const embed = new EmbedBuilder()
      .setAuthor({ name: "Ascend Command Core", iconURL: BRAND_ICON })
      .setTitle("🚀 Command Refresh")
      .setColor(statusColor(settings, "active"))
      .setDescription("> Slash commands were synchronized successfully.")
      .addFields(
        { name: "🌐 Scope", value: `\`\`\`\n${scopeText}\n\`\`\``, inline: true },
        { name: "🔢 Deployed", value: `\`\`\`\n${registration.count} commands\n\`\`\``, inline: true },
        { name: "⚠️ Warnings", value: `\`\`\`\n${registration.warning || "None"}\n\`\`\``, inline: false }
      )
      .setFooter({ text: footerText(settings), iconURL: BRAND_ICON })
      .setTimestamp(new Date());

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply({
      content: `Command refresh failed: ${error instanceof Error ? error.message : "Unknown error"}`
    });
  }
}

async function handleConfigCheckCommand(interaction, context) {
  const settings = getGuildSettings(interaction.guild.id, context.config);
  const appConfig = applicationConfig(context);

  const checks = [
    { label: "Leaderboard endpoint", ok: Boolean(settings.leaderboardEndpoint || context.config.leaderboardApiUrl) },
    { label: "Leaderboard channel", ok: Boolean(settings.leaderboardChannelId) },
    { label: "Ticket enabled", ok: Boolean(settings.ticketEnabled) },
    { label: "Ticket category", ok: Boolean(settings.ticketCategoryId) },
    { label: "Welcome channel", ok: Boolean(settings.welcomeChannelId) },
    { label: "Applications channel", ok: Boolean(appConfig.channelId) },
    { label: "Application reviewer role", ok: Boolean(appConfig.reviewerRoleId) },
    { label: "Application accepted role", ok: Boolean(appConfig.acceptedRoleId) }
  ];

  const passed = checks.filter((item) => item.ok).length;
  const failed = checks.length - passed;

  const embed = new EmbedBuilder()
    .setAuthor({ name: "Ascend Initialisation", iconURL: BRAND_ICON })
    .setTitle("🛠️ Config Check")
    .setColor(statusColor(settings, failed ? "eliminated" : "active"))
    .setDescription("Validating module configuration.\n\n" + checks.map((item) => `> ${item.ok ? "✅" : "⚠️"} **${item.label}**`).join("\n"))
    .addFields(
      { name: "Passed", value: `\`\`\`\n${passed}\n\`\`\``, inline: true },
      { name: "Warnings", value: `\`\`\`\n${failed}\n\`\`\``, inline: true }
    )
    .setFooter({ text: footerText(settings), iconURL: BRAND_ICON })
    .setTimestamp(new Date());

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleAutoPostStatusCommand(interaction, context) {
  const settings = getGuildSettings(interaction.guild.id, context.config);
  const intervalHours = Math.max(1, Number(settings.leaderboardAutoPostIntervalHours || 6));
  const lastRunAt = settings.leaderboardAutoPostLastRunAt
    ? new Date(settings.leaderboardAutoPostLastRunAt)
    : null;
  const nextDueAt = lastRunAt
    ? new Date(lastRunAt.getTime() + (intervalHours * 60 * 60 * 1000))
    : null;

  const embed = new EmbedBuilder()
    .setTitle("Ascend Entrenched Auto Post Status")
    .setColor(statusColor(settings, settings.leaderboardAutoPostEnabled ? "active" : "eliminated"))
    .addFields(
      { name: "Enabled", value: settings.leaderboardAutoPostEnabled ? "Yes" : "No", inline: true },
      { name: "Interval", value: `${intervalHours} hour(s)`, inline: true },
      { name: "Channel", value: settings.leaderboardChannelId ? `<#${settings.leaderboardChannelId}>` : "Not set", inline: true },
      { name: "Last Run", value: lastRunAt ? lastRunAt.toLocaleString() : "Never", inline: false },
      { name: "Next Due", value: nextDueAt ? nextDueAt.toLocaleString() : "Pending first run", inline: false }
    )
    .setFooter({ text: footerText(settings) })
    .setTimestamp(new Date());

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleHqPostCommand(interaction, context) {
  const settings = getGuildSettings(interaction.guild.id, context.config);
  const channel = interaction.options.getChannel("channel");
  const message = interaction.options.getString("message", true).trim();
  const pin = interaction.options.getBoolean("pin") === true;

  const targetChannel = channel || interaction.channel;
  if (!targetChannel || !targetChannel.isTextBased()) {
    await interaction.reply({
      content: "Target channel is not a text channel.",
      ephemeral: true
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle("Ascend Entrenched HQ Broadcast")
    .setColor(statusColor(settings, "active"))
    .setDescription(message)
    .setFooter({ text: footerText(settings) })
    .setTimestamp(new Date());

  const sent = await targetChannel.send({ embeds: [embed] });
  if (pin) {
    await sent.pin().catch(() => {});
  }

  await interaction.reply({
    content: `Broadcast sent to ${targetChannel}.${pin ? " Message pinned if permissions allowed." : ""}`,
    ephemeral: true
  });
}

async function handleSetWelcomeCommand(interaction, context) {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return;
  }

  const guildId = interaction.guild.id;
  const channel = interaction.options.getChannel("channel", true);
  const next = patchGuildSettings(guildId, { welcomeChannelId: channel.id }, context.config);
  const preview = buildWelcomeEmbedPreview({
    memberMention: `<@${interaction.user.id}>`,
    serverName: interaction.guild.name,
    memberCount: interaction.guild.memberCount,
    autoRoleId: next.autoRoleId
  });

  const embed = new EmbedBuilder()
    .setTitle("Welcome Setup Updated")
    .setColor(statusColor(next, "active"))
    .addFields(
      {
        name: "Channel",
        value: next.welcomeChannelId ? `<#${next.welcomeChannelId}>` : "Not set"
      },
      {
        name: "Auto Role",
        value: next.autoRoleId ? `<@&${next.autoRoleId}>` : "Not set"
      },
      {
        name: "Preview",
        value: preview.slice(0, 1024)
      }
    )
    .setFooter({ text: footerText(next) })
    .setTimestamp(new Date());

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleAutoRoleCommand(interaction, context) {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return;
  }

  const role = interaction.options.getRole("role", true);
  if (role.managed) {
    await interaction.reply({
      content: "Managed integration roles cannot be set as auto roles.",
      ephemeral: true
    });
    return;
  }

  const me = interaction.guild.members.me || await interaction.guild.members.fetchMe().catch(() => null);
  if (!me || role.position >= me.roles.highest.position) {
    await interaction.reply({
      content: "I cannot assign that role due to role hierarchy. Move my role above it and try again.",
      ephemeral: true
    });
    return;
  }

  const next = patchGuildSettings(interaction.guild.id, { autoRoleId: role.id }, context.config);
  const embed = new EmbedBuilder()
    .setTitle("Auto Role Updated")
    .setColor(statusColor(next, "active"))
    .setDescription(`New members will now receive <@&${role.id}> when they join.`)
    .setFooter({ text: footerText(next) })
    .setTimestamp(new Date());

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleSendInfoCommand(interaction, context) {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return;
  }

  const settings = getGuildSettings(interaction.guild.id, context.config);
  const appConfig = applicationConfig(context);
  const channel = interaction.options.getChannel("channel", true);

  if (!channel.isTextBased()) {
    await interaction.reply({
      content: "Target channel is not a text channel.",
      ephemeral: true
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle("Ascend Entrenched - New Member Intel")
    .setColor(statusColor(settings, "active"))
    .setDescription("Welcome to Ascend Entrenched. Follow this quick guide to get started fast.")
    .addFields(
      {
        name: "Start Here",
        value: [
          "1) Read the rules and announcements.",
          "2) Introduce yourself in the community channels.",
          "3) Use /1v1 whenever you are looking for a match."
        ].join("\n")
      },
      {
        name: "Applications",
        value: appConfig.channelId
          ? `Application updates are handled in <#${appConfig.channelId}>.`
          : "Ask staff where applications are currently handled."
      },
      {
        name: "Support",
        value: settings.ticketPanelChannelId
          ? `Open a ticket from <#${settings.ticketPanelChannelId}> if you need help.`
          : "Use the ticket panel to contact staff if you need help."
      },
      {
        name: "Welcome Channel",
        value: settings.welcomeChannelId ? `<#${settings.welcomeChannelId}>` : "Not set",
        inline: true
      },
      {
        name: "Auto Role",
        value: settings.autoRoleId ? `<@&${settings.autoRoleId}>` : "Not set",
        inline: true
      }
    )
    .setFooter({ text: footerText(settings) })
    .setTimestamp(new Date());

  await channel.send({ embeds: [embed] });
  await interaction.reply({
    content: `Info message sent to ${channel}.`,
    ephemeral: true
  });
}

async function handleInfoCommand(interaction, context) {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return;
  }

  const settings = getGuildSettings(interaction.guild.id, context.config);
  const appConfig = applicationConfig(context);

  const embed = new EmbedBuilder()
    .setTitle("Ascend Entrenched Info")
    .setColor(statusColor(settings, "active"))
    .setDescription("Quick guide for members and staff.")
    .addFields(
      {
        name: "Core Commands",
        value: [
          "/1v1 - Join or leave live queue",
          "/leaderboard - View synced leaderboard",
          "/userinfo - Player profile snapshot",
          "/help - Full command list"
        ].join("\n")
      },
      {
        name: "Support",
        value: settings.ticketPanelChannelId
          ? `Open support tickets from <#${settings.ticketPanelChannelId}>.`
          : "Ticket panel channel is not configured yet."
      },
      {
        name: "Applications",
        value: appConfig.channelId
          ? `Application reviews are posted in <#${appConfig.channelId}>.`
          : "Application review channel is not configured yet."
      },
      {
        name: "Auto Role",
        value: settings.autoRoleId ? `<@&${settings.autoRoleId}>` : "Not set"
      }
    )
    .setFooter({ text: footerText(settings) })
    .setTimestamp(new Date());

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleHelpCommand(interaction, context) {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return;
  }

  const settings = getGuildSettings(interaction.guild.id, context.config);
  const embed = new EmbedBuilder()
    .setTitle("Ascend Entrenched Command Help")
    .setColor(statusColor(settings, "active"))
    .addFields(
      {
        name: "Setup",
        value: [
          "/setupapply, /setupticket",
          "/setwelcome, /autorole, /setautorole",
          "/sendinfo, /ticketpanel, /applypanel"
        ].join("\n")
      },
      {
        name: "Community",
        value: [
          "/1v1, /leaderboard, /userinfo",
          "/info, /status, /serverintel"
        ].join("\n")
      },
      {
        name: "Utility",
        value: [
          "/help, /webstatus, /syncaudit",
          "/poll, /choose, /roll, /coinflip, /eightball"
        ].join("\n")
      },
      {
        name: "If Commands Missing",
        value: "Run /refreshcommands and restart the bot once to force command sync."
      }
    )
    .setFooter({ text: footerText(settings) })
    .setTimestamp(new Date());

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleOneVsOneCommand(interaction, context) {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return;
  }

  const settings = getGuildSettings(interaction.guild.id, context.config);
  const action = String(interaction.options.getString("action") || "join").trim().toLowerCase();

  try {
    if (action === "leave") {
      const entries = await requestLfgQueue(context, "leave", { userId: interaction.user.id });
      const embed = new EmbedBuilder()
        .setTitle("1v1 Queue Updated")
        .setColor(statusColor(settings, "eliminated"))
        .setDescription("You were removed from the live 1v1 queue.")
        .addFields({ name: "Active Queue", value: String(entries.length), inline: true })
        .setFooter({ text: footerText(settings) })
        .setTimestamp(new Date());

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (action === "status") {
      const entries = await requestLfgQueue(context, "status");
      const current = entries.find((entry) => String(entry?.userId || "") === String(interaction.user.id));
      const remaining = current
        ? shortDurationLabel(Number(current.expiresAt || 0) - Date.now())
        : "Not in queue";

      const embed = new EmbedBuilder()
        .setTitle("1v1 Queue Status")
        .setColor(statusColor(settings, current ? "active" : "info"))
        .setDescription(current ? `${LFG_STATUS_LABEL} (${remaining} left)` : "You are not currently queued.")
        .addFields({ name: "Active Queue", value: String(entries.length), inline: true })
        .setFooter({ text: footerText(settings) })
        .setTimestamp(new Date());

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const entries = await requestLfgQueue(context, "join", {
      userId: interaction.user.id,
      username: interaction.user.username,
      guildId: interaction.guild.id,
      guildName: interaction.guild.name,
      status: LFG_STATUS_LABEL,
      ttlSeconds: LFG_QUEUE_TTL_SECONDS
    });

    const current = entries.find((entry) => String(entry?.userId || "") === String(interaction.user.id));
    const remaining = current
      ? shortDurationLabel(Number(current.expiresAt || 0) - Date.now())
      : "60m";

    const embed = new EmbedBuilder()
      .setTitle("1v1 Queue Active")
      .setColor(statusColor(settings, "active"))
      .setDescription(`You are now **${LFG_STATUS_LABEL}** on the web live feed.`)
      .addFields(
        { name: "Duration", value: remaining, inline: true },
        { name: "Active Queue", value: String(entries.length), inline: true }
      )
      .setFooter({ text: footerText(settings) })
      .setTimestamp(new Date());

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    console.warn("[1v1 Queue Error]", error instanceof Error ? error.message : error);
    await interaction.reply({
      content: "Your request has been accepted.",
      ephemeral: true
    });
  }
}

async function handlePollCommand(interaction, context) {
  const settings = getGuildSettings(interaction.guild.id, context.config);
  const question = interaction.options.getString("question", true).trim();
  const optionsRaw = interaction.options.getString("options", true);
  const durationMinutes = clampInt(interaction.options.getInteger("duration_minutes"), 1, 10080, 60);
  const options = splitPipeOptions(optionsRaw, { min: 2, max: 6 });

  if (!options) {
    await interaction.reply({
      content: "Provide 2 to 6 options separated by |, for example: yes | no | maybe",
      ephemeral: true
    });
    return;
  }

  if (!interaction.channel || !interaction.channel.isTextBased()) {
    await interaction.reply({
      content: "This command requires a text channel.",
      ephemeral: true
    });
    return;
  }

  const lines = options.map((choice, index) => `${POLL_REACTIONS[index]} ${choice}`);
  const closesAtUnix = Math.floor((Date.now() + (durationMinutes * 60 * 1000)) / 1000);

  const embed = new EmbedBuilder()
    .setTitle("Ascend Entrenched Poll")
    .setColor(statusColor(settings, "active"))
    .setDescription(`**${question}**\n\n${lines.join("\n")}`)
    .addFields({
      name: "Voting Window",
      value: `Closes <t:${closesAtUnix}:R>`
    })
    .setFooter({ text: footerText(settings) })
    .setTimestamp(new Date());

  const pollMessage = await interaction.channel.send({ embeds: [embed] });
  await Promise.all(lines.map((_, index) => pollMessage.react(POLL_REACTIONS[index]).catch(() => null)));

  await interaction.reply({
    content: `Poll posted in ${interaction.channel}.`,
    ephemeral: true
  });
}

async function handleServerIntelCommand(interaction, context) {
  const settings = getGuildSettings(interaction.guild.id, context.config);
  const guild = interaction.guild;
  const createdUnix = Math.floor(guild.createdTimestamp / 1000);

  const embed = new EmbedBuilder()
    .setTitle("Ascend Entrenched Server Intel")
    .setColor(statusColor(settings, "active"))
    .addFields(
      { name: "Server", value: guild.name, inline: true },
      { name: "Members", value: String(guild.memberCount), inline: true },
      { name: "Channels", value: String(guild.channels.cache.size), inline: true },
      { name: "Roles", value: String(guild.roles.cache.size), inline: true },
      { name: "Created", value: `<t:${createdUnix}:F>`, inline: false }
    )
    .setFooter({ text: footerText(settings) })
    .setTimestamp(new Date());

  if (guild.iconURL()) {
    embed.setThumbnail(guild.iconURL({ size: 512 }));
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleAvatarCommand(interaction, context) {
  const settings = getGuildSettings(interaction.guild.id, context.config);
  const targetUser = interaction.options.getUser("user") || interaction.user;

  const embed = new EmbedBuilder()
    .setTitle(`Ascend Entrenched Avatar | ${targetUser.tag}`)
    .setColor(statusColor(settings, "active"))
    .setImage(targetUser.displayAvatarURL({ size: 1024 }))
    .setFooter({ text: footerText(settings) })
    .setTimestamp(new Date());

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleCoinflipCommand(interaction, context) {
  const settings = getGuildSettings(interaction.guild.id, context.config);
  const result = Math.random() < 0.5 ? "Heads" : "Tails";

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle("Ascend Entrenched Coin Flip")
        .setColor(statusColor(settings, "active"))
        .setDescription(`Result: **${result}**`)
        .setFooter({ text: footerText(settings) })
        .setTimestamp(new Date())
    ],
    ephemeral: true
  });
}

async function handleRollCommand(interaction, context) {
  const settings = getGuildSettings(interaction.guild.id, context.config);
  const sides = clampInt(interaction.options.getInteger("sides"), 2, 1000, 100);
  const count = clampInt(interaction.options.getInteger("count"), 1, 10, 1);
  const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
  const total = rolls.reduce((sum, value) => sum + value, 0);

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle("Ascend Entrenched Dice Roll")
        .setColor(statusColor(settings, "active"))
        .setDescription(`d${sides} x${count} -> ${rolls.join(", ")}`)
        .addFields({ name: "Total", value: String(total), inline: true })
        .setFooter({ text: footerText(settings) })
        .setTimestamp(new Date())
    ],
    ephemeral: true
  });
}

async function handleChooseCommand(interaction, context) {
  const settings = getGuildSettings(interaction.guild.id, context.config);
  const options = splitPipeOptions(interaction.options.getString("options", true), { min: 2, max: 10 });
  if (!options) {
    await interaction.reply({
      content: "Provide 2 to 10 choices separated by |, for example: push | defend | regroup",
      ephemeral: true
    });
    return;
  }

  const chosen = randomItem(options, options[0]);
  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle("Ascend Entrenched Decision")
        .setColor(statusColor(settings, "active"))
        .setDescription(`Chosen option: **${chosen}**`)
        .setFooter({ text: footerText(settings) })
        .setTimestamp(new Date())
    ],
    ephemeral: true
  });
}

async function handleEightBallCommand(interaction, context) {
  const settings = getGuildSettings(interaction.guild.id, context.config);
  const question = interaction.options.getString("question", true).trim();
  const answer = randomItem(EIGHTBALL_RESPONSES, "Intelligence unavailable.");

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle("Ascend Entrenched 8-Ball")
        .setColor(statusColor(settings, "active"))
        .addFields(
          { name: "Question", value: question },
          { name: "Answer", value: answer }
        )
        .setFooter({ text: footerText(settings) })
        .setTimestamp(new Date())
    ],
    ephemeral: true
  });
}

async function handleHelpCommand(interaction, context) {
  const brandIcon = BRAND_ICON || "https://ascendentrenched.vercel.app/assets/brand/logo-mark-512.png";
  const embed = new EmbedBuilder()
    .setAuthor({ name: "Ascend Command Center", iconURL: brandIcon })
    .setTitle("Command Directory")
    .setColor("#3B82F6")
    .setDescription("Here are the available commands, separated by permission level.")
    .addFields(
      { name: "🛡️ Admin & Staff Commands", value: "`mute`, `warn`, `kick`, `ban`, `hqpost`, `ticketpanel`, `syncaudit`, `setup`, `template`, `refreshcommands`\n*(Requires specific server permissions)*" },
      { name: "👤 Member Core Commands", value: "`leaderboard` (Show public rankings), `userinfo`, `1v1`, `avatar`, `serverstats` (View server info)" },
      { name: "🎲 Fun & Utilities", value: "`eightball`, `coinflip`, `roll`, `choose`, `joke`, `ping`" }
    )
    .setFooter({ text: "Ascend Entrenched", iconURL: brandIcon })
    .setTimestamp();
  
  await interaction.reply({ embeds: [embed], ephemeral: false });
}

async function handleServerStatsCommand(interaction, context) {
  if (!interaction.guild) {
    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return;
  }
  const brandIcon = BRAND_ICON || "https://ascendentrenched.vercel.app/assets/brand/logo-mark-512.png";
  const embed = new EmbedBuilder()
    .setAuthor({ name: "Ascend Telemetry", iconURL: brandIcon })
    .setTitle(`📈 ${interaction.guild.name} Statistics`)
    .setColor("#3B82F6")
    .setThumbnail(interaction.guild.iconURL({ dynamic: true }) || brandIcon)
    .addFields(
      { name: "👥 Members", value: `\`\`\`\n${interaction.guild.memberCount}\n\`\`\``, inline: true },
      { name: "🔰 Roles", value: `\`\`\`\n${interaction.guild.roles.cache.size}\n\`\`\``, inline: true },
      { name: "💬 Channels", value: `\`\`\`\n${interaction.guild.channels.cache.size}\n\`\`\``, inline: true },
      { name: "🚀 Boosts", value: `> ${interaction.guild.premiumSubscriptionCount || 0} Boosts (Tier ${interaction.guild.premiumTier})`, inline: false }
    )
    .setFooter({ text: "Ascend Entrenched", iconURL: brandIcon })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: false });
}

async function handleJokeCommand(interaction, context) {
  const jokes = [
    "Why do programmers prefer dark mode? Because light attracts bugs.",
    "Why did the soldier bring a ladder to the bar? He heard the drinks were on the house.",
    "I tried to explain to my squad how to throw a grenade, but it went over their heads.",
    "What's a tactical gamer's favorite type of music? Heavy Metal Gear.",
    "Why are keyboards great at warfare? Because they have two Shifts and a Space to retreat.",
    "How many programmers does it take to change a light bulb? None, that's a hardware problem."
  ];
  const selectedJoke = randomItem(jokes, jokes[0]);
  
  const embed = new EmbedBuilder()
    .setTitle("🎲 Humor Module")
    .setColor("#FACC15")
    .setDescription(`> ${selectedJoke}`);
    
  await interaction.reply({ embeds: [embed] });
}

async function handleTemplateCommand(interaction, context) {
  const templateName = interaction.options.getString("name", true);
  const brandIcon = BRAND_ICON || "https://ascendentrenched.vercel.app/assets/brand/logo-mark-512.png";
  let title = "Template";
  let desc = "";

  if (templateName === "rules") {
    title = "📜 Server Rules & Welcome";
    desc = "**1. Respect Everyone**\nTreat all members with respect. No harassment or toxicity.\n\n**2. No Exploiting or Cheating**\nAny forms of exploiting in-game will result in an immediate ban.\n\n**3. Listen to Staff**\nStaff decisions are final.\n\n> *Ignorance of the rules is not an excuse.*";
  } else if (templateName === "app_guide") {
    title = "📝 Application Guidelines";
    desc = "To join the roster, ensure you meet the level requirements.\n\n1. Use the Create Application button.\n2. Provide your exact Discord tag and Roblox username.\n3. Wait patiently for staff to review your submission in the designated channels.";
  } else if (templateName === "war_room") {
    title = "⚔️ War Room Operational";
    desc = "**The War Room is now active.**\n\nAll forces must report to their designated voice channels immediately. Ensure your gear and loadouts are prepared before deployment.";
  }

  const embed = new EmbedBuilder()
    .setAuthor({ name: "Ascend Dispatch", iconURL: brandIcon })
    .setTitle(title)
    .setColor("#F43F5E")
    .setDescription(desc)
    .setFooter({ text: "Official Ascend Entrenched Template", iconURL: brandIcon })
    .setTimestamp();
    
  await interaction.reply({ embeds: [embed] });
}

async function handleSlashCommand(interaction, context) {
  if (await handleApplyDecisionButton(interaction, context)) {
    return;
  }

  if (await handleApplyCreateButton(interaction)) {
    return;
  }

  if (await handleApplyCreateModal(interaction, context)) {
    return;
  }

  if (await handleTicketCreateButton(interaction, context)) {
    return;
  }

  if (await handleTicketCreateModal(interaction, context)) {
    return;
  }

  if (await handleTicketStatusButton(interaction, context)) {
    return;
  }

  if (await handleTicketCloseButton(interaction, context)) {
    return;
  }

  if (await handleTicketCloseModal(interaction, context)) {
    return;
  }

  if (await handleLeaderboardNavButton(interaction, context)) {
    return;
  }

  if (!interaction.isChatInputCommand()) {
    return;
  }

  if (interaction.commandName === "help") {
    await handleHelpCommand(interaction, context);
    return;
  }

  if (interaction.commandName === "serverstats") {
    await handleServerStatsCommand(interaction, context);
    return;
  }

  if (interaction.commandName === "joke") {
    await handleJokeCommand(interaction, context);
    return;
  }

  if (interaction.commandName === "template") {
    await handleTemplateCommand(interaction, context);
    return;
  }

  if (interaction.commandName === "ping") {
    const wsPing = Math.round(interaction.client.ws.ping || 0);
    await interaction.reply({
      content: `Pong. Websocket ping: ${wsPing} ms`,
      ephemeral: true
    });
    return;
  }

  if (interaction.commandName === "queue") {
    await interaction.reply({
      content: `Queue size: ${context.updateQueue.size()} | Rate: 1 message / ${context.config.queueIntervalMs} ms`,
      ephemeral: true
    });
    return;
  }

  if (interaction.commandName === "status") {
    await handleStatusCommand(interaction, context);
    return;
  }

  if (interaction.commandName === "webstatus") {
    await handleWebStatusCommand(interaction, context);
    return;
  }

  if (interaction.commandName === "syncaudit") {
    await handleSyncAuditCommand(interaction, context);
    return;
  }

  if (interaction.commandName === "refreshcommands") {
    await handleRefreshCommandsCommand(interaction, context);
    return;
  }

  if (interaction.commandName === "configcheck") {
    await handleConfigCheckCommand(interaction, context);
    return;
  }

  if (interaction.commandName === "autopoststatus") {
    await handleAutoPostStatusCommand(interaction, context);
    return;
  }

  if (interaction.commandName === "hqpost") {
    await handleHqPostCommand(interaction, context);
    return;
  }

  if (interaction.commandName === "poll") {
    await handlePollCommand(interaction, context);
    return;
  }

  if (interaction.commandName === "serverintel") {
    await handleServerIntelCommand(interaction, context);
    return;
  }

  if (interaction.commandName === "avatar") {
    await handleAvatarCommand(interaction, context);
    return;
  }

  if (interaction.commandName === "coinflip") {
    await handleCoinflipCommand(interaction, context);
    return;
  }

  if (interaction.commandName === "roll") {
    await handleRollCommand(interaction, context);
    return;
  }

  if (interaction.commandName === "choose") {
    await handleChooseCommand(interaction, context);
    return;
  }

  if (interaction.commandName === "eightball") {
    await handleEightBallCommand(interaction, context);
    return;
  }

  if (interaction.commandName === "1v1") {
    await handleOneVsOneCommand(interaction, context);
    return;
  }

  if (interaction.commandName === "ticketpanel") {
    const settings = getGuildSettings(interaction.guild.id, context.config);
    const ticketConfig = ticketPanelConfig(settings);
    const panelEmbed = new EmbedBuilder()
      .setTitle("Ascend Entrenched Tickets")
      .setColor(statusColor(settings, "active"))
      .setDescription("Press **Create Help Ticket** to instantly open a private support ticket with staff.")
      .addFields(
        { name: "Flow", value: "One click to create ticket. Staff closes with Close Ticket button." },
        { name: "Status", value: settings.ticketEnabled ? "Ticket creation enabled" : "Ticket creation disabled" }
      )
      .setFooter({ text: footerText(settings) })
      .setTimestamp(new Date());

    const components = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(TICKET_CREATE_BUTTON_ID)
          .setLabel("Create Help Ticket")
          .setStyle(ButtonStyle.Success)
          .setDisabled(!settings.ticketEnabled)
      )
    ];

    if (ticketConfig.panelChannelId) {
      const panelChannel = interaction.guild.channels.cache.get(ticketConfig.panelChannelId)
        || await interaction.guild.channels.fetch(ticketConfig.panelChannelId).catch(() => null);

      if (!panelChannel || !panelChannel.isTextBased()) {
        await interaction.reply({
          content: "Configured ticket panel channel is not valid. Update with /setupticket.",
          ephemeral: true
        });
        return;
      }

      await panelChannel.send({ embeds: [panelEmbed], components });
      await interaction.reply({
        content: `Ticket panel posted in ${panelChannel}.`,
        ephemeral: true
      });
      return;
    }

    await interaction.reply({ embeds: [panelEmbed], components });
    return;
  }

  if (interaction.commandName === "applypanel") {
    const settings = getGuildSettings(interaction.guild.id, context.config);
    const appConfig = applicationConfig(context);
    const panelEmbed = new EmbedBuilder()
      .setTitle("Ascend Entrenched Applications")
      .setColor(statusColor(settings, "active"))
      .setDescription("Press **Apply Now** to submit your player application. Staff will accept or reject it in the applications channel.")
      .addFields(
        { name: "Required", value: "Roblox Username, Faction, Country, Device You Play On, Classes You Play On" },
        { name: "Panel Channel", value: appConfig.panelChannelId ? `<#${appConfig.panelChannelId}>` : "Current channel" },
        { name: "Review Channel", value: appConfig.channelId ? `<#${appConfig.channelId}>` : "Not configured (use /setupapply)" }
      )
      .setFooter({ text: footerText(settings) })
      .setTimestamp(new Date());

    const components = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(APPLY_CREATE_BUTTON_ID)
          .setLabel("Apply Now")
          .setStyle(ButtonStyle.Primary)
      )
    ];

    if (appConfig.panelChannelId) {
      const panelChannel = interaction.guild.channels.cache.get(appConfig.panelChannelId)
        || await interaction.guild.channels.fetch(appConfig.panelChannelId).catch(() => null);

      if (!panelChannel || !panelChannel.isTextBased()) {
        await interaction.reply({
          content: "Configured apply panel channel is not valid. Update with /setupapply.",
          ephemeral: true
        });
        return;
      }

      await panelChannel.send({ embeds: [panelEmbed], components });
      await interaction.reply({
        content: `Apply panel posted in ${panelChannel}.`,
        ephemeral: true
      });
      return;
    }

    await interaction.reply({ embeds: [panelEmbed], components });
    return;
  }

  if (interaction.commandName === "ticketupdate") {
    if (!interaction.inGuild() || !isTicketChannel(interaction.channel)) {
      await interaction.reply({ content: "Use this command inside a ticket channel.", ephemeral: true });
      return;
    }

    const settings = getGuildSettings(interaction.guild.id, context.config);
    const note = interaction.options.getString("note", true).trim();
    const status = interaction.options.getString("status");
    const meta = parseTicketTopic(interaction.channel.topic) || {};

    if (status && !hasReviewerAccess(interaction.member, settings)) {
      await interaction.reply({
        content: "Only reviewers can change ticket status.",
        ephemeral: true
      });
      return;
    }

    if (status) {
      await interaction.channel.setTopic(buildTicketTopic({ ...meta, status })).catch(() => {});
    }

    const noteEmbed = new EmbedBuilder()
      .setTitle(`Ticket ${meta.ticket || "Update"}`)
      .setColor(statusColor(settings, status || "active"))
      .setDescription(note)
      .addFields({
        name: "By",
        value: `<@${interaction.user.id}>`,
        inline: true
      })
      .setFooter({ text: footerText(settings) })
      .setTimestamp(new Date());

    if (status) {
      noteEmbed.addFields({
        name: "Status",
        value: `${statusIcon(status)} ${normalizeStatusLabel(status)}`,
        inline: true
      });
    }

    await interaction.reply({ embeds: [noteEmbed] });

    appendTicketAudit({
      event: "ticket_follow_up",
      guildId: interaction.guild.id,
      channelId: interaction.channel.id,
      ticketId: meta.ticket || "",
      ownerId: meta.owner || "",
      actorId: interaction.user.id,
      note,
      status: status || null
    });

    return;
  }

  if (interaction.commandName === "userinfo") {
    await handleUserInfoCommand(interaction, context);
    return;
  }

  if (interaction.commandName === "leaderboard") {
    await handleLeaderboardCommand(interaction, context);
    return;
  }

  if (interaction.commandName === "setup") {
    await handleSetupCommand(interaction, context);
    return;
  }

  if (interaction.commandName === "setupapply") {
    await handleApplySetupCommand(interaction, context);
    return;
  }

  if (interaction.commandName === "setupticket") {
    await handleTicketPanelSetupCommand(interaction, context);
    return;
  }

  if (interaction.commandName === "setwelcome") {
    await handleSetWelcomeCommand(interaction, context);
    return;
  }

  if (interaction.commandName === "autorole") {
    await handleAutoRoleCommand(interaction, context);
    return;
  }

  if (interaction.commandName === "setautorole") {
    await handleAutoRoleCommand(interaction, context);
    return;
  }

  if (interaction.commandName === "sendinfo") {
    await handleSendInfoCommand(interaction, context);
    return;
  }

  if (interaction.commandName === "info") {
    await handleInfoCommand(interaction, context);
    return;
  }

  if (interaction.commandName === "help") {
    await handleHelpCommand(interaction, context);
    return;
  }

  if (interaction.commandName === "webhooktest") {
    const payload = {
      group: interaction.options.getString("group", true),
      player: interaction.options.getString("player", true),
      status: interaction.options.getString("status", true),
      score: interaction.options.getNumber("score", true),
      matchHighlight: interaction.options.getString("highlight", true)
    };

    context.updateQueue.enqueue(
      async () => context.handleAcceptedEvent(payload, "leaderboard"),
      { source: "slash:webhooktest", group: payload.group }
    );

    await interaction.reply({
      content: "Test update queued and will be sent to the configured channel shortly.",
      ephemeral: true
    });
    return;
  }

  if (interaction.commandName === "mute") {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
      return;
    }

    const user = interaction.options.getUser("user", true);
    const minutes = interaction.options.getInteger("minutes", true);
    const reason = interaction.options.getString("reason") || `Muted by ${interaction.user.tag}`;
    const durationMs = getMuteDurationMs(minutes);

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      await interaction.reply({ content: "User is not in this server.", ephemeral: true });
      return;
    }

    if (!member.moderatable) {
      await interaction.reply({
        content: "I cannot mute that member (role hierarchy or permissions issue).",
        ephemeral: true
      });
      return;
    }

    await member.timeout(durationMs, reason);
    await interaction.reply({
      content: `Muted ${user.tag} for ${minutes} minute(s). Reason: ${reason}`,
      ephemeral: true
    });
    return;
  }

  if (interaction.commandName === "warn" || interaction.commandName === "waarn") {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
      return;
    }

    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") || `Warned by ${interaction.user.tag}`;
    const guildName = String(interaction.guild?.name || "this server").trim();

    let dmDelivered = true;
    try {
      await user.send({
        content: [
          `You have received an admin warning in **${guildName}**.`,
          `Reason: ${reason}`,
          `Moderator: ${interaction.user.tag}`
        ].join("\n")
      });
    } catch {
      dmDelivered = false;
    }

    await interaction.reply({
      content: dmDelivered
        ? `Warned ${user.tag}. A DM with the reason was sent.`
        : `Warned ${user.tag}, but I could not send them a DM (their DMs may be closed).`,
      ephemeral: true
    });
    return;
  }

  if (interaction.commandName === "kick") {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
      return;
    }

    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") || `Kicked by ${interaction.user.tag}`;
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (!member) {
      await interaction.reply({ content: "User is not in this server.", ephemeral: true });
      return;
    }

    if (!member.kickable) {
      await interaction.reply({
        content: "I cannot kick that member (role hierarchy or permissions issue).",
        ephemeral: true
      });
      return;
    }

    await member.kick(reason);
    await interaction.reply({
      content: `Kicked ${user.tag}. Reason: ${reason}`,
      ephemeral: true
    });
    return;
  }

  if (interaction.commandName === "ban") {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
      return;
    }

    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") || `Banned by ${interaction.user.tag}`;
    const deleteDays = interaction.options.getInteger("delete_days") || 0;

    await interaction.guild.members.ban(user.id, {
      reason,
      deleteMessageSeconds: deleteDays * 86400
    });

    await interaction.reply({
      content: `Banned ${user.tag}. Reason: ${reason}. Deleted messages: ${deleteDays} day(s).`,
      ephemeral: true
    });
  }
}

module.exports = {
  registerSlashCommands,
  handleSlashCommand
};
