
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
    metaMaskWallet,
    rainbowWallet,
    coinbaseWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { sepolia, polygonAmoy } from 'wagmi/chains';

import { http } from 'wagmi';

const sepoliaRpcUrl =
    import.meta.env.VITE_SEPOLIA_RPC_URL ||
    'https://ethereum-sepolia-rpc.publicnode.com';

const hardhatLocal = {
    id: 31337,
    name: "Hardhat Local",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
        default: { http: ["http://127.0.0.1:8545"] },
    },
} as const;

const isLocal = import.meta.env.VITE_SUPPORTED_CHAIN_ID === "31337";

export const config = getDefaultConfig({
    appName: 'RentableNFT DAO',
    projectId: import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID || '3a8170812b534d0ff9d794f19a901d64',
    chains: (isLocal ? [hardhatLocal, sepolia, polygonAmoy] : [sepolia, polygonAmoy]) as any,
    transports: {
        [sepolia.id]: http(sepoliaRpcUrl),
        [polygonAmoy.id]: http(),
        [hardhatLocal.id]: http("http://127.0.0.1:8545"),
    },
    ssr: false,
    wallets: [
        {
            groupName: 'Recommended',
            wallets: [
                metaMaskWallet,
                rainbowWallet,
                coinbaseWallet,
            ],
        },
    ],
});
