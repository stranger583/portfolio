'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface SymbolSelectorProps {
    symbol: string
    onSymbolChange: (symbol: string) => void
}

interface BinanceSymbol {
    symbol: string
    baseAsset: string
    quoteAsset: string
    status: string
}

export function SymbolSelector({ symbol, onSymbolChange }: SymbolSelectorProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [symbols, setSymbols] = useState<BinanceSymbol[]>([])
    const [filteredSymbols, setFilteredSymbols] = useState<BinanceSymbol[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Fetch all USDT trading pairs
    const fetchSymbols = async () => {
        try {
            setIsLoading(true)
            const response = await fetch('https://api.binance.com/api/v3/exchangeInfo')
            const data = await response.json()

            const usdtPairs = data.symbols
                .filter((s: BinanceSymbol) =>
                    s.quoteAsset === 'USDT' &&
                    s.status === 'TRADING' &&
                    s.baseAsset !== 'USDT'
                )
                .map((s: BinanceSymbol) => ({
                    symbol: s.symbol,
                    baseAsset: s.baseAsset,
                    quoteAsset: s.quoteAsset,
                    status: s.status
                }))
                .sort((a: BinanceSymbol, b: BinanceSymbol) => a.baseAsset.localeCompare(b.baseAsset))

            setSymbols(usdtPairs)
            setFilteredSymbols(usdtPairs)
            console.log('Fetched symbols:', usdtPairs.length)
        } catch (error) {
            console.error('Error fetching symbols:', error)
        } finally {
            setIsLoading(false)
        }
    }

    // Filter symbols based on search term
    useEffect(() => {
        const filtered = symbols.filter(s =>
            s.baseAsset.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.symbol.toLowerCase().includes(searchTerm.toLowerCase())
        )
        setFilteredSymbols(filtered)
    }, [searchTerm, symbols])

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    // Fetch symbols when dropdown opens
    useEffect(() => {
        if (isOpen && symbols.length === 0) {
            fetchSymbols()
        }
    }, [isOpen, symbols.length])

    const handleSymbolSelect = (selectedSymbol: string) => {
        onSymbolChange(selectedSymbol)
        setIsOpen(false)
        setSearchTerm('')
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <div
                className="flex items-center space-x-2 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setIsOpen(!isOpen)}
            >
                <CardTitle className='lg:mb-2 text-sm lg:text-xl'>
                    {symbol} / USDT
                </CardTitle>
                <ChevronDown
                    className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
            </div>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-hidden">
                    {/* Search */}
                    <div className="p-3 border-b border-gray-200">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                placeholder="搜尋幣種..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </div>

                    {/* Symbol List */}
                    <div className="max-h-80 overflow-y-auto">
                        {isLoading ? (
                            <div className="p-4 text-center text-sm text-gray-500">
                                載入中...
                            </div>
                        ) : filteredSymbols.length === 0 ? (
                            <div className="p-4 text-center text-sm text-gray-500">
                                沒有找到相關幣種
                            </div>
                        ) : (
                            <div className="p-2">
                                {filteredSymbols.slice(0, 50).map((s) => (
                                    <div
                                        key={s.symbol}
                                        className={`flex items-center justify-between p-2 rounded cursor-pointer hover:bg-gray-50 transition-colors ${s.baseAsset === symbol ? 'bg-blue-50 border border-blue-200' : ''
                                            }`}
                                        onClick={() => handleSymbolSelect(s.baseAsset)}
                                    >
                                        <div className="flex items-center space-x-2">
                                            <div className="font-medium">{s.baseAsset}</div>
                                            <Badge variant="secondary" className="text-xs">
                                                {s.symbol}
                                            </Badge>
                                        </div>
                                        {s.baseAsset === symbol && (
                                            <div className="text-blue-600 text-sm">當前</div>
                                        )}
                                    </div>
                                ))}
                                {filteredSymbols.length > 50 && (
                                    <div className="p-2 text-center text-xs text-gray-500">
                                        顯示前50個結果，請使用搜尋功能查找更多
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
} 