'use client'

import { useEffect, useRef, useState } from 'react'
import { createChart, IChartApi, Time } from 'lightweight-charts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// 在文件頂部添加類型定義
type BinanceKline = [
    number,   // 開盤時間 (timestamp)
    string,   // 開盤價
    string,   // 最高價
    string,   // 最低價
    string,   // 收盤價
    string,   // 成交量
    number,   // 收盤時間
    string,   // 成交額
    number,   // 成交筆數
    string,   // 主動買入成交量
    string,   // 主動買入成交額
    string    // 忽略
]

export function ChartTest() {
    const chartContainerRef = useRef<HTMLDivElement>(null)
    const chartRef = useRef<IChartApi | null>(null)
    const [dataLoaded, setDataLoaded] = useState(false)

    useEffect(() => {
        if (!chartContainerRef.current) return

        console.log('Creating test chart with real data...')

        const chart = createChart(chartContainerRef.current, {
            width: 600,
            height: 300,
            layout: {
                background: { color: '#ffffff' },
                textColor: '#333',
            },
        })

        const candlestickSeries = chart.addCandlestickSeries()

        // Fetch real BTC data
        fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=100')
            .then(response => response.json())
            .then(data => {
                console.log('Real data received:', data.length, 'items')

                const formattedData = data.map((item: BinanceKline) => ({
                    time: Math.floor(item[0] / 1000) as Time,
                    open: parseFloat(item[1]),
                    high: parseFloat(item[2]),
                    low: parseFloat(item[3]),
                    close: parseFloat(item[4]),
                }))

                console.log('Formatted data sample:', formattedData.slice(0, 3))
                candlestickSeries.setData(formattedData)
                chart.timeScale().fitContent()
                setDataLoaded(true)
                console.log('Real data chart created successfully')
            })
            .catch(error => {
                console.error('Error fetching real data:', error)
            })

        chartRef.current = chart

        return () => {
            if (chartRef.current) {
                chartRef.current.remove()
            }
        }
    }, [])

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>Chart Test with Real Data {dataLoaded ? '(Loaded)' : '(Loading...)'}</CardTitle>
            </CardHeader>
            <CardContent>
                <div ref={chartContainerRef} className="w-full h-[300px] border border-gray-200 bg-white" />
            </CardContent>
        </Card>
    )
} 