'use client'

import { useEffect, useRef, useState } from 'react'
import { createChart, IChartApi, ISeriesApi, Time } from 'lightweight-charts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface TradingViewChartProps {
    symbol: string
    twdRate: number
}

interface KlineData {
    time: Time
    open: number
    high: number
    low: number
    close: number
    volume: number
}

export function TradingViewChart({ symbol, twdRate }: TradingViewChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null)
    const chartRef = useRef<IChartApi | null>(null)
    const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
    const wsRef = useRef<WebSocket | null>(null)
    const [currentPrice, setCurrentPrice] = useState<number>(0)
    const [timeframe, setTimeframe] = useState<string>('1m')
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isChartReady, setIsChartReady] = useState(false)
    const [containerReady, setContainerReady] = useState(false)

    // Fetch historical kline data
    const fetchHistoricalData = async (interval: string = '1m') => {
        try {
            const symbolPair = `${symbol}USDT`
            console.log(`Fetching data for ${symbolPair} with interval ${interval}`)

            const response = await fetch(
                `https://api.binance.com/api/v3/klines?symbol=${symbolPair}&interval=${interval}&limit=500`
            )

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            const data = await response.json()
            console.log(`Received ${data.length} klines for ${symbolPair}`)

            if (!Array.isArray(data) || data.length === 0) {
                throw new Error('No data received from API')
            }

            const formattedData = data.map((item: (string | number)[]) => {
                if (!Array.isArray(item) || item.length < 6) {
                    console.error('Invalid kline data format:', item)
                    return null
                }

                // Binance returns milliseconds, convert to seconds for lightweight-charts
                const timestamp = Math.floor(Number(item[0]) / 1000)

                return {
                    time: timestamp as Time,
                    open: parseFloat(item[1] as string),
                    high: parseFloat(item[2] as string),
                    low: parseFloat(item[3] as string),
                    close: parseFloat(item[4] as string),
                    volume: parseFloat(item[5] as string)
                }
            }).filter((item): item is KlineData => item !== null)

            console.log(`Formatted ${formattedData.length} data points`)
            console.log('Sample data:', formattedData.slice(0, 3))
            console.log('Time range:', new Date((formattedData[0]?.time as number) * 1000), 'to', new Date((formattedData[formattedData.length - 1]?.time as number) * 1000))
            return formattedData
        } catch (error) {
            console.error('Error fetching historical data:', error)
            setError(`Failed to fetch data: ${error}`)
            return []
        }
    }

    // Direct WebSocket setup without checking isChartReady
    const setupWebSocketDirect = () => {
        console.log('=== setupWebSocketDirect called ===')
        console.log('symbol:', symbol)
        console.log('timeframe:', timeframe)
        console.log('candlestickSeriesRef.current:', !!candlestickSeriesRef.current)

        if (!candlestickSeriesRef.current) {
            console.log('❌ Candlestick series not available, skipping WebSocket setup')
            return
        }

        // Close existing connection
        if (wsRef.current) {
            console.log('Closing existing WebSocket connection')
            wsRef.current.close()
            console.log('Closed existing WebSocket connection')
        }

        // Try different stream formats
        const streamName1 = `${symbol.toLowerCase()}usdt@kline_${timeframe}`
        const streamName2 = `${symbol.toLowerCase()}usdt@miniTicker`
        const wsUrl = `wss://stream.binance.com:9443/ws/${streamName1}`
        console.log('Connecting to WebSocket URL:', wsUrl)
        console.log('Stream name:', streamName1)
        console.log('Alternative stream name:', streamName2)
        console.log('Expected timeframe:', timeframe)

        try {
            const ws = new WebSocket(wsUrl)

            // Add connection timeout
            const connectionTimeout = setTimeout(() => {
                if (ws.readyState === WebSocket.CONNECTING) {
                    console.log('⏰ WebSocket connection timeout, closing...')
                    ws.close()
                }
            }, 10000) // 10 second timeout

            ws.onopen = () => {
                clearTimeout(connectionTimeout)
                console.log('✅ Chart WebSocket connected successfully for', symbol)
                console.log('WebSocket readyState:', ws.readyState)
            }

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data)
                    console.log('📨 WebSocket message received:', data)

                    // Check if this is a kline message
                    if (data.e === 'kline') {
                        console.log('📊 Kline event detected')
                        const kline = data.k
                        if (kline) {
                            console.log('📊 Kline data:', kline)
                            console.log('Kline interval:', kline.i)
                            console.log('Kline symbol:', kline.s)
                            console.log('Is final (closed):', kline.x)
                            console.log('Start time:', new Date(kline.t))
                            console.log('Close time:', new Date(kline.T))

                            const candleData: KlineData = {
                                time: Math.floor(kline.t / 1000) as Time,
                                open: parseFloat(kline.o),
                                high: parseFloat(kline.h),
                                low: parseFloat(kline.l),
                                close: parseFloat(kline.c),
                                volume: parseFloat(kline.v)
                            }

                            console.log('🔄 Processed candle data:', candleData)
                            console.log('Candle is closed (kline.x):', kline.x)
                            console.log('Candlestick series available:', !!candlestickSeriesRef.current)

                            // Update chart for both open and closed candles
                            if (kline.x) { // Candle is closed
                                console.log('✅ Updating chart with closed candle:', candleData)
                                if (candlestickSeriesRef.current) {
                                    candlestickSeriesRef.current.update(candleData)
                                    console.log('✅ Chart updated successfully with closed candle')
                                } else {
                                    console.log('❌ Candlestick series not available for closed candle update')
                                }
                                setCurrentPrice(candleData.close)
                            } else { // Candle is still open - update the current candle
                                console.log('📈 Updating chart with open candle:', candleData)
                                if (candlestickSeriesRef.current) {
                                    candlestickSeriesRef.current.update(candleData)
                                    console.log('✅ Chart updated successfully with open candle')
                                } else {
                                    console.log('❌ Candlestick series not available for open candle update')
                                }
                                setCurrentPrice(candleData.close)
                            }
                        }
                    } else {
                        console.log('📨 Other message type:', data.e)
                    }
                } catch (error) {
                    console.error('❌ Error parsing WebSocket data:', error)
                }
            }

            ws.onerror = (error) => {
                clearTimeout(connectionTimeout)
                console.error('❌ Chart WebSocket error:', error)
                // Don't treat WebSocket errors as critical - they're often network-related
                console.log('ℹ️ WebSocket error is non-critical, connection may still work')
            }

            ws.onclose = (event) => {
                clearTimeout(connectionTimeout)
                console.log('🔌 Chart WebSocket disconnected for', symbol)
                console.log('Close event code:', event.code, 'reason:', event.reason)

                // Only reconnect for normal closures or network issues
                if (event.code === 1000 || event.code === 1001 || event.code === 1006) {
                    console.log('🔄 Attempting to reconnect WebSocket...')
                    setTimeout(() => {
                        setupWebSocketDirect()
                    }, 5000)
                } else {
                    console.log('WebSocket closed with code:', event.code, '- not reconnecting')
                }
            }

            wsRef.current = ws
            console.log('✅ WebSocket setup completed')
            console.log('WebSocket readyState:', ws.readyState)
        } catch (error) {
            console.error('❌ Error creating WebSocket:', error)
        }
    }

    // Change timeframe
    const changeTimeframe = async (newTimeframe: string) => {
        console.log('Changing timeframe to:', newTimeframe)
        setTimeframe(newTimeframe)
        setIsLoading(true)
        setError(null)

        // Close current WebSocket
        if (wsRef.current) {
            wsRef.current.close()
            console.log('Closed WebSocket for timeframe change')
        }

        // Clear chart data
        if (candlestickSeriesRef.current) {
            candlestickSeriesRef.current.setData([])
        }

        // Load new data
        const historicalData = await fetchHistoricalData(newTimeframe)
        if (historicalData.length > 0 && candlestickSeriesRef.current) {
            candlestickSeriesRef.current.setData(historicalData)
            const lastCandle = historicalData[historicalData.length - 1]
            setCurrentPrice(lastCandle.close)

            // Fit content to new data
            if (chartRef.current) {
                chartRef.current.timeScale().fitContent()
            }
        }

        setIsLoading(false)

        // Setup new WebSocket with new timeframe
        console.log('Setting up new WebSocket for timeframe:', newTimeframe)
        setupWebSocketDirect()
    }

    // Single effect to handle chart initialization
    useEffect(() => {
        if (!symbol) return

        console.log('=== TradingViewChart: useEffect triggered for symbol:', symbol, '===')
        console.log('chartContainerRef.current:', chartContainerRef.current)
        console.log('Container ready state:', containerReady)

        const initChart = async () => {
            try {
                console.log('=== TradingViewChart: Initializing for symbol:', symbol, '===')
                setIsLoading(true)
                setError(null)
                setIsChartReady(false)

                // Wait for container with shorter intervals and more attempts
                let attempts = 0
                console.log('Starting container detection...')
                while (!chartContainerRef.current && attempts < 50) {
                    console.log(`Attempt ${attempts + 1}: chartContainerRef.current =`, chartContainerRef.current)
                    await new Promise(resolve => setTimeout(resolve, 20))
                    attempts++
                }

                if (!chartContainerRef.current) {
                    console.log('Container not found after retries')
                    setError('Container not found')
                    setIsLoading(false)
                    return
                }

                console.log('Container found, dimensions:', chartContainerRef.current.clientWidth, chartContainerRef.current.clientHeight)

                // Clear previous chart
                if (chartRef.current) {
                    chartRef.current.remove()
                    console.log('Previous chart removed')
                }

                // Get actual container dimensions
                const containerWidth = chartContainerRef.current.clientWidth || 800
                const containerHeight = chartContainerRef.current.clientHeight || 400

                console.log('Creating chart with dimensions:', containerWidth, containerHeight)

                // Create chart with actual container dimensions
                const chart = createChart(chartContainerRef.current, {
                    width: containerWidth,
                    height: containerHeight,
                    layout: {
                        background: { color: '#ffffff' },
                        textColor: '#333',
                    },
                    grid: {
                        vertLines: { color: '#f0f0f0' },
                        horzLines: { color: '#f0f0f0' },
                    },
                    crosshair: {
                        mode: 1,
                    },
                    rightPriceScale: {
                        borderColor: '#ddd',
                        visible: true,
                    },
                    timeScale: {
                        borderColor: '#ddd',
                        timeVisible: true,
                        secondsVisible: false,
                        visible: true,
                    },
                })

                chartRef.current = chart
                console.log('Chart created successfully')

                // Add candlestick series
                const candlestickSeries = chart.addCandlestickSeries({
                    upColor: '#26a69a',
                    downColor: '#ef5350',
                    borderVisible: false,
                    wickUpColor: '#26a69a',
                    wickDownColor: '#ef5350',
                })
                candlestickSeriesRef.current = candlestickSeries
                console.log('Candlestick series added')

                // Load historical data
                const historicalData = await fetchHistoricalData(timeframe)
                if (historicalData.length > 0) {
                    console.log(`Setting ${historicalData.length} data points to chart`)
                    console.log('First data point:', historicalData[0])
                    console.log('Last data point:', historicalData[historicalData.length - 1])

                    candlestickSeries.setData(historicalData)
                    console.log('Data set to chart')

                    // Set current price
                    const lastCandle = historicalData[historicalData.length - 1]
                    setCurrentPrice(lastCandle.close)
                    setIsLoading(false)
                    setError(null)
                    console.log('Chart data loaded successfully')

                    // Force chart to fit content
                    chart.timeScale().fitContent()
                    console.log('Chart fit content called')

                    // Chart is now ready
                    setIsChartReady(true)
                    console.log('🎉 Chart initialization completed successfully')
                    console.log('isChartReady will be set to: true')

                    // Setup WebSocket automatically - call directly since we know chart is ready
                    console.log('🔄 Setting up WebSocket automatically...')
                    console.log('Current isChartReady state:', isChartReady)
                    setTimeout(() => {
                        console.log('🔄 About to call setupWebSocket, isChartReady should be true now')
                        // Call setupWebSocket directly since we know the chart is ready
                        setupWebSocketDirect()
                    }, 100) // Small delay to ensure chart is fully ready
                } else {
                    console.error('No historical data received')
                    setError('No data available for this symbol')
                    setIsLoading(false)
                }

                // Handle resize
                const handleResize = () => {
                    if (chartContainerRef.current && chartRef.current) {
                        const newWidth = chartContainerRef.current.clientWidth
                        const newHeight = chartContainerRef.current.clientHeight
                        console.log('Resizing chart to:', newWidth, 'x', newHeight)
                        chartRef.current.applyOptions({
                            width: newWidth,
                            height: newHeight
                        })
                    }
                }

                window.addEventListener('resize', handleResize)

                return () => {
                    window.removeEventListener('resize', handleResize)
                }
            } catch (error) {
                console.error('Failed to initialize chart:', error)
                setError(`Failed to initialize chart: ${error}`)
                setIsLoading(false)
            }
        }

        // Add a small delay to ensure component is fully rendered
        setTimeout(() => {
            initChart()
        }, 100)
    }, [symbol]) // Only depend on symbol changes

    // Effect to handle container ready state
    useEffect(() => {
        if (chartContainerRef.current) {
            setContainerReady(true)
            console.log('Container is ready')
        }
    }, [])

    // Effect to handle symbol changes
    useEffect(() => {
        console.log('Symbol changed to:', symbol)
    }, [symbol])

    useEffect(() => {
        return () => {
            if (wsRef.current) {
                wsRef.current.close()
            }
            if (chartRef.current) {
                chartRef.current.remove()
            }
        }
    }, [])

    const timeframes = [
        { label: '1m', value: '1m' },
        { label: '5m', value: '5m' },
        { label: '15m', value: '15m' },
        { label: '1h', value: '1h' },
        { label: '4h', value: '4h' },
        { label: '1d', value: '1d' },
    ]

    return (
        <Card className="w-full">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>{symbol}/USDT 圖表</CardTitle>
                    <div className="flex items-center space-x-2">
                        <div className="text-right">
                            <div className="font-medium">${currentPrice.toFixed(4)}</div>
                            <div className="text-sm text-muted-foreground">
                                NT$ {(currentPrice * twdRate).toFixed(2)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Timeframe selector */}
                <div className="flex space-x-1">
                    {timeframes.map((tf) => (
                        <Badge
                            key={tf.value}
                            variant={timeframe === tf.value ? "default" : "secondary"}
                            className="cursor-pointer"
                            onClick={() => changeTimeframe(tf.value)}
                        >
                            {tf.label}
                        </Badge>
                    ))}
                </div>
            </CardHeader>

            <CardContent>
                <div
                    ref={chartContainerRef}
                    className="w-full h-[400px] border border-gray-200 bg-white"
                    style={{ minHeight: '400px', position: 'relative' }}
                />
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
                        <div className="text-lg">載入圖表中...</div>
                    </div>
                )}
                {error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
                        <div className="text-lg text-red-600">錯誤: {error}</div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
} 