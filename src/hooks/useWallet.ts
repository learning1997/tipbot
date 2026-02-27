import { useCallback, useMemo } from 'react';
import { useWalletConnect, SupportedWallets } from '@btc-vision/walletconnect';
import { networks } from '@btc-vision/bitcoin';

export interface WalletState {
    isConnected: boolean;
    address: string | null;
    opAddress: string | null;
    signer: any | null;
    network: any;
    p2tr?: string | null;
}

export const useWallet = () => {
    const {
        walletAddress,
        address: opAddressObj,
        publicKey,
        signer,
        connectToWallet,
        disconnect: disconnectWallet,
    } = useWalletConnect();

    const isConnected = !!walletAddress;

    const connect = useCallback(async () => {
        try {
            // Explicitly connect to OP_WALLET for full feature support
            await connectToWallet(SupportedWallets.OP_WALLET);
            localStorage.setItem('wallet_connected_type', 'opnet');
        } catch (error: any) {
            console.error('OP_NET connection error:', error);
            // Some errors are just the user closing the modal
            if (!error?.message?.includes('User rejected')) {
                alert(`Wallet Error: ${error?.message || 'Unknown error'}`);
            }
        }
    }, [connectToWallet]);

    const disconnect = useCallback(() => {
        disconnectWallet();
        localStorage.removeItem('wallet_connected_type');
    }, [disconnectWallet]);

    const walletState = useMemo(() => {
        return {
            isConnected,
            address: walletAddress || null,
            // Use the address object's toString() for the bech32 representation
            opAddress: opAddressObj ? opAddressObj.toString() : null,
            publicKey: publicKey || null,
            signer: signer,
            network: networks.testnet,
            p2tr: walletAddress || null,
            connect,
            disconnect
        };
    }, [isConnected, walletAddress, opAddressObj, publicKey, signer, connect, disconnect]);

    return walletState;
};
