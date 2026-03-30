const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { sendModLog } = require('../../utils/modLog');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('timeout')
 .setDescription('Timeout a member')
 .addUserOption(option =>
 option.setName('user')
 .setDescription('The user to timeout')
 .setRequired(true))
 .addStringOption(option =>
 option.setName('duration')
 .setDescription('Duration (e.g., 5m, 1h, 1d)')
 .setRequired(true))
 .addStringOption(option =>
 option.setName('reason')
 .setDescription('Reason for the timeout')
 .setRequired(false))
 .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
 async execute(interaction) {
 const user = interaction.options.getUser('user');
 const duration = interaction.options.getString('duration');
 const reason = interaction.options.getString('reason') || 'No reason provided';
 const member = interaction.guild.members.cache.get(user.id);

 if (!member) {
 return interaction.reply({ content: ' User not found in this server.', ephemeral: true });
 }

 if (!member.moderatable) {
 return interaction.reply({ content: ' I cannot timeout this user. They may have higher permissions than me.', ephemeral: true });
 }

 if (user.id === interaction.user.id) {
 return interaction.reply({ content: ' You cannot timeout yourself.', ephemeral: true });
 }

 // Parse duration
 const ms = parseDuration(duration);
 if (!ms || ms > 28 * 24 * 60 * 60 * 1000) {
 return interaction.reply({ content: ' Invalid duration. Use format like 5m, 1h, 1d (max 28 days).', ephemeral: true });
 }

 try {
 // Try to DM the user before timing out
 try {
 const dmEmbed = new EmbedBuilder()
 .setColor('#8B0000')
 .setTitle(' You have been timed out ')
 .setDescription(`. .\n\nYou have been timed out in **${interaction.guild.name}**`)
 .addFields(
 { name: ' Duration ', value: duration, inline: true },
 { name: ' Reason ', value: reason, inline: false }
 )
 .setFooter({ text: ' . Please be patient~' })
 .setTimestamp();
 await user.send({ embeds: [dmEmbed] });
 } catch (dmError) {
 // User has DMs disabled, continue with timeout
 }

 await member.timeout(ms, reason);

 // Send mod log
 await sendModLog(interaction.guild, 'Timeout', interaction.user, user, reason, [
 { name: ' Duration ', value: duration, inline: true }
 ]);

 const embed = new EmbedBuilder()
 .setColor('#8B0000')
 .setTitle(' User Timed Out ')
 .setDescription(`. .\n\n**${user.tag}** has been timed out.`)
 .addFields(
 { name: ' User ', value: `${user.tag}`, inline: true },
 { name: ' Duration ', value: duration, inline: true },
 { name: ' Reason ', value: reason, inline: false }
 )
 .setFooter({ text: ' . Moderation Action' })
 .setTimestamp();

 await interaction.reply({ embeds: [embed] });
 } catch (error) {
 console.error(error);
 await interaction.reply({ content: ' Failed to timeout user.', ephemeral: true });
 }
 },
};

function parseDuration(str) {
 const match = str.match(/^(\d+)(m|h|d)$/i);
 if (!match) return null;
 
 const num = parseInt(match[1]);
 const unit = match[2].toLowerCase();
 
 switch (unit) {
 case 'm': return num * 60 * 1000;
 case 'h': return num * 60 * 60 * 1000;
 case 'd': return num * 24 * 60 * 60 * 1000;
 default: return null;
 }
}
