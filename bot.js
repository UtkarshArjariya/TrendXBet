require('dotenv').config();
const { Telegraf, Markup, session, Scenes } = require('telegraf');
const fs = require('fs');
const { Connection, PublicKey, clusterApiUrl } = require('@solana/web3.js');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Use session middleware
bot.use(session());

// === Helper Functions ===

function loadDB() {
  try {
    return JSON.parse(fs.readFileSync('db.json', 'utf8'));
  } catch (error) {
    // If db.json doesn't exist, create a default structure
    const defaultDB = {
      matches: [],
      bets: []
    };
    saveDB(defaultDB);
    return defaultDB;
  }
}

function saveDB(data) {
  fs.writeFileSync('db.json', JSON.stringify(data, null, 2));
}

function getConnection() {
  // Connect to Solana devnet
  return new Connection(clusterApiUrl('devnet'), 'confirmed');
}

// === Create Bet Scene ===

// Create a scene for handling bets
// === Create Bet Scene ===

// Create a scene for handling bets
const betScene = new Scenes.BaseScene('bet');

betScene.enter(async (ctx) => {
  const matchId = ctx.scene.state.matchId;
  const db = loadDB();
  const match = db.matches.find((m) => m.id === matchId);

  if (!match) {
    await ctx.reply('❌ Match not found.');
    return ctx.scene.leave();
  }

  await ctx.reply(
    `🎯 You selected ${match.teamA} vs ${match.teamB} (Odds: ${match.oddsA} - ${match.oddsB}).
    
Please reply with the team you want to bet on:
1. ${match.teamA}
2. ${match.teamB}

You can enter either the number (1 or 2) or the team name directly.`
  );
  
  ctx.scene.state.match = match;
  ctx.scene.state.step = 'team';
});

