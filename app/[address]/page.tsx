"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useRef, useState } from "react";

import jsPDF from "jspdf";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import { QRCode } from "react-qrcode-logo";
import { TbFileDownload } from "react-icons/tb";

import {
	CheckmarkIcon,
	CopyIcon,
	LoadingIcon,
	PaycrestLogo,
} from "@/components/ImageAssets";
import {
	AnimatedContainer,
	AnimatedItem,
	BasepayPdf,
	Custom404,
	Navbar,
	Preloader,
	primaryButtonStyles,
	RateCalculator,
	secondaryButtonStyles,
} from "@/components";
import { classNames, formatCurrency } from "../utils";
import type { LinkedAddressResponse } from "../types";
import { useAddressContext } from "@/context/AddressContext";
import { fetchLinkedAddress, fetchRate } from "../api/aggregator";

export default function BasepayLink() {
	const pathname = usePathname();
	const rawAddress = pathname.split("/").pop() as string;

	if (
		(!rawAddress?.startsWith("0x") || rawAddress?.length !== 42) &&
		!rawAddress?.includes(".base.eth")
	) {
		return <Custom404 address={rawAddress} isAddressInvalid={true} />;
	}

	const { ready, user, authenticated } = usePrivy();
	const { basename } = useAddressContext();

	const [rate, setRate] = useState(0);
	const [hasError, setHasError] = useState(false);
	const [isGenerating, setIsGenerating] = useState(false);
	const [isPageLoading, setIsPageLoading] = useState(true);
	const [isAddressCopied, setIsAddressCopied] = useState(false);
	const [exportFormat, setExportFormat] = useState<"pdf" | "png">("pdf");
	const [addressStatusResponse, setAddressStatusResponse] =
		useState<LinkedAddressResponse>();

	const basepayPdfRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		const fetchAndSetAddressStatus = async () => {
			setIsPageLoading(true);
			try {
				const response = await fetchLinkedAddress({ address: rawAddress });
				setAddressStatusResponse(response);
			} catch (error) {
				console.error("Error fetching linked address:", error);
				setHasError(true);
				toast.error("Failed to fetch address information");
			} finally {
				setIsPageLoading(false);
			}
		};

		fetchAndSetAddressStatus();
	}, [rawAddress]);

	useEffect(() => {
		const getRate = async () => {
			if (
				!addressStatusResponse?.linkedAddress ||
				!addressStatusResponse.currency
			)
				return;

			try {
				const rateResponse = await fetchRate({
					currency: addressStatusResponse.currency,
					amount: 1,
					token: "usdt",
				});
				setRate(rateResponse.data);
			} catch (error) {
				console.error("Error fetching rate:", error);
				toast.error("Failed to fetch exchange rate");
			}
		};

		getRate();
	}, [addressStatusResponse]);

	const handleCopyAddress = () => {
		if (addressStatusResponse?.linkedAddress) {
			navigator.clipboard.writeText(addressStatusResponse.linkedAddress);
			setIsAddressCopied(true);
			setTimeout(() => setIsAddressCopied(false), 2000);
		}
	};

	const handleExport = async () => {
		setIsGenerating(true);

		try {
			if (basepayPdfRef.current) {
				const canvas = await html2canvas(basepayPdfRef.current, {
					scale: 2,
					useCORS: true,
					logging: false,
				});

				if (exportFormat === "png") {
					// Export as PNG
					const blob = await new Promise<Blob>((resolve) => {
						canvas.toBlob((blob) => {
							resolve(blob as Blob);
						}, "image/png");
					});

					const url = URL.createObjectURL(blob);
					const link = document.createElement("a");
					link.href = url;
					link.download = "basepay_image.png";
					document.body.appendChild(link);
					link.click();
					document.body.removeChild(link);
					URL.revokeObjectURL(url);
				} else {
					// Export as PDF
					const imgWidth = 297; // A4 width in mm
					const imgHeight = (canvas.height * imgWidth) / canvas.width;

					const pdf = new jsPDF("l", "mm", "a4");
					pdf.addImage(
						canvas.toDataURL("image/png"),
						"PNG",
						0,
						0,
						imgWidth,
						imgHeight,
					);

					pdf.save("basepay_document.pdf");
				}
			}
		} catch (error) {
			console.error("Error generating export:", error);
			toast.error("Error generating export");
		} finally {
			setIsGenerating(false);
		}
	};

	if (!ready || isPageLoading) return <Preloader isLoading={true} />;

	if (hasError || !addressStatusResponse?.linkedAddress) {
		return <Custom404 address={rawAddress} />;
	}

	return (
		<>
			<RateCalculator
				defaultSelectedCurrency={addressStatusResponse?.currency}
			/>

			{ready && authenticated && <Navbar />}

			<AnimatedContainer
				className={classNames(
					"w-full min-h-screen flex flex-col gap-8 max-w-md mx-auto",
					ready && authenticated ? "pt-20" : "pt-4",
				)}
			>
				<div className="flex-grow p-6 text-sm space-y-5 lg:content-center">
					{ready && !authenticated && (
						<AnimatedItem>
							<Link
								href="/"
								title="Go to basepay"
								className="flex items-center justify-center gap-1 pb-2"
							>
								<p className="text-text-primary text-base sm:text-lg font-semibold">
									basepay
								</p>
								<PaycrestLogo className="size-2.5" />
							</Link>
						</AnimatedItem>
					)}

					<AnimatedItem className="space-y-4">
						<div className="flex items-center justify-between">
							<p className="text-text-secondary">Supported tokens</p>
							<div className="flex gap-2">
								{["usdc"].map((token) => (
									<div key={token} className="flex gap-1 items-center">
										<Image
											src={`/logos/${token}.svg`}
											alt={token}
											width={0}
											height={0}
											className="size-4"
										/>
										<p className="text-text-primary">{token.toUpperCase()}</p>
									</div>
								))}
							</div>
						</div>

						<div className="flex items-center justify-between">
							<p className="text-text-secondary">Network</p>
							<div className="flex gap-2">
								<div className="flex gap-1 items-center">
									<Image
										src={"/logos/base.svg"}
										alt="base"
										width={16}
										height={16}
									/>
									<p className="text-text-primary">Base</p>
								</div>
							</div>
						</div>

						{rate > 0 && addressStatusResponse?.currency && (
							<div className="flex items-center justify-between">
								<p className="text-text-secondary">Rate</p>
								<p className="text-text-primary">
									$1 ~{" "}
									{formatCurrency(
										Number(rate),
										addressStatusResponse?.currency,
										`en-${addressStatusResponse?.currency?.toUpperCase().slice(0, 2)}`,
									)}
								</p>
							</div>
						)}
					</AnimatedItem>

					<AnimatedItem className="w-full">
						<QRCode
							value={addressStatusResponse?.linkedAddress}
							qrStyle="dots"
							eyeRadius={20}
							eyeColor="#121217"
							fgColor="#121217"
							bgColor="#F9FAFB"
							size={400}
							quietZone={40}
							logoImage="/images/paycrest-grayscale.svg"
							style={{
								borderRadius: "32px",
								margin: "0 auto",
								width: "100%",
								maxWidth: "400px",
								objectFit: "contain",
								height: "auto",
								border: "1px solid #EBEBEF",
							}}
						/>
					</AnimatedItem>

					<AnimatedItem className="rounded-xl border border-border-light bg-background-neutral py-4 space-y-4">
						<div className="px-4 flex justify-between items-center overflow-hidden flex-wrap">
							<p className="text-xs font-semibold bg-gradient-to-r from-purple-500 via-orange-500 to-fuchsia-400 bg-clip-text text-transparent break-words">
								{addressStatusResponse?.linkedAddress}
							</p>
							<button type="button" onClick={handleCopyAddress}>
								{isAddressCopied ? (
									<CheckmarkIcon className="size-4 text-primary-blue" />
								) : (
									<CopyIcon className="size-4 text-primary-blue" />
								)}
							</button>
						</div>
						<hr className="border-t border-border-light" />
						<p className="text-text-secondary px-4">
							Send only{" "}
							<span className="text-text-primary">Supported tokens</span> on{" "}
							<span className="text-text-primary">Base Network</span>
						</p>
					</AnimatedItem>

					{ready &&
						user &&
						user.wallet?.address === addressStatusResponse?.resolvedAddress &&
						basename && (
							<AnimatedItem className="flex items-center justify-between space-x-4 rounded-xl bg-background-neutral p-4">
								<p className="text-text-primary">Download format</p>
								<div className="flex gap-4">
									{["pdf", "png"].map((format) => (
										<label
											key={format}
											className="inline-flex items-center gap-2 bg-white rounded-full py-1 px-2 cursor-pointer"
										>
											<input
												type="radio"
												className="form-radio accent-primary-blue cursor-pointer"
												name="exportFormat"
												value={format}
												checked={exportFormat === format}
												onChange={() =>
													setExportFormat(format as "pdf" | "png")
												}
											/>
											<span>{format.toUpperCase()}</span>
										</label>
									))}
								</div>
							</AnimatedItem>
						)}

					<AnimatedItem className="flex items-center gap-4">
						{ready &&
							user &&
							user.wallet?.address === addressStatusResponse?.resolvedAddress &&
							basename && (
								<button
									type="button"
									title="Download"
									onClick={handleExport}
									className={classNames(
										"!text-primary-blue",
										secondaryButtonStyles,
									)}
								>
									{isGenerating ? (
										<LoadingIcon className="size-5 animate-spin" />
									) : (
										<TbFileDownload className="size-5" />
									)}
								</button>
							)}

						<button
							type="button"
							className={classNames(primaryButtonStyles, "w-full")}
							onClick={() => {
								navigator.share({
									title: "My Basepay link",
									text: `Click to pay me in ${addressStatusResponse?.currency} with crypto via Basepay`,
									url: window.location.href,
								});
							}}
						>
							Share
						</button>
					</AnimatedItem>
				</div>
			</AnimatedContainer>

			{addressStatusResponse && basename && (
				<div className="absolute left-[-9999px] top-[-9999px]">
					<div ref={basepayPdfRef}>
						<BasepayPdf
							linkedAddress={addressStatusResponse?.linkedAddress}
							currency={addressStatusResponse?.currency}
							basename={basename}
						/>
					</div>
				</div>
			)}
		</>
	);
}
