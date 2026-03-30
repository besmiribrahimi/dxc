const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { sendModLog } = require('../../utils/modLog');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('warn')
 .setDescription('Warn a member')
 .addUserOption(option =>
 option.setName('user')
 .setDescription('The user to warn')
 .setRequired(true))
 .addStringOption(option =>
 option.setName('reason')
 .setDescription('Reason for the warning')
 .setRequired(true))
 .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
 async execute(interaction) {
 const user = interaction.options.getUser('user');
 const reason = interaction.options.getString('reason');
 const member = interaction.guild.members.cache.get(user.id);

 if (!member) {
 return interaction.reply({ content: ' User not found in this server.', ephemeral: true });
 }

 if (user.id === interaction.user.id) {
 return interaction.reply({ content: ' You cannot warn yourself.', ephemeral: true });
 }

 // Send mod log
 await sendModLog(interaction.guild, 'Warn', interaction.user, user, reason);

 // Try to DM the user
 try {
 const dmEmbed = new EmbedBuilder()
 .setColor('#8B0000')
 .setTitle(' . Warning ')
 .setDescription(` \n\nYou have received a warning in **${interaction.guild.name}**`)
 .addFields({ name: ' Reason ', value: reason, inline: false })
 .setFooter({ text: ' . Please follow the server rules.' })
 .setTimestamp();

 await user.send({ embeds: [dmEmbed] }).catch(() => {});
 } catch (e) {}

 const embed = new EmbedBuilder()
 .setColor('#8B0000')
 .setTitle(' . User Warned ')
 .setDescription(` \n\n**${user.tag}** has been warned.`)
 .addFields(
 { name: ' User ', value: `${user.tag}`, inline: true },
 { name: ' Reason ', value: reason, inline: true }
 )
 .setFooter({ text: ' . Moderation Action' })
 .setTimestamp();

 await interaction.reply({ embeds: [embed] });
 },
};
