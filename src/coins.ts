export interface Coin {
  sym: string; // тикер, пара завжди до USDT
  name: string;
  color: string;
  def: number; // запасна ціна, якщо ще жодного разу не було інтернету
  vol: number; // коефіцієнт волатильності для симуляції
}

export const COINS: Coin[] = [
  { sym: 'BTC', name: 'Bitcoin', color: '#f7931a', def: 95000, vol: 1 },
  { sym: 'ETH', name: 'Ethereum', color: '#627eea', def: 3300, vol: 1.2 },
  { sym: 'BNB', name: 'BNB', color: '#f3ba2f', def: 650, vol: 1.1 },
  { sym: 'SOL', name: 'Solana', color: '#9945ff', def: 180, vol: 1.6 },
  { sym: 'XRP', name: 'XRP', color: '#3aa0d8', def: 2.2, vol: 1.5 },
  { sym: 'DOGE', name: 'Dogecoin', color: '#c2a633', def: 0.22, vol: 1.9 },
  { sym: 'ADA', name: 'Cardano', color: '#3468d1', def: 0.7, vol: 1.6 },
  { sym: 'TRX', name: 'TRON', color: '#ef0027', def: 0.25, vol: 1.1 },
  { sym: 'AVAX', name: 'Avalanche', color: '#e84142', def: 30, vol: 1.8 },
  { sym: 'TON', name: 'Toncoin', color: '#0098ea', def: 4, vol: 1.6 },
  { sym: 'LINK', name: 'Chainlink', color: '#2a5ada', def: 17, vol: 1.7 },
  { sym: 'DOT', name: 'Polkadot', color: '#e6007a', def: 5, vol: 1.7 },
  { sym: 'SHIB', name: 'Shiba Inu', color: '#ffa409', def: 0.000015, vol: 2.1 },
  { sym: 'LTC', name: 'Litecoin', color: '#6f87b5', def: 95, vol: 1.4 },
  { sym: 'BCH', name: 'Bitcoin Cash', color: '#8dc351', def: 420, vol: 1.5 },
  { sym: 'NEAR', name: 'NEAR Protocol', color: '#00c08b', def: 3.5, vol: 1.9 },
  { sym: 'UNI', name: 'Uniswap', color: '#ff007a', def: 8, vol: 1.8 },
  { sym: 'APT', name: 'Aptos', color: '#2ed8a7', def: 7, vol: 1.9 },
  { sym: 'ICP', name: 'Internet Computer', color: '#f15a24', def: 7, vol: 1.9 },
  { sym: 'ETC', name: 'Ethereum Classic', color: '#33b25a', def: 22, vol: 1.6 },
  { sym: 'FIL', name: 'Filecoin', color: '#0090ff', def: 4, vol: 1.9 },
  { sym: 'ATOM', name: 'Cosmos', color: '#6f7390', def: 6, vol: 1.7 },
  { sym: 'ARB', name: 'Arbitrum', color: '#28a0f0', def: 0.6, vol: 2 },
  { sym: 'OP', name: 'Optimism', color: '#ff0420', def: 1.2, vol: 2 },
  { sym: 'SUI', name: 'Sui', color: '#4da2ff', def: 3, vol: 2 },
  { sym: 'PEPE', name: 'Pepe', color: '#4c9540', def: 0.00001, vol: 2.6 },
  { sym: 'XLM', name: 'Stellar', color: '#7d8a99', def: 0.3, vol: 1.6 },
  { sym: 'HBAR', name: 'Hedera', color: '#8259ef', def: 0.2, vol: 1.8 },
  { sym: 'INJ', name: 'Injective', color: '#00c2e0', def: 15, vol: 2.1 },
  { sym: 'AAVE', name: 'Aave', color: '#b6509e', def: 220, vol: 1.8 },
];

export const COIN: Record<string, Coin> = Object.fromEntries(COINS.map((c) => [c.sym, c]));
