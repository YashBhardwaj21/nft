import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NFT } from "../../types";
import api from "../../api/client";
import { toast } from "sonner";
import { Loader2, CheckCircle, ExternalLink } from "lucide-react";
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { parseEther } from 'viem';

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

    const [approvalTxHash, setApprovalTxHash] = useState<`0x${string}` | undefined>(undefined);
    const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);

    // Wagmi Hooks
    const { writeContractAsync } = useWriteContract();

    // Wait for Approval Tx
    const { isSuccess: isApprovalSuccess } = useWaitForTransactionReceipt({
        hash: approvalTxHash,
    });

    // Wait for Listing Tx
    const { isSuccess: isTxSuccess, data: receipt } = useWaitForTransactionReceipt({
        hash: txHash,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log(`[ACTION] handleSubmit triggered! Form validated.`, {
            nftId: nft?.id,
            tokenId: nft?.tokenId,
            address: address,
            price: price,
            duration: duration
        });

        if (!nft || !nft.tokenId) {
            console.error(`[ERROR] Missing NFT data:`, nft);
            toast.error("This NFT is missing contract data and cannot be listed on-chain.");
            return;
        }

        if (!address) {
            console.error(`[ERROR] User is not connected to a wallet!`);
            toast.error("Wallet not connected.");
            return;
        }

        try {
            const marketplaceAddress = import.meta.env.VITE_MARKETPLACE_ADDRESS;
            console.log(`[DATA] Marketplace Address from env:`, marketplaceAddress);
            if (!marketplaceAddress) {
                throw new Error("Marketplace Address not configured in env");
            }

            console.log(`[STATE] Changing step to 'drafting'`);
            setStep('drafting');

            // 1. Hit Draft API
            console.log(`[NETWORK] Sending /marketplace/draft POST request...`);
            const draftRes = await api.post('/marketplace/draft', {
                nftId: nft.id,
                price: parseFloat(price),
                duration: parseInt(duration),
            });
            console.log(`[NETWORK] /marketplace/draft Response received:`, draftRes.data);

            const newDraftId = draftRes.data.data.draftId;
            const newMetadataHash = draftRes.data.data.metadataHash;
            console.log(`[DATA] Extracted Draft properties:`, { newDraftId, newMetadataHash });

            setDraftId(newDraftId);
            setMetadataHash(newMetadataHash);

            console.log(`[STATE] Changing step to 'approving'`);
            setStep('approving');

            // 2. Approve Marketplace to manage this specific NFT
            console.log(`[BLOCKCHAIN] Requesting writeContractAsync for approve()`, {
                address: import.meta.env.VITE_CONTRACT_ADDRESS,
                marketplaceAddress,
                tokenId: nft.tokenId
            });
            const approveHash = await writeContractAsync({
                address: import.meta.env.VITE_CONTRACT_ADDRESS as `0x${string}`,
                abi: NFT_ABI,
                functionName: 'approve',
                args: [marketplaceAddress as `0x${string}`, BigInt(nft.tokenId)]
            });
            console.log(`[BLOCKCHAIN] approve() Transaction submitted. Hash:`, approveHash);

            setApprovalTxHash(approveHash);
            console.log(`[STATE] Changing step to 'confirmingApproval'`);
            setStep('confirmingApproval');
            // The useEffect will catch the success and trigger the listing step

        } catch (error: any) {
            console.error("[ERROR] Transaction failed in handleSubmit:", error);
            setStep('idle');
            toast.error(error.message || "Failed to initiate transaction");
        }
    };

    // Effect: Once approval is confirmed, trigger the listing transaction
    useEffect(() => {
        if (step === 'confirmingApproval' && isApprovalSuccess && metadataHash) {
            const listToMarketplace = async () => {
                setStep('signing');
                try {
                    const marketplaceAddress = import.meta.env.VITE_MARKETPLACE_ADDRESS;
                    const hash = await writeContractAsync({
                        address: marketplaceAddress as `0x${string}`,
                        abi: MARKETPLACE_ABI,
                        functionName: 'listNFT',
                        args: [
                            import.meta.env.VITE_CONTRACT_ADDRESS as `0x${string}`,
                            BigInt(nft?.tokenId as string),
                            parseEther(price),
                            BigInt(1), // min duration 1 day
                            BigInt(parseInt(duration)),
                            metadataHash as `0x${string}` // passes the 0x prefixed hex
                        ],
                    });
                    setTxHash(hash);
                    setStep('confirming');
                } catch (error: any) {
                    console.error("Listing transaction failed:", error);
                    setStep('idle');
                    toast.error(error.message || "Failed to initiate listing transaction");
                }
            };
            listToMarketplace();
        }
    }, [step, isApprovalSuccess, writeContractAsync, nft, price, duration, metadataHash]);

    // Effect: Once transaction is confirmed, tell the backend
    useEffect(() => {
        if (step === 'confirming' && isTxSuccess && receipt && txHash && draftId) {
            setStep('backend');

            // Tell Backend (Fast Path)
            api.post('/marketplace/notify', {
                draftId,
                txHash
            }, { headers: { 'Idempotency-Key': crypto.randomUUID() } })
                .then(() => {
                    setStep('success');
                    toast.success("Successfully listed for rent!");
                    onSuccess();
                })
                .catch(err => {
                    console.error("Backend failed:", err);
                    // Even if backend fails, the chain listener will pick it up
                    toast.success("Listed on-chain! Synching to dashboard shortly...");
                    setStep('success');
                    onSuccess();
                });
        }
    }, [step, isTxSuccess, receipt, txHash, draftId, onSuccess]);

    const reset = () => {
        setPrice("");
        setDuration(import.meta.env.VITE_DEFAULT_RENTAL_DURATION || "30");
        setStep('idle');
        setTxHash(undefined);
        setApprovalTxHash(undefined);
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
