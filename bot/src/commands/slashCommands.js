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
const TICKET_STATUS_PREFIX = "ticket_status:";
const TICKET_CLOSE_BUTTON_ID = "ticket_close";
const TICKET_CLOSE_MODAL_ID = "ticket_close_modal";
const LEADERBOARD_NAV_PREFIX = "lbnav";

const DEFAULT_FOOTER = "Ascend Entrenched";
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
        .setCustomId(`${TICKET_STATUS_PREFIX}open`)
        .setLabel("Open")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId(`${TICKET_STATUS_PREFIX}waiting_user`)
        .setLabel("Waiting User")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId(`${TICKET_STATUS_PREFIX}in_review`)
        .setLabel("In Review")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId(`${TICKET_STATUS_PREFIX}escalated`)
        .setLabel("Escalated")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId(`${TICKET_STATUS_PREFIX}resolved`)
        .setLabel("Resolved")
        .setStyle(ButtonStyle.Success)
        .setDisabled(disabled)
    ),
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
    .setTitle(`Ticket ${ticketId}`)
    .setColor(statusColor(settings, status))
    .setDescription(`${statusIcon(status)} **Status:** ${normalizeStatusLabel(status)}`)
    .addFields(
      { name: "Applicant", value: `<@${applicant.id}>`, inline: true },
      { name: "Subject", value: subjectText.slice(0, 1024), inline: true },
      { name: "Details", value: detailsText.slice(0, 1024), inline: false }
    )
    .setFooter({ text: footerText(settings) })
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

  const modal = new ModalBuilder()
    .setCustomId(TICKET_CREATE_MODAL_ID)
    .setTitle("Create Help Ticket");

  const subjectInput = new TextInputBuilder()
    .setCustomId("ticket_subject")
    .setLabel("What do you need help with?")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100);

  const detailsInput = new TextInputBuilder()
    .setCustomId("ticket_details")
    .setLabel("Describe your issue")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(1000);

  modal.addComponents(
    new ActionRowBuilder().addComponents(subjectInput),
    new ActionRowBuilder().addComponents(detailsInput)
  );

  await interaction.showModal(modal);
  return true;
}

async function handleTicketCreateModal(interaction, context) {
  if (!interaction.isModalSubmit() || interaction.customId !== TICKET_CREATE_MODAL_ID) {
    return false;
  }

  if (!interaction.inGuild()) {
    await interaction.reply({ content: "Tickets can only be created in a server.", ephemeral: true });
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

  const subject = interaction.fields.getTextInputValue("ticket_subject").trim();
  const details = interaction.fields.getTextInputValue("ticket_details").trim();

  const ticketId = Date.now().toString(36);
  const baseName = sanitizeChannelName(subject).slice(0, 40);
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
  });

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

  const modal = new ModalBuilder()
    .setCustomId(TICKET_CLOSE_MODAL_ID)
    .setTitle("Close Ticket");

  const reasonInput = new TextInputBuilder()
    .setCustomId("ticket_close_reason")
    .setLabel("Reason (optional)")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(500);

  modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
  await interaction.showModal(modal);
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
    await ticketOwner.send(`Your ticket in ${interaction.guild.name} was closed.${reason ? ` Reason: ${reason}` : ""}`).catch(() => {});
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

  const countryInput = new TextInputBuilder()
    .setCustomId("apply_country")
    .setLabel("Country")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(48);

  const factionInput = new TextInputBuilder()
    .setCustomId("apply_faction")
    .setLabel("Faction")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(48);

  modal.addComponents(
    new ActionRowBuilder().addComponents(robloxInput),
    new ActionRowBuilder().addComponents(countryInput),
    new ActionRowBuilder().addComponents(factionInput)
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
  const roblox = interaction.fields.getTextInputValue("apply_roblox").trim();
  const country = interaction.fields.getTextInputValue("apply_country").trim();
  const faction = interaction.fields.getTextInputValue("apply_faction").trim();

  const configuredChannelId = String(context.config.applicationsChannelId || "").trim();
  const targetChannel = configuredChannelId
    ? interaction.guild.channels.cache.get(configuredChannelId)
      || await interaction.guild.channels.fetch(configuredChannelId).catch(() => null)
    : interaction.channel;

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
      { name: "Country", value: country, inline: true },
      { name: "Faction", value: faction, inline: true }
    )
    .setFooter({ text: footerText(settings) })
    .setTimestamp(new Date());

  const reviewerRoleId = String(context.config.applicationsReviewerRoleId || "").trim();
  const reviewerMention = reviewerRoleId ? `<@&${reviewerRoleId}>` : null;

  await targetChannel.send({
    content: reviewerMention,
    embeds: [applicationEmbed]
  });

  upsertUserProfileFromTicket(interaction.guild.id, interaction.user.id, {
    robloxUsername: roblox,
    country,
    faction
  });

  await interaction.reply({
    content: `Application submitted successfully in ${targetChannel}.`,
    ephemeral: true
  });

  return true;
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
          `Category: ${settings.ticketCategoryId ? `<#${settings.ticketCategoryId}>` : "Not set"}`,
          `Log Channel: ${settings.ticketLogChannelId ? `<#${settings.ticketLogChannelId}>` : "Not set"}`,
          `Ping Roles: ${pingRoles}`,
          `Reviewer Roles: ${reviewerRoles}`,
          `Allowed Roles: ${allowedRoles}`
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

  await interaction.deferReply({ ephemeral: !postToConfiguredChannel });

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

async function handleSlashCommand(interaction, context) {
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

  if (interaction.commandName === "ticketpanel") {
    const settings = getGuildSettings(interaction.guild.id, context.config);
    const panelEmbed = new EmbedBuilder()
      .setTitle("Ascend Entrenched Tickets")
      .setColor(statusColor(settings, "active"))
      .setDescription("Press **Create Help Ticket** to open a private support ticket with staff.")
      .addFields(
        { name: "Required", value: "Issue Subject and Details" },
        { name: "Status", value: settings.ticketEnabled ? "Ticket creation enabled" : "Ticket creation disabled" }
      )
      .setFooter({ text: footerText(settings) })
      .setTimestamp(new Date());

    await interaction.reply({
      embeds: [panelEmbed],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(TICKET_CREATE_BUTTON_ID)
            .setLabel("Create Help Ticket")
            .setStyle(ButtonStyle.Success)
            .setDisabled(!settings.ticketEnabled)
        )
      ]
    });
    return;
  }

  if (interaction.commandName === "applypanel") {
    const settings = getGuildSettings(interaction.guild.id, context.config);
    const panelEmbed = new EmbedBuilder()
      .setTitle("Ascend Entrenched Applications")
      .setColor(statusColor(settings, "active"))
      .setDescription("Press **Apply Now** to submit your player application. This is separate from help tickets.")
      .addFields({ name: "Required", value: "Roblox Username, Country, Faction" })
      .setFooter({ text: footerText(settings) })
      .setTimestamp(new Date());

    await interaction.reply({
      embeds: [panelEmbed],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(APPLY_CREATE_BUTTON_ID)
            .setLabel("Apply Now")
            .setStyle(ButtonStyle.Primary)
        )
      ]
    });
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
