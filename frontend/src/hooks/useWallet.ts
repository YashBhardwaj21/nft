import { useAccount } from 'wagmi';

export const useWallet = () => {
    const { address, isConnected } = useAccount();

    return {
        address,
        isConnected,
        // For compatibility with legacy code calling getSigner, though we should prefer wagmi hooks directly
        getSigner: async () => null
    };
};
