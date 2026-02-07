import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NFT } from "../../types";
import api from "../../api/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface RentListingModalProps {
    isOpen: boolean;
    onClose: () => void;
    nft: NFT | null;
    onSuccess: () => void;
}

const RentListingModal = ({ isOpen, onClose, nft, onSuccess }: RentListingModalProps) => {
    const [price, setPrice] = useState("");
    const [duration, setDuration] = useState("30"); // Default 30 days
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nft) return;

        setIsLoading(true);
        try {
            await api.post(`/marketplace/list/${nft.id}`, {
                price: parseFloat(price),
                type: 'rent',
                duration: parseInt(duration)
            });
            toast.success("Correctly listed for rent!");
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error(error);
            toast.error(error.response?.data?.error || "Failed to list NFT");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px] bg-[#1a1b2e] border-white/10 text-white">
                <DialogHeader>
                    <DialogTitle>List {nft?.name} for Rent</DialogTitle>
                    <DialogDescription className="text-gray-400">
                        Set your daily rental price and maximum duration.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="price" className="text-white">Daily Price (ETH)</Label>
                        <Input
                            id="price"
                            type="number"
                            step="0.001"
                            placeholder="0.01"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            className="bg-black/40 border-white/10 text-white placeholder:text-gray-600 focus:border-cyan-500/50"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="duration" className="text-white">Max Duration (Days)</Label>
                        <Input
                            id="duration"
                            type="number"
                            placeholder="30"
                            value={duration}
                            onChange={(e) => setDuration(e.target.value)}
                            className="bg-black/40 border-white/10 text-white placeholder:text-gray-600 focus:border-cyan-500/50"
                            required
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} className="border-white/10 text-white hover:bg-white/5 hover:text-white">
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading || !price} className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white border-0">
                            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            List Asset
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default RentListingModal;
