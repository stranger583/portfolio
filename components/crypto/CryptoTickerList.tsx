import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CryptoTickerRow } from "./CryptoTickerRow"

interface CryptoData {
    symbol: string
    name: string
    price: number
    changePercent: number
    volume: number
}

interface CryptoTickerListProps {
    cryptoData: CryptoData[]
    twdRate: number
    onSymbolSelect?: (symbol: string) => void
    selectedSymbol?: string
}

export function CryptoTickerList({ cryptoData, twdRate, onSymbolSelect, selectedSymbol }: CryptoTickerListProps) {
    return (
        <Card className="h-[595px] flex flex-col">
            <CardHeader className="flex-shrink-0">
                <CardTitle>熱門虛擬貨幣行情</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
                <div className="h-full overflow-y-auto">
                    <Table>
                        <TableHeader className="sticky top-0 bg-white z-10">
                            <TableRow>
                                <TableHead className="w-[200px]">幣種</TableHead>
                                <TableHead className="text-right w-[150px]">價格 (USDT)</TableHead>
                                <TableHead className="text-right w-[120px]">24h 漲跌</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {cryptoData.map((crypto) => (
                                <CryptoTickerRow
                                    key={crypto.symbol}
                                    symbol={crypto.symbol}
                                    price={crypto.price}
                                    changePercent={crypto.changePercent}
                                    volume={crypto.volume}
                                    twdRate={twdRate}
                                    isSelected={selectedSymbol === crypto.symbol}
                                    onClick={() => onSymbolSelect?.(crypto.symbol)}
                                />
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    )
} 