betScene.on('text', async (ctx) => {
  const { step, match } = ctx.scene.state;
  
  // Handle team selection
  if (step === 'team') {
    const input = ctx.message.text.trim();
    let team;
    
    // Check if input is "1" or "2"
    if (input === "1") {
      team = match.teamA;
    } else if (input === "2") {
      team = match.teamB;
    } else {
      // Or check if input matches the team names directly
      team = input;
    }
    
    if (![match.teamA, match.teamB].includes(team)) {
      return ctx.reply(`❌ Invalid input. Please choose 1 for ${match.teamA} or 2 for ${match.teamB}, or type the team name directly.`);
    }
    
    ctx.scene.state.team = team;
    ctx.scene.state.step = 'amount';
    
    return ctx.reply(`You selected ${team}. Now please enter the amount to bet (between 0.01 SOL and 1 SOL):`);
  }
  
  // Handle amount
  if (step === 'amount') {
    const amount = parseFloat(ctx.message.text.trim());
    
    if (isNaN(amount) || amount < 0.01 || amount > 1) {
      return ctx.reply('❌ Invalid amount. Please bet between 0.01 SOL and 1 SOL.');
    }
    
    ctx.scene.state.amount = amount;
    ctx.scene.state.step = 'wallet';
    
    return ctx.reply('Please provide your Solana wallet address to receive winnings:');
  }
  
  // Handle wallet address
  if (step === 'wallet') {
    const walletAddress = ctx.message.text.trim();
    
    // Basic validation for Solana addresses
    if (walletAddress.length !== 44 && walletAddress.length !== 43) {
      return ctx.reply('❌ Invalid wallet address. Please provide a valid Solana wallet address.');
    }
    
    // Now we have all the information, save the bet
    const { matchId, team, amount } = ctx.scene.state;
    
    // Generate a unique ID for the bet
    const betId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    
    const bet = {
      id: betId,
      matchId,
      team,
      amount,
      userId: ctx.from.id,
      userWallet: walletAddress,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    const db = loadDB();
    db.bets.push(bet);
    saveDB(db);
    
    // Provide payment instructions
    await ctx.reply(`✅ Bet registered!

📋 Bet Details:
🆔 ID: ${betId}
🏏 Match: ${match.teamA} vs ${match.teamB}
🏆 Team: ${team}
💰 Amount: ${amount} SOL

Please send exactly ${amount} SOL to the following address to confirm your bet:
\`${process.env.BOT_WALLET_ADDRESS}\`

Your bet will be automatically confirmed once payment is received.`);
    
    return ctx.scene.leave();
  }
});

betScene.on('message', (ctx) => {
  ctx.reply('Please send text messages only.');
});

betScene.on('text', async (ctx) => {
  const { step, match } = ctx.scene.state;
  
  // Handle team selection
  if (step === 'team') {
    const team = ctx.message.text.trim();
    
    if (![match.teamA, match.teamB].includes(team)) {
      return ctx.reply(`❌ Invalid team. Please choose between ${match.teamA} and ${match.teamB}.`);
    }
    
    ctx.scene.state.team = team;
    ctx.scene.state.step = 'amount';
    
    return ctx.reply(`You selected ${team}. Now please enter the amount to bet (between 0.01 SOL and 1 SOL):`);
  }
  
  // Handle amount
  if (step === 'amount') {
    const amount = parseFloat(ctx.message.text.trim());
    
    if (isNaN(amount) || amount < 0.01 || amount > 1) {
      return ctx.reply('❌ Invalid amount. Please bet between 0.01 SOL and 1 SOL.');
    }
    
    ctx.scene.state.amount = amount;
    ctx.scene.state.step = 'wallet';
    
    return ctx.reply('Please provide your Solana wallet address to receive winnings:');
  }
  
  // Handle wallet address
  if (step === 'wallet') {
    const walletAddress = ctx.message.text.trim();
    
    // Basic validation for Solana addresses
    if (walletAddress.length !== 44 && walletAddress.length !== 43) {
      return ctx.reply('❌ Invalid wallet address. Please provide a valid Solana wallet address.');
    }
    
    // Now we have all the information, save the bet
    const { matchId, team, amount } = ctx.scene.state;
    
    // Generate a unique ID for the bet
    const betId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    
    const bet = {
      id: betId,
      matchId,
      team,
      amount,
      userId: ctx.from.id,
      userWallet: walletAddress,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    const db = loadDB();
    db.bets.push(bet);
    saveDB(db);
    
    // Provide payment instructions
    await ctx.reply(`✅ Bet registered!

📋 Bet Details:
🆔 ID: ${betId}
🏏 Match: ${match.teamA} vs ${match.teamB}
🏆 Team: ${team}
💰 Amount: ${amount} SOL

Please send exactly ${amount} SOL to the following address to confirm your bet:
\`${process.env.BOT_WALLET_ADDRESS}\`

Your bet will be automatically confirmed once payment is received.`);
    
    return ctx.scene.leave();
  }
});

betScene.on('message', (ctx) => {
  ctx.reply('Please send text messages only.');
});

// Create stage with bet scene
const stage = new Scenes.Stage([betScene]);
bot.use(stage.middleware());

// === /start Command ===

bot.start((ctx) => {
  ctx.reply(
    `👋 Welcome to **BetSOL** — The Telegram Cricket Betting Bot built on Solana!

🚀 No login, no KYC. Just bet and win in SOL.

Available commands:
/matches – View upcoming matches
/mybets – See your bets

👇 Use the buttons below to get started:`,
    Markup.inlineKeyboard([
      [Markup.button.callback('🏏 View Matches', 'view_matches')],
      [Markup.button.callback('💰 My Bets', 'view_bets')],
      [Markup.button.callback('❓ How It Works', 'how_it_works')],
    ])
  );
});

// === Button Callbacks ===

bot.action('view_matches', (ctx) => {
  ctx.answerCbQuery();
  showMatches(ctx);
});

bot.action('view_bets', (ctx) => {
  ctx.answerCbQuery();
  showUserBets(ctx);
});

bot.action('how_it_works', (ctx) => {
  ctx.answerCbQuery();
  ctx.reply(`🧠 How It Works:
1. Use /matches to view available games.
2. Select a match and place a bet with your SOL wallet.
3. Watch the game and win if your team wins!
4. Winnings are sent directly to your wallet.

Min: 0.01 SOL | Max: 1 SOL
Admin will update result after match.`);
});

// === /addmatch Command (Admin Only) ===

bot.command('addmatch', (ctx) => {
  const isAdmin = String(ctx.from.id) === process.env.ADMIN_ID;
  if (!isAdmin) return ctx.reply('⛔ You are not authorized.');

  const input = ctx.message.text.split(' ').slice(1);
  if (input.length < 4) {
    return ctx.reply('❌ Usage: /addmatch TeamA TeamB OddsA OddsB\nExample: /addmatch India Pakistan 1.9 2.1');
  }

  const [teamA, teamB, oddsA, oddsB] = input;
  const db = loadDB();
  const match_id = 100 + db.matches.length;

  const newMatch = {
    id: match_id,
    teamA,
    teamB,
    oddsA: parseFloat(oddsA),
    oddsB: parseFloat(oddsB),
    status: 'open',
    createdAt: new Date().toISOString()
  };

  db.matches.push(newMatch);
  saveDB(db);

  ctx.reply(`✅ Match added!\n\n🆔 Match ID: ${match_id}\n🏏 ${teamA} vs ${teamB}\n🔢 Odds: ${teamA} (${oddsA}) | ${teamB} (${oddsB})`);
});

// === /setresult Command (Admin Only) ===

bot.command('setresult', (ctx) => {
  const isAdmin = String(ctx.from.id) === process.env.ADMIN_ID;
  if (!isAdmin) return ctx.reply('⛔ You are not authorized.');

  const input = ctx.message.text.split(' ').slice(1);
  if (input.length < 2) {
    return ctx.reply('❌ Usage: /setresult MatchID WinningTeam\nExample: /setresult 100 India');
  }

  const [matchId, winningTeam] = input;
  const matchIdNum = parseInt(matchId);
  
  const db = loadDB();
  const match = db.matches.find(m => m.id === matchIdNum);
  
  if (!match) {
    return ctx.reply('❌ Match not found.');
  }
  
  if (match.status !== 'open') {
    return ctx.reply('❌ This match is not open.');
  }
  
  if (![match.teamA, match.teamB].includes(winningTeam)) {
    return ctx.reply(`❌ Invalid team. Please choose between ${match.teamA} and ${match.teamB}.`);
  }
  
  // Update match status
  match.status = 'completed';
  match.winner = winningTeam;
  match.completedAt = new Date().toISOString();
  
  // Process all bets for this match
  const bets = db.bets.filter(b => b.matchId === matchIdNum && b.status === 'locked');
  let winningBets = 0;
  let losingBets = 0;
  
  for (const bet of bets) {
    if (bet.team === winningTeam) {
      bet.status = 'won';
      bet.payout = bet.amount * (winningTeam === match.teamA ? match.oddsA : match.oddsB);
      winningBets++;
    } else {
      bet.status = 'lost';
      losingBets++;
    }
  }
  
  saveDB(db);
  
  ctx.reply(`✅ Match result set!
🏏 ${match.teamA} vs ${match.teamB}
🏆 Winner: ${winningTeam}
📊 Bets: ${winningBets} winning, ${losingBets} losing

Use /payout to process payments to winners.`);
});

// === /payout Command (Admin Only) ===

bot.command('payout', async (ctx) => {
  const isAdmin = String(ctx.from.id) === process.env.ADMIN_ID;
  if (!isAdmin) return ctx.reply('⛔ You are not authorized.');

  const db = loadDB();
  const winningBets = db.bets.filter(b => b.status === 'won');
  
  if (winningBets.length === 0) {
    return ctx.reply('❌ No winning bets to pay out.');
  }
  
  // In a real implementation, this would interact with Solana to send payments
  // For now, we'll just mark them as paid
  for (const bet of winningBets) {
    bet.status = 'paid';
    bet.paidAt = new Date().toISOString();
    
    // Notify user
    try {
      await bot.telegram.sendMessage(
        bet.userId,
        `🎉 Congratulations! Your bet has won.
💰 Payout: ${bet.payout} SOL
🔄 Sent to: ${bet.userWallet}

Thanks for using BetSOL!`
      );
    } catch (error) {
      console.error(`Failed to notify user ${bet.userId}:`, error);
    }
  }
  
  saveDB(db);
  
  ctx.reply(`✅ Processed payouts for ${winningBets.length} winning bets.`);
});

// === /matches Command ===

bot.command('matches', (ctx) => {
  showMatches(ctx);
});

// === /mybets Command ===

bot.command('mybets', (ctx) => {
  showUserBets(ctx);
});

// Show available matches to users
function showMatches(ctx) {
  const db = loadDB();
  const openMatches = db.matches.filter(match => match.status === 'open');

  if (openMatches.length === 0) {
    return ctx.reply('🚫 No open matches at the moment.');
  }

  const matchButtons = openMatches.map((match) => [
    Markup.button.callback(`${match.teamA} vs ${match.teamB} | Odds: ${match.oddsA} - ${match.oddsB}`, `select_match_${match.id}`)
  ]);

  ctx.reply(
    '🎯 Here are the available matches to bet on:',
    Markup.inlineKeyboard(matchButtons)
  );
}

// Show user's bets
function showUserBets(ctx) {
  const db = loadDB();
  const userBets = db.bets.filter(bet => bet.userId === ctx.from.id);
  
  if (userBets.length === 0) {
    return ctx.reply('🚫 You have no bets yet.');
  }
  
  let message = '💼 Your bets:\n\n';
  
  for (const bet of userBets) {
    const match = db.matches.find(m => m.id === bet.matchId);
    if (!match) continue;
    
    let statusEmoji = '⏳';
    if (bet.status === 'locked') statusEmoji = '🔒';
    if (bet.status === 'won') statusEmoji = '🏆';
    if (bet.status === 'lost') statusEmoji = '❌';
    if (bet.status === 'paid') statusEmoji = '💰';
    
    message += `${statusEmoji} ${match.teamA} vs ${match.teamB}\n`;
    message += `    Team: ${bet.team}\n`;
    message += `    Amount: ${bet.amount} SOL\n`;
    message += `    Status: ${bet.status}\n`;
    
    if (bet.status === 'won' || bet.status === 'paid') {
      message += `    Payout: ${bet.payout} SOL\n`;
    }
    
    message += '\n';
  }
  
  ctx.reply(message);
}

// Handle match selection
bot.action(/^select_match_(\d+)$/, (ctx) => {
  ctx.answerCbQuery();
  const matchId = parseInt(ctx.match[1]);
  
  // Enter bet scene with matchId
  ctx.scene.enter('bet', { matchId });
});

// === Payment Detection ===

// === Enhanced Payment Detection with Debugging ===

// async function detectPayment() {
//   const connection = getConnection();
//   let db = loadDB();

//   // Log the wallet address to ensure it's correct
//   console.log('BOT_WALLET_ADDRESS:', process.env.BOT_WALLET_ADDRESS);

//   // Check if wallet address is valid
//   if (!process.env.BOT_WALLET_ADDRESS || process.env.BOT_WALLET_ADDRESS.length === 0) {
//     console.error('BOT_WALLET_ADDRESS is missing or invalid');
//     return;
//   }

//   const botWalletAddress = new PublicKey(process.env.BOT_WALLET_ADDRESS);

//   // Print pending bets
//   const pendingBets = db.bets.filter(bet => bet.status === 'pending');
//   console.log(`[PAYMENT] Found ${pendingBets.length} pending bets:`);
//   pendingBets.forEach(bet => {
//     console.log(`[PAYMENT] - Bet ID: ${bet.id}, Amount: ${bet.amount} SOL, Team: ${bet.team}`);
//   });

//   // Poll for new transactions every 5 seconds instead of 10
//   console.log('[PAYMENT] Starting transaction monitoring...');
  
//   setInterval(async () => {
//     try {
//       // Reload DB to ensure we have the latest data
//       db = loadDB();
      
//       console.log('[PAYMENT] Checking for new transactions...');
      
//       // Use getSignaturesForAddress with slightly more results
//       const recentTransactions = await connection.getSignaturesForAddress(
//         botWalletAddress,
//         { limit: 20 } // Increased from 10 to 20
//       );

//       console.log(`[PAYMENT] Found ${recentTransactions.length} recent transactions`);
      
//       // Look at each transaction
//       for (const tx of recentTransactions) {
//         console.log(`[PAYMENT] Processing transaction: ${tx.signature.slice(0, 10)}...`);
        
//         try {
//           // Check if we've already processed this transaction
//           const alreadyProcessed = db.bets.some(bet => bet.txSignature === tx.signature);
//           if (alreadyProcessed) {
//             console.log(`[PAYMENT] Transaction ${tx.signature.slice(0, 10)}... already processed, skipping`);
//             continue;
//           }
          
//           // Add maxSupportedTransactionVersion parameter
//           const transaction = await connection.getTransaction(tx.signature, {
//             commitment: 'confirmed',
//             maxSupportedTransactionVersion: 0
//           });

//           if (!transaction) {
//             console.log(`[PAYMENT] Transaction details not found for ${tx.signature.slice(0, 10)}...`);
//             continue;
//           }

//           // Calculate the actual amount transferred to the bot's wallet
//           const transferAmount = calculateTransferAmount(transaction, botWalletAddress);
//           console.log(`[PAYMENT] Calculated transfer amount: ${transferAmount} SOL`);
          
//           if (transferAmount <= 0) {
//             console.log(`[PAYMENT] No SOL received in this transaction, skipping`);
//             continue;
//           }

//           // Find pending bets that match this amount with some tolerance
//           // We'll use a more lenient match to account for potential rounding issues
//           const MATCH_TOLERANCE = 0.01; // 0.01 SOL tolerance
//           const matchingBets = db.bets.filter(
//             (b) => b.status === 'pending' && 
//                   Math.abs(b.amount - transferAmount) < MATCH_TOLERANCE
//           );

//           console.log(`[PAYMENT] Found ${matchingBets.length} bets matching amount ${transferAmount} SOL (with ${MATCH_TOLERANCE} SOL tolerance)`);

//           // If we find any matching bets, confirm the first one
//           if (matchingBets.length > 0) {
//             const bet = matchingBets[0];
//             console.log(`[PAYMENT] Confirming bet ID: ${bet.id} for user ${bet.userId}`);
//             bet.status = 'locked';
//             bet.txSignature = tx.signature;
//             bet.confirmedAt = new Date().toISOString();
//             saveDB(db);
            
//             try {
//               // Confirm the bet in the chat
//               await bot.telegram.sendMessage(
//                 bet.userId, 
//                 `✅ Payment received! Your bet of ${bet.amount} SOL is locked.
                
// Transaction: ${tx.signature}

// Good luck! 🍀`
//               );
//               console.log(`[PAYMENT] Confirmation message sent to user ${bet.userId}`);
//             } catch (telegramError) {
//               console.error(`[PAYMENT] Error sending confirmation message:`, telegramError);
//             }
            
//             // If multiple bets match this amount, log a warning
//             if (matchingBets.length > 1) {
//               console.warn(`[PAYMENT] Multiple bets match amount ${transferAmount}. Confirmed the first one, manual verification needed for others.`);
//             }
//           }
//         } catch (txError) {
//           console.error(`[PAYMENT] Error processing transaction ${tx.signature.slice(0, 10)}...`, txError);
//         }
//       }
//     } catch (error) {
//       console.error('[PAYMENT] Error in payment detection:', error);
//     }
//   }, 5000); // Poll every 5 seconds instead of 10
// }

// // Enhanced helper function to calculate the actual transfer amount with more logging
// function calculateTransferAmount(transaction, receiverAddress) {
//   if (!transaction || !transaction.meta) {
//     console.log('[PAYMENT] Transaction or meta data is missing');
//     return 0;
//   }
  
//   let transferAmount = 0;
  
//   // Check if there are any SOL transfers to our address
//   if (transaction.meta.postBalances && transaction.meta.preBalances) {
//     const accountKeys = transaction.transaction.message.accountKeys;
//     const receiverAddressStr = receiverAddress.toString();
    
//     // Log all accounts involved in the transaction
//     console.log('[PAYMENT] Accounts in transaction:');
//     accountKeys.forEach((key, index) => {
//       const keyStr = key.toString();
//       const isReceiver = keyStr === receiverAddressStr;
      
//       // Log pre and post balances
//       const pre = transaction.meta.preBalances[index] / 1e9;
//       const post = transaction.meta.postBalances[index] / 1e9;
//       const change = post - pre;
      
//       console.log(`[PAYMENT] Account ${index}: ${keyStr.slice(0, 10)}... | Pre: ${pre} SOL | Post: ${post} SOL | Change: ${change} SOL ${isReceiver ? '(BOT WALLET)' : ''}`);
//     });
    
//     // Find the index of our wallet address in the transaction
//     const receiverIndex = accountKeys.findIndex(
//       key => key.toString() === receiverAddressStr
//     );
    
//     if (receiverIndex >= 0) {
//       // Calculate how much SOL was received
//       const preBalance = transaction.meta.preBalances[receiverIndex];
//       const postBalance = transaction.meta.postBalances[receiverIndex];
//       transferAmount = (postBalance - preBalance) / 1e9; // Convert lamports to SOL
      
//       console.log(`[PAYMENT] Bot wallet balance change: ${transferAmount} SOL`);
//     } else {
//       console.log(`[PAYMENT] Bot wallet not found in transaction accounts`);
//     }
//   } else {
//     console.log('[PAYMENT] Transaction missing balance information');
//   }
  
//   return transferAmount;
// }`

// Start detecting payments
// detectPayment();

// === Start Bot ===

bot.launch();
console.log('🤖 Bot is running...');

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));