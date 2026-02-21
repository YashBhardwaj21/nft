import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NFT } from "../../types";
import api from "../../api/client";
import { toast } from "sonner";
import { Loader2, CheckCircle, ExternalLink } from "lucide-react";
import { useWriteContract, useAccount } from 'wagmi';
import { waitForTransactionReceipt } from '@wagmi/core';
import { parseEther } from 'viem';
import { config } from "../../config/wagmi";
import { ensureSepolia } from "../../lib/ensureCorrectNetwork";
import { verifyOwnership } from "../../lib/checkOwnership";

const MARKETPLACE_ABI = [
    {
        "inputs": [
            { "internalType": "address", "name": "tokenAddress", "type": "address" },
            { "internalType": "uint256", "name": "tokenId", "type": "uint256" },
            { "internalType": "uint256", "name": "pricePerDay", "type": "uint256" },
            { "internalType": "uint64", "name": "minDuration", "type": "uint64" },
            { "internalType": "uint64", "name": "maxDuration", "type": "uint64" },
            { "internalType": "bytes32", "name": "metadataHash", "type": "bytes32" }
        ],
        "name": "listNFT",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

const NFT_ABI = [
    {
        "inputs": [
            { "internalType": "address", "name": "to", "type": "address" },
            { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
        ],
        "name": "approve",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

interface RentListingModalProps {
    isOpen: boolean;
    onClose: () => void;
    nft: NFT | null;
    onSuccess: () => void;
}

const RentListingModal = ({ isOpen, onClose, nft, onSuccess }: RentListingModalProps) => {
    const { address } = useAccount();

    const [price, setPrice] = useState("");
    const [duration, setDuration] = useState(import.meta.env.VITE_DEFAULT_RENTAL_DURATION || "30"); // Default from env
    const currency = import.meta.env.VITE_CURRENCY_SYMBOL || "ETH";

    // Status State
    const [step, setStep] = useState<'idle' | 'drafting' | 'approving' | 'confirmingApproval' | 'signing' | 'confirming' | 'backend' | 'success'>('idle');
    const [draftId, setDraftId] = useState<string | null>(null);
    const [metadataHash, setMetadataHash] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
    const [pending, setPending] = useState(false);

    // Wagmi Hooks
    const { writeContractAsync } = useWriteContract();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (pending) return;
        setPending(true);

        try {
            if (!nft || !nft.tokenId) {
                toast.error("This NFT is missing contract data and cannot be listed on-chain.");
                return;
            }

            if (!address) {
                toast.error("Wallet not connected.");
                return;
            }

            const marketplaceAddress = import.meta.env.VITE_MARKETPLACE_ADDRESS;
            const contractAddress = nft.tokenAddress || nft.contractAddress || import.meta.env.VITE_CONTRACT_ADDRESS;

            if (!marketplaceAddress) {
                throw new Error("Marketplace Address not configured in env");
            }

            // 1. Preflight Checks
            await ensureSepolia();
            await verifyOwnership(contractAddress as Extract<`0x${string}`, string>, BigInt(nft.tokenId), address as Extract<`0x${string}`, string>);

            setStep('drafting');

            // 2. Hit Draft API
            const draftRes = await api.post('/marketplace/draft', {
                nftId: nft.id,
                price: parseFloat(price),
                duration: parseInt(duration),
            });

            const newDraftId = draftRes.data.data.draftId;
            const newMetadataHash = draftRes.data.data.metadataHash;

            setDraftId(newDraftId);
            setMetadataHash(newMetadataHash);

            setStep('approving');

            // 3. Approve Marketplace
            const approveHash = await writeContractAsync({
                address: contractAddress as `0x${string}`,
                abi: NFT_ABI,
                functionName: 'approve',
                args: [marketplaceAddress as `0x${string}`, BigInt(nft.tokenId)]
            });

            setStep('confirmingApproval');
            await waitForTransactionReceipt(config, { hash: approveHash });

            // 4. Create Listing
            setStep('signing');
            const listHash = await writeContractAsync({
                address: marketplaceAddress as `0x${string}`,
                abi: MARKETPLACE_ABI,
                functionName: 'listNFT',
                args: [
                    contractAddress as `0x${string}`,
                    BigInt(nft.tokenId),
                    parseEther(price),
                    BigInt(1), // min duration 1 day
                    BigInt(parseInt(duration)),
                    newMetadataHash as `0x${string}`
                ],
            });

            setTxHash(listHash);
            setStep('confirming');
            await waitForTransactionReceipt(config, { hash: listHash });

            // 5. Backend Confirmation
            setStep('backend');
            await api.post('/marketplace/notify', {
                draftId: newDraftId,
                txHash: listHash
            }, { headers: { 'Idempotency-Key': crypto.randomUUID() } });

            setStep('success');
            toast.success("Successfully listed for rent!");
            onSuccess();

        } catch (error: any) {
            console.error("[ERROR] Transaction failed in handleSubmit:", error);
            setStep('idle');
            // If the user rejects the transaction, viability shouldn't show it as an ugly error string to the user necessarily but we log it.
            if (error.message?.includes("User rejected")) {
                toast.error("Transaction cancelled.");
            } else {
                toast.error(error.message || "Failed to initiate transaction");
            }
        } finally {
            setPending(false);
        }
    };

    const reset = () => {
        if (pending) return;
        setPrice("");
        setDuration(import.meta.env.VITE_DEFAULT_RENTAL_DURATION || "30");
        setStep('idle');
        setTxHash(undefined);
        setDraftId(null);
        setMetadataHash(null);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && reset()}>
            <DialogContent className="sm:max-w-[425px] bg-[#1a1b2e] border-white/10 text-white">
                <DialogHeader>
                    <DialogTitle>List {nft?.name} for Rent</DialogTitle>
                    <DialogDescription className="text-gray-400">
                        Set your daily rental price and maximum duration.
                    </DialogDescription>
                </DialogHeader>

                {step === 'success' ? (
                    <div className="flex flex-col items-center justify-center py-8 space-y-4">
                        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center">
                            <CheckCircle className="w-8 h-8 text-green-500" />
                        </div>
                        <h3 className="text-xl font-bold">Listed!</h3>
                        <p className="text-sm text-gray-400 text-center">
                            Your NFT is now available for rent on the marketplace.
                        </p>
                        {txHash && (
                            <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline flex items-center gap-1 text-sm">
                                View transaction <ExternalLink className="w-3 h-3" />
                            </a>
                        )}
                        <Button onClick={reset} className="w-full mt-4 bg-white text-black hover:bg-gray-200">Close</Button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="price" className="text-white">Daily Price ({currency})</Label>
                            <Input
                                id="price"
                                type="number"
                                step="0.001"
                                placeholder="0.01"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                className="bg-black/40 border-white/10 text-white placeholder:text-gray-600 focus:border-cyan-500/50"
                                required
                                disabled={step !== 'idle'}
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
                                disabled={step !== 'idle'}
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={reset} disabled={step !== 'idle'} className="border-white/10 text-white hover:bg-white/5 hover:text-white">
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={step !== 'idle' || !price}
                                className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white border-0"
                                onClick={(e) => {
                                    console.log(`[USER CLICK EVENT] Submit button actual onClick triggered.`);
                                    if (!price || !duration) {
                                        console.warn(`[WARNING] Price or duration is empty! Browser HTML5 validation might block this submit natively.`);
                                    }
                                }}
                            >
                                {step === 'drafting' && <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Preparing Listing...</>}
                                {step === 'approving' && <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Confirm Approval in Wallet...</>}
                                {step === 'confirmingApproval' && <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Waiting for Approval...</>}
                                {step === 'signing' && <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Confirm Listing in Wallet...</>}
                                {step === 'confirming' && <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Waiting for block...</>}
                                {step === 'backend' && <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Syncing data...</>}
                                {step === 'idle' && 'List Asset'}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default RentListingModal;
