const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('support')
 .setDescription('Support the server and help us grow'),
 async execute(interaction) {
 const embed = new EmbedBuilder()
 .setColor('#B00000')
 .setTitle(' . Support Draxar\'s Disc ')
 .setDescription(` \n\n Why Support Us? \n\nYour support helps us keep this community running and growing!`)
 .addFields(
 { 
 name: ' Benefits ', 
 value: ' Keep the server ad-free\n Fund new resources and features\n Support community events\n Help us grow and improve', 
 inline: false 
 },
 { 
 name: ' Supporter Perks ', 
 value: ' Exclusive supporter role\n Access to special channels\n Priority in giveaways\n Our eternal gratitude! ', 
 inline: false 
 }
 )
 .setFooter({ text: ' . Draxar\'s Disc Every little bit helps! Thank you ' })
 .setTimestamp();

 await interaction.reply({ embeds: [embed] });
 },
};
