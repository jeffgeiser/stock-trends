const fetch = require('node-fetch');
const { DateTime } = require('luxon');
const fs = require('fs');
const express = require('express');
const app = express();
const port = 3000;

// Your code snippet goes here

// ... rest of the code

const polygonApiKey = 'hnMJp4oIlKDa_FNiTEvMJp8DlTfyDHt5';
const openaiApiKey = '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';

// Static list of stocks
// const stockSymbols = ['QQQ', 'AAPL'];

// Read stock symbols from file
const stockSymbols = fs.readFileSync('./api/stockSymbols.txt', 'utf-8')
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
async function findUptrendingStocks(stockSymbols) {
  console.log('Checking trends for stocks:', stockSymbols);
  const uptrendingStocks = [];
  const downtrendingStocks = [];

  for (const symbol of stockSymbols) {
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
    }
    if (trend === 'Downtrend') {
      console.log(`Found downtrend for ${symbol}`);
      downtrendingStocks.push(symbol);
    }
  }

  console.log('Finished checking trends for stocks');
  console.log('Downtrending stocks:', downtrendingStocks);
  return uptrendingStocks;
  
}


// async function generateArticle(stockSymbol) {
//   const prompt = `Write an article about the recent uptrend in ${stockSymbol} stock and discuss the factors contributing to its performance.`;
//   const response = await openai.Completion.create({
//     engine: 'text-davinci-002',
//     prompt,
//     max_tokens: 500,
//     n: 1,
//     stop: null,
//     temperature: 0.7,
//   });

//   const generatedArticle = response.choices[0].text.trim();
//   console.log(`Generated article for ${stockSymbol}:\n${generatedArticle}`);
//   return generatedArticle;
// }
// (async () => {
//   console.log('Starting to find uptrending stocks...');
//   const uptrendingStocks = await findUptrendingStocks(stockSymbols);
//   console.log('Uptrending stocks:', uptrendingStocks);
// })();


  // for (const stockSymbol of uptrendingStocks) {
  //   const article = await generateArticle(stockSymbol);
  //   console.log(`\nArticle for ${stockSymbol}:`);
  //   console.log(article);
  
  app.get('/', async (req, res) => {
    const uptrendingStocks = await findUptrendingStocks(stockSymbols);
    res.send(`<html>
      <head>
        <title>Uptrending Indexes and Stocks</title>
      </head>
      <body>
        <h1>Welcome to Uptrend or Downtrend</h1>
        <ul>
            ${uptrendingStocks.map(stock => `<li>${stock}</li>`).join('')}
          </ul>
      </body>
    </html>`);
  });

  // app.get('/uptrending-stocks', async (req, res) => {
  //   // const uptrendingStocks = await findUptrendingStocks(stockSymbols);
  //   res.send(`
  //     <html>
  //       <head>
  //         <title>Uptrending Stocks</title>
  //       </head>
  //       <body>
  //         <h1>Uptrending Stocks:</h1>
  //         <ul>
  //           ${uptrendingStocks.map(stock => `<li>${stock}</li>`).join('')}
  //         </ul>
  //       </body>
  //     </html>
  //   `);
  // });
  

  module.exports = app;

