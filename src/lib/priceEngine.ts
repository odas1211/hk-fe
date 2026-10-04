// HKFES Market Price Engine & WebSocket Consumer
// Connects to backend WebSocket price stream when live, with local fallback simulation.

import { useEffect, useRef, useCallback } from 'react';
import { usePriceStore, useTradesStore, useWalletStore, useNotificationsStore } from '../store';
import { WS_BASE_URL, getAuthToken } from './api';
import type { PriceTick } from '../store';

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface AssetConfig {
  symbol: string;
  displayName: string;
  assetClass: 'fx' | 'crypto' | 'equity' | 'index' | 'commodity';
  pipSize: number;
  minTradeSize: number;
  seedPrice: number;
}

export const ASSETS: AssetConfig[] = [
  // ── Commodities (Gold, Silver, Energy) ──
  { symbol: 'XAU/USD',  displayName: 'Gold Spot / USD',           assetClass: 'commodity', pipSize: 0.01,   minTradeSize: 10,  seedPrice: 2685.50 },
  { symbol: 'XAG/USD',  displayName: 'Silver Spot / USD',         assetClass: 'commodity', pipSize: 0.001,  minTradeSize: 10,  seedPrice: 31.85 },
  { symbol: 'WTI/USD',  displayName: 'Crude Oil (WTI) / USD',     assetClass: 'commodity', pipSize: 0.01,   minTradeSize: 10,  seedPrice: 71.40 },
  { symbol: 'BRENT/USD', displayName: 'Brent Crude Oil / USD',    assetClass: 'commodity', pipSize: 0.01,   minTradeSize: 10,  seedPrice: 75.20 },
  { symbol: 'NG/USD',   displayName: 'Natural Gas / USD',         assetClass: 'commodity', pipSize: 0.001,  minTradeSize: 10,  seedPrice: 2.85 },

  // ── Crypto (Proper High-Liquidity Coins) ──
  { symbol: 'BTC/USD',  displayName: 'Bitcoin',                   assetClass: 'crypto',    pipSize: 0.01,   minTradeSize: 10,  seedPrice: 63850 },
  { symbol: 'ETH/USD',  displayName: 'Ethereum',                  assetClass: 'crypto',    pipSize: 0.01,   minTradeSize: 10,  seedPrice: 3420 },
  { symbol: 'SOL/USD',  displayName: 'Solana',                    assetClass: 'crypto',    pipSize: 0.01,   minTradeSize: 10,  seedPrice: 152.40 },
  { symbol: 'BNB/USD',  displayName: 'BNB (Binance Coin)',        assetClass: 'crypto',    pipSize: 0.01,   minTradeSize: 10,  seedPrice: 585.00 },
  { symbol: 'XRP/USD',  displayName: 'XRP (Ripple)',              assetClass: 'crypto',    pipSize: 0.0001, minTradeSize: 10,  seedPrice: 0.5840 },
  { symbol: 'DOGE/USD', displayName: 'Dogecoin',                  assetClass: 'crypto',    pipSize: 0.0001, minTradeSize: 10,  seedPrice: 0.1285 },
  { symbol: 'ADA/USD',  displayName: 'Cardano',                   assetClass: 'crypto',    pipSize: 0.0001, minTradeSize: 10,  seedPrice: 0.3850 },
  { symbol: 'AVAX/USD', displayName: 'Avalanche',                 assetClass: 'crypto',    pipSize: 0.01,   minTradeSize: 10,  seedPrice: 28.40 },
  { symbol: 'DOT/USD',  displayName: 'Polkadot',                  assetClass: 'crypto',    pipSize: 0.01,   minTradeSize: 10,  seedPrice: 4.65 },
  { symbol: 'LINK/USD', displayName: 'Chainlink',                 assetClass: 'crypto',    pipSize: 0.01,   minTradeSize: 10,  seedPrice: 11.85 },
  { symbol: 'NEAR/USD', displayName: 'NEAR Protocol',             assetClass: 'crypto',    pipSize: 0.01,   minTradeSize: 10,  seedPrice: 4.95 },
  { symbol: 'SUI/USD',  displayName: 'Sui Network',               assetClass: 'crypto',    pipSize: 0.001,  minTradeSize: 10,  seedPrice: 1.75 },

  // ── Equities (Top Global Companies & Mega-Caps) ──
  { symbol: 'AAPL',     displayName: 'Apple Inc.',                assetClass: 'equity',    pipSize: 0.01,   minTradeSize: 10,  seedPrice: 228.40 },
  { symbol: 'NVDA',     displayName: 'NVIDIA Corp.',              assetClass: 'equity',    pipSize: 0.01,   minTradeSize: 10,  seedPrice: 125.60 },
  { symbol: 'MSFT',     displayName: 'Microsoft Corp.',           assetClass: 'equity',    pipSize: 0.01,   minTradeSize: 10,  seedPrice: 432.16 },
  { symbol: 'AMZN',     displayName: 'Amazon.com Inc.',           assetClass: 'equity',    pipSize: 0.01,   minTradeSize: 10,  seedPrice: 186.50 },
  { symbol: 'GOOGL',    displayName: 'Alphabet Inc. (Google)',    assetClass: 'equity',    pipSize: 0.01,   minTradeSize: 10,  seedPrice: 164.80 },
  { symbol: 'META',     displayName: 'Meta Platforms Inc.',       assetClass: 'equity',    pipSize: 0.01,   minTradeSize: 10,  seedPrice: 568.20 },
  { symbol: 'TSLA',     displayName: 'Tesla Inc.',                assetClass: 'equity',    pipSize: 0.01,   minTradeSize: 10,  seedPrice: 245.80 },
  { symbol: 'NFLX',     displayName: 'Netflix Inc.',              assetClass: 'equity',    pipSize: 0.01,   minTradeSize: 10,  seedPrice: 708.50 },
  { symbol: 'AMD',      displayName: 'Advanced Micro Devices',    assetClass: 'equity',    pipSize: 0.01,   minTradeSize: 10,  seedPrice: 156.40 },
  { symbol: 'BABA',     displayName: 'Alibaba Group',             assetClass: 'equity',    pipSize: 0.01,   minTradeSize: 10,  seedPrice: 88.60 },
  { symbol: 'COIN',     displayName: 'Coinbase Global',           assetClass: 'equity',    pipSize: 0.01,   minTradeSize: 10,  seedPrice: 216.50 },
  { symbol: 'PLTR',     displayName: 'Palantir Technologies',     assetClass: 'equity',    pipSize: 0.01,   minTradeSize: 10,  seedPrice: 38.20 },

  // ── FX Major Pairs ──
  { symbol: 'EUR/USD',  displayName: 'Euro / US Dollar',          assetClass: 'fx',        pipSize: 0.0001, minTradeSize: 100, seedPrice: 1.0821 },
  { symbol: 'GBP/USD',  displayName: 'British Pound / USD',       assetClass: 'fx',        pipSize: 0.0001, minTradeSize: 100, seedPrice: 1.2674 },
  { symbol: 'USD/JPY',  displayName: 'US Dollar / Yen',           assetClass: 'fx',        pipSize: 0.01,   minTradeSize: 100, seedPrice: 149.82 },
  { symbol: 'AUD/USD',  displayName: 'Australian Dollar / USD',   assetClass: 'fx',        pipSize: 0.0001, minTradeSize: 100, seedPrice: 0.6523 },
  { symbol: 'USD/CHF',  displayName: 'US Dollar / Swiss Franc',   assetClass: 'fx',        pipSize: 0.0001, minTradeSize: 100, seedPrice: 0.9012 },
  { symbol: 'USD/CAD',  displayName: 'US Dollar / Canadian $',    assetClass: 'fx',        pipSize: 0.0001, minTradeSize: 100, seedPrice: 1.3621 },
  { symbol: 'GBP/JPY',  displayName: 'British Pound / Yen',       assetClass: 'fx',        pipSize: 0.01,   minTradeSize: 100, seedPrice: 189.45 },
  { symbol: 'EUR/GBP',  displayName: 'Euro / British Pound',      assetClass: 'fx',        pipSize: 0.0001, minTradeSize: 100, seedPrice: 0.8538 },

  // ── World Indices ──
  { symbol: 'SPX500',   displayName: 'S&P 500 Index',             assetClass: 'index',     pipSize: 0.01,   minTradeSize: 10,  seedPrice: 5620 },
  { symbol: 'NAS100',   displayName: 'NASDAQ 100 Index',          assetClass: 'index',     pipSize: 0.01,   minTradeSize: 10,  seedPrice: 19780 },
  { symbol: 'US30',     displayName: 'Dow Jones 30 Index',        assetClass: 'index',     pipSize: 0.01,   minTradeSize: 10,  seedPrice: 42120 },
  { symbol: 'GER40',    displayName: 'DAX 40 (Germany)',          assetClass: 'index',     pipSize: 0.01,   minTradeSize: 10,  seedPrice: 18950 },
];

