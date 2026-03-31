const mesgaCommand = require('./mesga');

module.exports = {
 data: mesgaCommand.buildMessageCommand('mesga'),
 execute: mesgaCommand.executeMessageCommand,
};