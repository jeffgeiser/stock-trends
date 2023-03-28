const path = require('path');
const fetch = require('node-fetch');
const { DateTime } = require('luxon');
const fs = require('fs');
const express = require('express');
const app = express();
const port = 3000;
const FileSync = require('lowdb/adapters/FileSync');



let db;
let tally;

(async () => {
  const lowdb = await import('lowdb');
  const adapter = new FileSync.default('./db.json');
  db = lowdb(adapter);
  db.defaults({ uptrend: {}, downtrend: {}, sideways: {} }).write();
  
  // Read the tally from the file system and store it in a variable
  tally = db.getState();
})();




// Your code snippet goes here

// ... rest of the code

const polygonApiKey = 'hnMJp4oIlKDa_FNiTEvMJp8DlTfyDHt5';
const openaiApiKey = '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';

// Static list of stocks
// const stockSymbols = ['QQQ', 'AAPL'];

// Read stock symbols from file
const stocksymbolsPath = path.join(__dirname, 'stocksymbols.txt');
const stocksymbols = fs.readFileSync(stocksymbolsPath, 'utf-8')
  .trim()
  .split('\n');

// Fetch stock data from polygon.io
async function getStockData(indexSymbol, days = 45) {
  const endDate = DateTime.now();
  const startDate = endDate.minus({ days });
  const url = `https://api.polygon.io/v2/aggs/ticker/${indexSymbol}/range/1/day/${startDate.toISODate()}/${endDate.toISODate()}?adjusted=true&sort=asc&limit=120&apiKey=${polygonApiKey}`;

  const response = await fetch(url);
  const json = await response.json();

  if (!json.results) {
    console.error(`Error fetching data for ${indexSymbol}: ${JSON.stringify(json)}`);
    return [];
  }

  return json.results;
}

// Calculate the simple moving average (SMA)
function sma(data, window) {
  return data.reduce((sum, val) => sum + val, 0) / window;
}

// Calculate the MACD (Moving Average Convergence Divergence)
function macd(data) {
  const shortWindow = 12;
  const longWindow = 26;
  const emaShort = sma(data.slice(-shortWindow), shortWindow);
  const emaLong = sma(data.slice(-longWindow), longWindow);
  return emaShort - emaLong;
}

// Analyze the trend
async function analyzeTrend(symbol) {
  const data = await getStockData(symbol);

  if (!data || data.length < 26) {
    return 'Insufficient data';
  }

  const closePrices = data.map((d) => d.c);
  const currentPrice = closePrices[closePrices.length - 1];
  const sma10 = sma(closePrices.slice(-10), 10);
  const macdValue = macd(closePrices);

  if (currentPrice > sma10 && macdValue > 0) {
    return 'Uptrend';
  } else if (currentPrice < sma10 && macdValue < 0) {
    return 'Downtrend';
  } else {
    return 'No trend';
  }
}

// Identify uptrending stocks

async function findUptrendingStocks(stocksymbols, tally) {
  console.log('Checking trends for stocks:', stocksymbols);
  const uptrendingStocks = [];
  const downtrendingStocks = [];
  const sidewaysStocks = [];
  
  // Use the tally passed in as a parameter instead of reading from the file system
  for (const symbol of stocksymbols) {
    console.log(`Checking trend for ${symbol}`);
    const trend = await analyzeTrend(symbol);
    console.log(`Trend for ${symbol}: ${trend}`);

    if (trend === 'Insufficient data') {
      console.log(`Insufficient data for ${symbol}. Skipping.`);
      continue;
    }

    if (trend === 'Uptrend') {
      console.log(`Found uptrend for ${symbol}`);
      uptrendingStocks.push(symbol);
      tally.uptrend[symbol] = (tally.uptrend[symbol] || 0) + 1;
      delete tally.downtrend[symbol];
      delete tally.sideways[symbol];
    } else if (trend === 'Downtrend') {
      console.log(`Found downtrend for ${symbol}`);
      downtrendingStocks.push(symbol);
      tally.downtrend[symbol] = (tally.downtrend[symbol] || 0) + 1;
      delete tally.uptrend[symbol];
      delete tally.sideways[symbol];
    } else {
      console.log(`No clear trend for ${symbol}`);
      sidewaysStocks.push(symbol);
      tally.sideways[symbol] = (tally.sideways[symbol] || 0) + 1;
      delete tally.uptrend[symbol];
      delete tally.downtrend[symbol];
    }
  } 


 
// Write the updated tally back to the file
fs.writeFileSync(tallyPath, JSON.stringify(tally, null, 2));


return { uptrendingStocks, downtrendingStocks, sidewaysStocks, tally };
  
}



  
  app.get('/', async (req, res) => {
    const { uptrendingStocks, downtrendingStocks, sidewaysStocks } = await findUptrendingStocks(stocksymbols, tally);
  res.send(`<html>
    <head>
      <title>Is Market in Uptrend?</title>
    </head>
     <body>
      <!-- ... -->
      <h2>Uptrending Stocks</h2>
      <ul>
        ${uptrendingStocks.map(stock => `<li>${stock} (in uptrend for ${tally.uptrend[stock]} days)</li>`).join('')}
      </ul>
      <h2>Downtrending Stocks</h2>
      <ul>
        ${downtrendingStocks.map(stock => `<li>${stock} (in downtrend for ${tally.downtrend[stock]} days)</li>`).join('')}
      </ul>
      <h2>Sideways Stocks</h2>
      <ul>
        ${sidewaysStocks.map(stock => `<li>${stock} (sideways for ${tally.sideways[stock]} days)</li>`).join('')}
      </ul>
      <!-- ... -->
    </body>
    </html>`);
  });

  

  module.exports = app;

