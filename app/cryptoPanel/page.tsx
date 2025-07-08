'use client'

import { useState } from 'react'
import { CryptoSearch } from '@/components/crypto/CryptoSearch'
import { CryptoTickerList } from '@/components/crypto/CryptoTickerList'
import { TradingViewChart } from '@/components/crypto/TradingViewChart'
import { useCryptoData } from '@/hooks/useCryptoData'

function CryptoPanel() {
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedSymbol, setSelectedSymbol] = useState<string>('BTC')
    const { cryptoData, twdRate, loading, error } = useCryptoData(searchTerm)

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-lg">載入中...</div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-lg text-red-600">錯誤: {error}</div>
            </div>
        )
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex flex-col space-y-4">
                <h1 className="text-3xl font-bold">虛擬貨幣行情</h1>
                <CryptoSearch
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left side - Ticker List */}
                <div className="lg:col-span-1">
                    <CryptoTickerList
                        cryptoData={cryptoData}
                        twdRate={twdRate}
                        selectedSymbol={selectedSymbol}
                        onSymbolSelect={setSelectedSymbol}
                    />
                </div>

                {/* Right side - TradingView Chart */}
                <div className="lg:col-span-2">
                    <TradingViewChart
                        symbol={selectedSymbol}
                        twdRate={twdRate}
                    />
                </div>
            </div>
        </div>
    )
}

export default CryptoPanel