const VOLATILITIES: Record<string, number> = {
  // Commodities
  'XAU/USD': 0.0008, 'XAG/USD': 0.0015, 'WTI/USD': 0.0018, 'BRENT/USD': 0.0016, 'NG/USD': 0.0022,
  // Crypto
  'BTC/USD': 0.0025, 'ETH/USD': 0.003, 'SOL/USD': 0.0045, 'BNB/USD': 0.0028,
  'XRP/USD': 0.0040, 'DOGE/USD': 0.0055, 'ADA/USD': 0.0042, 'AVAX/USD': 0.0048,
  'DOT/USD': 0.0042, 'LINK/USD': 0.0040, 'NEAR/USD': 0.0045, 'SUI/USD': 0.0050,
  // Equities
  'AAPL': 0.001, 'NVDA': 0.0022, 'MSFT': 0.001, 'AMZN': 0.0015, 'GOOGL': 0.0012,
  'META': 0.0018, 'TSLA': 0.0025, 'NFLX': 0.0018, 'AMD': 0.0024, 'BABA': 0.0020,
  'COIN': 0.0032, 'PLTR': 0.0028,
  // FX
  'EUR/USD': 0.0004, 'GBP/USD': 0.0005, 'USD/JPY': 0.0004, 'AUD/USD': 0.0005,
  'USD/CHF': 0.0004, 'USD/CAD': 0.0004, 'GBP/JPY': 0.0006, 'EUR/GBP': 0.0004,
  // Indices
  'SPX500': 0.0006, 'NAS100': 0.0009, 'US30': 0.0006, 'GER40': 0.0007,
};

