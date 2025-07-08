import { useState, useEffect, useRef } from "react";

interface CryptoData {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  volume: number;
}

interface ExchangeRate {
  rates: {
    TWD: number;
  };
}

interface BinanceTickerData {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  quoteVolume: string;
}

interface BinanceWebSocketData {
  s: string; // symbol
  c: string; // close price
  P: string; // price change percent
  q: string; // quote volume
}

export function useCryptoData(searchTerm: string = "") {
  const [cryptoData, setCryptoData] = useState<CryptoData[]>([]);
  const [twdRate, setTwdRate] = useState<number>(31.5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const initialDataRef = useRef<CryptoData[]>([]);

  // Fetch initial crypto data from REST API
  const fetchInitialCryptoData = async () => {
    try {
      const response = await fetch(
        "https://api.binance.com/api/v3/ticker/24hr"
      );
      const data: BinanceTickerData[] = await response.json();

      const usdtPairs = data
        .filter((item: BinanceTickerData) => item.symbol.endsWith("USDT"))
        .map((item: BinanceTickerData) => ({
          symbol: item.symbol.replace("USDT", ""),
          name: item.symbol.replace("USDT", ""),
          price: parseFloat(item.lastPrice),
          changePercent: parseFloat(item.priceChangePercent),
          volume: parseFloat(item.quoteVolume),
        }))
        .sort((a: CryptoData, b: CryptoData) => b.volume - a.volume)
        .slice(0, 10);

      initialDataRef.current = usdtPairs;
      setCryptoData(usdtPairs);
      setLoading(false);
    } catch (err) {
      setError("Failed to fetch initial crypto data");
      console.error("Error fetching initial crypto data:", err);
      setLoading(false);
    }
  };

  // Fetch TWD exchange rate
  const fetchTwdRate = async () => {
    try {
      const response = await fetch(
        "https://api.exchangerate-api.com/v4/latest/USD"
      );
      const data: ExchangeRate = await response.json();
      setTwdRate(data.rates.TWD);
    } catch (err) {
      console.error("Error fetching TWD rate:", err);
    }
  };

  // Setup WebSocket connection
  const setupWebSocket = () => {
    // Get symbols for top 10 USDT pairs
    const symbols = initialDataRef.current
      .map((crypto) => `${crypto.symbol}USDT`)
      .map((s) => s.toLowerCase());

    // Create WebSocket connection to Binance stream
    const ws = new WebSocket(
      `wss://stream.binance.com:9443/ws/${symbols.join("@ticker/")}@ticker`
    );

    ws.onopen = () => {
      console.log("WebSocket connected");
    };

    ws.onmessage = (event) => {
      try {
        const data: BinanceWebSocketData = JSON.parse(event.data);

        setCryptoData((prevData) => {
          return prevData.map((crypto) => {
            if (crypto.symbol === data.s.replace("USDT", "")) {
              return {
                ...crypto,
                price: parseFloat(data.c),
                changePercent: parseFloat(data.P),
                volume: parseFloat(data.q),
              };
            }
            return crypto;
          });
        });
      } catch (err) {
        console.error("Error parsing WebSocket data:", err);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setError("WebSocket connection error");
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
      // Attempt to reconnect after 5 seconds
      setTimeout(() => {
        if (initialDataRef.current.length > 0) {
          setupWebSocket();
        }
      }, 5000);
    };

    wsRef.current = ws;
  };

  // Filter data based on search term
  const filteredData = cryptoData.filter(
    (crypto) =>
      crypto.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      crypto.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    // Fetch initial data and exchange rate
    fetchInitialCryptoData();
    fetchTwdRate();

    // Setup WebSocket after initial data is loaded
    const setupWebSocketAfterInitialData = () => {
      if (initialDataRef.current.length > 0) {
        setupWebSocket();
      } else {
        // Retry after 1 second if initial data isn't loaded yet
        setTimeout(setupWebSocketAfterInitialData, 1000);
      }
    };

    setupWebSocketAfterInitialData();

    // Cleanup WebSocket on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    cryptoData: filteredData,
    twdRate,
    loading,
    error,
  };
}
