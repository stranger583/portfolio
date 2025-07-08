import { Badge } from "@/components/ui/badge"

interface PriceChangeBadgeProps {
    changePercent: number
}

export function PriceChangeBadge({ changePercent }: PriceChangeBadgeProps) {
    const isPositive = changePercent >= 0
    const color = isPositive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
    const sign = isPositive ? "+" : ""

    return (
        <Badge variant="secondary" className={color}>
            {sign}{changePercent.toFixed(2)}%
        </Badge>
    )
} 