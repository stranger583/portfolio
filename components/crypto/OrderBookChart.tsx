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
    const wsRef = useRef<WebSocket | null>(null)
    const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    // Debounced update function to prevent rapid changes
    const debouncedUpdate = (buyOrders: OrderBookData[], sellOrders: OrderBookData[]) => {
        if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current)
        }

        updateTimeoutRef.current = setTimeout(() => {
            // Calculate new ratios
            const totalBuyVolume = buyOrders.reduce((sum, order) => sum + order.quantity, 0)
            const totalSellVolume = sellOrders.reduce((sum, order) => sum + order.quantity, 0)
            const totalVolume = totalBuyVolume + totalSellVolume

            const buyRatioValue = totalVolume > 0 ? (totalBuyVolume / totalVolume) * 100 : 0
            const sellRatioValue = totalVolume > 0 ? (totalSellVolume / totalVolume) * 100 : 0

            console.log('Debounced update - Buy:', buyRatioValue.toFixed(2) + '%', 'Sell:', sellRatioValue.toFixed(2) + '%')

            setBuyRatio(buyRatioValue)
            setSellRatio(sellRatioValue)
            setOrderBookData([...buyOrders, ...sellOrders])
        }, 100) // 100ms debounce
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

            // Calculate total volumes
            const totalBuyVolume = buyOrders.reduce((sum, order) => sum + order.quantity, 0)
            const totalSellVolume = sellOrders.reduce((sum, order) => sum + order.quantity, 0)
            const totalVolume = totalBuyVolume + totalSellVolume

            // Calculate ratios
            const buyRatioValue = totalVolume > 0 ? (totalBuyVolume / totalVolume) * 100 : 0
            const sellRatioValue = totalVolume > 0 ? (totalSellVolume / totalVolume) * 100 : 0

            setBuyRatio(buyRatioValue)
            setSellRatio(sellRatioValue)
            setOrderBookData([...buyOrders, ...sellOrders])
            setIsLoading(false)

            console.log('Order book data fetched:', { buyRatio: buyRatioValue, sellRatio: sellRatioValue })
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

        // Try different stream formats
        const streamName1 = `${symbol.toLowerCase()}usdt@depth20`
        const streamName2 = `${symbol.toLowerCase()}usdt@miniTicker`
        const wsUrl = `wss://stream.binance.com:9443/ws/${streamName1}`

        console.log('Connecting to order book WebSocket:', wsUrl)
        console.log('Stream name:', streamName1)
        console.log('Alternative stream name:', streamName2)

        const ws = new WebSocket(wsUrl)

        // Add connection timeout
        const connectionTimeout = setTimeout(() => {
            if (ws.readyState === WebSocket.CONNECTING) {
                console.log('WebSocket connection timeout, closing...')
                ws.close()
            }
        }, 10000)

        ws.onopen = () => {
            clearTimeout(connectionTimeout)
            console.log('✅ Order book WebSocket connected successfully')
            console.log('WebSocket readyState:', ws.readyState)
        }

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                console.log('📨 Order book WebSocket message received:', data)

                if (data.e === 'depthUpdate') {
                    console.log('📊 Depth update detected')
                    console.log('Bids:', data.b)
                    console.log('Asks:', data.a)

                    // Update order book with real-time data and validation
                    const updatedBuyOrders: OrderBookData[] = data.b
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

                    const updatedSellOrders: OrderBookData[] = data.a
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

                    console.log('Updated buy orders:', updatedBuyOrders.length)
                    console.log('Updated sell orders:', updatedSellOrders.length)

                    // Only update if we have valid data
                    if (updatedBuyOrders.length > 0 || updatedSellOrders.length > 0) {
                        // Use debounced update to prevent flashing
                        debouncedUpdate(updatedBuyOrders, updatedSellOrders)
                    } else {
                        console.log('⚠️ No valid order book data received, skipping update')
                    }
                } else if (data.e === '24hrTicker') {
                    console.log('📊 24hr ticker update - refreshing order book data')
                    // Fallback to REST API if WebSocket depth doesn't work
                    fetchOrderBook()
                } else {
                    console.log('📨 Other message type:', data.e)
                }
            } catch (error) {
                console.error('❌ Error parsing WebSocket data:', error)
                console.error('Raw data:', event.data)
            }
        }

        ws.onerror = (error) => {
            clearTimeout(connectionTimeout)
            console.error('❌ Order book WebSocket error:', error)
            console.log('WebSocket readyState:', ws.readyState)
            // Fallback to REST API
            console.log('🔄 Falling back to REST API for order book data')
            fetchOrderBook()
        }

        ws.onclose = (event) => {
            clearTimeout(connectionTimeout)
            console.log('🔌 Order book WebSocket disconnected')
            console.log('Close event code:', event.code, 'reason:', event.reason)

            // Only reconnect for normal closures or network issues
            if (event.code === 1000 || event.code === 1001 || event.code === 1006) {
                console.log('🔄 Attempting to reconnect order book WebSocket...')
                setTimeout(() => {
                    setupWebSocket()
                }, 3000)
            } else {
                console.log('WebSocket closed with code:', event.code, '- not reconnecting')
                // Fallback to REST API with interval
                console.log('🔄 Setting up REST API fallback with 5-second interval')
                const interval = setInterval(() => {
                    fetchOrderBook()
                }, 5000)

                // Clear interval when component unmounts
                return () => clearInterval(interval)
            }
        }

        wsRef.current = ws
    }


    useEffect(() => {
        if (!symbol) return

        console.log('🔄 Setting up order book for symbol:', symbol)
        fetchOrderBook()
        setupWebSocket()

        // Fallback: also refresh via REST API every 10 seconds
        const restInterval = setInterval(() => {
            console.log('🔄 Periodic REST API refresh for order book')
            fetchOrderBook()
        }, 10000)

        return () => {
            console.log('🧹 Cleaning up order book WebSocket and intervals')
            if (wsRef.current) {
                wsRef.current.close()
            }
            clearInterval(restInterval)
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current)
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