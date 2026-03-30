const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendModLog } = require('../../utils/modLog');
const { createStyledEmbed } = require('../../utils/embedStyle');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Remove mute/timeout from a member')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('The user to unmute')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('Reason for unmuting')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = interaction.guild.members.cache.get(user.id);

    if (!member) {
      await interaction.reply({ content: 'User not found in this server.', ephemeral: true });
      return;
    }

    if (!member.moderatable) {
      await interaction.reply({ content: 'I cannot unmute this user due to role/permission hierarchy.', ephemeral: true });
      return;
    }

    try {
      await member.timeout(null, reason);

      await sendModLog(interaction.guild, 'Unmute', interaction.user, user, reason);

      const embed = createStyledEmbed({
        interaction,
        icon: '🔊',
        title: 'Member Unmuted',
        theme: 'moderation',
        description: `**${user.tag}** can speak again.`,
        color: 'success',
      })
        .addFields(
          { name: 'Reason', value: reason, inline: false },
          { name: 'Moderator', value: interaction.user.tag, inline: false }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      await interaction.reply({ content: 'Failed to unmute this user.', ephemeral: true });
    }
  },
};
