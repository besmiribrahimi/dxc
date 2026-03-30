const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('announce')
 .setDescription('Send a beautiful announcement to a channel')
 .addStringOption(option =>
 option.setName('title')
 .setDescription('The announcement title')
 .setRequired(true))
 .addStringOption(option =>
 option.setName('message')
 .setDescription('The announcement message')
 .setRequired(true))
 .addChannelOption(option =>
 option.setName('channel')
 .setDescription('The channel to send the announcement to')
 .setRequired(false))
 .addStringOption(option =>
 option.setName('color')
 .setDescription('Embed color (hex code)')
 .setRequired(false))
 .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
 async execute(interaction) {
 const title = interaction.options.getString('title');
 const message = interaction.options.getString('message');
 const channel = interaction.options.getChannel('channel') || interaction.channel;
 const color = interaction.options.getString('color') || '#B00000';

 const embed = new EmbedBuilder()
 .setColor(color)
 .setTitle(` . ${title} `)
 .setDescription(` \n\n${message}`)
 .setFooter({ text: ` . Announced by ${interaction.user.tag}` })
 .setTimestamp();

 try {
 await channel.send({ embeds: [embed] });
 await interaction.reply({ 
 content: ` Announcement sent to ${channel}!`, 
 ephemeral: true 
 });
 } catch (error) {
 await interaction.reply({ 
 content: ' Failed to send announcement. Please check channel permissions.', 
 ephemeral: true 
 });
 }
 },
};
