import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heart, Timer, User } from "lucide-react";
import { NFT } from "../../types";

interface NFTCardProps {
    nft: NFT;
    status?: 'listing' | 'owned' | 'rented';
    onAction?: (action: string, id: string) => void;
}

const NFTCard = ({ nft, status = 'listing', onAction }: NFTCardProps) => {
    // Determine if this is an owned NFT that is currently rented out
    const isRentedOut = status === 'owned' && (nft.status === 'rented' || nft.isEscrowed);

    return (
        <Card className="group relative overflow-hidden border border-indigo-500/20 bg-gradient-to-b from-[#1a1b2e] to-[#16172b] hover:border-indigo-500/50 transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-500/20 hover:-translate-y-2">

            {/* Image Section */}
            <div className="relative aspect-square overflow-hidden rounded-t-xl">
                <img
                    src={nft.image}
                    alt={nft.name}
                    className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-110"
                    loading="lazy"
                />

                {/* Overlay Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent opacity-60" />

                {/* Top Actions */}
                <div className="absolute top-3 right-3 flex gap-2">
                    <button className="p-2 rounded-full bg-black/40 backdrop-blur-md hover:bg-white/20 transition-colors text-white">
                        <Heart className="w-4 h-4" />
                    </button>
                </div>

                {/* Status Badge */}
                <div className="absolute top-3 left-3">
                    {status === 'rented' && (
                        <Badge variant="premium" className="backdrop-blur-md">
                            Rented
                        </Badge>
                    )}
                    {status === 'owned' && !isRentedOut && (
                        <Badge variant="secondary" className="backdrop-blur-md bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                            Owned
                        </Badge>
                    )}
                    {isRentedOut && (
                        <Badge variant="outline" className="backdrop-blur-md bg-yellow-500/20 text-yellow-300 border-yellow-500/30">
                            Rented Out
                        </Badge>
                    )}
                </div>

                {/* Bottom Info Overlay */}
                {(nft.timeLeft || status === 'listing' || isRentedOut) && (
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                        {(nft.timeLeft || nft.rentalEndDate) && (
                            <div className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-xs font-medium text-white flex items-center gap-1.5 border border-white/10">
                                <Timer className="w-3.5 h-3.5 text-primary" />
                                {nft.timeLeft || (nft.rentalEndDate ? new Date(nft.rentalEndDate).toLocaleDateString() : 'N/A')}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Content Section */}
            <div className="p-5 space-y-4">
                <div>
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-medium text-cyan-400 mb-1">{nft.collection}</p>
                            <h3 className="font-semibold text-lg leading-tight text-white group-hover:text-primary transition-colors">
                                {nft.name}
                            </h3>
                        </div>
                        {nft.likes && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Heart className="w-3 h-3" />
                                <span>{nft.likes}</span>
                            </div>
                        )}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-blue-300">
                        <User className="w-3 h-3" />
                        <span className="truncate max-w-[150px]">Created by {nft.creator}</span>
                    </div>
                </div>

                <div className="h-px bg-white/5" />

                {/* Pricing / Action Area */}
                <div className="flex items-end justify-between gap-4">

                    {status === 'listing' && (
                        <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-pink-400">Price</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-lg font-bold text-green-400">{nft.price}</span>
                                <span className="text-xs font-medium text-primary">{nft.currency}</span>
                            </div>
                        </div>
                    )}

                    {status === 'rented' && (
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-muted-foreground">Expires</span>
                            <span className="text-sm font-medium text-white">{nft.timeLeft || (nft.rentalEndDate ? new Date(nft.rentalEndDate).toLocaleDateString() : 'Unknown')}</span>
                        </div>
                    )}

                    {status === 'owned' && (
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-muted-foreground">Estimate</span>
                            <span className="text-sm font-medium text-white">{nft.price} {nft.currency}</span>
                        </div>
                    )}

                    {/* Action Button */}
                    <div className="flex-1 max-w-[120px]">
                        {status === 'listing' && (
                            <Button size="sm" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-500/25 border-0" onClick={() => onAction?.('rent', nft.id)}>
                                Rent Now
                            </Button>
                        )}
                        {status === 'owned' && !isRentedOut && (
                            <Button variant="outline" size="sm" className="w-full" onClick={() => onAction?.('list', nft.id)}>
                                List
                            </Button>
                        )}
                        {isRentedOut && (
                            <Button variant="secondary" size="sm" className="w-full opacity-70" disabled>
                                In Escrow
                            </Button>
                        )}
                        {status === 'rented' && (
                            <Button variant="destructive" size="sm" className="w-full" onClick={() => onAction?.('return', nft.id)}>
                                Return
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </Card>
    );
};

export default NFTCard;
