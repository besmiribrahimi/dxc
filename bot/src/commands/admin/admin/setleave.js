const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { setLeaveChannel } = require('../../utils/welcomeConfig');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('setleave')
 .setDescription('Set up the leave channel for member goodbyes')
 .addChannelOption(option =>
 option.setName('channel')
 .setDescription('The channel to send leave messages')
 .setRequired(true))
 .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
 async execute(interaction) {
 const channel = interaction.options.getChannel('channel');

 setLeaveChannel(interaction.guild.id, channel.id);

 const embed = new EmbedBuilder()
 .setColor('#B00000')
 .setTitle(' . Leave Channel Set! ')
 .setDescription(` \n\n Settings Updated \n\nLeave messages will now be sent to ${channel}`)
 .addFields({ name: ' Channel ', value: `${channel}`, inline: true })
 .setFooter({ text: ' . Goodbye messages are now configured!' })
 .setTimestamp();

 await interaction.reply({ embeds: [embed], ephemeral: true });
 },
};
