import { TableCell, TableRow } from "@/components/ui/table"
import { PriceChangeBadge } from "./PriceChangeBadge"
import { VolumeDisplay } from "./VolumeDisplay"

interface CryptoTickerRowProps {
    symbol: string
    price: number
    changePercent: number
    volume: number
    twdRate: number
    isSelected?: boolean
    onClick?: () => void
}

export function CryptoTickerRow({
    symbol,
    price,
    changePercent,
    volume,
    twdRate,
    isSelected = false,
    onClick
}: CryptoTickerRowProps) {
    const twdPrice = price * twdRate

    return (
        <TableRow
            className={`hover:bg-muted/50 cursor-pointer transition-colors ${isSelected ? 'bg-muted/30 border-l-4 border-l-primary' : ''
                }`}
            onClick={onClick}
        >
            <TableCell>
                <div>
                    <div className="font-medium">{symbol}</div>
                    <div className="text-sm text-muted-foreground">
                        <VolumeDisplay volume={volume} />
                    </div>
                </div>
            </TableCell>

            <TableCell className="text-right font-medium">
                <div>
                    <div className="font-medium">${price.toFixed(4)}</div>
                    <div className="text-sm text-muted-foreground">NT$ {twdPrice.toFixed(2)}</div>
                </div>
            </TableCell>

            <TableCell className="text-right">
                <PriceChangeBadge changePercent={changePercent} />
            </TableCell>
        </TableRow>
    )
} 