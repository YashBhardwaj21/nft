import { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { LogIn, Loader2, ChevronDown, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from "wagmi";
import { useNavigate } from "react-router-dom";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "./ui/dropdown-menu";

const SIGN_TIMEOUT_MS = 60_000; // 1 minute

export const WalletConnectButton = () => {
    const { user, loginWithWallet, logout, isAuthenticated } = useAuth();
    const navigate = useNavigate();

    // UI State Machine
    const [isSigningIn, setIsSigningIn] = useState(false);
    const [wasRejected, setWasRejected] = useState(false);
    const [signError, setSignError] = useState<string | null>(null);
    const [shouldNavigate, setShouldNavigate] = useState(false);

    // Core references
    const hasAttempted = useRef(false);
    const { address: connectedAddress, isConnected, isDisconnected } = useAccount();

    // 1. Auto-logout on wallet switch
    useEffect(() => {
        if (!isAuthenticated || !connectedAddress || !user?.walletAddress) return;
        const connectedLower = connectedAddress.toLowerCase();
        const sessionLower = user.walletAddress.toLowerCase();
        if (connectedLower !== sessionLower) {
            logout();
            hasAttempted.current = false; // Allow auto-sign on the new account
            toast.info("Wallet switched — please sign in with your new account.");
        }
    }, [connectedAddress, isAuthenticated, user?.walletAddress, logout]);

    // 2. Global 401 Interceptor Listener
    // When api/client.ts catches an expired JWT (401), it dispatches 'auth:unauthorized'
    useEffect(() => {
        const handleUnauthorized = () => {
            hasAttempted.current = false; // Reset attempt so we can automatically prompt them again
            toast.error("Session expired. Reconnecting...");
            // Notice: we don't call handleSignIn directly here because the useEffect directly below 
            // will catch that `isAuthenticated` is now false, `isConnected` is true, and `hasAttempted` is false!
        };
        window.addEventListener('auth:unauthorized', handleUnauthorized);
        return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
    }, []);

    // 3. Reset auto-sign attempt exactly when disconnected
    // Fixes the issue where re-connecting in the same browser session doesn't trigger auto-sign
    useEffect(() => {
        if (!connectedAddress || isDisconnected) {
            hasAttempted.current = false;
            setWasRejected(false);
            setSignError(null);
        }
    }, [connectedAddress, isDisconnected]);

    // 4. Navigate post-render hook
    useEffect(() => {
        if (isAuthenticated && shouldNavigate) {
            navigate("/my-nfts");
            setShouldNavigate(false);
        }
    }, [isAuthenticated, shouldNavigate, navigate]);

    const handleSignIn = async () => {
        if (!connectedAddress) {
            toast.error("Please connect your wallet first");
            return;
        }

        setWasRejected(false);
        setSignError(null);
        setIsSigningIn(true);

        const timer = setTimeout(() => {
            setIsSigningIn(false);
            hasAttempted.current = false; // allow retry if they just walked away
            setSignError("Signature request timed out. Please try again.");
        }, SIGN_TIMEOUT_MS);

        try {
            const success = await loginWithWallet(connectedAddress);
            clearTimeout(timer);
            if (success) {
                toast.success("Successfully signed in!");
                navigate("/my-nfts");
            }
        } catch (error: any) {
            clearTimeout(timer);
            setIsSigningIn(false);

            // 4001 is the standard MetaMask/EIP-1193 rejection error code
            if (error?.code === 4001 || error?.message?.includes("rejected")) {
                setWasRejected(true);
                // Leave hasAttempted as true so we don't spam them again
            } else {
                setSignError(error.message || "Sign in failed. Please try again.");
                hasAttempted.current = false; // Allow manual retry
            }
        }
    };

    // 5. Automatic SIWE trigger
    // Waits for strict 'connected' status to prevent race conditions during Wagmi flicker
    useEffect(() => {
        if (isConnected && connectedAddress && !isAuthenticated && !hasAttempted.current) {
            hasAttempted.current = true;
            handleSignIn();
        }
    }, [isConnected, connectedAddress, isAuthenticated]);

    // Render logic
    return (
        <ConnectButton.Custom>
            {({
                account,
                chain,
                openAccountModal,
                openChainModal,
                openConnectModal,
                authenticationStatus,
                mounted,
            }) => {
                const ready = mounted && authenticationStatus !== 'loading';
                const connected =
                    ready &&
                    account &&
                    chain &&
                    (!authenticationStatus ||
                        authenticationStatus === 'authenticated');

                if (!ready) {
                    return (
                        <Button variant="outline" disabled className="opacity-50 pointer-events-none">
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Loading...
                        </Button>
                    );
                }

                if (!connected) {
                    return (
                        <Button onClick={openConnectModal} className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0">
                            Connect Wallet
                        </Button>
                    );
                }

                if (chain.unsupported) {
                    return (
                        <Button variant="destructive" onClick={openChainModal}>
                            Wrong network
                        </Button>
                    );
                }

                // Connected but NOT Authenticated with Backend (SIWE)
                if (!isAuthenticated) {
                    return (
                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={openAccountModal} className="border-white/10 hidden sm:flex">
                                {account.displayName}
                            </Button>

                            {isSigningIn ? (
                                <Button disabled className="bg-white/10 text-white min-w-[140px]">
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Signing in...
                                </Button>
                            ) : wasRejected ? (
                                <Button
                                    onClick={handleSignIn}
                                    className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 border-yellow-500/20 border min-w-[140px]"
                                >
                                    <LogIn className="w-4 h-4 mr-2" />
                                    Sign In (Click to try again)
                                </Button>
                            ) : signError ? (
                                <Button
                                    onClick={handleSignIn}
                                    className="bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/20 border min-w-[140px] group relative overflow-hidden"
                                >
                                    <AlertCircle className="w-4 h-4 mr-2" />
                                    Sign In Failed
                                    <div className="absolute inset-0 bg-[#09090b]/90 items-center justify-center hidden group-hover:flex">
                                        <span className="text-sm font-medium">Retry Sign In</span>
                                    </div>
                                </Button>
                            ) : (
                                <Button
                                    onClick={handleSignIn}
                                    className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 border-yellow-500/20 border min-w-[140px]"
                                >
                                    <LogIn className="w-4 h-4 mr-2" />
                                    Sign In
                                </Button>
                            )}
                        </div>
                    );
                }

                // Fully Authenticated
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-pulse" />
                                <span className="mr-2">{user?.username || account.displayName}</span>
                                <ChevronDown className="w-4 h-4 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 bg-[#09090b] border-white/10 text-white">
                            <DropdownMenuLabel>My Account</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-white/10" />
                            <DropdownMenuItem className="focus:bg-white/5 cursor-pointer" onClick={openAccountModal}>
                                Wallet Details
                            </DropdownMenuItem>
                            <DropdownMenuItem className="focus:bg-white/5 cursor-pointer text-red-400 focus:text-red-300" onClick={logout}>
                                Disconnect App
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            }}
        </ConnectButton.Custom>
    );
};
