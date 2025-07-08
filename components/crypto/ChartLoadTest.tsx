'use client'

import { useEffect, useRef, useState } from 'react'
import { createChart, IChartApi, Time } from 'lightweight-charts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function ChartLoadTest() {
    const chartContainerRef = useRef<HTMLDivElement>(null)
    const chartRef = useRef<IChartApi | null>(null)
    const [status, setStatus] = useState<string>('Initializing...')

    useEffect(() => {
        console.log('=== ChartLoadTest: Component mounted ===')

        const initChart = async () => {
            try {
                setStatus('Waiting for container...')

                // Wait for container
                let attempts = 0
                while (!chartContainerRef.current && attempts < 50) {
                    await new Promise(resolve => setTimeout(resolve, 20))
                    attempts++
                }

                if (!chartContainerRef.current) {
                    setStatus('ERROR: Container not found')
                    return
                }

                setStatus('Container found, creating chart...')
                console.log('Container dimensions:', chartContainerRef.current.clientWidth, chartContainerRef.current.clientHeight)

                // Create chart
                const chart = createChart(chartContainerRef.current, {
                    width: 600,
                    height: 300,
                    layout: {
                        background: { color: '#ffffff' },
                        textColor: '#333',
                    },
                })

                chartRef.current = chart
                setStatus('Chart created, adding series...')

                // Add candlestick series
                const candlestickSeries = chart.addCandlestickSeries()
                setStatus('Series added, fetching data...')

                // Fetch real data
                const response = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=100')
                const data = await response.json()

                setStatus('Data received, formatting...')

                const formattedData = data.map((item: any) => ({
                    time: Math.floor(item[0] / 1000) as Time,
                    open: parseFloat(item[1]),
                    high: parseFloat(item[2]),
                    low: parseFloat(item[3]),
                    close: parseFloat(item[4]),
                }))

                setStatus('Setting data to chart...')
                candlestickSeries.setData(formattedData)

                chart.timeScale().fitContent()

                setStatus('SUCCESS: Chart loaded successfully!')
                console.log('ChartLoadTest: Chart loaded successfully')

            } catch (error) {
                console.error('ChartLoadTest: Error:', error)
                setStatus(`ERROR: ${error}`)
            }
        }

        initChart()

        return () => {
            if (chartRef.current) {
                chartRef.current.remove()
            }
        }
    }, [])

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>Chart Load Test - {status}</CardTitle>
            </CardHeader>
            <CardContent>
                <div
                    ref={chartContainerRef}
                    className="w-full h-[300px] border border-gray-200 bg-white"
                />
            </CardContent>
        </Card>
    )
} 