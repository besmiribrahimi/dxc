const { SlashCommandBuilder } = require('discord.js');
const { getLeaderboard, getUserRank, getUserStats } = require('../../utils/messageStats');
const { createStyledEmbed, getPlacementBadge, makeProgressBar } = require('../../utils/embedStyle');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('leaderboard')
 .setDescription('View the message activity leaderboard'),
 async execute(interaction) {
 const guildId = interaction.guild.id;
 const userId = interaction.user.id;
 
 // Get top 20 users
 const leaderboard = getLeaderboard(guildId, 20);
 const topMessages = Math.max(1, leaderboard[0]?.messages || 1);
 
 if (leaderboard.length === 0) {
 const emptyEmbed = createStyledEmbed({
 interaction,
 icon: '📭',
 title: 'Leaderboard Empty',
 theme: 'leaderboard',
 description: 'No message data yet. Start chatting to claim the first spot.',
 color: 'warning',
 });

 return interaction.reply({ embeds: [emptyEmbed], ephemeral: true });
 }

 // Build leaderboard entries
 const leaderboardEntries = await Promise.all(
 leaderboard.map(async (entry, index) => {
 let user;
 try {
 user = await interaction.client.users.fetch(entry.userId);
 } catch {
 user = { username: 'Unknown User' };
 }
 
 const badge = getPlacementBadge(index);
 const highlight = entry.userId === userId ? '  •  **YOU**' : '';
 const scoreBar = makeProgressBar(entry.messages, topMessages, 12);
 
 return `${badge} **${user.username}**${highlight}\n${scoreBar}  \`${entry.messages.toLocaleString()}\` messages`;
 })
 );

 // Get current user's stats
 const userRank = getUserRank(userId, guildId);
 const userStats = getUserStats(userId, guildId);
 const userMessages = userStats?.messages || 0;

 const embed = createStyledEmbed({
 interaction,
 icon: '🏁',
 title: 'Message Leaderboard',
 theme: 'leaderboard',
 summary: 'Live activity ladder for this server.',
 sections: [
 {
 label: 'Top 20 Activity',
 content: leaderboardEntries.join('\n\n'),
 },
 ],
 cta: 'Run /rank to view your personal card',
 })
 .addFields({
 name: '🎯 Your Position',
 value: `Rank: **#${userRank || 'N/A'}**\nMessages: **${userMessages.toLocaleString()}**\nPace: **${makeProgressBar(userMessages, topMessages, 10)}**`,
 inline: false
 })
 .setTimestamp();

 await interaction.reply({ embeds: [embed] });
 },
};
