const fs = require("node:fs");
const path = require("node:path");
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder,
} = require("discord.js");
require("dotenv").config();
const { addMessage } = require("./commands/utils/messageStats");
const { findMatchingTrigger } = require("./commands/utils/autoResponder");
const { getWelcomeChannel, getLeaveChannel } = require("./commands/utils/welcomeConfig");
const giveawayManager = require("./commands/utils/giveawayMenager");
const helpSetCommand = require("./commands/admin/admin/helpset");
const privateVcCommand = require("./commands/admin/member/join-to-create");
const { startWebsiteAutoSync } = require("./services/websiteSync");

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId || !guildId) {
  console.error("Missing environment variables. Check DISCORD_TOKEN, CLIENT_ID, and GUILD_ID.");
  process.exit(1);
}

const commandsRoot = path.join(__dirname, "commands");
const adminCommandsDir = path.join(commandsRoot, "admin", "admin");
const legacyMemberCommandsDir = path.join(commandsRoot, "admin", "member");
const memberCommandsDir = path.join(commandsRoot, "member");

function getJsFilesRecursively(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  const jsFiles = [];

  for (const entry of entries) {
    const fullPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      jsFiles.push(...getJsFilesRecursively(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".js")) {
      jsFiles.push(fullPath);
    }
  }

  return jsFiles;
}

function loadCommandsFromDirectory(directoryPath, category) {
  const files = getJsFilesRecursively(directoryPath);
  const loadedCommands = [];

  for (const commandPath of files) {
    try {
      delete require.cache[require.resolve(commandPath)];
      const command = require(commandPath);

      if (!command?.data || typeof command.execute !== "function") {
        console.warn(`Skipping invalid command file: ${commandPath}`);
        continue;
      }

      loadedCommands.push({
        ...command,
        category,
      });
    } catch (error) {
      console.error(`Failed to load command file: ${commandPath}`, error);
    }
  }

  return loadedCommands;
}

function loadAllCommands() {
  const adminCommands = loadCommandsFromDirectory(adminCommandsDir, "admin");
  const legacyMemberCommands = loadCommandsFromDirectory(legacyMemberCommandsDir, "member");
  const memberCommands = loadCommandsFromDirectory(memberCommandsDir, "member");
  const all = [...adminCommands, ...legacyMemberCommands, ...memberCommands];

  // De-duplicate command names when commands exist in multiple import paths.
  const byName = new Map(all.map((command) => [command.data.name, command]));
  return [...byName.values()];
}

const commandDefinitions = loadAllCommands();
const commandMap = new Map(
  commandDefinitions.map((command) => [command.data.name, command])
);

async function safeInteractionReply(interaction, payload, forceEphemeral = false) {
  try {
    if (interaction.deferred || interaction.replied) {
      const content = typeof payload === "string" ? payload : payload.content;
      await interaction.editReply(content ?? "Done.");
      return true;
    }

    if (typeof payload === "string") {
      await interaction.reply({
        content: payload,
        ...(forceEphemeral ? { flags: MessageFlags.Ephemeral } : {}),
      });
      return true;
    }

    await interaction.reply({
      ...payload,
      ...(forceEphemeral && !payload.flags ? { flags: MessageFlags.Ephemeral } : {}),
    });
    return true;
  } catch (error) {
    // 10062 = interaction expired or already acknowledged by Discord.
    if (error?.code !== 10062) {
      console.error("Interaction reply failed:", error);
    }

    return false;
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],
});

async function registerGuildCommands() {
  const rest = new REST({ version: "10" }).setToken(token);
  const payload = commandDefinitions.map((command) => command.data.toJSON());

  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: payload,
  });

  // Clear old global commands so stale commands from previous bot versions do not appear.
  await rest.put(Routes.applicationCommands(clientId), {
    body: [],
  });

  console.log(`Slash commands registered for guild ${guildId}: ${payload.length} command(s)`);
  console.log("Global commands cleared: 0 command(s)");
}

client.once("clientReady", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  try {
    await registerGuildCommands();
  } catch (error) {
    console.error("Failed to register slash commands:", error);
  }

  startWebsiteAutoSync(console);
});

