const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getLeaderboard, getUserRank, getUserStats } = require('../../utils/messageStats');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('leaderboard')
 .setDescription('View the message activity leaderboard'),
 async execute(interaction) {
 const guildId = interaction.guild.id;
 const userId = interaction.user.id;
 
 // Get top 20 users
 const leaderboard = getLeaderboard(guildId, 20);
 
 if (leaderboard.length === 0) {
 return interaction.reply({ 
 content: ' No message data yet! Start chatting to appear on the leaderboard.', 
 ephemeral: true 
 });
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
 
 const medal = index === 0 ? '' : index === 1 ? '' : index === 2 ? '' : `**${index + 1}.**`;
 const highlight = entry.userId === userId ? ' ' : '';
 
 return `${medal} ${user.username}${highlight}\n \`${entry.messages.toLocaleString()}\` messages`;
 })
 );

 // Get current user's stats
 const userRank = getUserRank(userId, guildId);
 const userStats = getUserStats(userId, guildId);
 const userMessages = userStats?.messages || 0;

 const embed = new EmbedBuilder()
 .setColor('#B00000')
 .setTitle(' . Message Leaderboard ')
 .setDescription(` \n\n${leaderboardEntries.join('\n\n')}`)
 .addFields({
 name: ' ',
 value: ` Your Stats \n\n **Rank:** #${userRank || 'N/A'}\n **Messages:** ${userMessages.toLocaleString()}`,
 inline: false
 })
 .setFooter({ text: ' . Draxar\'s Disc Keep chatting to climb the ranks!' })
 .setTimestamp();

 await interaction.reply({ embeds: [embed] });
 },
};
