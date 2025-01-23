// useIntersendAutoConnect.js
import { useEffect, useState, useCallback } from 'react';
import { useWallets, usePrivy } from '@privy-io/react-auth';

/**
 * Hook for handling Intersend wallet auto-connection
 */
function useIntersendAutoConnect() {
  const { wallets, ready } = useWallets();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);

  const connectWallet = useCallback(async (address) => {
    const wallet = wallets.find(
      (w) => w.address?.toLowerCase() === address.toLowerCase()
    );

    if (wallet) {
      try {
        await wallet.loginOrLink();
        return true;
      } catch (err) {
        console.error('Wallet login/link error:', err);
        throw err;
      }
    }
    return false;
  }, [wallets]);

  useEffect(() => {
    if (!ready || isConnecting || !window.ethereum?._state?.accounts?.length) {
      return;
    }

    const autoConnect = async () => {
      try {
        setIsConnecting(true);
        setError(null);

        const address = window.ethereum._state.accounts[0];
        const connected = await connectWallet(address);

        if (!connected) {
          console.log('No matching wallet found for address:', address);
        }
      } catch (err) {
        console.error('Auto-connect error:', err);
        setError(err);
      } finally {
        setIsConnecting(false);
      }
    };

    autoConnect();
  }, [ready, wallets, isConnecting, connectWallet]);

  return { isConnecting, error };
}

/**
 * Component that handles auto-connection of Intersend wallet
 * Usage: Just include this component in your app's provider wrapper
 * <AutoConnectHandler />
 */
export function AutoConnectHandler() {
  const { isConnecting, error } = useIntersendAutoConnect();
  
  useEffect(() => {
    if (error) {
      console.error('Auto-connect error:', error);
      // You can add additional error handling here, like showing a toast notification
      // toast.error('Failed to auto-connect wallet');
    }
  }, [error]);

  // Component doesn't render anything
  return null;
}

// Export both the hook and the component
export { useIntersendAutoConnect };

// Default export is the component for easier imports
export default AutoConnectHandler;