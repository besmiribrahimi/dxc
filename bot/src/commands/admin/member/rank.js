const { SlashCommandBuilder } = require('discord.js');
const { getUserRank, getUserStats, getLeaderboard } = require('../../utils/messageStats');
const { createStyledEmbed, makeProgressBar } = require('../../utils/embedStyle');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('rank')
 .setDescription('View your message rank and stats'),
 async execute(interaction) {
 const guildId = interaction.guild.id;
 const userId = interaction.user.id;
 
 // Get user's stats
 const userRank = getUserRank(userId, guildId);
 const userStats = getUserStats(userId, guildId);
 const userMessages = userStats?.messages || 0;

 // Get total users on leaderboard
 const fullLeaderboard = getLeaderboard(guildId, 1000);
 const totalUsers = fullLeaderboard.length;

 if (userMessages === 0) {
 const emptyEmbed = createStyledEmbed({
 interaction,
 icon: '📭',
 title: 'No Rank Yet',
 theme: 'leaderboard',
 description: 'You have not sent messages yet. Start chatting to enter the ladder.',
 color: 'warning',
 });

 return interaction.reply({ embeds: [emptyEmbed], ephemeral: true });
 }

 const placement = totalUsers > 0
 ? `${Math.max(1, Math.round((1 - ((userRank - 1) / totalUsers)) * 100))}%`
 : 'N/A';

 const topMessages = Math.max(1, fullLeaderboard[0]?.messages || 1);
 const nextEntry = userRank > 1 ? fullLeaderboard[userRank - 2] : null;
 const messagesToNext = nextEntry ? Math.max(0, (nextEntry.messages - userMessages) + 1) : 0;

 const embed = createStyledEmbed({
 interaction,
 icon: '🔥',
 title: 'Rank Card',
 theme: 'leaderboard',
 summary: 'Current message performance in this server.',
 sections: [
 {
 label: 'Power Gauge',
 content: `${makeProgressBar(userMessages, topMessages, 14)}\n${userMessages.toLocaleString()} / ${topMessages.toLocaleString()} messages`,
 },
 ],
 cta: userRank > 1 ? `Send ${messagesToNext.toLocaleString()} more message(s) to reach #${userRank - 1}` : 'You are rank #1. Defend your lead.',
 })
 .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
 .addFields(
 { 
 name: '📊 Stats', 
 value: `Rank: **#${userRank}** of **${totalUsers}**\nMessages: **${userMessages.toLocaleString()}**\nPlacement: **Top ${placement}**`,
 inline: true 
 },
 {
 name: '🎮 Player',
 value: `User: **${interaction.user.username}**\nTarget: **${userRank > 1 ? `#${userRank - 1}` : 'Champion'}**\nNeeded: **${messagesToNext.toLocaleString()}**`,
 inline: true,
 }
 )
 .setTimestamp();

 await interaction.reply({ embeds: [embed] });
 },
};
