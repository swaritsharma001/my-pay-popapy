
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const DataMod = require('./DataMod.js');
const mongoose = require('mongoose');

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent, 
    GatewayIntentBits.GuildMembers
  ]
});

async function db() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

db();

client.once('ready', () => {
  console.log('Ready');
  client.user.setActivity('with 4,654,789 servers!', { type: 'STREAMING'})
});

const prefix = 'o';

function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content.toLowerCase().startsWith(prefix)) {
    const [cmd, ...args] = message.content
      .trim()
      .substring(prefix.length)
      .toLowerCase()
      .split(/\s+/);

    if (cmd === 'cash') {
      try {
        const Id = message.author.id;
        const data = await DataMod.findOne({ Id });

        if (data) {
          const formattedCash = formatNumber(data.Owo);
          await message.channel.send(`<:owocash:1422912345151115348> **| ${message.author.globalName}**, you currently have **__${formattedCash}__ cowoncy!**`);
        } else {
          await DataMod.create({ Id, Owo: '0' });
          await message.channel.send(`<:owocash:1422912345151115348> **| ${message.author.globalName}**, you currently have **__${formattedCash}__ cowoncy!**`);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        await message.reply('Failed to fetch data.');
      }
    }

    if (cmd === 'daily') {
      try {
        const Id = message.author.id;
        const data = await DataMod.findOne({ Id });
        const dailyCoin = 3000;

        if (data) {
          const newAmount = (parseInt(data.Owo) || 0) + dailyCoin;
          await DataMod.findOneAndUpdate({ Id }, { Owo: newAmount.toString() });
          const formattedDaily = formatNumber(dailyCoin);
          const formattedTotal = formatNumber(newAmount);
          await message.reply(`<:cowoncy:416043450337853441> **| ${message.author.globalName}**, you claimed your daily **__${formattedDaily}__ cowoncy!** You now have **__${formattedTotal}__ cowoncy!**`);
        } else {
          await DataMod.create({ Id, Owo: dailyCoin.toString() });
          const formattedDaily = formatNumber(dailyCoin);
          await message.reply(`<:cowoncy:416043450337853441> **| ${message.author.globalName}**, you claimed your daily **__${formattedDaily}__ cowoncy!**`);
        }
      } catch (error) {
        console.error('Error with daily command:', error);
        await message.reply('Failed to claim daily.');
      }
    }

    if (cmd === 'give'){
      const user = message.mentions.users.first();
      if (!user) return message.reply('**❌ | Please mention a user to give cowoncy to!**');

      const amount = parseInt(args[1]);
      if (isNaN(amount) || amount <= 0) return message.reply('**❌ | Please provide a valid amount!**');

      const data = await DataMod.findOne({ Id: message.author.id});
      if (!data) return message.reply('**❌ | You don\'t have an account yet!**');

      const target = await DataMod.findOne({ Id: user.id});
      if (!target) {
        await DataMod.create({ Id: user.id, Owo: '0' });
      }

      const currentAmount = parseInt(data.Owo) || 0;
      if (amount > currentAmount) {
        return message.reply(`**🚫 | ${message.author.globalName}**, you silly hooman! You don't have enough cowoncy!`);
      }

      // Create embed with proper styling
      const embed = new EmbedBuilder()
        .setColor(0x00A0D2) // Discord dark theme color
        .setAuthor({ name: `${message.author.globalName}, you are about to give cowoncy to ${user.globalName}`, iconURL: message.author.displayAvatarURL({ dynamic: true})})
        .setDescription(
          `To confirm this transaction, click ✅ Confirm.\n` +
          `To cancel this transaction, click ❌ Cancel.\n\n` +
          `⚠️ *It is against our rules to trade cowoncy for anything of monetary value. This includes real money, crypto, nitro, or anything similar. You will be* ***banned*** *for doing so.\n\n` +
          `<@${message.author.id}> will give <@${user.id}>:\n` +
    `\`\`\`${formatNumber(amount)} cowoncy\`\`\``
  
        )
        
        .setTimestamp()

      // Create buttons
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('confirm')
            .setLabel('Confirm')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅'),
          new ButtonBuilder()
            .setCustomId('cancel')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌')
        );

      const msg = await message.channel.send({ embeds: [embed], components: [row] });

      // Wait for button interaction
      const filter = (interaction) => {
        return ['confirm', 'cancel'].includes(interaction.customId) && interaction.user.id === message.author.id;
      };

      try {
        const interaction = await msg.awaitMessageComponent({ filter, time: 30000 });

        if (interaction.customId === 'confirm') {
          // Update database
          const newAmo = currentAmount - amount;
          const targetAmount = parseInt(target?.Owo || '0') + amount;

          await DataMod.findOneAndUpdate({ Id: message.author.id}, { Owo: newAmo.toString()});
          await DataMod.findOneAndUpdate({ Id: user.id}, { Owo: targetAmount.toString()});

          //update the same embed with some text like in footr write that user accespted
          embed.setColor(0x00FF00)
          embed.setFooter({ text: `${message.author.globalName} accepted`})

          await interaction.update({ 
            content: `💳 **| ${message.author.globalName}** sent **${formatNumber(amount)} cowoncy** to **${user.globalName}**! *(edited)*`,
            embeds: [embed]  ,
            components: []
          });
        } else {
          await interaction.update({ 
            content: `**❌ | Transaction cancelled.**`,
            embeds: [],
            components: []
          });
        }
      } catch (error) {
        await msg.edit({ 
          content: `**⏱️ | Transaction timed out.**`,
          embeds: [],
          components: []
        });
      }
    }
  }
});

client.login("MTQyMzE0MDg4OTU1NDg0NTc5OQ.GOn7Mv.l_ZT9CNsohQx-24UyeNb1wWDu2hx10Bp7LAO3w");
