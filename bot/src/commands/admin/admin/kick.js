const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { sendModLog } = require('../../utils/modLog');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('kick')
 .setDescription('Kick a member from the server')
 .addUserOption(option =>
 option.setName('user')
 .setDescription('The user to kick')
 .setRequired(true))
 .addStringOption(option =>
 option.setName('reason')
 .setDescription('Reason for the kick')
 .setRequired(false))
 .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
 async execute(interaction) {
 const user = interaction.options.getUser('user');
 const reason = interaction.options.getString('reason') || 'No reason provided';
 const member = interaction.guild.members.cache.get(user.id);

 if (!member) {
 return interaction.reply({ content: ' User not found in this server.', ephemeral: true });
 }

 if (!member.kickable) {
 return interaction.reply({ content: ' I cannot kick this user. They may have higher permissions than me.', ephemeral: true });
 }

 if (member.id === interaction.user.id) {
 return interaction.reply({ content: ' You cannot kick yourself.', ephemeral: true });
 }

 try {
 // Try to DM the user before kicking
 try {
 const dmEmbed = new EmbedBuilder()
 .setColor('#8B0000')
 .setTitle(' You have been kicked ')
 .setDescription(`. .\n\nYou have been kicked from **${interaction.guild.name}**`)
 .addFields(
 { name: ' Reason ', value: reason, inline: false }
 )
 .setFooter({ text: ' . You may rejoin if you wish!' })
 .setTimestamp();
 await user.send({ embeds: [dmEmbed] });
 } catch (dmError) {
 // User has DMs disabled, continue with kick
 }

 await member.kick(reason);

 // Send mod log
 await sendModLog(interaction.guild, 'Kick', interaction.user, user, reason);

 const embed = new EmbedBuilder()
 .setColor('#8B0000')
 .setTitle(' User Kicked ')
 .setDescription(`. .\n\n**${user.tag}** has been kicked from the server.`)
 .addFields(
 { name: ' User ', value: `${user.tag}`, inline: true },
 { name: ' Reason ', value: reason, inline: true }
 )
 .setFooter({ text: ' . Moderation Action' })
 .setTimestamp();

 await interaction.reply({ embeds: [embed] });
 } catch (error) {
 console.error(error);
 await interaction.reply({ content: ' Failed to kick user.', ephemeral: true });
 }
 },
};
