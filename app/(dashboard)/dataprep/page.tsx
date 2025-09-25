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

	// Helper to render a scrollable image row
	function ImageRow({ images, refEl }: { images: string[]; refEl: React.RefObject<HTMLDivElement> }) {
		return (
			<div
				ref={refEl}
				className="rounded-2xl bg-white shadow p-2 my-4 flex overflow-x-auto gap-2 min-h-[70px] w-full box-border"
				style={{
				  width: '100%',
				  boxSizing: 'border-box',
				  overflowX: 'auto',
				  overflowY: 'hidden',
				  flexShrink: 0,
				}}
			>
				{images.map((src, i) => (
					<img
						key={i}
						src={src}
						alt="data"
						loading="lazy"
						className="h-[60px] max-w-[120px] object-contain rounded border"
						style={{ minWidth: 40 }}
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
					<ImageRow images={imagePair.imagesA} refEl={listARef} />
					<ImageRow images={imagePair.imagesB} refEl={listBRef} />

					<div className="flex gap-6 mt-4">
						<button
							className="flex-1 px-6 py-3 rounded-lg bg-green-600 text-white font-semibold shadow hover:bg-green-700 transition"
							onClick={() => handleClassify("same")}
							disabled={loading}
						>
							Same
						</button>
						<button
							className="flex-1 px-6 py-3 rounded-lg bg-red-600 text-white font-semibold shadow hover:bg-red-700 transition"
							onClick={() => handleClassify("different")}
							disabled={loading}
						>
							Different
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
