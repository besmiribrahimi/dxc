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

const APPLICATION_MODAL_ID = "application_submit_v1";
const APPLICATION_ACCEPT_PREFIX = "application_accept:";
const APPLICATION_REJECT_PREFIX = "application_reject:";

const applicationCooldownMap = new Map();

function getRemainingCooldownMs(userId, cooldownMs) {
  const now = Date.now();
  const until = Number(applicationCooldownMap.get(userId) || 0);
  if (until <= now) {
    return 0;
  }

  return until - now;
}

function setApplicationCooldown(userId, cooldownMs) {
  const now = Date.now();
  applicationCooldownMap.set(userId, now + cooldownMs);
}

function buildApplicationReviewButtons(applicantId, applicationId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${APPLICATION_ACCEPT_PREFIX}${applicantId}:${applicationId}`)
      .setLabel("Accept")
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`${APPLICATION_REJECT_PREFIX}${applicantId}:${applicationId}`)
      .setLabel("Reject")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled)
  );
}

function parseApplicationReviewCustomId(customId) {
  const isAccept = customId.startsWith(APPLICATION_ACCEPT_PREFIX);
  const isReject = customId.startsWith(APPLICATION_REJECT_PREFIX);

  if (!isAccept && !isReject) {
    return null;
  }

  const payload = isAccept
    ? customId.slice(APPLICATION_ACCEPT_PREFIX.length)
    : customId.slice(APPLICATION_REJECT_PREFIX.length);
  const [applicantId, applicationId] = String(payload || "").split(":");

  if (!applicantId || !applicationId) {
    return null;
  }

  return {
    action: isAccept ? "accept" : "reject",
    applicantId,
    applicationId
  };
}

function canReviewApplications(interaction, config) {
  if (!interaction.inGuild()) {
    return false;
  }

  const reviewerRoleId = String(config.applicationsReviewerRoleId || "").trim();
  const member = interaction.member;

  if (member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
    return true;
  }

  if (reviewerRoleId && member?.roles?.cache?.has(reviewerRoleId)) {
    return true;
  }

  return false;
}

function buildDecisionEmbed(baseEmbed, decisionText, reviewerTag, approved) {
  const embed = EmbedBuilder.from(baseEmbed || {});
  const existingFields = Array.isArray(embed.data?.fields) ? embed.data.fields : [];
  const filteredFields = existingFields.filter((field) => field?.name !== "Decision");

  embed
    .setColor(approved ? 0x2ecc71 : 0xe74c3c)
    .setFields(
      ...filteredFields,
      {
        name: "Decision",
        value: `${decisionText} by ${reviewerTag}`
      }
    )
    .setTimestamp(new Date());

  return embed;
}

async function handleApplicationModalSubmit(interaction, context) {
  if (!interaction.isModalSubmit() || interaction.customId !== APPLICATION_MODAL_ID) {
    return false;
  }

  if (!interaction.inGuild()) {
    await interaction.reply({
      content: "Applications can only be submitted inside a server.",
      ephemeral: true
    });
    return true;
  }

  const targetChannelId = String(context.config.applicationsChannelId || "").trim();
  if (!targetChannelId) {
    await interaction.reply({
      content: "Applications are not configured yet. Ask an admin to set APPLICATIONS_CHANNEL_ID.",
      ephemeral: true
    });
    return true;
  }

  const reviewChannel = await interaction.client.channels.fetch(targetChannelId).catch(() => null);
  if (!reviewChannel || !reviewChannel.isTextBased()) {
    await interaction.reply({
      content: "Configured applications channel is not available or not text-based.",
      ephemeral: true
    });
    return true;
  }

  const roblox = interaction.fields.getTextInputValue("apply_roblox").trim();
  const age = interaction.fields.getTextInputValue("apply_age").trim();
  const timezone = interaction.fields.getTextInputValue("apply_timezone").trim();
  const reason = interaction.fields.getTextInputValue("apply_reason").trim();
  const applicationId = Date.now().toString(36);

  const embed = new EmbedBuilder()
    .setTitle("New Application")
    .setColor(0xdb2b2b)
    .setDescription(`Applicant: <@${interaction.user.id}>`)
    .addFields(
      { name: "Roblox", value: roblox || "N/A" },
      { name: "Age", value: age || "N/A", inline: true },
      { name: "Timezone", value: timezone || "N/A", inline: true },
      { name: "Why do you want to join?", value: reason || "N/A" },
      { name: "Application ID", value: applicationId }
    )
    .setFooter({ text: `Applicant ID: ${interaction.user.id}` })
    .setTimestamp(new Date());

  await reviewChannel.send({
    embeds: [embed],
    components: [buildApplicationReviewButtons(interaction.user.id, applicationId, false)]
  });

  await interaction.reply({
    content: "Application submitted. Staff will review it soon.",
    ephemeral: true
  });

  return true;
}

async function handleApplicationReviewButton(interaction, context) {
  if (!interaction.isButton()) {
    return false;
  }

  const parsed = parseApplicationReviewCustomId(interaction.customId);
  if (!parsed) {
    return false;
  }

  if (!canReviewApplications(interaction, context.config)) {
    await interaction.reply({
      content: "You do not have permission to review applications.",
      ephemeral: true
    });
    return true;
  }

  const approved = parsed.action === "accept";
  const decisionText = approved ? "Accepted" : "Rejected";
  const baseEmbed = interaction.message?.embeds?.[0] || new EmbedBuilder().setTitle("Application");
  const updatedEmbed = buildDecisionEmbed(baseEmbed, decisionText, interaction.user.tag, approved);

  await interaction.update({
    embeds: [updatedEmbed],
    components: [buildApplicationReviewButtons(parsed.applicantId, parsed.applicationId, true)]
  });

  if (approved && interaction.inGuild()) {
    const acceptedRoleId = String(context.config.applicationsAcceptedRoleId || "").trim();
    if (acceptedRoleId) {
      const member = await interaction.guild.members.fetch(parsed.applicantId).catch(() => null);
      if (member) {
        await member.roles.add(acceptedRoleId, `Application accepted by ${interaction.user.tag}`).catch(() => null);
      }
    }
  }

  const applicantUser = await interaction.client.users.fetch(parsed.applicantId).catch(() => null);
  if (applicantUser) {
    const dmText = approved
      ? `Your application in ${interaction.guild?.name || "the server"} was accepted.`
      : `Your application in ${interaction.guild?.name || "the server"} was rejected.`;
    await applicantUser.send(dmText).catch(() => null);
  }

  await interaction.followUp({
    content: `${decisionText} application for <@${parsed.applicantId}>.`,
    ephemeral: true
  });

  return true;
}

async function fetchLeaderboardConfig(config) {
  const endpoint = String(config.leaderboardApiUrl || "").trim();
  if (!endpoint) {
    throw new Error("LEADERBOARD_API_URL is not configured in bot environment");
  }

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Leaderboard API failed with HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (!payload?.ok || !payload?.config || typeof payload.config !== "object") {
    throw new Error("Leaderboard API returned an invalid payload");
  }

  return payload.config;
}

function clampLevel(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 1;
  }

  return Math.max(1, Math.min(10, Math.round(numeric)));
}

function clampKd(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 1.0;
  }

  return Math.max(0, Math.min(9.9, Number(numeric.toFixed(1))));
}

function normalizePlayers(rawPlayers) {
  const source = rawPlayers && typeof rawPlayers === "object" ? rawPlayers : {};
  const normalized = {};

  Object.entries(source).forEach(([rawName, rawStats]) => {
    const key = String(rawName || "").trim().toLowerCase();
    if (!key) {
      return;
    }

    const stats = rawStats && typeof rawStats === "object" ? rawStats : {};
    normalized[key] = {
      level: clampLevel(stats.level),
      kd: clampKd(stats.kd)
    };
  });

  return normalized;
}

function normalizeOrder(rawOrder, playerKeys) {
  const keys = Array.isArray(playerKeys) ? playerKeys : [];
  const valid = new Set(keys);
  const seen = new Set();
  const ordered = [];

  if (Array.isArray(rawOrder)) {
    rawOrder.forEach((rawKey) => {
      const key = String(rawKey || "").trim().toLowerCase();
      if (!key || !valid.has(key) || seen.has(key)) {
        return;
      }

      seen.add(key);
      ordered.push(key);
    });
  }

  keys.forEach((key) => {
    if (!seen.has(key)) {
      ordered.push(key);
    }
  });

  return ordered;
}

function calculateScore(level, kd, rank) {
  return Number(((level * 12) + (kd * 18) + Math.max(0, 14 - rank)).toFixed(1));
}

function buildRankedLeaderboard(config, limit) {
  const topLimit = Math.max(1, Math.min(20, Number(limit) || 10));
  const players = normalizePlayers(config?.players);
  const keys = Object.keys(players);
  if (!keys.length) {
    return [];
  }

  const order = normalizeOrder(config?.order, keys);
  const orderMap = new Map(order.map((key, index) => [key, index]));

  return keys
    .sort((a, b) => {
      const aOrder = orderMap.has(a) ? orderMap.get(a) : Number.MAX_SAFE_INTEGER;
      const bOrder = orderMap.has(b) ? orderMap.get(b) : Number.MAX_SAFE_INTEGER;

      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }

      const aStats = players[a];
      const bStats = players[b];

      if (bStats.level !== aStats.level) {
        return bStats.level - aStats.level;
      }

      return a.localeCompare(b);
    })
    .slice(0, topLimit)
    .map((key, index) => {
      const stats = players[key] || { level: 1, kd: 1.0 };
      const rank = index + 1;
      return {
        player: key,
        rank,
        level: stats.level,
        kd: stats.kd,
        score: calculateScore(stats.level, stats.kd, rank)
      };
    });
}

function getMuteDurationMs(minutes) {
  const safeMinutes = Math.max(1, Math.min(40320, Number(minutes) || 0));
  return safeMinutes * 60 * 1000;
}

const slashCommandBuilders = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check bot latency and health"),
  new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Show webhook queue status"),
  new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Show globally synced leaderboard standings")
    .addIntegerOption((option) =>
      option
        .setName("limit")
        .setDescription("How many top players to show (1-20)")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(20)
    ),
  new SlashCommandBuilder()
    .setName("apply")
    .setDescription("Submit an application to staff")
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("applysetup")
    .setDescription("Configure Appy-style application settings")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addChannelOption((option) =>
      option
        .setName("review_channel")
        .setDescription("Channel where applications are sent")
        .setRequired(false)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    )
    .addRoleOption((option) =>
      option
        .setName("reviewer_role")
        .setDescription("Role allowed to accept/reject applications")
        .setRequired(false)
    )
    .addRoleOption((option) =>
      option
        .setName("accepted_role")
        .setDescription("Role granted when application is accepted")
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName("cooldown_ms")
        .setDescription("Cooldown between /apply uses in milliseconds")
        .setRequired(false)
        .setMinValue(10000)
        .setMaxValue(86400000)
    ),
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

      // If guild registration fails (usually missing access or wrong guild ID),
      // fall back to global registration so commands still appear eventually.
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

async function handleSlashCommand(interaction, context) {
  if (await handleApplicationModalSubmit(interaction, context)) {
    return;
  }

  if (await handleApplicationReviewButton(interaction, context)) {
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

  if (interaction.commandName === "leaderboard") {
    const limit = interaction.options.getInteger("limit") || 10;

    await interaction.deferReply({ ephemeral: true });

    try {
      const configData = await fetchLeaderboardConfig(context.config);
      const ranked = buildRankedLeaderboard(configData, limit);

      if (!ranked.length) {
        await interaction.editReply({
          content: "Leaderboard is currently empty."
        });
        return;
      }

      const lines = ranked.map((entry) => (
        `#${entry.rank} ${entry.player} | Lvl ${entry.level} | K/D ${entry.kd.toFixed(1)} | Score ${entry.score}`
      ));

      const embed = new EmbedBuilder()
        .setTitle("Global Synced Leaderboard")
        .setColor(0xdb2b2b)
        .setDescription(lines.join("\n").slice(0, 4000))
        .setFooter({
          text: configData?.updatedAt
            ? `Last sync: ${new Date(configData.updatedAt).toLocaleString()}`
            : "Last sync: unknown"
        })
        .setTimestamp(new Date());

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({
        content: `Failed to load leaderboard sync: ${error instanceof Error ? error.message : "Unknown error"}`
      });
    }

    return;
  }

  if (interaction.commandName === "apply") {
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        ephemeral: true
      });
      return;
    }

    const cooldownMs = Number(context.config.applicationCooldownMs) || 120000;
    const remainingMs = getRemainingCooldownMs(interaction.user.id, cooldownMs);
    if (remainingMs > 0) {
      const seconds = Math.max(1, Math.ceil(remainingMs / 1000));
      await interaction.reply({
        content: `Please wait ${seconds}s before sending another application.`,
        ephemeral: true
      });
      return;
    }

    setApplicationCooldown(interaction.user.id, cooldownMs);

    const modal = new ModalBuilder()
      .setCustomId(APPLICATION_MODAL_ID)
      .setTitle("Server Application");

    const robloxInput = new TextInputBuilder()
      .setCustomId("apply_roblox")
      .setLabel("Roblox Username")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(32);

    const ageInput = new TextInputBuilder()
      .setCustomId("apply_age")
      .setLabel("Age")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(4);

    const timezoneInput = new TextInputBuilder()
      .setCustomId("apply_timezone")
      .setLabel("Timezone")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(32);

    const reasonInput = new TextInputBuilder()
      .setCustomId("apply_reason")
      .setLabel("Why do you want to join?")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1000);

    modal.addComponents(
      new ActionRowBuilder().addComponents(robloxInput),
      new ActionRowBuilder().addComponents(ageInput),
      new ActionRowBuilder().addComponents(timezoneInput),
      new ActionRowBuilder().addComponents(reasonInput)
    );

    await interaction.showModal(modal);
    return;
  }

  if (interaction.commandName === "applysetup") {
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        ephemeral: true
      });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: "You need Manage Server permission to run this command.",
        ephemeral: true
      });
      return;
    }

    const reviewChannel = interaction.options.getChannel("review_channel");
    const reviewerRole = interaction.options.getRole("reviewer_role");
    const acceptedRole = interaction.options.getRole("accepted_role");
    const cooldownMs = interaction.options.getInteger("cooldown_ms");

    const hasAnyOption = Boolean(reviewChannel || reviewerRole || acceptedRole || cooldownMs);

    if (!hasAnyOption) {
      const channelLabel = context.config.applicationsChannelId
        ? `<#${context.config.applicationsChannelId}>`
        : "Not set";
      const reviewerLabel = context.config.applicationsReviewerRoleId
        ? `<@&${context.config.applicationsReviewerRoleId}>`
        : "Not set";
      const acceptedLabel = context.config.applicationsAcceptedRoleId
        ? `<@&${context.config.applicationsAcceptedRoleId}>`
        : "Not set";
      const cooldownLabel = Number(context.config.applicationCooldownMs) || 120000;

      await interaction.reply({
        content: [
          "Current application setup:",
          `- Review channel: ${channelLabel}`,
          `- Reviewer role: ${reviewerLabel}`,
          `- Accepted role: ${acceptedLabel}`,
          `- Cooldown: ${cooldownLabel}ms`,
          "",
          "Run /applysetup with options to update settings."
        ].join("\n"),
        ephemeral: true
      });
      return;
    }

    const nextSettings = {
      applicationsChannelId: reviewChannel ? reviewChannel.id : context.config.applicationsChannelId,
      applicationsReviewerRoleId: reviewerRole ? reviewerRole.id : context.config.applicationsReviewerRoleId,
      applicationsAcceptedRoleId: acceptedRole ? acceptedRole.id : context.config.applicationsAcceptedRoleId,
      applicationCooldownMs: cooldownMs || Number(context.config.applicationCooldownMs) || 120000
    };

    context.config.applicationsChannelId = nextSettings.applicationsChannelId;
    context.config.applicationsReviewerRoleId = nextSettings.applicationsReviewerRoleId;
    context.config.applicationsAcceptedRoleId = nextSettings.applicationsAcceptedRoleId;
    context.config.applicationCooldownMs = nextSettings.applicationCooldownMs;

    if (typeof context.saveRuntimeSettings === "function") {
      context.saveRuntimeSettings(nextSettings);
    }

    const channelLabel = nextSettings.applicationsChannelId
      ? `<#${nextSettings.applicationsChannelId}>`
      : "Not set";
    const reviewerLabel = nextSettings.applicationsReviewerRoleId
      ? `<@&${nextSettings.applicationsReviewerRoleId}>`
      : "Not set";
    const acceptedLabel = nextSettings.applicationsAcceptedRoleId
      ? `<@&${nextSettings.applicationsAcceptedRoleId}>`
      : "Not set";

    await interaction.reply({
      content: [
        "Application setup saved.",
        `- Review channel: ${channelLabel}`,
        `- Reviewer role: ${reviewerLabel}`,
        `- Accepted role: ${acceptedLabel}`,
        `- Cooldown: ${nextSettings.applicationCooldownMs}ms`
      ].join("\n"),
      ephemeral: true
    });
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
