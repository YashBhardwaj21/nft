import { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Upload, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/api/client';
import { parseEther } from 'viem';

// ABI for mint function
const MINT_ABI = [
    {
        "inputs": [
            { "internalType": "address", "name": "to", "type": "address" },
            { "internalType": "string", "name": "uri", "type": "string" }
        ],
        "name": "mint",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

interface MintModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function MintModal({ isOpen, onClose, onSuccess }: MintModalProps) {
    const { address } = useAccount();

    // Form State
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);

    // Status State
    const [step, setStep] = useState<'idle' | 'uploading' | 'minting' | 'confirming' | 'success'>('idle');
    const [draftId, setDraftId] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);

    // Wagmi Hooks
    const { writeContractAsync, isPending: isWalletSigning } = useWriteContract();

    // Wait for Tx
    const { isLoading: isTxConfirming, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({
        hash: txHash,
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const f = e.target.files[0];
            setFile(f);
            setPreview(URL.createObjectURL(f));
        }
    };

    const handleMint = async () => {
        if (!file || !name || !address) return;

        try {
            setStep('uploading');

            // 1. Prepare Mint (Upload to PINATA)
            const formData = new FormData();
            formData.append('image', file);
            formData.append('name', name);
            formData.append('description', description);
            // formData.append('attributes', JSON.stringify([])); 

            const prepRes = await api.post('/nfts/prepare', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const { tokenURI, draftId: newDraftId, contractAddress } = prepRes.data.data;
            setDraftId(newDraftId);

            // 2. Wallet Sign & Send
            setStep('minting');

            // Fallback address if not in env yet (Sepolia dummy for testing if strictly necessary, but better fail)
            const targetContract = contractAddress || import.meta.env.VITE_CONTRACT_ADDRESS;

            if (!targetContract) {
                throw new Error("Contract address not configured.");
            }

            const hash = await writeContractAsync({
                address: targetContract as `0x${string}`,
                abi: MINT_ABI,
                functionName: 'mint',
                args: [address, tokenURI],
            });

            setTxHash(hash);
            setStep('confirming');

            // Wait for transaction receipt (handled by hook) is handled by effect below

        } catch (error: any) {
            console.error("Mint failed:", error);
            setStep('idle');
            toast.error(error.message || "Failed to mint NFT");
        }
    };

    // Confirm backend once tx is mined
    // We use a separate useEffect to watch isTxSuccess from wagmi
    // or we can just poll. 
    // Actually, `useWaitForTransactionReceipt` is great.

    // EFFECT: Confirm on Backend
    if (step === 'confirming' && isTxSuccess && txHash && draftId) {
        // Only run once
        api.post('/nfts/confirm', { draftId, txHash })
            .then(() => {
                setStep('success');
                toast.success("Minted successfully!");
                onSuccess();
            })
            .catch(err => {
                console.error("Backend confirm failed:", err);
                toast.error("Minted on-chain but failed to confirm on backend.");
                setStep('success'); // Still success on chain
            });
    }

    const reset = () => {
        setName('');
        setDescription('');
        setFile(null);
        setPreview(null);
        setStep('idle');
        setTxHash(undefined);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && reset()}>
            <DialogContent className="sm:max-w-[425px] bg-[#12141f] border-white/10 text-white">
                <DialogHeader>
                    <DialogTitle>Mint New NFT</DialogTitle>
                    <DialogDescription className="text-gray-400">
                        Upload an image and create your NFT on Sepolia testnet.
                    </DialogDescription>
                </DialogHeader>

                {step === 'success' ? (
                    <div className="flex flex-col items-center justify-center py-8 space-y-4">
                        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center">
                            <CheckCircle className="w-8 h-8 text-green-500" />
                        </div>
                        <h3 className="text-xl font-bold">Minted!</h3>
                        <p className="text-sm text-gray-400 text-center">
                            Your NFT has been minted and is now verifying on the blockchain.
                        </p>
                        {txHash && (
                            <a
                                href={`https://sepolia.etherscan.io/tx/${txHash}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:underline flex items-center gap-1 text-sm"
                            >
                                View on Etherscan <ExternalLink className="w-3 h-3" />
                            </a>
                        )}
                        <Button onClick={reset} className="w-full mt-4">Close</Button>
                    </div>
                ) : (
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="image">Image</Label>
                            {preview ? (
                                <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-white/10 group">
                                    <img src={preview} alt="Preview" className="h-full w-full object-cover" />
                                    <button
                                        onClick={() => { setFile(null); setPreview(null); }}
                                        className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <span className="text-white text-xs font-bold">Remove</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="relative flex items-center justify-center w-full aspect-square border-2 border-dashed border-white/10 rounded-lg hover:border-primary/50 transition-colors cursor-pointer bg-white/5">
                                    <input
                                        type="file"
                                        id="image"
                                        accept="image/*"
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        onChange={handleFileChange}
                                    />
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <Upload className="w-8 h-8 mb-3 text-gray-400" />
                                        <p className="text-xs text-gray-400">PNG, JPG, GIF (Max 10MB)</p>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="bg-black/20 border-white/10"
                                placeholder="E.g. Cosmic Cube #1"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="bg-black/20 border-white/10"
                                placeholder="Describe your NFT..."
                            />
                        </div>
                    </div>
                )}

                {step !== 'success' && (
                    <DialogFooter>
                        <Button variant="outline" onClick={onClose} disabled={step !== 'idle'}>
                            Cancel
                        </Button>
                        <Button onClick={handleMint} disabled={!file || !name || step !== 'idle' || !address}>
                            {step === 'uploading' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {step === 'minting' && 'Confirm in Wallet...'}
                            {step === 'confirming' && (
                                <span className="flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Verifying...
                                </span>
                            )}
                            {step === 'idle' && 'Mint NFT'}
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
