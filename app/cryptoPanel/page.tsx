'use client'

import { useState } from 'react'
import { CryptoSearch } from '@/components/crypto/CryptoSearch'
import { CryptoTickerList } from '@/components/crypto/CryptoTickerList'
import { useCryptoData } from '@/hooks/useCryptoData'

function CryptoPanel() {
    const [searchTerm, setSearchTerm] = useState('')
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

            <CryptoTickerList
                cryptoData={cryptoData}
                twdRate={twdRate}
            />
        </div>
    )
}

export default CryptoPanel
