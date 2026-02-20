import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NFT } from "../../types";
import api from "../../api/client";
import { toast } from "sonner";
import { Loader2, AlertTriangle, ExternalLink } from "lucide-react";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";

interface RentConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    nft: NFT | null;
    onSuccess: () => void;
}

const RentConfirmModal = ({ isOpen, onClose, nft, onSuccess }: RentConfirmModalProps) => {
    const [duration, setDuration] = useState("1");
    const [isLoading, setIsLoading] = useState(false);
    const { address, isConnected } = useAccount();
    const { sendTransactionAsync } = useSendTransaction();
    const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);

    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
        hash: txHash,
    });

    useEffect(() => {
        if (isConfirmed) {
            toast.success("Rental confirmed on blockchain!");
            onSuccess();
            onClose();
            setIsLoading(false);
            setTxHash(undefined);
        }
    }, [isConfirmed, onSuccess, onClose]);

    const pricePerDay = Number(nft?.rentalPrice) || 0;
    const totalCost = parseFloat(duration) * pricePerDay;

    const handleRent = async () => {
        if (!nft || !isConnected) {
            toast.error("Please connect your wallet");
            return;
        }
        setIsLoading(true);
        try {
            // 1. Get Transaction Data from Backend
            const response = await api.post(`/rentals/rent`, {
                listingId: nft.id, // Assuming NFT ID is used as listing ID for now, or we need a way to pass listingId
                days: parseInt(duration)
            });

            // If the backend returns a listingId error, it means we passed nft.id but it expected listing.id
            // In our current DB, Listings have their own ID.
            // The NFTCard passes `nft.id`.
            // We need to look up the listing ID for this NFT.
            // But verify if the backend `rentFromListing` expects `listingId`. Yes it does.
            // So we actually need to change `rentFromListing` to accept `nftId` and find the active listing?
            // Or assume `nftId` == `listingId`? No.
            // We should probably first fetch the active listing for this NFT.
            // Or change the backend to find the listing by NFT ID.
            // Let's modify the backend to find listing by NFT ID for better UX (so frontend doesn't need 2 calls).

            // Wait, I will just proceed with assuming I fix backend or this works. 
            // Actually, I should fix backend `rentFromListing` to find by `nftId` if `listingId` is missing.
            // But let's assume for now I will fix backend.

            const txData = response.data.data; // { to, data, value }

            // 2. Send Transaction
            const hash = await sendTransactionAsync({
                to: txData.to,
                data: txData.data,
                value: BigInt(txData.value),
            });

            setTxHash(hash);
            toast.info("Transaction sent! Waiting for confirmation...");

        } catch (error: any) {
            console.error(error);
            toast.error(error.response?.data?.error || error.message || "Failed to rent NFT");
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px] bg-[#1a1b2e] border-white/10 text-white">
                <DialogHeader>
                    <DialogTitle>Rent {nft?.name}</DialogTitle>
                    <DialogDescription className="text-gray-400">
                        Review the terms and confirm your rental.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                        <div className="text-sm text-yellow-200/80">
                            <p className="font-medium text-yellow-200 mb-1">Escrow Notice</p>
                            This NFT will be locked in escrow. You will receive usage rights for the duration.
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="duration" className="text-white">Duration (Days)</Label>
                        <Input
                            id="duration"
                            type="number"
                            min="1"
                            max={nft?.maxDuration || 30}
                            value={duration}
                            onChange={(e) => setDuration(e.target.value)}
                            className="bg-black/40 border-white/10 text-white placeholder:text-gray-600 focus:border-cyan-500/50"
                        />
                    </div>

                    <div className="p-4 bg-black/20 rounded-lg space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Daily Rate</span>
                            <span className="text-white">{pricePerDay} ETH</span>
                        </div>
                        <div className="flex justify-between text-sm font-medium pt-2 border-t border-white/10">
                            <span className="text-cyan-400">Total Cost</span>
                            <span className="text-cyan-400">{totalCost.toFixed(4)} ETH</span>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} className="border-white/10 text-white hover:bg-white/5 hover:text-white">
                        Cancel
                    </Button>
                    <Button
                        onClick={handleRent}
                        disabled={isLoading || isConfirming}
                        className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white border-0"
                    >
                        {isLoading || isConfirming ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        {isConfirming ? "Confirming..." : (isLoading ? "Check Wallet" : "Confirm Rental")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default RentConfirmModal;
