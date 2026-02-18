import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { LogIn, Loader2, User, ChevronDown } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useNavigate } from "react-router-dom";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export const WalletConnectButton = () => {
    const { user, loginWithWallet, logout, isAuthenticated } = useAuth();
    const [isSigningIn, setIsSigningIn] = useState(false);
    const [shouldNavigate, setShouldNavigate] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (isAuthenticated && shouldNavigate) {
            navigate("/my-nfts");
            setShouldNavigate(false);
        }
    }, [isAuthenticated, shouldNavigate, navigate]);

    const handleSignIn = async (address: string) => {
        try {
            setIsSigningIn(true);
            const success = await loginWithWallet(address);
            if (success) {
                toast.success("Successfully signed in!");
                // Force navigation immediately on success
                navigate("/my-nfts");
            }
        } catch (error: any) {
            console.error("Sign in failed:", error);
            toast.error(error.message || "Sign in failed. Please try again.");
        } finally {
            setIsSigningIn(false);
        }
    }

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
                            <Button variant="outline" onClick={openAccountModal} className="border-white/10">
                                {account.displayName}
                            </Button>
                            <Button
                                onClick={() => handleSignIn(account.address)}
                                disabled={isSigningIn}
                                className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 border-yellow-500/20 border"
                            >
                                {isSigningIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4 mr-2" />}
                                Sign In
                            </Button>
                        </div>
                    );
                }

                // Authenticated
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