function randn(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function mapBackendTick(tick: any): PriceTick {
  return {
    symbol: tick.symbol,
    price: tick.price,
    bid: tick.bid ?? tick.price * 0.9999,
    ask: tick.ask ?? tick.price * 1.0001,
    change: tick.change24h ?? 0,
    changePct: tick.change24h ?? 0,
    high24h: tick.high24h ?? tick.price,
    low24h: tick.low24h ?? tick.price,
    volume24h: tick.volume24h ?? 0,
    timestamp: Date.now(),
    direction: tick.price > (tick.previousPrice ?? tick.price) ? 'up' : tick.price < (tick.previousPrice ?? tick.price) ? 'down' : 'flat',
  };
}

export class PriceEngine {
  private prices: Record<string, number> = {};
  private openPrices: Record<string, number> = {};
  private candles: Record<string, Candle[]> = {};
  private listeners: Set<(ticks: Record<string, PriceTick>) => void> = new Set();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private ws: WebSocket | null = null;
  private wsConnected = false;
  private paused = false;

  constructor() {
    this.initPrices();
    this.initCandles();
  }

  private initPrices() {
    for (const a of ASSETS) {
      this.prices[a.symbol] = a.seedPrice;
      this.openPrices[a.symbol] = a.seedPrice;
    }
  }

  private initCandles() {
    const now = Date.now();
    const candleDuration = 60 * 1000; // 1m candles
    for (const a of ASSETS) {
      const list: Candle[] = [];
      const cur = this.prices[a.symbol] || a.seedPrice;
      let p = cur;
      const vol = VOLATILITIES[a.symbol] || 0.001;
      const precision = a.pipSize < 0.01 ? 4 : 2;

      // Generate 70 historical candles backwards from current price to eliminate start gap
      for (let i = 0; i < 70; i++) {
        const time = now - i * candleDuration;
        const change = p * vol * randn() * 0.7;
        const open = p - change;
        const close = p;
        const high = Math.max(open, close) + Math.abs(randn()) * p * vol * 0.3;
        const low = Math.min(open, close) - Math.abs(randn()) * p * vol * 0.3;
        list.unshift({
          time,
          open: parseFloat(open.toFixed(precision)),
          high: parseFloat(high.toFixed(precision)),
          low: parseFloat(low.toFixed(precision)),
          close: parseFloat(close.toFixed(precision)),
          volume: Math.floor(100 + Math.random() * 500),
        });
        p = open;
      }
      // Guarantee exact 0-gap on active candle
      if (list.length > 0) {
        list[list.length - 1].close = cur;
      }
      this.candles[a.symbol] = list;
    }
  }

  public getCandles(symbol: string): Candle[] {
    return this.candles[symbol] || [];
  }

  public setCandles(symbol: string, candles: Candle[]) {
    if (candles && candles.length > 0) {
      this.candles[symbol] = candles;
    }
  }

  public start(intervalMs = 1000) {
    this.tryConnectWebSocket();

    if (this.intervalId) return;
    this.intervalId = setInterval(() => {
      if (this.paused) return;
      // If WebSocket is active and streaming, let WS drive updates.
      // Otherwise use fallback local GBM simulation.
      if (!this.wsConnected) {
        this.stepSimulation();
      }
    }, intervalMs);
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.wsConnected = false;
    }
  }

  public subscribe(callback: (ticks: Record<string, PriceTick>) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  public pause() {
    this.paused = true;
  }

  public resume() {
    this.paused = false;
  }

  public resetPrices() {
    this.initPrices();
    this.initCandles();
    this.emitCurrentTicks();
  }

  public injectSpike(symbol: string, magnitudePercent: number, direction: 'up' | 'down' | 'random') {
    const cur = this.prices[symbol];
    if (!cur) return;
    let sign = 1;
    if (direction === 'down') sign = -1;
    else if (direction === 'random') sign = Math.random() > 0.5 ? 1 : -1;

    const newPrice = cur * (1 + sign * (magnitudePercent / 100));
    this.prices[symbol] = newPrice;
    this.updateCandle(symbol, newPrice);
    this.emitCurrentTicks();
  }

  private stepSimulation() {
    const ticks: Record<string, PriceTick> = {};
    for (const a of ASSETS) {
      const vol = VOLATILITIES[a.symbol] || 0.001;
      const prev = this.prices[a.symbol] || a.seedPrice;
      const newP = prev * Math.exp(-0.5 * vol * vol / 86400 + vol * Math.sqrt(1 / 86400) * randn());
      this.prices[a.symbol] = newP;
      const change = newP - this.openPrices[a.symbol];
      const pipPrecision = a.pipSize <= 0.0001 ? 4 : a.pipSize <= 0.001 ? 3 : (a.seedPrice < 5 ? 3 : 2);


      ticks[a.symbol] = {
        symbol: a.symbol,
        price: parseFloat(newP.toFixed(pipPrecision)),
        bid: parseFloat((newP * 0.9999).toFixed(pipPrecision)),
        ask: parseFloat((newP * 1.0001).toFixed(pipPrecision)),
        change: parseFloat(change.toFixed(pipPrecision)),
        changePct: parseFloat(((change / this.openPrices[a.symbol]) * 100).toFixed(3)),
        high24h: newP,
        low24h: newP,
        volume24h: 0,
        timestamp: Date.now(),
        direction: newP > prev ? 'up' : newP < prev ? 'down' : 'flat',
      };

      this.updateCandle(a.symbol, newP);
    }

    usePriceStore.getState().setTicks(ticks);
    useTradesStore.getState().updateTradePrices(ticks);
    for (const listener of this.listeners) {
      listener(ticks);
    }
  }

  public updateCandle(symbol: string, price: number) {
    const cList = this.candles[symbol];
    if (!cList || cList.length === 0) return;
    const last = cList[cList.length - 1];
    const now = Date.now();
    if (now - last.time > 60 * 1000) {
      // New 1m candle starting at previous close for seamless continuity (0 gap)
      cList.push({
        time: now,
        open: last.close,
        high: Math.max(last.close, price),
        low: Math.min(last.close, price),
        close: price,
        volume: 1,
      });
      if (cList.length > 200) cList.shift();
    } else {
      // Update current active candle
      last.close = price;
      last.high = Math.max(last.high, price);
      last.low = Math.min(last.low, price);
      last.volume += 1;
    }
  }

  private emitCurrentTicks() {
    const ticks: Record<string, PriceTick> = {};
    for (const a of ASSETS) {
      const p = this.prices[a.symbol] || a.seedPrice;
      const prev = this.openPrices[a.symbol] || a.seedPrice;
      const change = p - prev;
      const pipPrecision = a.pipSize <= 0.0001 ? 4 : a.pipSize <= 0.001 ? 3 : (a.seedPrice < 5 ? 3 : 2);

      ticks[a.symbol] = {
        symbol: a.symbol,
        price: parseFloat(p.toFixed(pipPrecision)),
        bid: parseFloat((p * 0.9999).toFixed(pipPrecision)),
        ask: parseFloat((p * 1.0001).toFixed(pipPrecision)),
        change: parseFloat(change.toFixed(pipPrecision)),
        changePct: parseFloat(((change / prev) * 100).toFixed(3)),
        high24h: p,
        low24h: p,
        volume24h: 0,
        timestamp: Date.now(),
        direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
      };
    }
    usePriceStore.getState().setTicks(ticks);
    useTradesStore.getState().updateTradePrices(ticks);
    for (const listener of this.listeners) {
      listener(ticks);
    }
  }

  public authenticate(token: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: 'auth', token }));
    }
  }

  private tryConnectWebSocket() {
    if (this.ws || typeof WebSocket === 'undefined') return;
    try {
      this.ws = new WebSocket(WS_BASE_URL);
      this.ws.onopen = () => {
        this.wsConnected = true;
        const token = getAuthToken();
        if (token && this.ws) {
          this.ws.send(JSON.stringify({ action: 'auth', token }));
        }
      };
      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if ((msg.type === 'snapshot' || msg.type === 'tick') && Array.isArray(msg.data)) {
            const ticks: Record<string, PriceTick> = { ...usePriceStore.getState().ticks };
            for (const item of msg.data) {
              const mapped = mapBackendTick(item);
              this.prices[mapped.symbol] = mapped.price;

              // Calibrate historical candle baseline if starting price differed from real market
              const cList = this.candles[mapped.symbol];
              if (cList && cList.length > 0) {
                const lastC = cList[cList.length - 1];
                if (Math.abs(lastC.close - mapped.price) / mapped.price > 0.03) {
                  const ratio = mapped.price / lastC.close;
                  const prec = mapped.price < 5 ? 4 : 2;
                  for (const c of cList) {
                    c.open = Number((c.open * ratio).toFixed(prec));
                    c.high = Number((c.high * ratio).toFixed(prec));
                    c.low = Number((c.low * ratio).toFixed(prec));
                    c.close = Number((c.close * ratio).toFixed(prec));
                  }
                }
              }

              this.updateCandle(mapped.symbol, mapped.price);
              ticks[mapped.symbol] = mapped;
            }
            usePriceStore.getState().setTicks(ticks);
            useTradesStore.getState().updateTradePrices(ticks);
            for (const listener of this.listeners) {
              listener(ticks);
            }
          } else if (msg.type === 'order_filled') {
            useTradesStore.getState().fetchPositions();
            useWalletStore.getState().fetchWallet();
            useNotificationsStore.getState().addNotification({
              type: 'order_filled',
              title: 'Order Executed',
              message: msg.message || 'Your pending order was executed.',
              symbol: msg.trade?.assetSymbol,
            });
          } else if (msg.type === 'position_closed') {
            useTradesStore.getState().fetchPositions();
            useTradesStore.getState().fetchHistory();
            useWalletStore.getState().fetchWallet();
            useNotificationsStore.getState().addNotification({
              type: 'order_filled',
              title: `${msg.reason || 'Position'} Triggered`,
              message: msg.message || 'Position was closed.',
              symbol: msg.trade?.assetSymbol,
            });
          }
        } catch {
          // ignore malformed ws packet
        }
      };
      this.ws.onclose = () => {
        this.wsConnected = false;
        this.ws = null;
      };
      this.ws.onerror = () => {
        this.wsConnected = false;
      };
    } catch {
      this.wsConnected = false;
      this.ws = null;
    }
  }
}

export const priceEngine = new PriceEngine();
export const fallbackPriceEngine = priceEngine;

export function usePriceWebSocket() {
  const setTicks = usePriceStore(s => s.setTicks);
  const updateTradePrices = useTradesStore(s => s.updateTradePrices);

  useEffect(() => {
    priceEngine.start(1000);
    const unsub = priceEngine.subscribe((ticks) => {
      setTicks(ticks);
      updateTradePrices(ticks);
    });
    return () => {
      unsub();
    };
  }, [setTicks, updateTradePrices]);
}
