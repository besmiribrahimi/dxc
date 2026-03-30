const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require('discord.js');
const { ensureQueueRole, QUEUE_ROLE_NAME } = require('../../utils/oneVOneQueue');
const { createStyledEmbed } = require('../../utils/embedStyle');

const QUEUE_BUTTON_ID = 'queue_1v1_toggle';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set1v1')
    .setDescription('Post the 1v1 matchmaking queue panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    try {
      await ensureQueueRole(interaction.guild);
    } catch {
      await interaction.reply({
        content: `Could not create/find the ${QUEUE_ROLE_NAME} role. Check Manage Roles permission.`,
        ephemeral: true,
      });
      return;
    }

    const embed = createStyledEmbed({
      interaction,
      icon: '⚔️',
      title: '1v1 Queue',
      theme: 'matchmaking',
      summary: 'Join the queue to be discoverable for instant 1v1 challenges.',
      cta: 'Click JOIN 1V1 QUEUE below to toggle your status',
    })
      .addFields(
        { name: 'Queue Role', value: QUEUE_ROLE_NAME, inline: true },
        { name: 'Find Match', value: 'Use /look1v1 after joining.', inline: true },
        { name: 'Toggle', value: 'Click the button again anytime to leave queue.', inline: false }
      )
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(QUEUE_BUTTON_ID)
        .setLabel('JOIN 1V1 QUEUE')
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    const postedEmbed = createStyledEmbed({
      interaction,
      icon: '✅',
      title: 'Queue Panel Posted',
      theme: 'matchmaking',
      description: 'Your 1v1 queue panel is now live in this channel.',
      color: 'success',
    });
    await interaction.reply({ embeds: [postedEmbed], flags: 64 });
  },
};
