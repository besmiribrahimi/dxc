const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createStyledEmbed } = require('../../utils/embedStyle');

function buildCommand(name) {
 return new SlashCommandBuilder()
 .setName(name)
 .setDescription('Admin messaging commands')
 .addSubcommand(subcommand =>
 subcommand
 .setName('user')
 .setDescription('Send a direct message to a specific user')
 .addUserOption(option =>
 option
 .setName('user')
 .setDescription('The user to message')
 .setRequired(true))
 .addStringOption(option =>
 option
 .setName('message')
 .setDescription('Extra custom message text')
 .setRequired(false))
 .addBooleanOption(option =>
 option
 .setName('leaderboard')
 .setDescription('Include leaderboard added message (default: true)')
 .setRequired(false)))
 .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
}

async function executeMessageCommand(interaction) {
 const subcommand = interaction.options.getSubcommand();

 if (subcommand !== 'user') {
 return interaction.reply({
 content: 'Unknown subcommand.',
 ephemeral: true,
 });
 }

 const user = interaction.options.getUser('user');
 const customMessage = (interaction.options.getString('message') || '').trim();
 const includeLeaderboard = interaction.options.getBoolean('leaderboard');
 const shouldIncludeLeaderboard = includeLeaderboard === null ? true : includeLeaderboard;

 if (!user) {
 return interaction.reply({
 content: 'User not found.',
 ephemeral: true,
 });
 }

 const messageParts = [];
 if (shouldIncludeLeaderboard) {
 messageParts.push(`Hey **${user.username}**, you have been added to the **Draxar web leaderboard**.`);
 }

 if (customMessage) {
 messageParts.push(customMessage);
 }

 if (messageParts.length === 0) {
 messageParts.push('Hello from the Draxar admin team.');
 }

 const dmEmbed = createStyledEmbed({
 interaction,
 icon: '🏆',
 title: 'Web Leaderboard Update',
 theme: 'leaderboard',
 description: messageParts.join('\n\n'),
 cta: 'Keep pushing matches to climb higher.',
 });

 try {
 await user.send({ embeds: [dmEmbed] });

 const confirmation = createStyledEmbed({
 interaction,
 icon: '📨',
 title: 'Message Sent',
 theme: 'system',
 description: `DM sent to **${user.tag}** successfully.`,
 });

 await interaction.reply({ embeds: [confirmation], ephemeral: true });
 } catch (error) {
 const failure = createStyledEmbed({
 interaction,
 icon: '⚠️',
 title: 'Delivery Failed',
 theme: 'system',
 color: 'warning',
 description: `Could not DM **${user.tag}**. They may have DMs disabled.`,
 });

 await interaction.reply({ embeds: [failure], ephemeral: true });
 }
}

module.exports = {
 data: buildCommand('msga'),
 execute: executeMessageCommand,
 buildMessageCommand: buildCommand,
 executeMessageCommand,
};