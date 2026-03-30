const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('embed')
 .setDescription('Create a custom embed message')
 .addStringOption(option =>
 option.setName('title')
 .setDescription('Embed title')
 .setRequired(true))
 .addStringOption(option =>
 option.setName('description')
 .setDescription('Embed description')
 .setRequired(true))
 .addStringOption(option =>
 option.setName('color')
 .setDescription('Hex color code (e.g., #B00000)')
 .setRequired(false))
 .addStringOption(option =>
 option.setName('footer')
 .setDescription('Footer text')
 .setRequired(false))
 .addStringOption(option =>
 option.setName('image')
 .setDescription('Image URL')
 .setRequired(false))
 .addStringOption(option =>
 option.setName('thumbnail')
 .setDescription('Thumbnail URL')
 .setRequired(false))
 .addChannelOption(option =>
 option.setName('channel')
 .setDescription('Channel to send embed to')
 .setRequired(false))
 .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
 async execute(interaction) {
 const title = interaction.options.getString('title');
 const description = interaction.options.getString('description');
 const color = interaction.options.getString('color') || '#B00000';
 const footer = interaction.options.getString('footer');
 const image = interaction.options.getString('image');
 const thumbnail = interaction.options.getString('thumbnail');
 const channel = interaction.options.getChannel('channel') || interaction.channel;

 const embed = new EmbedBuilder()
 .setColor(color)
 .setTitle(title)
 .setDescription(description)
 .setTimestamp();

 if (footer) embed.setFooter({ text: footer });
 if (image) embed.setImage(image);
 if (thumbnail) embed.setThumbnail(thumbnail);

 try {
 await channel.send({ embeds: [embed] });
 await interaction.reply({ 
 content: ` Embed sent to ${channel}!`, 
 ephemeral: true 
 });
 } catch (error) {
 await interaction.reply({ 
 content: ' Failed to send embed. Please check the channel permissions and URLs.', 
 ephemeral: true 
 });
 }
 },
};
