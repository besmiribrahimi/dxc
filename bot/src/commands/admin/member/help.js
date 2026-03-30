const { SlashCommandBuilder } = require('discord.js');
const { createStyledEmbed, SEPARATOR } = require('../../utils/embedStyle');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('help')
 .setDescription('Show matchmaking, leaderboard, and admin commands'),
 async execute(interaction) {
 const embed = createStyledEmbed({
 interaction,
 icon: '🧭',
 title: 'Command Hub',
theme: 'leaderboard',
 summary: 'Elite control center for matchmaking, rankings, and admin operations.',
 sections: [
 {
 label: 'Fast Start',
 content: [
 '1) Run **/set1v1**',
 '2) Hit **JOIN 1V1 QUEUE**',
 '3) Run **/look1v1** to ping queued players',
 ].join('\n'),
 },
 {
 label: 'Identity',
 content: 'High tempo • Competitive voice • Clean match flow',
 },
 ],
 cta: 'Run /set1v1 to open the queue panel',
 })
 .addFields(
 { name: `${SEPARATOR}\n⚔️ MATCHMAKING`, value: '`/set1v1` Open queue panel\n`/look1v1` DM all queued fighters', inline: false },
 { name: '🏆 LEADERBOARD', value: '`/webleaderboard` Website top players/factions/countries\n`/webstats` Live totals and sync source\n`/leaderboard` Server message ladder\n`/rank` Personal rank card', inline: false }
 )
 .addFields({
 name: '🛡️ ADMIN TOOLS',
 value: [
 '`/mute` Timeout a member',
 '`/unmute` Remove timeout',
 '`/kick` Kick a member',
 '`/ban` Ban a member',
 '`/ticketpanel` Post ticket panel',
 '`/botstatus` Runtime and resource health',
 '`/websyncstatus` Sync service diagnostics',
 ].join('\n'),
 inline: false
 });

 await interaction.reply({ embeds: [embed] });
 },
};
