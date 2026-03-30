const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { createStyledEmbed } = require('../../utils/embedStyle');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('ticketpanel')
 .setDescription('Set up a ticket panel for members to create support tickets')
 .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
 async execute(interaction, client) {
 const embed = createStyledEmbed({
 interaction,
 icon: '📢',
 title: 'Support Ticket Center',
 theme: 'support',
 summary: 'Need support? Open a private ticket and staff will respond as soon as possible.',
 cta: 'Click CREATE TICKET below to open a private channel',
 })
 .addFields(
 { 
 name: 'Before You Open', 
 value: 'Check pinned info first\nDescribe your issue clearly\nOne open ticket per user\nBe respectful to staff', 
 inline: false 
 },
 { 
 name: 'Support Topics', 
 value: 'General questions\nTechnical issues\nReports and moderation\nPartnership/contact', 
 inline: false 
 }
 )
 .setFooter({ text: 'Press Create Ticket to get started' })
 .setTimestamp();

 const row = new ActionRowBuilder()
 .addComponents(
 new ButtonBuilder()
 .setCustomId('create_ticket')
 .setLabel('Create Ticket')
 .setStyle(ButtonStyle.Danger)
 );

 // Send as a regular message (not a reply) so it stays as a permanent panel
 try {
 await interaction.channel.send({ embeds: [embed], components: [row] });
 const postedEmbed = createStyledEmbed({
 interaction,
 icon: '✅',
 title: 'Ticket Panel Posted',
 theme: 'support',
 description: 'Support ticket panel is now live in this channel.',
 color: 'success',
 });
 await interaction.reply({ embeds: [postedEmbed], flags: 64 });
 } catch (error) {
 console.error('TicketPanel Error:', error);
 const errMsg = typeof error === 'string' ? error : (error.message || 'Unknown error');
 if (interaction.replied || interaction.deferred) {
 await interaction.followUp({ content: ` Error: ${errMsg}`, ephemeral: true });
 } else {
 await interaction.reply({ content: ` Error: ${errMsg}`, ephemeral: true });
 }
 }
 },
};
