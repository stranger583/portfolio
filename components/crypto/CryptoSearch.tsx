import { Input } from "@/components/ui/input"

interface CryptoSearchProps {
    searchTerm: string
    onSearchChange: (value: string) => void
}

export function CryptoSearch({ searchTerm, onSearchChange }: CryptoSearchProps) {
    return (
        <div className="w-full max-w-md">
            <Input
                type="text"
                placeholder="搜尋虛擬貨幣..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full"
            />
        </div>
    )
} 