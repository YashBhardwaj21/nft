
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
    metaMaskWallet,
    rainbowWallet,
    coinbaseWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { sepolia, polygonAmoy } from 'wagmi/chains';

import { http } from 'wagmi';

export const config = getDefaultConfig({
    appName: 'RentableNFT DAO',
    projectId: import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID || '3a8170812b534d0ff9d794f19a901d64',
    chains: [sepolia, polygonAmoy],
    transports: {
        [sepolia.id]: http('https://eth-sepolia.g.alchemy.com/v2/58zSpALvUAi9RkVKJA7g4'),
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
