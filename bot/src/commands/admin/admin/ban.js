const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendModLog } = require('../../utils/modLog');
const { createStyledEmbed } = require('../../utils/embedStyle');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('ban')
 .setDescription('Ban a member from the server')
 .addUserOption(option =>
 option.setName('user')
 .setDescription('The user to ban')
 .setRequired(true))
 .addStringOption(option =>
 option.setName('reason')
 .setDescription('Reason for the ban')
 .setRequired(false))
 .addIntegerOption(option =>
 option.setName('days')
 .setDescription('Number of days of messages to delete (0-7)')
 .setMinValue(0)
 .setMaxValue(7)
 .setRequired(false))
 .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
 async execute(interaction) {
 const user = interaction.options.getUser('user');
 const reason = interaction.options.getString('reason') || 'No reason provided';
 const days = interaction.options.getInteger('days') || 0;

 if (user.id === interaction.user.id) {
 return interaction.reply({ content: ' You cannot ban yourself.', ephemeral: true });
 }

 const member = interaction.guild.members.cache.get(user.id);
 if (member && !member.bannable) {
 return interaction.reply({ content: ' I cannot ban this user. They may have higher permissions than me.', ephemeral: true });
 }

 try {
 // Try to DM the user before banning
 try {
 const dmEmbed = createStyledEmbed({
 interaction,
 icon: '⛔',
 title: 'You Were Banned',
 theme: 'moderation',
 description: `You were banned from **${interaction.guild.name}**.`,
 color: 'danger',
 })
 .addFields(
 { name: 'Reason', value: reason, inline: false }
 )
 .setFooter({ text: 'You can appeal to staff if your server allows it.' })
 .setTimestamp();
 await user.send({ embeds: [dmEmbed] });
 } catch (dmError) {
 // User has DMs disabled, continue with ban
 }

 await interaction.guild.members.ban(user, { deleteMessageDays: days, reason: reason });

 // Send mod log
 await sendModLog(interaction.guild, 'Ban', interaction.user, user, reason);

 const embed = createStyledEmbed({
 interaction,
 icon: '⛔',
 title: 'Member Banned',
 theme: 'moderation',
 description: `**${user.tag}** has been permanently removed.`,
 color: 'danger',
 })
 .addFields(
 { name: 'User', value: `${user.tag}`, inline: true },
 { name: 'Reason', value: reason, inline: true },
 { name: 'Delete Days', value: String(days), inline: true },
 { name: 'Moderator', value: interaction.user.tag, inline: true }
 )
 .setFooter({ text: 'Moderation action completed' })
 .setTimestamp();

 await interaction.reply({ embeds: [embed] });
 } catch (error) {
 console.error(error);
 await interaction.reply({ content: ' Failed to ban user.', ephemeral: true });
 }
 },
};
