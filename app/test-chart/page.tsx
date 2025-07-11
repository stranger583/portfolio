'use client'

import { TradingViewChart } from '@/components/crypto/TradingViewChart'

export default function TestChartPage() {
    return (
        <div className="container mx-auto p-4 space-y-4">
            <h1 className="text-2xl font-bold">Chart Test Page</h1>
            <p className="text-sm text-gray-600">
                Test the chart with scroll-to-load functionality. Try scrolling left to load more historical data.
            </p>
            <TradingViewChart symbol="BTC" twdRate={31.5} />
        </div>
    )
} 