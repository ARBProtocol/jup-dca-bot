import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import 'dotenv/config'

export const SOLANA_RPC_ENDPOINT: string = process.env.RPC_ENDPOINT!;
export const WRAP_UNWRAP_SOL: boolean =  process.env.WRAP_UNWRAP_SOL === undefined ? true : process.env.WRAP_UNWRAP_SOL === "true";
export const tradingEnabled: boolean = process.env.TRADING_ENABLED === undefined ? true : process.env.TRADING_ENABLED === "true";
export const tradingRetries: number = process.env.TRADING_RETRIES  === undefined ? 0 : Number(process.env.TRADING_RETRIES);

// Wallets
export const WALLET_PRIVATE_KEY =
  process.env.WALLET_PRIVATE_KEY || "PASTE YOUR WALLET PRIVATE KEY";
export const USER_PRIVATE_KEY = bs58.decode(WALLET_PRIVATE_KEY);
export const USER_KEYPAIR = Keypair.fromSecretKey(USER_PRIVATE_KEY);

// mainnet-beta mints only
// for list, see: https://solscan.io/tokens
export const MINT_ADDRESSES: { [key: string]: string } = {
  "SOL": "So11111111111111111111111111111111111111112",
  "USDC": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "USDT": "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
};

// Interface
export interface Token {
  chainId: number; // 101,
  address: string; // '8f9s1sUmzUbVZMoMh6bufMueYH1u4BJSM57RCEvuVmFp',
  symbol: string; // 'TRUE',
  name: string; // 'TrueSight',
  decimals: number; // 9,
  logoURI: string; // 'https://i.ibb.co/pKTWrwP/true.jpg',
  tags: string[]; // [ 'utility-token', 'capital-token' ]
}

export interface DcaConfig {
  name?: string;
  inputToken: string;
  outputToken: string;
  amount: number;
  slippage: number;
  cron: string;
}
