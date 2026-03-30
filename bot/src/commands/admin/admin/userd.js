const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getUserActions } = require('../../utils/modLog');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('userd')
 .setDescription('Show moderation history for a user')
 .addUserOption(option =>
 option.setName('user')
 .setDescription('The user to check')
 .setRequired(true))
 .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
 async execute(interaction) {
 const user = interaction.options.getUser('user');
 const guildId = interaction.guild.id;
 const actions = getUserActions(guildId, user.id);

 // Count actions
 let bans = 0, kicks = 0, warns = 0, mutes = 0, timeouts = 0;
 actions.forEach(a => {
 if (a.action === 'Ban') bans++;
 if (a.action === 'Kick') kicks++;
 if (a.action === 'Warn') warns++;
 if (a.action === 'Mute' || a.action === 'Timeout') mutes++;
 if (a.action === 'Timeout') timeouts++;
 });

 const embed = new EmbedBuilder()
 .setColor('#B00000')
 .setTitle(` . User Moderation Data `)
 .setDescription(` \n\n Moderation History `)
 .addFields(
 { name: ' User ', value: `${user.tag}\n\`${user.id}\``, inline: true },
 { name: ' Bans ', value: ` ${bans}`, inline: true },
 { name: ' Kicks ', value: ` ${kicks}`, inline: true },
 { name: ' Warns ', value: ` ${warns}`, inline: true },
 { name: ' Mutes/Timeouts ', value: ` ${mutes} ( ${timeouts} timeouts)`, inline: true },
 { name: ' Total Actions ', value: `${actions.length}`, inline: true }
 )
 .setThumbnail(user.displayAvatarURL({ dynamic: true }))
 .setFooter({ text: ' . Draxar\'s Disc User moderation summary' })
 .setTimestamp();

 if (actions.length === 0) {
 embed.setDescription('No moderation actions found for this user.');
 }

 await interaction.reply({ embeds: [embed] });
 },
};
