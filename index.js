const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const TOKEN = 'MTUzMDQyOTYyMTU4MDA3NTA2OQ.G9FqXA.e_cI6fT3iiTKfbAbgMoes5KPpk9YYghT6GQYaM';
const GUILD_ID = '1530429842544263309';
const PREFIX = '!';

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  console.log(message)
  if (message.author.bot) return;
  if (!message.guild || message.guild.id !== GUILD_ID) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args.shift()?.toLowerCase();

  if (command === 'dm') {
    const count = parseInt(args[0], 10);

    if (!count || count <= 0) {
      return message.reply('Usage: !dm 3');
    }

    await message.guild.members.fetch();

    const members = message.guild.members.cache
      .filter(
        (m) =>
          !m.user.bot &&
          m.id !== message.author.id &&
          m.id !== client.user.id
      )
      .map((m) => m);

    // Shuffle
    members.sort(() => Math.random() - 0.5);

    let sent = 0;

    for (const member of members.slice(0, count)) {
      try {
        await member.send('Hii, JOIN OUR NEW SERVER https://discord.gg/2hSzwzBxW4');
        sent++;
      } catch (err) {
        console.log(`Could not DM ${member.user.tag}`);
      }
    }

    message.reply(`DM sent to ${sent} member(s).`);
  }
});

client.login(TOKEN);
