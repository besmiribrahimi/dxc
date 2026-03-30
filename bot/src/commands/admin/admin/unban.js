const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { sendModLog } = require('../../utils/modLog');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('unban')
 .setDescription('Unban a user from the server')
 .addStringOption(option =>
 option.setName('userid')
 .setDescription('The user ID to unban')
 .setRequired(true))
 .addStringOption(option =>
 option.setName('reason')
 .setDescription('Reason for the unban')
 .setRequired(false))
 .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
 async execute(interaction) {
 const userId = interaction.options.getString('userid');
 const reason = interaction.options.getString('reason') || 'No reason provided';

 try {
 const banList = await interaction.guild.bans.fetch();
 const bannedUser = banList.get(userId);

 if (!bannedUser) {
 return interaction.reply({ content: ' This user is not banned.', ephemeral: true });
 }

 await interaction.guild.members.unban(userId, reason);

 // Send mod log
 await sendModLog(interaction.guild, 'Unban', interaction.user, bannedUser.user, reason);

 const embed = new EmbedBuilder()
 .setColor('#8B0000')
 .setTitle(' . User Unbanned ')
 .setDescription(` \n\n**${bannedUser.user.tag}** has been unbanned from the server.`)
 .addFields(
 { name: ' User ', value: `${bannedUser.user.tag}`, inline: true },
 { name: ' Reason ', value: reason, inline: true }
 )
 .setFooter({ text: ' . Moderation Action' })
 .setTimestamp();

 await interaction.reply({ embeds: [embed] });
 } catch (error) {
 console.error(error);
 await interaction.reply({ content: ' Failed to unban user. Make sure the ID is correct.', ephemeral: true });
 }
 },
};