client.on("error", (error) => {
  console.error("Discord client error:", error);
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isModalSubmit()) {
    if (interaction.customId !== "helpRequestModal") {
      return;
    }

    const requestType = interaction.fields.getTextInputValue("requestType");
    const requestDescription = interaction.fields.getTextInputValue("requestDescription");
    const helpChannelId = helpSetCommand.getHelpChannel(interaction.guild.id);

    if (!helpChannelId) {
      await safeInteractionReply(
        interaction,
        {
          content: "Help channel is not configured. Ask an admin to run /helpset.",
          flags: MessageFlags.Ephemeral,
        },
        true
      );
      return;
    }

    const helpChannel = interaction.guild.channels.cache.get(helpChannelId) || (await interaction.guild.channels.fetch(helpChannelId).catch(() => null));

    if (!helpChannel || !helpChannel.isTextBased()) {
      await safeInteractionReply(
        interaction,
        {
          content: "Configured help channel is missing or not text-based.",
          flags: MessageFlags.Ephemeral,
        },
        true
      );
      return;
    }

    const embed = new EmbedBuilder()
      .setColor("#8B0000")
      .setTitle("New Help Request")
      .addFields(
        { name: "From", value: `${interaction.user.tag} (${interaction.user.id})`, inline: false },
        { name: "Type", value: requestType, inline: true },
        { name: "Description", value: requestDescription, inline: false }
      )
      .setTimestamp();

    await helpChannel.send({ embeds: [embed] }).catch(() => null);

    await safeInteractionReply(
      interaction,
      {
        content: "Your request was submitted successfully.",
        flags: MessageFlags.Ephemeral,
      },
      true
    );
    return;
  }

  if (interaction.isButton()) {
    if (interaction.customId === "create_ticket") {
      const ticketOwnerTag = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16) || "member";
      const ticketTopic = `ticket-owner:${interaction.user.id}`;

      const existingTicket = interaction.guild.channels.cache.find(
        (channel) => channel.isTextBased() && channel.topic === ticketTopic
      );

      if (existingTicket) {
        await safeInteractionReply(interaction, {
          content: `You already have an open ticket: ${existingTicket}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const ticketChannel = await interaction.guild.channels.create({
        name: `ticket-${ticketOwnerTag}`,
        type: 0,
        parent: interaction.channel?.parentId || null,
        topic: ticketTopic,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: ["ViewChannel"],
          },
          {
            id: interaction.user.id,
            allow: ["ViewChannel", "SendMessages", "ReadMessageHistory", "AttachFiles", "EmbedLinks"],
          },
        ],
      });

      await ticketChannel.send({
        content: `${interaction.user} Ticket created. Describe your issue and wait for staff response.`,
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 4,
                custom_id: "close_ticket",
                label: "Close Ticket",
              },
            ],
          },
        ],
      });

      await safeInteractionReply(interaction, {
        content: `Ticket created: ${ticketChannel}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.customId === "close_ticket") {
      const topic = interaction.channel?.topic || "";
      const ownerId = topic.startsWith("ticket-owner:") ? topic.replace("ticket-owner:", "") : null;

      if (!ownerId) {
        await safeInteractionReply(interaction, {
          content: "This is not a managed ticket channel.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const isOwner = interaction.user.id === ownerId;
      const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);

      if (!isOwner && !isAdmin) {
        await safeInteractionReply(interaction, {
          content: "Only the ticket owner or an admin can close this ticket.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await safeInteractionReply(interaction, {
        content: "Closing ticket...",
        flags: MessageFlags.Ephemeral,
      });

      await interaction.channel.delete(`Ticket closed by ${interaction.user.tag}`).catch(() => null);
      return;
    }

    if (!interaction.customId.startsWith("giveaway_")) {
      return;
    }

    const giveaway = giveawayManager.getGiveaway(interaction.message.id);

    if (!giveaway) {
      await safeInteractionReply(interaction, {
        content: "This giveaway is not active anymore.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (Date.now() > giveaway.endTime) {
      await safeInteractionReply(interaction, {
        content: "This giveaway already ended.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (giveaway.mode === "exclusive" && giveaway.requiredRole) {
      const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
      const hasRole = member?.roles?.cache?.has(giveaway.requiredRole);

      if (!hasRole) {
        await safeInteractionReply(interaction, {
          content: "You do not have the required role for this giveaway.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    const participants = Array.isArray(giveaway.participants) ? giveaway.participants : [];
    const alreadyJoined = participants.includes(interaction.user.id);

    if (alreadyJoined) {
      giveawayManager.removeParticipant(interaction.message.id, interaction.user.id);
      await safeInteractionReply(interaction, {
        content: "You were removed from this giveaway.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    giveawayManager.addParticipant(interaction.message.id, interaction.user.id);
    await safeInteractionReply(interaction, {
      content: "You joined the giveaway.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!interaction.isChatInputCommand()) {
    return;
  }

  const command = commandMap.get(interaction.commandName);

  if (!command) {
    await safeInteractionReply(interaction, {
      content: "This command is not available right now.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const isOwner = interaction.guild?.ownerId === interaction.user.id;
  const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);

  if (command.category === "admin" && !isOwner && !isAdmin) {
    await safeInteractionReply(interaction, {
      content: "Only server admins can use this command.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    await command.execute(interaction, { client });
  } catch (error) {
    console.error(`Command execution failed: ${interaction.commandName}`, error);

    await safeInteractionReply(
      interaction,
      {
        content: "Something went wrong while running this command.",
        flags: MessageFlags.Ephemeral,
      },
      true
    );
  }
});

client.on("messageCreate", (message) => {
  if (!message.guild || message.author.bot) {
    return;
  }

  addMessage(message.guild.id, message.author.id);

  const trigger = findMatchingTrigger(message.guild.id, message.content);
  if (!trigger) {
    return;
  }

  if (trigger.embedResponse) {
    const embed = new EmbedBuilder()
      .setColor("#8B0000")
      .setDescription(trigger.response)
      .setTimestamp();

    message.channel.send({ embeds: [embed] }).catch(() => {});
    return;
  }

  message.channel.send({ content: trigger.response }).catch(() => {});
});

client.on("guildMemberAdd", async (member) => {
  const channelId = getWelcomeChannel(member.guild.id);
  if (!channelId) {
    return;
  }

  const channel = member.guild.channels.cache.get(channelId) || (await member.guild.channels.fetch(channelId).catch(() => null));
  if (!channel || !channel.isTextBased()) {
    return;
  }

  await channel.send(`Welcome ${member} to ${member.guild.name}.`).catch(() => {});
});

client.on("guildMemberRemove", async (member) => {
  const channelId = getLeaveChannel(member.guild.id);
  if (!channelId) {
    return;
  }

  const channel = member.guild.channels.cache.get(channelId) || (await member.guild.channels.fetch(channelId).catch(() => null));
  if (!channel || !channel.isTextBased()) {
    return;
  }

  await channel.send(`${member.user.tag} left ${member.guild.name}.`).catch(() => {});
});

client.on("voiceStateUpdate", async (oldState, newState) => {
  if (typeof privateVcCommand.handleVoiceStateUpdate !== "function") {
    return;
  }

  await privateVcCommand.handleVoiceStateUpdate(oldState, newState).catch((error) => {
    console.error("privatevc voiceStateUpdate handler error:", error);
  });
});

client.login(token);
