const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('help')
 .setDescription('Get help or view member commands'),
 async execute(interaction) {
 const embed = new EmbedBuilder()
 .setColor('#B00000')
 .setTitle(' . Quick Server Guide! ')
 .setDescription(` \n\n In this server `)
 .addFields(
 { name: ' FAQ Forum ', value: 'Browse tutorials and guides.', inline: false },
 { name: ' webhooks ', value: 'Aes. and easy to copy & paste webhooks.', inline: false },
 { name: ' shop ', value: 'Browse ready-made, premium server templates.', inline: false },
 { name: ' questions ', value: 'Ask questions and get answers.', inline: false },
 { name: ' ask 4 help ', value: 'Ask other members for assistance.', inline: false },
 { name: ' taking requests ', value: 'Browse services members are offering RIGHT NOW.', inline: false },
 { name: ' hire staff ', value: 'Search through staff applications and recruit someone.', inline: false },
 { name: ' support tickets ', value: 'Have any questions or concerns? Let us know by opening a ticket.', inline: false }
 )
 .addFields({
 name: ' ',
 value: ' Member Commands \n\n`/resources` Free resources\n`/commissions` Shop & commissions\n`/webstats` Live website stats\n`/help` You\'re here!\n`/support` Support us\n`/about` About the server\n`/request` Request help',
 inline: false
 });

 embed
 .setFooter({ text: ' . Draxar\'s Disc I\'m glad you\'re here!' })
 .setTimestamp();

 await interaction.reply({ embeds: [embed] });
 },
};
