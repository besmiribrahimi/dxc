const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// Store active private channels and their deletion timers
const privateChannels = new Map();

module.exports = {
 data: new SlashCommandBuilder()
 .setName('privatevc')
 .setDescription('Manage private voice channels with user limits and auto-deletion')
 .addSubcommand(subcommand =>
 subcommand
 .setName('create')
 .setDescription('Create a new private voice channel')
 .addIntegerOption(option =>
 option.setName('user_limit')
 .setDescription('Maximum number of users allowed (1-99)')
 .setRequired(false)
 .setMinValue(1)
 .setMaxValue(99)
 )
 .addStringOption(option =>
 option.setName('duration')
 .setDescription('Auto-delete duration')
 .setRequired(false)
 .addChoices(
 { name: '5 minutes', value: '5m' },
 { name: '1 hour', value: '1h' },
 { name: '3 hours', value: '3h' },
 { name: '5 hours (max)', value: '5h' }
 )
 )
 )
 .addSubcommand(subcommand =>
 subcommand
 .setName('close')
 .setDescription('Close your active private voice channel')
 )
 .addSubcommand(subcommand =>
 subcommand
 .setName('info')
 .setDescription('Get information about your active private voice channel')
 )
 .addSubcommand(subcommand =>
 subcommand
 .setName('invite')
 .setDescription('Invite a user to your private voice channel')
 .addUserOption(option =>
 option.setName('user')
 .setDescription('The user to invite')
 .setRequired(true)
 )
 ),

 async execute(interaction) {
 const subcommand = interaction.options.getSubcommand();

 if (subcommand === 'close') {
 return this.closePrivateChannel(interaction);
 }

 if (subcommand === 'info') {
 return this.privateChannelInfo(interaction);
 }

 if (subcommand === 'invite') {
 return this.inviteToPrivateChannel(interaction);
 }

 try {
 // Get options
 const userLimit = interaction.options.getInteger('user_limit') || 10; // Default 10 users
 const duration = interaction.options.getString('duration') || '1h'; // Default 1 hour
 
 // Convert duration to milliseconds
 let durationMs;
 switch (duration) {
 case '5m':
 durationMs = 5 * 60 * 1000; // 5 minutes
 break;
 case '1h':
 durationMs = 60 * 60 * 1000; // 1 hour
 break;
 case '3h':
 durationMs = 3 * 60 * 60 * 1000; // 3 hours
 break;
 case '5h':
 durationMs = 5 * 60 * 60 * 1000; // 5 hours
 break;
 default:
 durationMs = 60 * 60 * 1000; // Default 1 hour
 }

 // Get the guild and member
 const guild = interaction.guild;
 const member = interaction.member;

 // Check if user already has an active private channel
 if (privateChannels.has(member.id)) {
 const existingChannel = privateChannels.get(member.id);
 return interaction.reply({
 embeds: [new EmbedBuilder()
 .setColor('#FF0000')
 .setTitle(' Private Channel Already Exists')
 .setDescription(`You already have an active private voice channel: <#${existingChannel.channelId}>`)
 .setFooter({ text: 'Use /privatevc close to close your existing channel.' })
 ],
 ephemeral: true
 });
 }

 // Find or create a category for private channels
 let privateCategory = guild.channels.cache.find(channel => 
 channel.type === 4 && channel.name.toLowerCase().includes('private')
 );

 // If no private category exists, create one
 if (!privateCategory) {
 try {
 privateCategory = await guild.channels.create({
 name: ' Private Channels',
 type: 4, // Category type
 permissionOverwrites: [
 {
 id: guild.id,
 deny: ['ViewChannel']
 }
 ]
 });
 } catch (error) {
 console.error('Error creating private category:', error);
 // Fallback to creating channel without category
 }
 }

 // Create the private voice channel
 const channelName = ` ${member.displayName}'s VC`;
 
 const privateChannel = await guild.channels.create({
 name: channelName,
 type: 2, // Voice channel type
 userLimit: userLimit,
 parent: privateCategory?.id || null,
 permissionOverwrites: [
 {
 id: guild.id,
 deny: ['ViewChannel', 'Connect', 'Speak']
 },
 {
 id: member.id,
 allow: ['ViewChannel', 'Connect', 'Speak', 'ManageChannels', 'MuteMembers', 'DeafenMembers', 'MoveMembers']
 }
 ]
 });

 // Store channel info with deletion timer
 const channelInfo = {
 channelId: privateChannel.id,
 ownerId: member.id,
 createdAt: Date.now(),
 duration: duration,
 deletionTimer: setTimeout(async () => {
 await this.deletePrivateChannel(guild, member.id, privateChannel.id, 'Timer expired');
 }, durationMs)
 };

 privateChannels.set(member.id, channelInfo);

 // Create success embed
 const successEmbed = new EmbedBuilder()
 .setColor('#8B0000')
 .setTitle(' Private Voice Channel Created!')
 .setDescription(`Your private voice channel has been created successfully!`)
 .addFields(
 { name: ' Channel', value: `<#${privateChannel.id}>`, inline: true },
 { name: ' User Limit', value: `${userLimit} users`, inline: true },
 { name: ' Auto-delete', value: duration, inline: true },
 { name: ' Controls', value: 'You have full control over this channel including managing permissions, muting members, and moving users.' }
 )
 .setFooter({ text: 'Use /privatevc close to manually close this channel.' })
 .setTimestamp();

 await interaction.reply({ embeds: [successEmbed], ephemeral: true });

 // Send a message to the channel creator with instructions
 try {
 await member.send({
 embeds: [new EmbedBuilder()
 .setColor('#8B0000')
 .setTitle(' Your Private Voice Channel')
 .setDescription(`You created a private voice channel in **${guild.name}**`)
 .addFields(
 { name: ' Channel', value: `<#${privateChannel.id}>`, inline: true },
 { name: ' User Limit', value: `${userLimit} users`, inline: true },
 { name: ' Auto-delete', value: duration, inline: true }
 )
 .setFooter({ text: 'You have full control over this channel. Use /privatevc close to close it early.' })
 ]
 });
 } catch (error) {
 // User might have DMs disabled, that's okay
 }

 } catch (error) {
 console.error('Error creating private voice channel:', error);
 await interaction.reply({
 embeds: [new EmbedBuilder()
 .setColor('#FF0000')
 .setTitle(' Error')
 .setDescription('An error occurred while creating your private voice channel.')
 .addFields({ name: 'Error Details', value: error.message })
 ],
 ephemeral: true
 });
 }
 },

 async privateChannelInfo(interaction) {
 const member = interaction.member;
 const channelInfo = privateChannels.get(member.id);

 if (!channelInfo) {
 return interaction.reply({
 embeds: [new EmbedBuilder()
 .setColor('#FF0000')
 .setTitle(' No Active Channel')
 .setDescription('You do not have an active private voice channel.')
 ],
 ephemeral: true
 });
 }

 const channel = interaction.guild.channels.cache.get(channelInfo.channelId);
 const durationMs = channelInfo.duration === '5m' ? 5 * 60 * 1000 :
 channelInfo.duration === '1h' ? 60 * 60 * 1000 :
 channelInfo.duration === '3h' ? 3 * 60 * 60 * 1000 : 5 * 60 * 60 * 1000;
 const remainingMs = Math.max(0, (channelInfo.createdAt + durationMs) - Date.now());
 const remainingMin = Math.ceil(remainingMs / 60000);

 return interaction.reply({
 embeds: [new EmbedBuilder()
 .setColor('#8B0000')
 .setTitle(' Private Channel Info')
 .addFields(
 { name: ' Channel', value: channel ? `<#${channel.id}>` : 'Channel not found', inline: true },
 { name: ' User Limit', value: channel?.userLimit ? `${channel.userLimit}` : 'No limit', inline: true },
 { name: ' Time Remaining', value: `${remainingMin} minute(s)`, inline: true }
 )
 .setTimestamp()
 ],
 ephemeral: true
 });
 },

 async inviteToPrivateChannel(interaction) {
 const member = interaction.member;
 const targetUser = interaction.options.getUser('user');
 const channelInfo = privateChannels.get(member.id);

 if (!channelInfo) {
 return interaction.reply({
 embeds: [new EmbedBuilder()
 .setColor('#FF0000')
 .setTitle(' No Active Channel')
 .setDescription('You do not have an active private voice channel.')
 ],
 ephemeral: true
 });
 }

 const channel = interaction.guild.channels.cache.get(channelInfo.channelId);
 if (!channel) {
 return interaction.reply({
 content: 'Private channel not found. It may have been deleted.',
 ephemeral: true
 });
 }

 await channel.permissionOverwrites.edit(targetUser.id, {
 ViewChannel: true,
 Connect: true,
 Speak: true,
 }).catch(() => null);

 return interaction.reply({
 embeds: [new EmbedBuilder()
 .setColor('#8B0000')
 .setTitle(' User Invited')
 .setDescription(`${targetUser} can now join ${channel}.`)
 ],
 ephemeral: true
 });
 },

 // Method to delete private channels
 async deletePrivateChannel(guild, ownerId, channelId, reason = 'Unknown') {
 try {
 const channel = guild.channels.cache.get(channelId);
 if (channel) {
 await channel.delete(`Private VC deleted - ${reason}`);
 }
 
 // Clear the timer and remove from map
 const channelInfo = privateChannels.get(ownerId);
 if (channelInfo && channelInfo.deletionTimer) {
 clearTimeout(channelInfo.deletionTimer);
 }
 privateChannels.delete(ownerId);
 
 console.log(`Private channel ${channelId} deleted for user ${ownerId} - Reason: ${reason}`);
 } catch (error) {
 console.error('Error deleting private channel:', error);
 }
 },

 // Method to handle manual channel closure
 async closePrivateChannel(interaction) {
 const member = interaction.member;
 const channelInfo = privateChannels.get(member.id);
 
 if (!channelInfo) {
 return interaction.reply({
 embeds: [new EmbedBuilder()
 .setColor('#FF0000')
 .setTitle(' No Active Channel')
 .setDescription('You don\'t have an active private voice channel.')
 ],
 ephemeral: true
 });
 }

 await this.deletePrivateChannel(interaction.guild, member.id, channelInfo.channelId, 'Manual closure');
 
 await interaction.reply({
 embeds: [new EmbedBuilder()
 .setColor('#8B0000')
 .setTitle(' Channel Closed')
 .setDescription('Your private voice channel has been closed successfully.')
 ],
 ephemeral: true
 });
 },

 // Method to get active channels (for debugging/admin purposes)
 getActiveChannels() {
 return Array.from(privateChannels.entries()).map(([ownerId, info]) => ({
 ownerId,
 channelId: info.channelId,
 createdAt: info.createdAt,
 duration: info.duration,
 timeRemaining: info.createdAt + (info.duration === '5m' ? 5*60*1000 : 
 info.duration === '1h' ? 60*60*1000 :
 info.duration === '3h' ? 3*60*60*1000 :
 5*60*60*1000) - Date.now()
 }));
 }
};

