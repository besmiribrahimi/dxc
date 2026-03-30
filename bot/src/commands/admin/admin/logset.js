const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../../logConfig.json');

const loadConfig = () => {
 try {
 if (fs.existsSync(configPath)) {
 return JSON.parse(fs.readFileSync(configPath, 'utf8'));
 }
 } catch (err) {
 console.error('Error loading log config:', err);
 }
 return {};
};

const saveConfig = (data) => {
 fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
};

module.exports = {
 data: new SlashCommandBuilder()
 .setName('logset')
 .setDescription('Set the channel for mod logs (kicks, bans, etc.)')
 .addChannelOption(option =>
 option.setName('channel')
 .setDescription('The channel to send mod logs to')
 .setRequired(true))
 .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
 async execute(interaction) {
 const channel = interaction.options.getChannel('channel');

 const config = loadConfig();
 config[interaction.guild.id] = { logChannelId: channel.id };
 saveConfig(config);

 const embed = new EmbedBuilder()
 .setColor('#B00000')
 .setTitle(' . Mod Log Channel Set! ')
 .setDescription(` \n\n Settings Updated \n\nMod logs will now be sent to ${channel}`)
 .addFields({ name: ' Channel ', value: `${channel}`, inline: true })
 .setFooter({ text: ' . Mod logs are now configured!' })
 .setTimestamp();

 await interaction.reply({ embeds: [embed], ephemeral: true });
 },
 
 // Export helper function
 getLogChannel: (guildId) => {
 const config = loadConfig();
 return config[guildId]?.logChannelId;
 }
};
