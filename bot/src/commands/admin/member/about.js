const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('about')
		.setDescription('Show server and community information'),

	async execute(interaction) {
		const embed = new EmbedBuilder()
			.setColor('#B00000')
			.setTitle('DXC Competitive Hub')
			.setDescription('Core information about the Discord community.')
			.addFields(
				{
					name: 'Community Focus',
					value: 'Competitive play\nEvents and matchups\nFaction-based progression',
					inline: true,
				},
				{
					name: 'Discord Server',
					value: [
						`Members: ${interaction.guild?.memberCount ?? 'N/A'}`,
						`Online status data: in Discord`,
					].join('\n'),
					inline: true,
				}
			)
			.setFooter({ text: 'DXC server info panel' })
			.setTimestamp();

		await interaction.reply({ embeds: [embed] });
	},
};
