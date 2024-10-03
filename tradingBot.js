import WebSocket from 'ws';
import moment from 'moment';

// Configuration
const CONFIG = {
  TOKEN: 'crvdv61r01qkji45ioh0crvdv61r01qkji45iohg',
  SYMBOL: 'AAPL',
  BUY_THRESHOLD: -0.0001, 
  SELL_THRESHOLD: 0.0002, 
  INITIAL_BALANCE: 10000
};

class TradingBot {
  constructor(config) {
    this.config = config;
    this.ws = new WebSocket(`wss://ws.finnhub.io?token=${this.config.TOKEN}`);
    this.lastPrice = null;
    this.position = null; // 'buy' or null
    this.balance = this.config.INITIAL_BALANCE;
    this.shares = 0;
    this.initialPrice = null;
    this.trades = [];

    this.setupWebSocket();
    this.setupExitHandler();
  }

  setupWebSocket() {
    this.ws.on('open', () => this.subscribe(this.config.SYMBOL));
    this.ws.on('message', (data) => this.handleMessage(data));
    this.ws.on('error', (error) => console.error('WebSocket error:', error));
    this.ws.on('close', () => console.log('WebSocket connection closed'));
  }

  setupExitHandler() {
    process.on('SIGINT', () => {
      this.printSummary();
      this.unsubscribe(this.config.SYMBOL);
      this.ws.close();
      process.exit(0);
    });
  }

  subscribe(symbol) {
    this.ws.send(JSON.stringify({ type: 'subscribe', symbol }));
  }

  unsubscribe(symbol) {
    this.ws.send(JSON.stringify({ type: 'unsubscribe', symbol }));
  }

  handleMessage(data) {
    try {
      const response = JSON.parse(data);
      if (response.type === 'trade') {
        this.handleTradeData(response.data);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  }

  handleTradeData(trades) {
    trades.forEach(trade => {
      const { p: price, t: timestamp, s: symbol } = trade;
      this.logTrade(price, timestamp, symbol);
      this.updatePrice(price);
      this.checkAndExecuteTrade(price);
    });
  }

  logTrade(price, timestamp, symbol) {
    const formattedTime = moment(timestamp).format('YYYY-MM-DD HH:mm:ss');
    console.log(`Price: ${price}, Time: ${formattedTime}, Symbol: ${symbol}`);
    this.trades.push({ price, timestamp, symbol });
  }

  updatePrice(price) {
    if (this.lastPrice === null) {
      this.lastPrice = price;
      this.initialPrice = price;
    }
    this.lastPrice = price;
  }

  checkAndExecuteTrade(price) {
    if (this.lastPrice === null) return; // Ensure lastPrice is set

    const priceChange = ((price - this.initialPrice) / this.initialPrice) * 100;

    if (this.position === null && priceChange <= this.config.BUY_THRESHOLD) {
        this.executeBuy(price);
    } else if (this.position === 'buy' && priceChange >= this.config.SELL_THRESHOLD) {
        this.executeSell(price);
    }
  }

  executeBuy(price) {
    this.shares = this.balance / price;
    this.balance = 0;
    this.position = 'buy';
    console.log(`Bought ${this.shares.toFixed(2)} shares at ${price}`);
  }

  executeSell(price) {
    this.balance = this.shares * price;
    this.shares = 0;
    this.position = null;
    console.log(`Sold ${this.shares.toFixed(2)} shares at ${price}`);
  }

  printSummary() {
    const currentBalance = this.balance + (this.shares * this.lastPrice);
    const profitLoss = currentBalance - this.config.INITIAL_BALANCE;
    const percentageChange = ((currentBalance / this.config.INITIAL_BALANCE) - 1) * 100;

    console.log('\n--- Trading Summary ---');
    console.log(`Initial Balance: $${this.config.INITIAL_BALANCE.toFixed(2)}`);
    console.log(`Final Balance: $${currentBalance.toFixed(2)}`);
    console.log(`Profit/Loss: $${profitLoss.toFixed(2)} (${percentageChange.toFixed(2)}%)`);
    console.log(`Number of Trades: ${this.trades.length}`);
    console.log(`Current Position: ${this.position ? 'Holding' : 'None'}`);
    if (this.position) {
      console.log(`Shares Held: ${this.shares.toFixed(2)}`);
    }
    console.log('----------------------');
  }
}

// Create and start the trading bot
const bot = new TradingBot(CONFIG);

console.log('Trading bot started. Press Ctrl+C to exit and view summary.');