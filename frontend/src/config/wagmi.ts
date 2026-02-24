
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

export const config = getDefaultConfig({
    appName: 'RentableNFT DAO',
    projectId: import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID || '3a8170812b534d0ff9d794f19a901d64',
    chains: [sepolia, polygonAmoy] as any,
    transports: {
        [sepolia.id]: http(sepoliaRpcUrl),
        [polygonAmoy.id]: http(),
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
