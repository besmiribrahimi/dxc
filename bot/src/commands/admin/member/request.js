const { SlashCommandBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('request')
 .setDescription('Request help from the community'),
 async execute(interaction) {
 const modal = new ModalBuilder()
 .setCustomId('helpRequestModal')
 .setTitle(' Help Request ');

 const typeInput = new TextInputBuilder()
 .setCustomId('requestType')
 .setLabel('What type of help do you need?')
 .setPlaceholder('e.g., Design, Server Setup, Graphics, etc.')
 .setStyle(TextInputStyle.Short)
 .setRequired(true);
 
 const descriptionInput = new TextInputBuilder()
 .setCustomId('requestDescription')
 .setLabel('Describe what you need')
 .setPlaceholder('Be as detailed as possible so others can help quickly.')
 .setStyle(TextInputStyle.Paragraph)
 .setRequired(true);

 const row1 = new ActionRowBuilder().addComponents(typeInput);
 const row2 = new ActionRowBuilder().addComponents(descriptionInput);

 modal.addComponents(row1, row2);

 await interaction.showModal(modal);
 },
};
