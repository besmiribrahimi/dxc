const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getTriggers, setTrigger, removeTrigger, getTriggerCount } = require('../../utils/autoResponder');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('autorespond')
 .setDescription('Manage autoresponder triggers')
 .addSubcommand(subcommand =>
 subcommand
 .setName('add')
 .setDescription('Add a new autoresponder trigger')
 .addStringOption(option =>
 option.setName('trigger')
 .setDescription('The word/phrase to trigger a response')
 .setRequired(true))
 .addStringOption(option =>
 option.setName('response')
 .setDescription('The response message to send')
 .setRequired(true))
 .addBooleanOption(option =>
 option.setName('exact')
 .setDescription('Require exact match? (Default: false - triggers if word appears anywhere)')
 .setRequired(false))
 .addBooleanOption(option =>
 option.setName('embed')
 .setDescription('Send response as a styled embed? (Default: false)')
 .setRequired(false)))
 .addSubcommand(subcommand =>
 subcommand
 .setName('remove')
 .setDescription('Remove an autoresponder trigger')
 .addStringOption(option =>
 option.setName('trigger')
 .setDescription('The trigger word/phrase to remove')
 .setRequired(true)))
 .addSubcommand(subcommand =>
 subcommand
 .setName('edit')
 .setDescription('Edit an existing autoresponder trigger')
 .addStringOption(option =>
 option.setName('trigger')
 .setDescription('The trigger word/phrase to edit')
 .setRequired(true))
 .addStringOption(option =>
 option.setName('response')
 .setDescription('The new response message')
 .setRequired(false))
 .addBooleanOption(option =>
 option.setName('exact')
 .setDescription('Require exact match?')
 .setRequired(false))
 .addBooleanOption(option =>
 option.setName('embed')
 .setDescription('Send response as a styled embed?')
 .setRequired(false)))
 .addSubcommand(subcommand =>
 subcommand
 .setName('list')
 .setDescription('List all autoresponder triggers'))
 .addSubcommand(subcommand =>
 subcommand
 .setName('info')
 .setDescription('Get info about a specific trigger')
 .addStringOption(option =>
 option.setName('trigger')
 .setDescription('The trigger to get info about')
 .setRequired(true)))
 .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

 async execute(interaction) {
 const subcommand = interaction.options.getSubcommand();

 switch (subcommand) {
 case 'add': {
 const trigger = interaction.options.getString('trigger');
 const response = interaction.options.getString('response');
 const exactMatch = interaction.options.getBoolean('exact') || false;
 const embedResponse = interaction.options.getBoolean('embed') || false;

 // Check if trigger already exists
 const existing = getTriggers(interaction.guild.id);
 if (existing[trigger.toLowerCase()]) {
 return interaction.reply({
 content: ' That trigger already exists! Use `/autorespond edit` to modify it~ ',
 ephemeral: true
 });
 }

 const success = setTrigger(interaction.guild.id, trigger, response, {
 exactMatch,
 embedResponse,
 createdBy: interaction.user.tag,
 createdAt: new Date().toISOString()
 });

 if (success) {
 const embed = new EmbedBuilder()
 .setColor('#8B0000')
 .setTitle(' Autoresponder Added ')
 .setDescription(`. .`)
 .addFields(
 { name: ' Trigger ', value: `\`${trigger}\``, inline: true },
 { name: ' Response ', value: response.substring(0, 100) + (response.length > 100 ? '...' : ''), inline: true },
 { name: ' Settings ', value: `Exact Match: ${exactMatch ? '' : ''}\nEmbed: ${embedResponse ? '' : ''}`, inline: false }
 )
 .setFooter({ text: ' . Autoresponder will now trigger on this word!' })
 .setTimestamp();

 await interaction.reply({ embeds: [embed] });
 } else {
 await interaction.reply({ content: '() Failed to add trigger. Please try again!', ephemeral: true });
 }
 break;
 }

 case 'remove': {
 const trigger = interaction.options.getString('trigger');
 
 const success = removeTrigger(interaction.guild.id, trigger);

 if (success) {
 const embed = new EmbedBuilder()
 .setColor('#8B0000')
 .setTitle(' Autoresponder Removed ')
 .setDescription(`. .\n\nTrigger \`${trigger}\` has been removed~`)
 .setFooter({ text: ' . The bot will no longer respond to this trigger!' })
 .setTimestamp();

 await interaction.reply({ embeds: [embed] });
 } else {
 await interaction.reply({ 
 content: ' That trigger doesn\'t exist! Use `/autorespond list` to see all triggers~ ', 
 ephemeral: true 
 });
 }
 break;
 }

 case 'edit': {
 const trigger = interaction.options.getString('trigger');
 const newResponse = interaction.options.getString('response');
 const exactMatch = interaction.options.getBoolean('exact');
 const embedResponse = interaction.options.getBoolean('embed');

 const existing = getTriggers(interaction.guild.id);
 const triggerData = existing[trigger.toLowerCase()];

 if (!triggerData) {
 return interaction.reply({
 content: ' That trigger doesn\'t exist! Use `/autorespond add` to create it~ ',
 ephemeral: true
 });
 }

 // Update only provided options
 const success = setTrigger(interaction.guild.id, trigger, newResponse || triggerData.response, {
 exactMatch: exactMatch !== null ? exactMatch : triggerData.exactMatch,
 embedResponse: embedResponse !== null ? embedResponse : triggerData.embedResponse,
 createdBy: triggerData.createdBy,
 createdAt: triggerData.createdAt
 });

 if (success) {
 const embed = new EmbedBuilder()
 .setColor('#8B0000')
 .setTitle(' Autoresponder Edited ')
 .setDescription(`. .\n\nTrigger \`${trigger}\` has been updated~`)
 .addFields(
 { name: ' Response ', value: (newResponse || triggerData.response).substring(0, 100) + ((newResponse || triggerData.response).length > 100 ? '...' : ''), inline: false },
 { name: ' Settings ', value: `Exact Match: ${(exactMatch !== null ? exactMatch : triggerData.exactMatch) ? '' : ''}\nEmbed: ${(embedResponse !== null ? embedResponse : triggerData.embedResponse) ? '' : ''}`, inline: false }
 )
 .setFooter({ text: ' . Changes saved!' })
 .setTimestamp();

 await interaction.reply({ embeds: [embed] });
 } else {
 await interaction.reply({ content: '() Failed to edit trigger. Please try again!', ephemeral: true });
 }
 break;
 }

 case 'list': {
 const triggers = getTriggers(interaction.guild.id);
 const triggerList = Object.entries(triggers);

 if (triggerList.length === 0) {
 return interaction.reply({
 content: ' No autoresponders set up yet! Use `/autorespond add` to create one~ ',
 ephemeral: true
 });
 }

 const embed = new EmbedBuilder()
 .setColor('#8B0000')
 .setTitle(' Autoresponders List ')
 .setDescription(`. .\n\n**${triggerList.length}** autoresponders configured~`);

 // Add triggers (max 25 fields)
 const displayTriggers = triggerList.slice(0, 24);
 for (const [key, data] of displayTriggers) {
 const flags = [];
 if (data.exactMatch) flags.push(' Exact');
 if (data.embedResponse) flags.push(' Embed');
 
 embed.addFields({
 name: ` \`${data.trigger}\` `,
 value: `${data.response.substring(0, 50)}${data.response.length > 50 ? '...' : ''}\n${flags.length > 0 ? flags.join(' ') : ' Contains match'}`,
 inline: true
 });
 }

 if (triggerList.length > 24) {
 embed.addFields({
 name: ' Note',
 value: `And ${triggerList.length - 24} more triggers...`,
 inline: false
 });
 }

 embed.setFooter({ text: ' . Use /autorespond info <trigger> for details!' });
 embed.setTimestamp();

 await interaction.reply({ embeds: [embed] });
 break;
 }

 case 'info': {
 const trigger = interaction.options.getString('trigger');
 const triggers = getTriggers(interaction.guild.id);
 const triggerData = triggers[trigger.toLowerCase()];

 if (!triggerData) {
 return interaction.reply({
 content: ' That trigger doesn\'t exist! Use `/autorespond list` to see all triggers~ ',
 ephemeral: true
 });
 }

 const embed = new EmbedBuilder()
 .setColor('#8B0000')
 .setTitle(` Trigger Info `)
 .setDescription(`. .`)
 .addFields(
 { name: ' Trigger ', value: `\`${triggerData.trigger}\``, inline: true },
 { name: ' Match Type ', value: triggerData.exactMatch ? 'Exact Match' : 'Contains', inline: true },
 { name: ' Response Type ', value: triggerData.embedResponse ? 'Embed' : 'Text', inline: true },
 { name: ' Response ', value: triggerData.response, inline: false },
 { name: ' Created By ', value: triggerData.createdBy, inline: true },
 { name: ' Created At ', value: new Date(triggerData.createdAt).toLocaleDateString(), inline: true }
 )
 .setFooter({ text: ' . Use /autorespond edit to modify!' })
 .setTimestamp();

 await interaction.reply({ embeds: [embed] });
 break;
 }
 }
 },
};
