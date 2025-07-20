dayjs.extend(window.dayjs_plugin_utc);
dayjs.extend(window.dayjs_plugin_timezone);

async function handleMessage(message) {
  console.log(`Command received: ${message}`);
}
browser.runtime.onMessage.addListener(handleMessage);

// async function handleCommand(command) {
//   console.log(`Command received: ${command}`);
// }
// browser.commands.onCommand.addListener(handleCommand);