// Export the map for potential use in other modules
module.exports.privateChannels = privateChannels;

// Event handler for voice state updates (to clean up empty channels)
module.exports.handleVoiceStateUpdate = async (oldState, newState) => {
 // Check if user left a private channel
 if (oldState.channel && !newState.channel) {
 const channelInfo = Array.from(privateChannels.entries()).find(([_, info]) => info.channelId === oldState.channelId);
 
 if (channelInfo) {
 const [ownerId, info] = channelInfo;
 const channel = oldState.channel;
 
 // Check if channel is empty after 30 seconds
 setTimeout(async () => {
 try {
 const updatedChannel = await channel.guild.channels.fetch(channel.id);
 if (updatedChannel && updatedChannel.members.size === 0) {
 // Channel is empty, delete it
 await module.exports.deletePrivateChannel(channel.guild, ownerId, channel.id, 'Channel empty');
 
 // Notify the owner
 try {
 const owner = await channel.guild.members.fetch(ownerId);
 await owner.send({
 embeds: [new EmbedBuilder()
 .setColor('#8B0000')
 .setTitle(' Private Channel Closed')
 .setDescription('Your private voice channel was closed because it became empty.')
 .addFields(
 { name: ' Channel', value: channel.name, inline: true },
 { name: ' Tip', value: 'Create a new one anytime with `/privatevc create`!', inline: false }
 )
 ]
 });
 } catch (error) {
 // Owner might have DMs disabled or left the server
 }
 }
 } catch (error) {
 console.error('Error checking empty channel:', error);
 }
 }, 30000); // 30 second delay
 }
 }
};

// Cleanup function for bot restart
module.exports.cleanupOnRestart = async (client) => {
 console.log('Cleaning up private channels on restart...');
 
 for (const [ownerId, info] of privateChannels.entries()) {
 try {
 const guild = client.guilds.cache.find(g => g.channels.cache.has(info.channelId));
 if (guild) {
 const channel = guild.channels.cache.get(info.channelId);
 if (channel) {
 await channel.delete('Bot restart - Private channel cleanup');
 }
 }
 } catch (error) {
 console.error(`Error cleaning up channel ${info.channelId}:`, error);
 }
 }
 
 privateChannels.clear();
 console.log('Private channels cleanup complete.');
};