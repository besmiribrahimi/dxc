const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('help2')
 .setDescription('View detailed command descriptions'),
 async execute(interaction) {
 const embed = new EmbedBuilder()
 .setColor('#B00000')
 .setTitle(' . Command Details! ')
 .setDescription(` \n\n Member Commands `)
 .addFields(
 { name: '`/resources`', value: ' Access free resources and useful tools', inline: false },
 { name: '`/commissions`', value: ' Browse the shop and commission services', inline: false },
 { name: '`/webstats`', value: ' Fetch live statistics from the DXC website', inline: false },
 { name: '`/leaderboard`', value: ' View the message activity leaderboard', inline: false },
 { name: '`/rank`', value: ' View your message rank and stats', inline: false },
 { name: '`/help`', value: ' Quick overview of server features and commands', inline: false },
 { name: '`/help2`', value: ' View detailed command descriptions (you\'re here!)', inline: false },
 { name: '`/support`', value: ' Learn how to support the server', inline: false },
 { name: '`/about`', value: ' Learn about the server and its purpose', inline: false },
 { name: '`/request`', value: ' Submit a help request to other members', inline: false }
 );

 embed
 .setFooter({ text: ' . Draxar\'s Disc I\'m glad you\'re here!' })
 .setTimestamp();

 await interaction.reply({ embeds: [embed] });
 },
};
