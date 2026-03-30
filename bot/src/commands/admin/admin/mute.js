const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendModLog } = require('../../utils/modLog');
const { createStyledEmbed } = require('../../utils/embedStyle');

const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;

function parseDuration(input) {
  const match = String(input || '').trim().match(/^(\d+)(m|h|d)$/i);
  if (!match) {
    return null;
  }

  const amount = Number.parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  if (unit === 'm') return amount * 60 * 1000;
  if (unit === 'h') return amount * 60 * 60 * 1000;
  if (unit === 'd') return amount * 24 * 60 * 60 * 1000;
  return null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mute a member (Discord timeout)')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('The user to mute')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('duration')
        .setDescription('Duration like 10m, 1h, 1d')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('Reason for muting the user')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const duration = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = interaction.guild.members.cache.get(user.id);

    if (!member) {
      await interaction.reply({ content: 'User not found in this server.', ephemeral: true });
      return;
    }

    if (interaction.user.id === user.id) {
      await interaction.reply({ content: 'You cannot mute yourself.', ephemeral: true });
      return;
    }

    if (!member.moderatable) {
      await interaction.reply({ content: 'I cannot mute this user due to role/permission hierarchy.', ephemeral: true });
      return;
    }

    const durationMs = parseDuration(duration);
    if (!durationMs || durationMs > MAX_TIMEOUT_MS) {
      await interaction.reply({ content: 'Invalid duration. Use values like 10m, 1h, or 1d (max 28 days).', ephemeral: true });
      return;
    }

    try {
      await member.timeout(durationMs, reason);

      await sendModLog(interaction.guild, 'Mute', interaction.user, user, reason, [
        { name: 'Duration', value: duration, inline: true },
      ]);

      const embed = createStyledEmbed({
        interaction,
        icon: '🔇',
        title: 'Member Muted',
        theme: 'moderation',
        description: `**${user.tag}** is now muted via timeout.`,
        color: 'warning',
      })
        .addFields(
          { name: 'Duration', value: duration, inline: true },
          { name: 'Reason', value: reason, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      await interaction.reply({ content: 'Failed to mute this user.', ephemeral: true });
    }
  },
};
