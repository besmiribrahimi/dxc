const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('resources')
 .setDescription('View free Discord resources and design tools'),
 async execute(interaction) {
 const embed = new EmbedBuilder()
 .setColor('#B00000')
 .setTitle(' . Free Resources ')
 .setDescription(` \n\n Community Resources `)
 .addFields(
 { name: ' Layout Ideas ', value: 'Browse creative server layouts and channel organization tips.', inline: true },
 { name: ' Design Elements ', value: 'Free banners, dividers, emojis, and aesthetic assets.', inline: true },
 { name: ' Helpful Tools ', value: 'Bots, generators, and utilities to enhance your server.', inline: true },
 { name: ' Tips & Guides ', value: 'Tutorials on server setup, moderation, and community building.', inline: true },
 { name: ' Templates ', value: 'Ready-to-use templates for various server types.', inline: true },
 { name: ' Inspiration ', value: 'Get inspired by showcased servers and designs.', inline: true }
 )
 .setFooter({ text: ' . Draxar\'s Disc Sharing is caring! Feel free to contribute.' })
 .setTimestamp();

 await interaction.reply({ embeds: [embed] });
 },
};
