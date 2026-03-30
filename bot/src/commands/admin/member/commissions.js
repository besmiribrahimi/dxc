const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('commissions')
 .setDescription('View commission services and availability'),
 async execute(interaction) {
 const aboutEmbed = new EmbedBuilder()
 .setColor('#8B0000')
 .setTitle(' . Commission Services ')
 .setDescription('Open service categories and current availability for the community.')
 .addFields(
 {
 name: ' Available Services ',
 value: 'Server setup\nChannel/category structuring\nRole and permission layouts\nBot setup guidance',
 inline: true
 },
 {
 name: ' Design Work ',
 value: 'Embed templates\nAnnouncement formatting\nBrand-aligned visual setup\nTheme consistency updates',
 inline: true
 },
 {
 name: ' Request Process ',
 value: 'Use `/request` with clear details, timeline, and scope. A team member will respond in-server.',
 inline: false
 }
 )
 .setFooter({ text: ' . Requests are handled directly in this Discord server.' })
 .setTimestamp();

 await interaction.reply({ embeds: [aboutEmbed] });
 },
};
