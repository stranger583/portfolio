'use client'

import { useEffect, useRef, useState } from 'react'
import { createChart, IChartApi, ISeriesApi, Time } from 'lightweight-charts'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SymbolSelector } from './SymbolSelector'

interface TradingViewChartProps {
    symbol: string
    twdRate: number
    onSymbolChange?: (symbol: string) => void
}

interface KlineData {
    time: Time
    open: number
    high: number
    low: number
    close: number
    volume: number
}

export function TradingViewChart({ symbol, twdRate, onSymbolChange }: TradingViewChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null)
    const chartRef = useRef<IChartApi | null>(null)
    const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
    const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null)
    const maSeriesRef = useRef<ISeriesApi<"Line"> | null>(null)
    const wsRef = useRef<WebSocket | null>(null)
    const [currentPrice, setCurrentPrice] = useState<number>(0)
    const [timeframe, setTimeframe] = useState<string>('1m')
    const timeframeRef = useRef<string>('1m') // 新增：用ref追蹤當前timeframe
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [high24h, setHigh24h] = useState<number>(0)
    const [low24h, setLow24h] = useState<number>(0)
    const [volume24h, setVolume24h] = useState<number>(0)
    const isLoadingMoreRef = useRef(false)
    const hasMoreDataRef = useRef(true) // 追蹤是否還有更多數據可載入

    // Format large numbers with 億
    const formatNumber = (num: number) => {
        if (num >= 100000000) {
            return (num / 100000000).toFixed(1) + '億'
        }
        return num.toFixed(2)
    }

    // Format price to keep as number
    const formatPrice = (num: number) => {
        return num.toFixed(2)
    }

    // Fetch 24h ticker data
    const fetch24hData = async () => {
        try {
            const symbolPair = `${symbol}USDT`
            const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbolPair}`)

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            const data = await response.json()
            setHigh24h(parseFloat(data.highPrice))
            setLow24h(parseFloat(data.lowPrice))
            setVolume24h(parseFloat(data.volume))
            console.log('24h data fetched:', { high: data.highPrice, low: data.lowPrice, volume: data.volume })
        } catch (error) {
            console.error('Error fetching 24h data:', error)
        }
    }

    // Calculate moving average
    const calculateMA = (data: KlineData[], period: number) => {
        const maData = []
        for (let i = period - 1; i < data.length; i++) {
            const sum = data.slice(i - period + 1, i + 1).reduce((acc, item) => acc + item.close, 0)
            const average = sum / period
            maData.push({
                time: data[i].time,
                value: average
            })
        }
        return maData
    }

    // Fetch historical kline data
    const fetchHistoricalData = async (interval: string = '1m', limit?: number, endTime?: number) => {
        try {
            const symbolPair = `${symbol}USDT`
            const requestLimit = limit || 500
            console.log(`Fetching data for ${symbolPair} with interval ${interval}, limit ${requestLimit}`)

            let url = `https://api.binance.com/api/v3/klines?symbol=${symbolPair}&interval=${interval}&limit=${requestLimit}`
            if (endTime) {
                url += `&endTime=${endTime}`
            }

            const response = await fetch(url)

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            const data = await response.json()
            console.log(`Received ${data.length} klines for ${symbolPair}`)

            if (!Array.isArray(data) || data.length === 0) {
                console.log('No data received from API')
                return []
            }

            const formattedData = data.map((item: (string | number)[]) => {
                if (!Array.isArray(item) || item.length < 6) {
                    console.error('Invalid kline data format:', item)
                    return null
                }

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
            if (formattedData.length > 0) {
                console.log('Time range:', new Date((formattedData[0]?.time as number) * 1000), 'to', new Date((formattedData[formattedData.length - 1]?.time as number) * 1000))
            }
            return formattedData
        } catch (error) {
            console.error('Error fetching historical data:', error)
            setError(`Failed to fetch data: ${error}`)
            return []
        }
    }

    // Direct WebSocket setup
    const setupWebSocketDirect = () => {
        console.log('=== setupWebSocketDirect called ===')
        console.log('symbol:', symbol)
        console.log('timeframe:', timeframe)
        console.log('timeframeRef.current:', timeframeRef.current)
        console.log('candlestickSeriesRef.current:', !!candlestickSeriesRef.current)

        if (!candlestickSeriesRef.current) {
            console.log('❌ Candlestick series not available, skipping WebSocket setup')
            return
        }

        if (wsRef.current) {
            console.log('Closing existing WebSocket connection')
            wsRef.current.close()
        }

        // 使用 ref 中的當前 timeframe
        const currentTimeframe = timeframeRef.current
        const streamName = `${symbol.toLowerCase()}usdt@kline_${currentTimeframe}`
        const wsUrl = `wss://stream.binance.com:9443/ws/${streamName}`
        console.log('Connecting to WebSocket URL:', wsUrl)

        try {
            const ws = new WebSocket(wsUrl)

            const connectionTimeout = setTimeout(() => {
                if (ws.readyState === WebSocket.CONNECTING) {
                    console.log('⏰ WebSocket connection timeout, closing...')
                    ws.close()
                }
            }, 10000)

            ws.onopen = () => {
                clearTimeout(connectionTimeout)
                console.log('✅ Chart WebSocket connected successfully for', symbol)
            }

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data)
                    console.log('📨 WebSocket message received:', data)

                    if (data.e === 'kline') {
                        const kline = data.k
                        if (kline) {
                            const candleData: KlineData = {
                                time: Math.floor(kline.t / 1000) as Time,
                                open: parseFloat(kline.o),
                                high: parseFloat(kline.h),
                                low: parseFloat(kline.l),
                                close: parseFloat(kline.c),
                                volume: parseFloat(kline.v)
                            }

                            if (candlestickSeriesRef.current) {
                                candlestickSeriesRef.current.update(candleData)
                            }

                            if (volumeSeriesRef.current) {
                                const volumeData = {
                                    time: candleData.time,
                                    value: candleData.volume,
                                    color: candleData.close >= candleData.open ? '#26a69a' : '#ef5350'
                                }
                                volumeSeriesRef.current.update(volumeData)
                            }

                            setCurrentPrice(candleData.close)
                        }
                    }
                } catch (error) {
                    console.error('❌ Error parsing WebSocket data:', error)
                }
            }

            ws.onerror = (error) => {
                clearTimeout(connectionTimeout)
                console.error('❌ Chart WebSocket error:', error)
            }

            ws.onclose = (event) => {
                clearTimeout(connectionTimeout)
                console.log('🔌 Chart WebSocket disconnected for', symbol)
                console.log('Close event code:', event.code, 'reason:', event.reason)

                if (event.code === 1000 || event.code === 1001 || event.code === 1006) {
                    console.log('🔄 Attempting to reconnect WebSocket...')
                    setTimeout(() => {
                        setupWebSocketDirect()
                    }, 5000)
                }
            }

            wsRef.current = ws
        } catch (error) {
            console.error('❌ Error creating WebSocket:', error)
        }
    }

    // Change timeframe
    const changeTimeframe = async (newTimeframe: string) => {
        console.log('Changing timeframe to:', newTimeframe)
        setTimeframe(newTimeframe)
        timeframeRef.current = newTimeframe // 更新ref
        setIsLoading(true)
        setError(null)
        hasMoreDataRef.current = true // 重置有更多數據的標誌

        if (wsRef.current) {
            wsRef.current.close()
        }

        if (candlestickSeriesRef.current) {
            candlestickSeriesRef.current.setData([])
        }

        if (volumeSeriesRef.current) {
            volumeSeriesRef.current.setData([])
        }

        if (maSeriesRef.current) {
            maSeriesRef.current.setData([])
        }

        const historicalData = await fetchHistoricalData(newTimeframe)
        if (historicalData.length > 0 && candlestickSeriesRef.current) {
            candlestickSeriesRef.current.setData(historicalData)

            if (volumeSeriesRef.current) {
                const volumeData = historicalData.map(item => ({
                    time: item.time,
                    value: item.volume,
                    color: item.close >= item.open ? '#26a69a' : '#ef5350'
                }))
                volumeSeriesRef.current.setData(volumeData)
            }

            if (maSeriesRef.current) {
                let maPeriod = 150
                if (newTimeframe === '1m') maPeriod = 150
                else if (newTimeframe === '5m') maPeriod = 30
                else if (newTimeframe === '15m') maPeriod = 10
                else if (newTimeframe === '1h') maPeriod = 150
                else if (newTimeframe === '4h') maPeriod = 150
                else if (newTimeframe === '1d') maPeriod = 150

                const maData = calculateMA(historicalData, Math.min(maPeriod, historicalData.length))
                maSeriesRef.current.setData(maData)
            }

            const lastCandle = historicalData[historicalData.length - 1]
            setCurrentPrice(lastCandle.close)

            await fetch24hData()

            if (chartRef.current) {
                chartRef.current.timeScale().fitContent()
            }
        }

        setIsLoading(false)
        setupWebSocketDirect()
    }

    // 改進的載入更多歷史數據函數
    const loadMoreHistoricalData = async () => {
        console.log('🔄 loadMoreHistoricalData called')
        console.log('isLoadingMoreRef.current:', isLoadingMoreRef.current)
        console.log('hasMoreDataRef.current:', hasMoreDataRef.current)

        if (isLoadingMoreRef.current || !hasMoreDataRef.current || !chartRef.current || !candlestickSeriesRef.current) {
            console.log('🔄 Skipping load more - already loading or no more data or chart not ready')
            return
        }

        console.log('🔄 Loading more historical data...')
        isLoadingMoreRef.current = true

        try {
            // 獲取當前數據
            const currentData = candlestickSeriesRef.current.data() as KlineData[]
            console.log('Current data length:', currentData.length)

            if (currentData.length === 0) {
                console.log('No current data available')
                isLoadingMoreRef.current = false
                return
            }

            // 找到最舊的時間戳
            const oldestTimestamp = Math.min(...currentData.map(item => item.time as number))
            console.log('Oldest timestamp in current data:', new Date(oldestTimestamp * 1000))

            // 使用 ref 中的當前 timeframe，避免異步問題
            const currentTimeframe = timeframeRef.current
            console.log('Using timeframe from ref:', currentTimeframe)

            // 根據 timeframe 計算正確的時間間隔
            let timeInterval: number
            switch (currentTimeframe) {
                case '1m':
                    timeInterval = 60 // 1分鐘 = 60秒
                    break
                case '5m':
                    timeInterval = 5 * 60 // 5分鐘 = 300秒
                    break
                case '15m':
                    timeInterval = 15 * 60 // 15分鐘 = 900秒
                    break
                case '1h':
                    timeInterval = 60 * 60 // 1小時 = 3600秒
                    break
                case '4h':
                    timeInterval = 4 * 60 * 60 // 4小時 = 14400秒
                    break
                case '1d':
                    timeInterval = 24 * 60 * 60 // 1天 = 86400秒
                    break
                default:
                    timeInterval = 60 // 預設1分鐘
            }

            // 計算 endTime (最舊時間戳的前一個時間間隔)
            const endTime = (oldestTimestamp - timeInterval) * 1000 // 轉換為毫秒並減去對應的時間間隔
            console.log(`Calculated endTime for ${currentTimeframe}:`, new Date(endTime))

            // 獲取更舊的數據
            const olderData = await fetchHistoricalData(currentTimeframe, 500, endTime)

            if (olderData.length === 0) {
                console.log('No more historical data available')
                hasMoreDataRef.current = false
                isLoadingMoreRef.current = false
                return
            }

            // 過濾重複的數據
            const uniqueOlderData = olderData.filter(oldItem =>
                !currentData.some(currentItem => currentItem.time === oldItem.time)
            )

            console.log(`Loaded ${uniqueOlderData.length} unique older data points`)

            if (uniqueOlderData.length > 0) {
                // 合併數據
                const mergedData = [...uniqueOlderData, ...currentData]
                const sortedData = mergedData.sort((a, b) => (a.time as number) - (b.time as number))

                console.log('Merged data points:', sortedData.length)
                console.log('New time range:', new Date((sortedData[0]?.time as number) * 1000), 'to', new Date((sortedData[sortedData.length - 1]?.time as number) * 1000))

                // 更新蠟燭圖數據
                candlestickSeriesRef.current.setData(sortedData)

                // 更新成交量數據 - 保留現有數據，只添加新的數據點
                if (volumeSeriesRef.current) {
                    // 獲取現有的成交量數據
                    const existingVolumeData = volumeSeriesRef.current.data() as Array<{ time: Time, value: number, color: string }>

                    // 為新的數據點創建成交量數據
                    const newVolumeData = uniqueOlderData.map(item => ({
                        time: item.time,
                        value: item.volume,
                        color: item.close >= item.open ? '#26a69a' : '#ef5350'
                    }))

                    // 合併現有和新的成交量數據，避免重複
                    const mergedVolumeData = [...newVolumeData, ...existingVolumeData]
                    const uniqueVolumeData = mergedVolumeData.filter((item, index, self) =>
                        index === self.findIndex(t => t.time === item.time)
                    )

                    // 按時間排序
                    const sortedVolumeData = uniqueVolumeData.sort((a, b) => (a.time as number) - (b.time as number))

                    // 更新成交量圖表
                    volumeSeriesRef.current.setData(sortedVolumeData)
                }

                // 更新移動平均線
                if (maSeriesRef.current) {
                    let maPeriod = 150
                    if (currentTimeframe === '1m') maPeriod = 150
                    else if (currentTimeframe === '5m') maPeriod = 30
                    else if (currentTimeframe === '15m') maPeriod = 10
                    else if (currentTimeframe === '1h') maPeriod = 150
                    else if (currentTimeframe === '4h') maPeriod = 150
                    else if (currentTimeframe === '1d') maPeriod = 150

                    const maData = calculateMA(sortedData, Math.min(maPeriod, sortedData.length))
                    maSeriesRef.current.setData(maData)
                }

                console.log('✅ More historical data loaded successfully')
            } else {
                console.log('No new unique data points found')
                hasMoreDataRef.current = false
            }
        } catch (error) {
            console.error('❌ Error loading more historical data:', error)
        } finally {
            setTimeout(() => {
                isLoadingMoreRef.current = false
            }, 1000)
        }
    }

    // Single effect to handle chart initialization
    useEffect(() => {
        if (!symbol) return

        console.log('=== TradingViewChart: useEffect triggered for symbol:', symbol, '===')

        const initChart = async () => {
            try {
                console.log('=== TradingViewChart: Initializing for symbol:', symbol, '===')
                setIsLoading(true)
                setError(null)
                hasMoreDataRef.current = true // 重置有更多數據的標誌

                let attempts = 0
                while (!chartContainerRef.current && attempts < 50) {
                    await new Promise(resolve => setTimeout(resolve, 20))
                    attempts++
                }

                if (!chartContainerRef.current) {
                    console.log('Container not found after retries')
                    setError('Container not found')
                    setIsLoading(false)
                    return
                }

                if (chartRef.current) {
                    chartRef.current.remove()
                }

                const containerWidth = chartContainerRef.current.clientWidth || 800
                const containerHeight = chartContainerRef.current.clientHeight || 400

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
                        scaleMargins: {
                            top: 0.1,
                            bottom: 0.3,
                        },
                    },
                    timeScale: {
                        borderColor: '#ddd',
                        timeVisible: true,
                        secondsVisible: false,
                        visible: true,
                        rightOffset: 12,
                        barSpacing: 3,
                    },
                })

                chartRef.current = chart

                const candlestickSeries = chart.addCandlestickSeries({
                    upColor: '#26a69a',
                    downColor: '#ef5350',
                    borderVisible: false,
                    wickUpColor: '#26a69a',
                    wickDownColor: '#ef5350',
                })
                candlestickSeriesRef.current = candlestickSeries

                const volumeSeries = chart.addHistogramSeries({
                    color: '#26a69a',
                    priceFormat: {
                        type: 'volume',
                        precision: 0,
                        minMove: 1,
                    },
                    priceScaleId: 'volume',
                })
                volumeSeriesRef.current = volumeSeries

                chart.priceScale('volume').applyOptions({
                    scaleMargins: {
                        top: 0.7,
                        bottom: 0.05,
                    },
                    visible: true,
                    borderColor: '#ddd',
                    textColor: '#333',
                })

                const maSeries = chart.addLineSeries({
                    color: '#ff9800',
                    lineWidth: 2,
                    priceScaleId: 'right',
                })
                maSeriesRef.current = maSeries

                // 載入歷史數據
                const historicalData = await fetchHistoricalData(timeframe)
                if (historicalData.length > 0) {
                    candlestickSeries.setData(historicalData)

                    const volumeData = historicalData.map(item => ({
                        time: item.time,
                        value: item.volume,
                        color: item.close >= item.open ? '#26a69a' : '#ef5350'
                    }))
                    volumeSeries.setData(volumeData)

                    let maPeriod = 150
                    if (timeframe === '1m') maPeriod = 150
                    else if (timeframe === '5m') maPeriod = 30
                    else if (timeframe === '15m') maPeriod = 10
                    else if (timeframe === '1h') maPeriod = 150
                    else if (timeframe === '4h') maPeriod = 150
                    else if (timeframe === '1d') maPeriod = 150

                    const maData = calculateMA(historicalData, Math.min(maPeriod, historicalData.length))
                    maSeries.setData(maData)

                    await fetch24hData()

                    const lastCandle = historicalData[historicalData.length - 1]
                    setCurrentPrice(lastCandle.close)
                    setIsLoading(false)
                    setError(null)

                    // 確保 timeframeRef 與當前 timeframe 同步
                    timeframeRef.current = timeframe

                    setTimeout(() => {
                        setupWebSocketDirect()
                    }, 100)
                } else {
                    console.error('No historical data received')
                    setError('No data available for this symbol')
                    setIsLoading(false)
                }

                // 處理視窗大小調整
                const handleResize = () => {
                    if (chartContainerRef.current && chartRef.current) {
                        const newWidth = chartContainerRef.current.clientWidth
                        const newHeight = chartContainerRef.current.clientHeight
                        chartRef.current.applyOptions({
                            width: newWidth,
                            height: newHeight
                        })
                    }
                }

                // 改進的滾動檢測
                const handleVisibleRangeChanged = () => {
                    if (!chartRef.current || isLoadingMoreRef.current || !hasMoreDataRef.current) {
                        return
                    }

                    const logicalRange = chartRef.current.timeScale().getVisibleLogicalRange()

                    if (logicalRange && logicalRange.from <= 10) {
                        console.log('🔄 Near left edge, loading more data...')
                        loadMoreHistoricalData()
                    }
                }

                window.addEventListener('resize', handleResize)
                chart.timeScale().subscribeVisibleTimeRangeChange(handleVisibleRangeChanged)

                return () => {
                    window.removeEventListener('resize', handleResize)
                    chart.timeScale().unsubscribeVisibleTimeRangeChange(handleVisibleRangeChanged)
                }
            } catch (error) {
                console.error('Failed to initialize chart:', error)
                setError(`Failed to initialize chart: ${error}`)
                setIsLoading(false)
            }
        }

        setTimeout(() => {
            initChart()
        }, 100)
    }, [symbol])

    // Effect to periodically refresh 24h data
    useEffect(() => {
        if (!symbol) return

        fetch24hData()
        const interval = setInterval(() => {
            fetch24hData()
        }, 30000)

        return () => {
            clearInterval(interval)
        }
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
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center justify-between border-gray-200">
                        <div className="text-left">
                            {onSymbolChange ? (
                                <SymbolSelector
                                    symbol={symbol}
                                    onSymbolChange={onSymbolChange}
                                />
                            ) : (
                                <div className='lg:mb-2 text-sm lg:text-xl font-semibold'>{symbol} / USDT</div>
                            )}
                            <div className="text-xl lg:text-xl font-bold">{formatPrice(currentPrice)}</div>
                            <div className="text-xs lg:text-sm text-muted-foreground">
                                NT$ {formatPrice(currentPrice * twdRate)}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2 lg:space-x-4">
                        <div className="flex flex-col space-y-1 min-w-0">
                            <div className="text-right">
                                <div className="text-[10px] lg:text-sm text-muted-foreground">24h最高價</div>
                                <div className="text-[10px] lg:text-sm truncate">{formatPrice(high24h)}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] lg:text-sm text-muted-foreground">24h最低價</div>
                                <div className="text-[10px] lg:text-sm truncate">{formatPrice(low24h)}</div>
                            </div>
                        </div>
                        <div className="flex flex-col space-y-1 min-w-0">
                            <div className="text-right">
                                <div className="text-[10px] lg:text-sm text-muted-foreground">24h成交量({symbol})</div>
                                <div className="text-[10px] lg:text-sm truncate">{formatNumber(volume24h)}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] lg:text-sm text-muted-foreground">24h成交量(USDT)</div>
                                <div className="text-[10px] lg:text-sm truncate">{formatNumber(volume24h * currentPrice)}</div>
                            </div>
                        </div>
                    </div>
                </div>

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