"use client";

import React, { useState, useRef } from "react";

type ImagePair = {
	imagesA: string[];
	imagesB: string[];
};

export default function DataPrepPage() {
	const [started, setStarted] = useState(false);
	const [imagePair, setImagePair] = useState<ImagePair | null>(null);
	const [loading, setLoading] = useState(false);
	const [suspended, setSuspended] = useState(false);

	// For lazy loading, track which images are in view (placeholder for now)
	const listARef = useRef<HTMLDivElement>(null);
	const listBRef = useRef<HTMLDivElement>(null);

	const fetchPair = async () => {
		setLoading(true);
		// TODO: Replace with real API call
		const res = await fetch("/api/dataprep/track_pair_for_verification");
		const data = await res.json();
		setImagePair(data);
		setLoading(false);
	};

	const handleStart = async () => {
		setStarted(true);
		setSuspended(false);
		await fetchPair();
	};

	const handleClassify = async (label: "same" | "different") => {
		setLoading(true);
		// TODO: Replace with real API call
		const res = await fetch("/api/dataprep/classify_pair", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ label }),
		});
		const data = await res.json();
		setImagePair(data);
		setLoading(false);
	};

	const handleSuspend = () => {
		setStarted(false);
		setSuspended(true);
		setImagePair(null);
	};

	// Helper to render a scrollable image row (fixed height, horizontal scroll only)
	function ImageRow({ images, refEl }: { images: string[]; refEl: React.RefObject<HTMLDivElement | null> }) {
		return (
			<div
				ref={refEl}
				className="rounded-2xl bg-white shadow p-3 my-4 flex gap-2 w-full box-border overflow-x-auto overflow-y-hidden"
				style={{
				  width: '100%',
				  boxSizing: 'border-box',
				  flexShrink: 0,
				  scrollbarWidth: 'thin',
				  WebkitOverflowScrolling: 'touch',
				  height: 90,
				}}
			>
				{images.map((src, i) => (
					<img
						key={i}
						src={src}
						alt="data"
						loading="lazy"
						className="h-[70px] object-contain rounded border"
						style={{ minWidth: 70, maxWidth: 140 }}
					/>
				))}
			</div>
		);
	}

	return (
		<div className="flex flex-col items-center justify-center min-h-[70vh] w-full px-0 sm:px-4 max-w-screen-lg mx-auto">
			{!started && !loading && (
				<button
					className="px-8 py-4 rounded-full bg-indigo-600 text-white text-xl font-semibold shadow hover:bg-indigo-700 transition"
					onClick={handleStart}
				>
					Start Comparing
				</button>
			)}

			{started && imagePair && (
				<>
					<h2 className="text-lg font-semibold mt-2 mb-1 text-center">Are these images from the same player?</h2>
					<ImageRow images={imagePair.imagesA} refEl={listARef} />
					<ImageRow images={imagePair.imagesB} refEl={listBRef} />

					<div className="grid grid-cols-3 gap-6 mt-4 w-full max-w-xl">
						<button
							className="w-full px-6 py-3 rounded-lg bg-green-600 text-white font-semibold shadow hover:bg-green-700 transition disabled:opacity-50"
							onClick={() => handleClassify("same")}
							disabled={loading}
						>
							Same
						</button>
						<button
							className="w-full px-6 py-3 rounded-lg bg-red-600 text-white font-semibold shadow hover:bg-red-700 transition disabled:opacity-50"
							onClick={() => handleClassify("different")}
							disabled={loading}
						>
							Different
						</button>
						<button
							className="w-full px-6 py-3 rounded-lg bg-amber-500 text-white font-semibold shadow hover:bg-amber-600 transition disabled:opacity-50"
							onClick={() => {/* TODO: implement skip behavior */}}
							disabled={loading}
						>
							Skip
						</button>
					</div>

					<div className="mt-10">
						<button
							className="px-6 py-2 rounded-full bg-gray-200 text-gray-700 font-medium hover:bg-gray-300 transition"
							onClick={handleSuspend}
							disabled={loading}
						>
							Suspend Classification
						</button>
					</div>
				</>
			)}
		</div>
	);
}
