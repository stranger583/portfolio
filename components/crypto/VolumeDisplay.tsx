interface VolumeDisplayProps {
    volume: number
}

export function VolumeDisplay({ volume }: VolumeDisplayProps) {
    const formatVolume = (vol: number) => {
        if (vol >= 1e9) {
            return `${(vol / 1e9).toFixed(2)}B`
        } else if (vol >= 1e6) {
            return `${(vol / 1e6).toFixed(2)}M`
        } else if (vol >= 1e3) {
            return `${(vol / 1e3).toFixed(2)}K`
        }
        return vol.toFixed(2)
    }

    return (
        <div className="text-sm text-muted-foreground">
            {formatVolume(volume)}
        </div>
    )
} 