'use client'

import { useEffect, useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface OrderBookChartProps {
    symbol: string
}

interface OrderBookData {
    price: number
    quantity: number
    side: 'buy' | 'sell'
}

export function OrderBookChart({ symbol }: OrderBookChartProps) {
    const [orderBookData, setOrderBookData] = useState<OrderBookData[]>([])
    const [buyRatio, setBuyRatio] = useState<number>(0)
    const [sellRatio, setSellRatio] = useState<number>(0)
    const [isLoading, setIsLoading] = useState(true)
    const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date())
    const wsRef = useRef<WebSocket | null>(null)
    const currentOrderBookRef = useRef<{ bids: OrderBookData[], asks: OrderBookData[] }>({ bids: [], asks: [] })
    const lastValidDataRef = useRef<{ bids: OrderBookData[], asks: OrderBookData[] }>({ bids: [], asks: [] })
    const connectionRetryCount = useRef(0)
    const maxRetries = 5

    // 即時更新函數 - 移除 debounce 延遲
    const updateOrderBook = (buyOrders: OrderBookData[], sellOrders: OrderBookData[]) => {
        // 合併現有數據和新的更新數據
        const currentBids = currentOrderBookRef.current.bids
        const currentAsks = currentOrderBookRef.current.asks

        // 創建價格映射以便快速查找和更新
        const bidMap = new Map<number, OrderBookData>()
        const askMap = new Map<number, OrderBookData>()

        // 先添加現有數據
        currentBids.forEach(bid => bidMap.set(bid.price, bid))
        currentAsks.forEach(ask => askMap.set(ask.price, ask))

        // 更新或添加新的買單數據
        buyOrders.forEach(bid => {
            if (bid.quantity > 0) {
                bidMap.set(bid.price, bid)
            } else {
                bidMap.delete(bid.price) // 數量為0表示刪除該價格層級
            }
        })

        // 更新或添加新的賣單數據
        sellOrders.forEach(ask => {
            if (ask.quantity > 0) {
                askMap.set(ask.price, ask)
            } else {
                askMap.delete(ask.price) // 數量為0表示刪除該價格層級
            }
        })

        // 轉換回數組並排序
        const updatedBids = Array.from(bidMap.values())
            .sort((a, b) => b.price - a.price) // 買單按價格降序排列
            .slice(0, 20) // 只保留前20個

        const updatedAsks = Array.from(askMap.values())
            .sort((a, b) => a.price - b.price) // 賣單按價格升序排列
            .slice(0, 20) // 只保留前20個

        // 數據驗證：確保買賣價格不重疊
        const highestBid = updatedBids[0]?.price || 0
        const lowestAsk = updatedAsks[0]?.price || 0

        if (highestBid > 0 && lowestAsk > 0 && highestBid >= lowestAsk) {
            // 過濾掉無效的價格層級
            const validBids = updatedBids.filter(bid => bid.price < lowestAsk)
            const validAsks = updatedAsks.filter(ask => ask.price > highestBid)

            if (validBids.length > 0 && validAsks.length > 0) {
                currentOrderBookRef.current = { bids: validBids, asks: validAsks }
            } else {
                // 使用最後的有效數據作為備用
                if (lastValidDataRef.current.bids.length > 0 || lastValidDataRef.current.asks.length > 0) {
                    currentOrderBookRef.current = { ...lastValidDataRef.current }
                } else {
                    return
                }
            }
        } else {
            // 更新 ref
            currentOrderBookRef.current = { bids: updatedBids, asks: updatedAsks }
        }

        // 保存有效數據作為備用
        if (currentOrderBookRef.current.bids.length > 0 || currentOrderBookRef.current.asks.length > 0) {
            lastValidDataRef.current = { ...currentOrderBookRef.current }
        }

        // 計算新的比例
        const totalBuyVolume = currentOrderBookRef.current.bids.reduce((sum, order) => sum + order.quantity, 0)
        const totalSellVolume = currentOrderBookRef.current.asks.reduce((sum, order) => sum + order.quantity, 0)
        const totalVolume = totalBuyVolume + totalSellVolume

        const buyRatioValue = totalVolume > 0 ? (totalBuyVolume / totalVolume) * 100 : 0
        const sellRatioValue = totalVolume > 0 ? (totalSellVolume / totalVolume) * 100 : 0

        // 立即更新狀態
        setBuyRatio(buyRatioValue)
        setSellRatio(sellRatioValue)
        setOrderBookData([...currentOrderBookRef.current.bids, ...currentOrderBookRef.current.asks])
        setLastUpdateTime(new Date())
    }

    // Fetch order book data
    const fetchOrderBook = async () => {
        try {
            const symbolPair = `${symbol}USDT`
            const response = await fetch(`https://api.binance.com/api/v3/depth?symbol=${symbolPair}&limit=20`)

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            const data = await response.json()

            // Process order book data with validation
            const buyOrders: OrderBookData[] = data.bids
                .map((bid: [string, string]) => ({
                    price: parseFloat(bid[0]),
                    quantity: parseFloat(bid[1]),
                    side: 'buy'
                }))
                .filter((order: OrderBookData) =>
                    order.quantity > 0 &&
                    order.price > 0 &&
                    !isNaN(order.price) &&
                    !isNaN(order.quantity) &&
                    order.price > 1 // Filter out very low prices
                )

            const sellOrders: OrderBookData[] = data.asks
                .map((ask: [string, string]) => ({
                    price: parseFloat(ask[0]),
                    quantity: parseFloat(ask[1]),
                    side: 'sell'
                }))
                .filter((order: OrderBookData) =>
                    order.quantity > 0 &&
                    order.price > 0 &&
                    !isNaN(order.price) &&
                    !isNaN(order.quantity) &&
                    order.price > 1 // Filter out very low prices
                )

            // 初始化 currentOrderBookRef
            currentOrderBookRef.current = { bids: buyOrders, asks: sellOrders }

            // 使用新的更新函數
            updateOrderBook(buyOrders, sellOrders)
            setIsLoading(false)

            console.log('Order book data fetched and initialized')
        } catch (error) {
            console.error('Error fetching order book:', error)
            setIsLoading(false)
        }
    }

    // Setup WebSocket for real-time updates
    const setupWebSocket = () => {
        if (wsRef.current) {
            wsRef.current.close()
        }

        // 嘗試多種流格式
        const streamFormats = [
            `${symbol.toLowerCase()}usdt@depth20@100ms`,
            `${symbol.toLowerCase()}usdt@depth@100ms`,
            `${symbol.toLowerCase()}usdt@depth20`
        ]

        const streamName = streamFormats[0] // 優先使用100ms更新頻率
        const wsUrl = `wss://stream.binance.com:9443/ws/${streamName}`

        console.log('🔌 Attempting WebSocket connection with format:', streamName)
        console.log('🔌 WebSocket URL:', wsUrl)
        console.log('🔌 Alternative formats:', streamFormats.slice(1))

        const ws = new WebSocket(wsUrl)

        // Add connection timeout
        const connectionTimeout = setTimeout(() => {
            if (ws.readyState === WebSocket.CONNECTING) {
                console.log('⏰ WebSocket connection timeout, closing...')
                ws.close()
            }
        }, 10000)

        ws.onopen = () => {
            clearTimeout(connectionTimeout)
            console.log('✅ Order book WebSocket connected successfully')
            console.log('✅ WebSocket readyState:', ws.readyState)
            console.log('✅ Using stream format:', streamName)
        }

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)

                if (data.e === 'depthUpdate') {
                    // 簡化處理：直接處理所有深度更新
                    const updatedBuyOrders: OrderBookData[] = data.b
                        .map((bid: [string, string]) => ({
                            price: parseFloat(bid[0]),
                            quantity: parseFloat(bid[1]),
                            side: 'buy'
                        }))
                        .filter((order: OrderBookData) =>
                            order.quantity >= 0 && // 允許數量為0（表示刪除）
                            order.price > 0 &&
                            !isNaN(order.price) &&
                            !isNaN(order.quantity) &&
                            order.price > 1
                        )

                    const updatedSellOrders: OrderBookData[] = data.a
                        .map((ask: [string, string]) => ({
                            price: parseFloat(ask[0]),
                            quantity: parseFloat(ask[1]),
                            side: 'sell'
                        }))
                        .filter((order: OrderBookData) =>
                            order.quantity >= 0 && // 允許數量為0（表示刪除）
                            order.price > 0 &&
                            !isNaN(order.price) &&
                            !isNaN(order.quantity) &&
                            order.price > 1
                        )

                    // 檢查是否有數據並立即更新
                    if (updatedBuyOrders.length > 0 || updatedSellOrders.length > 0) {
                        updateOrderBook(updatedBuyOrders, updatedSellOrders)
                    }
                }
            } catch (error) {
                console.error('❌ Error parsing WebSocket data:', error)
            }
        }

        ws.onerror = (error) => {
            clearTimeout(connectionTimeout)
            console.error('❌ Order book WebSocket error:', error)
            console.error('❌ WebSocket readyState:', ws.readyState)
            // Fallback to REST API
            console.log('🔄 Falling back to REST API for order book data')
            fetchOrderBook()
        }

        ws.onclose = (event) => {
            clearTimeout(connectionTimeout)
            console.log('🔌 Order book WebSocket disconnected')
            console.log('🔌 Close event code:', event.code, 'reason:', event.reason)

            // Only reconnect for normal closures or network issues
            if (event.code === 1000 || event.code === 1001 || event.code === 1006) {
                if (connectionRetryCount.current < maxRetries) {
                    connectionRetryCount.current++
                    console.log(`🔄 Attempting to reconnect order book WebSocket... (${connectionRetryCount.current}/${maxRetries})`)
                    setTimeout(() => {
                        setupWebSocket()
                    }, 3000)
                } else {
                    console.log('❌ Max retry attempts reached, falling back to REST API')
                    connectionRetryCount.current = 0
                    // Fallback to REST API with interval
                    const interval = setInterval(() => {
                        fetchOrderBook()
                    }, 2000) // 減少到2秒
                    return () => clearInterval(interval)
                }
            } else {
                console.log('🔌 WebSocket closed with code:', event.code, '- not reconnecting')
                connectionRetryCount.current = 0
                // Fallback to REST API with interval
                console.log('🔄 Setting up REST API fallback with 2-second interval')
                const interval = setInterval(() => {
                    fetchOrderBook()
                }, 2000) // 減少到2秒
                return () => clearInterval(interval)
            }
        }

        wsRef.current = ws
    }


    useEffect(() => {
        if (!symbol) return

        console.log('🔄 Setting up order book for symbol:', symbol)

        // 先獲取初始數據
        fetchOrderBook()

        // 立即建立WebSocket連接，不延遲
        setupWebSocket()

        // 添加定期檢查，確保數據更新
        const checkInterval = setInterval(() => {
            // 如果超過10秒沒有更新，重新獲取數據（減少到10秒）
            const timeSinceLastUpdate = Date.now() - lastUpdateTime.getTime()
            if (timeSinceLastUpdate > 10000) {
                console.log('⚠️ No updates for 10 seconds, refreshing data')
                fetchOrderBook()
            }
        }, 2000) // 減少檢查間隔到2秒

        return () => {
            console.log('🧹 Cleaning up order book WebSocket and intervals')
            clearInterval(checkInterval)
            if (wsRef.current) {
                wsRef.current.close()
            }
        }
    }, [symbol])

    const buyOrders = orderBookData.filter(order => order.side === 'buy').slice(0, 10)
    const sellOrders = orderBookData.filter(order => order.side === 'sell').slice(0, 10)

    const maxVolume = Math.max(
        ...buyOrders.map(order => order.quantity),
        ...sellOrders.map(order => order.quantity)
    )

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="text-sm lg:text-lg">{symbol}/USDT 委託訂單</CardTitle>
                <div className="text-xs text-muted-foreground">
                    最後更新: {lastUpdateTime.toLocaleTimeString()}
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Buy/Sell Ratio Display */}
                <div className="flex items-center justify-center space-x-4">
                    <div className="text-center">
                        <div className="text-lg lg:text-xl font-bold text-green-600">{buyRatio.toFixed(2)}%</div>
                        <div className="text-xs text-muted-foreground">買入</div>
                    </div>

                    <div className="flex-1 max-w-xs">
                        <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
                            <div
                                className="absolute left-0 top-0 h-full bg-green-100 rounded-l-full transition-all duration-300"
                                style={{ width: `${buyRatio}%` }}
                            />
                            <div
                                className="absolute right-0 top-0 h-full bg-red-100 rounded-r-full transition-all duration-300"
                                style={{ width: `${sellRatio}%` }}
                            />
                        </div>
                    </div>

                    <div className="text-center">
                        <div className="text-lg lg:text-xl font-bold text-red-600">{sellRatio.toFixed(2)}%</div>
                        <div className="text-xs text-muted-foreground">賣出</div>
                    </div>
                </div>

                {/* Order Book Display - Mobile Optimized */}
                <div className="space-y-2">
                    {/* Header */}
                    <div className="grid grid-cols-2 gap-4 text-xs font-medium">
                        <div className="text-green-600">買入訂單</div>
                        <div className="text-red-600 text-right">賣出訂單</div>
                    </div>

                    {/* Order Rows */}
                    {Array.from({ length: Math.max(buyOrders.length, sellOrders.length) }, (_, index) => {
                        const buyOrder = buyOrders[index]
                        const sellOrder = sellOrders[index]

                        return (
                            <div key={index} className="grid grid-cols-2">
                                {/* Buy Order */}
                                <div className="flex items-center space-x-2">
                                    <div className="text-[10px] text-muted-foreground min-w-0 flex-shrink-0">
                                        {buyOrder ? buyOrder.quantity.toFixed(5) : '-'}
                                    </div>
                                    <div className="flex-1 relative">
                                        <div
                                            className="h-6 bg-green-100 rounded-l transition-all duration-300 ml-auto"
                                            style={{
                                                width: buyOrder ? `${(buyOrder.quantity / maxVolume) * 100}%` : '0%',
                                                minWidth: '10px'
                                            }}
                                        />
                                        <div className="absolute inset-0 flex items-center justify-end px-2">
                                            <div className="text-[10px] font-medium text-green-600 truncate">
                                                {buyOrder ? buyOrder.price.toFixed(2) : '-'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Sell Order */}
                                <div className="flex items-center space-x-2">
                                    <div className="flex-1 relative">
                                        <div
                                            className="h-6 bg-red-100 rounded-r transition-all duration-300"
                                            style={{
                                                width: sellOrder ? `${(sellOrder.quantity / maxVolume) * 100}%` : '0%',
                                                minWidth: '10px'
                                            }}
                                        />
                                        <div className="absolute inset-0 flex items-center justify-start px-2">
                                            <div className="text-[10px] font-medium text-red-600 truncate">
                                                {sellOrder ? sellOrder.price.toFixed(2) : '-'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground min-w-0 flex-shrink-0">
                                        {sellOrder ? sellOrder.quantity.toFixed(5) : '-'}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {isLoading && (
                    <div className="flex items-center justify-center py-4">
                        <div className="text-sm text-muted-foreground">載入委託訂單中...</div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
} 