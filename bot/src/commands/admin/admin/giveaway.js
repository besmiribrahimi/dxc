const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const giveawayManager = require('../../utils/giveawayMenager'); 
module.exports = {
 data: new SlashCommandBuilder()
 .setName('giveaway')
 .setDescription('Start a giveaway')
 .addStringOption(option =>
 option.setName('prize')
 .setDescription('What are you giving away?')
 .setRequired(true))
 .addStringOption(option =>
 option.setName('duration')
 .setDescription('Duration (e.g., 1h, 1d, 1w)')
 .setRequired(true))
 .addStringOption(option =>
 option.setName('mode')
 .setDescription('Giveaway mode')
 .setRequired(true)
 .addChoices(
 { name: ' Normal - Everyone can join!', value: 'normal' },
 { name: ' Exclusive - Boosters & Special Roles only!', value: 'exclusive' }
 ))
 .addIntegerOption(option =>
 option.setName('winners')
 .setDescription('Number of winners')
 .setRequired(false))
 .addRoleOption(option =>
 option.setName('required_role')
 .setDescription('Required role for exclusive giveaways')
 .setRequired(false))
 .addChannelOption(option =>
 option.setName('channel')
 .setDescription('Channel to host the giveaway')
 .setRequired(false))
 .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
 async execute(interaction) {
 const prize = interaction.options.getString('prize');
 const duration = interaction.options.getString('duration').trim();
 const mode = interaction.options.getString('mode');
 const winners = interaction.options.getInteger('winners') || 1;
 const requiredRole = interaction.options.getRole('required_role');
 const channel = interaction.options.getChannel('channel') || interaction.channel;

 // Parse duration
 const durationMs = parseDuration(duration);
 if (!durationMs) {
 return interaction.reply({ content: ' Invalid duration format. Use: 5m, 1h, 1d, 1w (e.g., 5m for 5 minutes)', ephemeral: true });
 }

 // Validate exclusive mode has a role
 if (mode === 'exclusive' && !requiredRole) {
 return interaction.reply({ 
 content: ' Please specify a required role for exclusive giveaways! ', 
 ephemeral: true 
 });
 }

 const startTime = Date.now();
 const startTimestamp = Math.floor(startTime / 1000);
 const endTime = startTime + durationMs;
 const endTimestamp = Math.floor(endTime / 1000);

 // Different styling based on mode
 const isExclusive = mode === 'exclusive';
 const embedColor = isExclusive ? '#5A0000' : '#8B0000';
 const modeTitle = isExclusive ? ' . EXCLUSIVE GIVEAWAY ' : ' . GIVEAWAY ';
 const modeEmoji = isExclusive ? '[EXCLUSIVE]' : '[OPEN]';
 const footerText = isExclusive ? ' . Special members only~!' : ' . Good luck everyone!';

 let description = ` \n\n`;
 description += ` ${modeEmoji} Prize ${modeEmoji} \n\n`;
 description += `**${prize}**\n\n`;
 
 if (isExclusive) {
 description += ` **Exclusive to:** ${requiredRole}\n`;
 description += ` Only special members can enter! \n\n`;
 }
 
 description += ` Click the button to enter! \n`;
 description += ` Starts: <t:${startTimestamp}:F>\n`;
 description += ` Ends: <t:${endTimestamp}:F>\n`;
 description += ` Winners: ${winners}\n`;
 description += ` Mode: ${isExclusive ? ' Exclusive' : ' Normal'}`;

 const embed = new EmbedBuilder()
 .setColor(embedColor)
 .setTitle(modeTitle)
 .setDescription(description)
 .addFields({ name: ' Hosted by ', value: interaction.user.toString(), inline: true })
 .setFooter({ text: footerText })
 .setTimestamp(new Date(endTime));

 // Button for giveaway entry interaction.
 const buttonCustomId = isExclusive 
 ? `giveaway_exclusive_${requiredRole?.id || 'none'}` 
 : 'giveaway_normal';

 const buttonLabel = isExclusive ? ' Join Exclusive ' : ' Enter Giveaway ';

 const row = new ActionRowBuilder()
 .addComponents(
 new ButtonBuilder()
 .setCustomId(buttonCustomId)
 .setLabel(buttonLabel)
 .setStyle(ButtonStyle.Secondary)
 );

 try {
 const giveawayMsg = await channel.send({ embeds: [embed], components: [row] });

 // Save giveaway to giveaways.json
 giveawayManager.addGiveaway({
 messageId: giveawayMsg.id,
 channelId: channel.id,
 prize,
 duration: durationMs,
 endTime,
 winners,
 mode,
 requiredRole: requiredRole ? requiredRole.id : null,
 participants: [],
 host: interaction.user.id
 });

 const modeText = isExclusive ? 'Exclusive' : 'Normal';
 await interaction.reply({ 
 content: ` ${modeText} giveaway started in ${channel}! `, 
 ephemeral: true 
 });
 } catch (error) {
 await interaction.reply({ 
 content: ' Failed to start giveaway. Please check channel permissions.', 
 ephemeral: true 
 });
 }
 },
};

function parseDuration(str) {
 const match = str.match(/^(\d+)(m|h|d|w)$/i);
 if (!match) return null;

 const num = parseInt(match[1]);
 const unit = match[2].toLowerCase();

 switch (unit) {
 
 case 'm': return num * 60 * 1000; // minutes
 case 'h': return num * 60 * 60 * 1000;
 case 'd': return num * 24 * 60 * 60 * 1000;
 case 'w': return num * 7 * 24 * 60 * 60 * 1000;
 default: return null;
 }
}