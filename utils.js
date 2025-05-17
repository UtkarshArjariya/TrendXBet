// solana-betting-bot/utils.js
const fs = require('fs');
const { botWallet, checkPayment, sendSOL } = require('./solana');
const DB_FILE = './db.json';

const readDB = () => JSON.parse(fs.readFileSync(DB_FILE));
const writeDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

const getMatches = () => readDB().matches;

const addMatch = (teamA, teamB, oddsA, oddsB) => {
  const db = readDB();
  const id = 'match' + Date.now();
  db.matches.push({ id, teamA, teamB, oddsA, oddsB, status: 'open' });
  writeDB(db);
  return id;
};

const getMatch = (id) => getMatches().find((m) => m.id === id);

const placeBet = async (userId, username, matchId, team, amount) => {
  const db = readDB();
  const match = getMatch(matchId);
  if (!match) return 'Match not found.';
  if (!['open'].includes(match.status)) return 'Betting closed for this match.';
  if (![match.teamA, match.teamB].includes(team)) return 'Invalid team name.';

  const bet = {
    id: 'bet' + Date.now(),
    userId,
    username,
    matchId,
    team,
    amount,
    status: 'pending',
    payout: 0,
    userWallet: '', // to be updated manually or in future from msg
  };
  db.bets.push(bet);
  writeDB(db);

  return `✅ Bet registered. Send ${amount} SOL to:
${botWallet.publicKey.toBase58()}\nAfter payment, we will confirm and lock your bet.`;
};

const getBetsByMatch = (matchId) => {
  const db = readDB();
  return matchId ? db.bets.filter(b => b.matchId === matchId) : db.bets;
};

const setResult = async (matchId, winner) => {
  const db = readDB();
  const match = db.matches.find(m => m.id === matchId);
  if (!match) return 'Match not found';
  match.status = 'completed';
  match.winner = winner;

  let paid = 0;
  for (const bet of db.bets.filter(b => b.matchId === matchId && b.status === 'confirmed')) {
    if (bet.team === winner) {
      const odds = bet.team === match.teamA ? match.oddsA : match.oddsB;
      const payout = bet.amount * odds;
      if (bet.userWallet) {
        try {
          await sendSOL(bet.userWallet, payout);
          bet.status = 'paid';
          bet.payout = payout;
          paid++;
        } catch (err) {
          console.error('Payout failed', err);
        }
      }
    } else {
      bet.status = 'lost';
    }
  }

  writeDB(db);
  return `✅ Result updated. Paid ${paid} winners.`;
};

const confirmPaymentAndLockBet = async (userId, wallet, matchId, amount) => {
  const db = readDB();
  const bet = db.bets.find(b => b.userId === userId && b.matchId === matchId && b.amount === amount && b.status === 'pending');
  if (!bet) return 'No pending bet found.';
  const paid = await checkPayment(wallet, amount);
  if (paid) {
    bet.status = 'confirmed';
    bet.userWallet = wallet;
    writeDB(db);
    return '✅ Payment confirmed. Bet is locked.';
  }
  return '❌ No payment detected yet.';
};

module.exports = {
  getMatches,
  addMatch,
  placeBet,
  setResult,
  getBetsByMatch,
  confirmPaymentAndLockBet
};
