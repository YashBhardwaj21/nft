import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSignMessage } from 'wagmi';


interface User {
    id: string;
    username: string;
    email: string;
    walletAddress?: string;
    profileImage?: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (token: string, userData: User) => void;
    loginWithWallet: (address: string) => Promise<boolean>;
    logout: () => void;
    isAuthenticated: boolean;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        const verifySession = async () => {
            const currentToken = localStorage.getItem('token');
            if (!currentToken) {
                setLoading(false);
                return;
            }

            try {
                const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
                const response = await fetch(`${apiBaseUrl}/auth/verify-token`, {
                    headers: {
                        'Authorization': `Bearer ${currentToken}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.valid && data.user) {
                        setUser(data.user);
                    } else {
                        logout();
                    }
                } else {
                    logout();
                }
            } catch (error) {
                console.error('Session verification failed:', error);
                logout();
            } finally {
                setLoading(false);
            }
        };

        verifySession();
    }, []);

    const login = (newToken: string, userData: User) => {
        console.log("AuthContext: login called, setting token:", newToken.substring(0, 10) + "...");
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(userData));
        setToken(newToken);
        setUser(userData);
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
    };

    // Wagmi hook for signing messages
    const { signMessageAsync } = useSignMessage();

    const loginWithWallet = async (address: string) => {
        try {
            setLoading(true);
            const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

            // 1. Get Nonce from backend
            const nonceResponse = await fetch(`${apiBaseUrl}/auth/nonce/${address}`);
            const nonceData = await nonceResponse.json();

            if (!nonceResponse.ok || !nonceData.nonce) {
                throw new Error(nonceData.error || 'Failed to get nonce');
            }

            // 2. Construct EIP-4361 (SIWE) message
            const domain = window.location.host;
            const uri = window.location.origin;
            const issuedAt = new Date().toISOString();
            const message = [
                `${domain} wants you to sign in with your Ethereum account:`,
                address,
                '',
                'Sign in to DAO Marketplace',
                '',
                `URI: ${uri}`,
                'Version: 1',
                'Chain ID: 1',
                `Nonce: ${nonceData.nonce}`,
                `Issued At: ${issuedAt}`,
            ].join('\n');

            // 3. Request wallet signature
            const signature = await signMessageAsync({ message });

            // 4. Verify signature on backend
            const verifyResponse = await fetch(`${apiBaseUrl}/auth/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress: address, signature, message })
            });

            const verifyData = await verifyResponse.json();

            if (verifyResponse.ok && verifyData.token) {
                login(verifyData.token, verifyData.user);
                setLoading(false);
                return true;
            } else {
                throw new Error(verifyData.error || 'Verification failed');
            }
        } catch (error: any) {
            console.error("Wallet login failed", error);
            setLoading(false);
            throw error;
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            token,
            login,
            loginWithWallet,
            logout,
            isAuthenticated: !!token,
            loading
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
