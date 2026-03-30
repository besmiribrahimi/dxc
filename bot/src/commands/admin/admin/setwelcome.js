const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { setWelcomeChannel } = require('../../utils/welcomeConfig');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('setwelcome')
 .setDescription('Set up the welcome channel for new members')
 .addChannelOption(option =>
 option.setName('channel')
 .setDescription('The channel to send welcome messages')
 .setRequired(true))
 .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
 async execute(interaction) {
 const channel = interaction.options.getChannel('channel');

 setWelcomeChannel(interaction.guild.id, channel.id);

 const embed = new EmbedBuilder()
 .setColor('#B00000')
 .setTitle(' . Welcome Channel Set! ')
 .setDescription(` \n\n Settings Updated \n\nNew members will be welcomed in ${channel}`)
 .addFields({ name: ' Channel ', value: `${channel}`, inline: true })
 .setFooter({ text: ' . Welcome messages are now configured!' })
 .setTimestamp();

 await interaction.reply({ embeds: [embed], ephemeral: true });
 },
};
