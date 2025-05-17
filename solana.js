// solana-betting-bot/solana.js
require('dotenv').config();
const { Connection, clusterApiUrl, Keypair, LAMPORTS_PER_SOL, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } = require('@solana/web3.js');

// Set up the Solana connection
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

// Load the bot's private key from the .env file and convert it to Uint8Array
const secretKey = Uint8Array.from([235,145,158,31,85,153,111,216,121,216,14,22,206,122,148,236,5,108,130,240,79,151,175,132,216,83,52,107,209,184,161,53,242,74,7,125,174,27,175,127,116,153,71,137,157,153,246,4,76,95,224,212,104,110,174,213,205,72,244,206,149,166,237,216]);

// Create the bot wallet from the private key
const botWallet = Keypair.fromSecretKey(secretKey);

// Function to check the balance of the bot's wallet
const getBalance = async () => {
  const balance = await connection.getBalance(botWallet.publicKey);
  return balance / LAMPORTS_PER_SOL; // Convert balance from lamports to SOL
};

// Function to check if the payment has been received from a specific wallet
const checkPayment = async (fromPubkey, amount) => {
  const sigs = await connection.getSignaturesForAddress(botWallet.publicKey, { limit: 20 });
  for (let sig of sigs) {
    const tx = await connection.getTransaction(sig.signature, { commitment: 'confirmed' });
    if (!tx) continue;
    const from = tx.transaction.message.accountKeys[0].toBase58();
    const sol = tx.meta.postBalances[1] - tx.meta.preBalances[1];
    if (from === fromPubkey && sol === amount * LAMPORTS_PER_SOL) {
      return true; // Payment is correct
    }
  }
  return false; // No matching payment found
};

// Function to send SOL to a specific wallet
const sendSOL = async (toPubkeyStr, amount) => {
  const toPubkey = new PublicKey(toPubkeyStr);
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: botWallet.publicKey,
      toPubkey,
      lamports: amount * LAMPORTS_PER_SOL // Convert SOL to lamports
    })
  );
  const signature = await sendAndConfirmTransaction(connection, transaction, [botWallet]);
  return signature; // Return the transaction signature
};

module.exports = {
  botWallet,
  getBalance,
  checkPayment,
  sendSOL,
  connection
};
