require("dotenv").config();

import fetch from "isomorphic-fetch";
import { Jupiter, TOKEN_LIST_URL, SwapMode } from "@jup-ag/core";
import { PublicKey, Connection } from "@solana/web3.js";
import * as cron from "node-cron";
import cronstrue from "cronstrue";
import {Token, MINT_ADDRESSES, USER_KEYPAIR, SOLANA_RPC_ENDPOINT, WRAP_UNWRAP_SOL, tradingEnabled, tradingRetries} from "./constants";
import { dcaconfig } from './dcaconfig'
import JSBI from 'jsbi';

// Simple delay function
function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}

// Date time logging object
function ptst() {
    let timestsmp: String = new Date().toLocaleString();
    return timestsmp;
}

// Add colour to console text
function setcolour(ctxt: string, colnum: number) {
    return ('\x1b['+colnum+'m'+ctxt+'\x1b[0m');
}

// Jupiter swap code
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
        ? JSBI.BigInt(Math.round(inputAmount * 10 ** inputToken.decimals))
        : JSBI.BigInt(0);
    
      const routes = inputToken && outputToken
        ? await jupiter.computeRoutes({
            inputMint: new PublicKey(inputToken.address),
            outputMint: new PublicKey(outputToken.address),
            amount: inputAmountInSmallestUnits,
            slippageBps: slippage,
            feeBps: 0,
            forceFetch: true,
            onlyDirectRoutes: false,
            filterTopNResult: 2,
            enforceSingleTx: false,
            swapMode: SwapMode.ExactIn,
        })
        : null;

      if (tradingEnabled){

          // handle transaction retries
          let i: number = 0;

          do {
            process.stdout.write( await ptst() + " - recurring DCA Swap Attempt #" + (i+1) )
            i++;

            try {
      
             const routes = inputToken && outputToken
            ? await jupiter.computeRoutes({
                inputMint: new PublicKey(inputToken.address),
                outputMint: new PublicKey(outputToken.address),
                amount: inputAmountInSmallestUnits,
                slippageBps: slippage,
                feeBps: 0,
                forceFetch: true,
                onlyDirectRoutes: false,
                filterTopNResult: 1,
                enforceSingleTx: false,
                swapMode: SwapMode.ExactIn,
            })
            : null;

            if (routes && routes.routesInfos) {
           
                console.log(" - " + routes.routesInfos.length + ' routes found');

                const { execute } = await jupiter.exchange({
                  routeInfo: routes!.routesInfos[0],
                });
                // Execute swap
                // Force any to ignore TS misidentifying SwapResult type
                const swapResult: any = await execute();

                if (swapResult.error) {
                   //console.log(swapResult.error);
                   let swaperr = String(swapResult.error);
                   let simpleerror = setcolour(swaperr.split('\n',1)[0],33);
                   console.log(await ptst() + " - " + simpleerror);
                } else {
                  // trying to keep these on one line
                  process.stdout.write(await ptst() + " - ");

                  process.stdout.write(
                    setcolour(`${swapResult.inputAmount / (10 ** inputToken.decimals)} `,32)
                  );
                 process.stdout.write(`${inputToken.symbol} -> `);
                process.stdout.write(
                    setcolour(`${swapResult.outputAmount / (10 ** outputToken.decimals)} `,32)
                  );
                process.stdout.write(`${outputToken.symbol}: `);
                  console.log(`https://solscan.io/tx/${swapResult.txid}`);
                  break; // exit retry loop
                }

              } else {
                console.log(await ptst() + " - Error during jupiter.computeRoutes().");
              }

        } catch (error) {
          console.log('Failure in route loop lookup.');
          throw error;
        }

        await delay(5000); // wait for 5 second between attempts

        } while ( i< tradingRetries)



      } else {
        console.log("Trading not enabled. You need to enable it in the .env for swaps to take place.");
      }


  } catch (error) {
    console.log('Throw error check on tokens');
    throw error;
  }
};              
              
              
const main = async () => {
  try {
    console.log(setcolour("Starting Jupiter V3 DCA Bot",92));
    console.log("The bot will retry "+String(tradingRetries)+" times if the swap fails for each scheduled period.");
    
    const cluster = "mainnet-beta"; // Force mainnet, as this uses Jupiter which is not deployed on devnet/testnet
    const connection = new Connection(SOLANA_RPC_ENDPOINT);
    const jupiter = await Jupiter.load({
        connection,
        cluster: cluster,
        user: USER_KEYPAIR,
        restrictIntermediateTokens: true,
        shouldLoadSerumOpenOrders: false,
        wrapUnwrapSOL: WRAP_UNWRAP_SOL,
        ammsToExclude: {
          Lifinity: false,
          GooseFX: true,
          'Raydium CLMM': false,
          Serum: true,
          Cropper: false,
          Cykura: false,
          Invariant: false,
          'Marco Polo': false,
          Openbook: false,
          Balansol: false,
          DeltaFi: false,
          Meteora: false,
          Crema: true,
          Step: false,
          Saber: false,
          Sencha: false,
          Raydium: false,
          Mercurial: false,
          Aldrin: false,
          Dradex: true,
          'Lifinity V2': false,
        }
    });

    // Fetch token list from Jupiter API
    const tokens: Token[] = await (await fetch(TOKEN_LIST_URL[cluster])).json();

    console.log("Warning! dcaconfig entries may be excluded if there are errors with the:");
    console.log("- invalid cron expression");
    console.log("- inputToken or outputToken does not exist in MINT_ADDRESSES");
    console.log("Validating dcaconfig.ts ...");

    // separator
    console.log('-----------------------------');  
    
    const filteredJobs = dcaconfig.filter(job => {
      return (cron.validate(job.cron) 
        && job.inputToken in MINT_ADDRESSES 
        && job.outputToken in MINT_ADDRESSES
      );
    });
    
    console.log("Scheduling swaps:");
    filteredJobs.map(job => {
      console.log(setcolour(String(job.amount),32) + ` ${job.inputToken} for ${job.outputToken} ${cronstrue.toString(job.cron)}`);
    });

    // separator
    console.log('-----------------------------');
    
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
