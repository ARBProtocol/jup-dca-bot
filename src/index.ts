import fetch from "isomorphic-fetch";
import { Jupiter, TOKEN_LIST_URL } from "@jup-ag/core";
import { PublicKey, Connection } from "@solana/web3.js";
import * as cron from "node-cron";
import cronstrue from "cronstrue";
import {Token, MINT_ADDRESSES, USER_KEYPAIR, SOLANA_RPC_ENDPOINT} from "./constants";
import { dcaconfig } from './dcaconfig'

const jupiterSwap = async ({
  jupiter,
  inputToken,
  outputToken,
  inputAmount,
  slippage,
}: {
  jupiter: Jupiter;
  inputToken?: Token;
  outputToken?: Token;
  inputAmount: number;
  slippage: number;
}) => {
  try {
      if (!inputToken || !outputToken) {
          return null;
      }

      const inputAmountInSmallestUnits = inputToken 
        ? Math.round(inputAmount * 10 ** inputToken.decimals)
        : 0;
      const routes = inputToken && outputToken
        ? await jupiter.computeRoutes({
            inputMint: new PublicKey(inputToken.address),
            outputMint: new PublicKey(outputToken.address),
            inputAmount: inputAmountInSmallestUnits, // raw input amount of tokens
            slippage,
            forceFetch: true,
        })
        : null;

      if (routes && routes.routesInfos) {
        // Prepare execute exchange
        const { execute } = await jupiter.exchange({
          routeInfo: routes!.routesInfos[0],
        });
        // Execute swap
        // Force any to ignore TS misidentifying SwapResult type
        const swapResult: any = await execute();
        if (swapResult.error) {
          console.log(swapResult.error);
        } else {
          // trying to keep these on one line
          process.stdout.write(
            `${swapResult.inputAmount / (10 ** inputToken.decimals)} `
          ); 
          process.stdout.write(`${inputToken.symbol} -> `);
          process.stdout.write(
            `${swapResult.outputAmount / (10 ** outputToken.decimals)} `
          );
          process.stdout.write(`${outputToken.symbol}: `);
          console.log(`https://solscan.io/tx/${swapResult.txid}`);
        }
      } else {
        console.log("Error during jupiter.computeRoutes().");
      }
  } catch (error) {
    throw error;
  }
};

const main = async () => {
  try {
    console.log("Starting Jupiter DCA Bot");

    const cluster = "mainnet-beta"; // Force mainnet, as this uses Jupiter which is not deployed on devnet/testnet
    const connection = new Connection(SOLANA_RPC_ENDPOINT);
    const jupiter = await Jupiter.load({
        connection,
        cluster: cluster,
        user: USER_KEYPAIR,
    });

    // Fetch token list from Jupiter API
    const tokens: Token[] = await (await fetch(TOKEN_LIST_URL[cluster])).json();

    console.log("Warning! dcaconfig entries may be excluded due to:");
    console.log("- invalid cron expression");
    console.log("- inputToken or outputToken does not exist in MINT_ADDRESSES");
    console.log("Validating dcaconfig.ts ...");
    const filteredJobs = dcaconfig.filter(job => {
      return (cron.validate(job.cron) 
        && job.inputToken in MINT_ADDRESSES 
        && job.outputToken in MINT_ADDRESSES
      );
    });
    
    console.log("Scheduling swaps:");
    filteredJobs.map(job => {
      console.log(`${job.amount} ${job.inputToken} for ${job.outputToken} ${cronstrue.toString(job.cron)}`);
    });
    
    filteredJobs.forEach(job => {
      const inputToken = tokens.find((t) => 
        t.address == MINT_ADDRESSES[job.inputToken]
      );
      const outputToken = tokens.find((t) => 
        t.address == MINT_ADDRESSES[job.outputToken]
      );

      return cron.schedule(job.cron, async () => {
        await jupiterSwap({
          jupiter,
          inputToken,
          outputToken,
          inputAmount: job.amount,
          slippage: job.slippage, // % slippage
        });
      });
    });
  } catch (error) {
    console.log({ error });
  }
};

main();
