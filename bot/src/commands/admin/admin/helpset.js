const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../../helpConfig.json');

const loadConfig = () => {
 try {
 if (fs.existsSync(configPath)) {
 return JSON.parse(fs.readFileSync(configPath, 'utf8'));
 }
 } catch (err) {
 console.error('Error loading help config:', err);
 }
 return {};
};

const saveConfig = (data) => {
 fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
};

module.exports = {
 data: new SlashCommandBuilder()
 .setName('helpset')
 .setDescription('Set the channel for help requests')
 .addChannelOption(option =>
 option.setName('channel')
 .setDescription('The channel to send help requests to')
 .setRequired(true))
 .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
 async execute(interaction) {
 const channel = interaction.options.getChannel('channel');

 const config = loadConfig();
 config[interaction.guild.id] = { helpChannelId: channel.id };
 saveConfig(config);

 const embed = new EmbedBuilder()
 .setColor('#B00000')
 .setTitle(' . Help Channel Set! ')
 .setDescription(` \n\n Settings Updated \n\nHelp requests will now be sent to ${channel}`)
 .addFields({ name: ' Channel ', value: `${channel}`, inline: true })
 .setFooter({ text: ' . Help requests are now configured!' })
 .setTimestamp();

 await interaction.reply({ embeds: [embed], ephemeral: true });
 },
 
 // Export helper function
 getHelpChannel: (guildId) => {
 const config = loadConfig();
 return config[guildId]?.helpChannelId;
 }
};
