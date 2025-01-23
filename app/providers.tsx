"use client";
import { Toaster } from "sonner";
import { PrivyProvider } from "@privy-io/react-auth";
import { AddressProvider } from "@/context/AddressContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import {PortabilityProvider} from "universal-portability"
import {createConfig} from '@privy-io/wagmi';


import {mainnet, polygon} from 'viem/chains';
import {http} from 'wagmi';

import {safe} from 'wagmi/connectors';
import {WagmiProvider} from '@privy-io/wagmi';

import './intersend-connector';
import { AutoConnectHandler } from './useIntersendAutoConnect';


import { useEffect } from "react";


if (!process.env.NEXT_PUBLIC_PRIVY_APP_ID) {
	throw new Error("One or more environment variables are not set");
}

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID as string;

const queryClient = new QueryClient();


const config = createConfig({
	chains: [mainnet, polygon], // Pass your required chains as an array
	connectors: [safe()],
	transports: {
	  [mainnet.id]: http(),
	  [polygon.id]: http(),
	  // For each of your required chains, add an entry to `transports` with
	  // a key of the chain's `id` and a value of `http()`
	},
  });






export default function Providers({ children }: { children: React.ReactNode }) {



return (
<>
			<PrivyProvider
				appId={privyAppId}
				config={{
					appearance: {
						theme: "light",
						accentColor: "#0065F5",
						logo: "/logos/basepay.svg",
					},
					loginMethodsAndOrder: {
						primary: ["email", "coinbase_wallet"],
						overflow: [
							"metamask",
							"rainbow",
							"wallet_connect",
							"detected_ethereum_wallets",
						],
					},
				}}
			>

				<QueryClientProvider client={queryClient}>
				<WagmiProvider config={config}>
					<AddressProvider>
					<AutoConnectHandler />
						{children}

						<Toaster position="bottom-right" richColors theme="light" />
					</AddressProvider>
				</WagmiProvider>	
				</QueryClientProvider>
			</PrivyProvider>
</>
  );
}