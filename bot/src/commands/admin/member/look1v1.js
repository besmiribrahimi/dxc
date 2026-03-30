const { SlashCommandBuilder } = require('discord.js');
const { getQueueRole, QUEUE_ROLE_NAME } = require('../../utils/oneVOneQueue');
const { createStyledEmbed } = require('../../utils/embedStyle');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('look1v1')
    .setDescription('Notify queued players that you are looking for a 1v1'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const role = await getQueueRole(interaction.guild);
    if (!role) {
      const missingRoleEmbed = createStyledEmbed({
        interaction,
        icon: '⛔',
        title: 'Queue Not Ready',
        theme: 'matchmaking',
        description: `Queue role not found: ${QUEUE_ROLE_NAME}. Ask an admin to run /set1v1.`,
        color: 'warning',
      });
      await interaction.editReply({ embeds: [missingRoleEmbed] });
      return;
    }

    await interaction.guild.members.fetch().catch(() => null);

    const targets = role.members.filter(
      (member) => !member.user.bot && member.id !== interaction.user.id
    );

    if (targets.size === 0) {
      const noneEmbed = createStyledEmbed({
        interaction,
        icon: '🕒',
        title: 'No Opponents Available',
        theme: 'matchmaking',
        description: 'No other queued players are online for 1v1 right now.',
        color: 'warning',
      });
      await interaction.editReply({ embeds: [noneEmbed] });
      return;
    }

    const dmEmbed = createStyledEmbed({
      interaction,
      icon: '⚔️',
      title: 'Match Request',
      theme: 'matchmaking',
      description: `${interaction.user.tag} is looking for a 1v1 match.`,
      cta: 'Open DM with them immediately if you are ready',
    })
      .addFields({ name: 'Action', value: 'Reach out to them if interested.', inline: false })
      .setTimestamp();

    let sent = 0;
    let failed = 0;

    for (const member of targets.values()) {
      try {
        await member.send({ embeds: [dmEmbed] });
        sent += 1;
      } catch {
        failed += 1;
      }
    }

    const resultEmbed = createStyledEmbed({
      interaction,
      icon: '📣',
      title: 'Queue Alerts Sent',
      theme: 'matchmaking',
      description: 'Queue notifications dispatched.',
      color: sent > 0 ? 'success' : 'warning',
    }).addFields(
      { name: 'Delivered', value: String(sent), inline: true },
      { name: 'Failed', value: String(failed), inline: true },
      { name: 'Requested By', value: interaction.user.tag, inline: true }
    );

    await interaction.editReply({ embeds: [resultEmbed] });
  },
};
