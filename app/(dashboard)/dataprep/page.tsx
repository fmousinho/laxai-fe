"use client";

import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { ErrorPage } from '@/components/ErrorPage';
import { useErrorHandler } from '@/lib/useErrorHandler';

type ImagePair = {
	imagesA: string[];
	imagesB: string[];
};

type VideoFile = {
  fileName: string;
  signedUrl: string;
};

export default function DataPrepPage() {
	const [view, setView] = useState<'list' | 'prep'>('list');
	const [selectedVideo, setSelectedVideo] = useState<VideoFile | null>(null);
	const [videos, setVideos] = useState<VideoFile[]>([]);
	const [loadingVideos, setLoadingVideos] = useState(true);
	const [started, setStarted] = useState(false);
	const [imagePair, setImagePair] = useState<ImagePair | null>(null);
	const [loading, setLoading] = useState(false);
	const [suspended, setSuspended] = useState(false);

	const { error, handleFetchError, handleApiError, clearError } = useErrorHandler();

	// For lazy loading, track which images are in view (placeholder for now)
	const listARef = useRef<HTMLDivElement>(null);
	const listBRef = useRef<HTMLDivElement>(null);

	// Fetch videos on mount
	useEffect(() => {
		const fetchVideos = async () => {
			setLoadingVideos(true);
			try {
				const { data } = await axios.get('/api/gcs/list_video');
				setVideos(data.files || []);
			} catch (err) {
				console.error('Failed to load videos:', err);
				setVideos([]);
			} finally {
				setLoadingVideos(false);
			}
		};
		fetchVideos();
	}, []);

	const fetchPair = async () => {
		setLoading(true);
		clearError(); // Clear any previous errors
		// TODO: Replace with real API call that includes selected video
		const processFolder = selectedVideo?.fileName;
		const url = processFolder
			? `/api/dataprep/track_pair_for_verification?process_folder=${encodeURIComponent(processFolder)}`
			: '/api/dataprep/track_pair_for_verification';
		try {
			const res = await fetch(url);
			const isOk = await handleFetchError(res, 'fetchPair');
			if (!isOk) {
				setLoading(false);
				return;
			}
			const data = await res.json();
			setImagePair(data);
		} catch (error) {
			console.error('Failed to fetch pair:', error);
			// For network errors, use handleApiError
			handleApiError(error, 'fetchPair');
		}
		setLoading(false);
	};

	const handleStart = async () => {
		setStarted(true);
		setSuspended(false);
		await fetchPair();
	};

	const handlePrepareVideo = async (video: VideoFile) => {
		setSelectedVideo(video);
		setView('prep');
		setStarted(false);
		setSuspended(false);
		setImagePair(null);
		clearError(); // Clear any errors when starting new video
		// Automatically start the comparison
		await handleStart();
	};

	const handleBackToList = () => {
		setView('list');
		setSelectedVideo(null);
		setStarted(false);
		setSuspended(false);
		setImagePair(null);
		clearError(); // Clear any errors when going back
	};

	const handleClassify = async (label: "same" | "different") => {
		setLoading(true);
		clearError(); // Clear any previous errors
		try {
			const res = await fetch("/api/dataprep/classify_pair", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ label }),
			});
			const isOk = await handleFetchError(res, 'handleClassify');
			if (!isOk) {
				setLoading(false);
				return;
			}
			const data = await res.json();
			setImagePair(data);
		} catch (error) {
			console.error('Failed to classify pair:', error);
			handleApiError(error, 'handleClassify');
		}
		setLoading(false);
	};

	const handleSuspend = async () => {
		setLoading(true);
		clearError(); // Clear any previous errors
		try {
			const res = await fetch("/api/dataprep/suspend", {
				method: "POST",
			});
			const isOk = await handleFetchError(res, 'handleSuspend');
			if (!isOk) {
				setLoading(false);
				return;
			}
			setStarted(false);
			setSuspended(true);
			setImagePair(null);
		} catch (error) {
			console.error('Failed to suspend:', error);
			handleApiError(error, 'handleSuspend');
		}
		setLoading(false);
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
		<div className="w-full max-w-6xl mx-auto p-4">
			{error ? (
				<ErrorPage
					error={error}
					onRetry={clearError}
					onDismiss={() => handleBackToList()}
					customActions={
						<>
							<Button
								onClick={clearError}
								variant="outline"
							>
								Try Again
							</Button>
							<Button
								onClick={handleBackToList}
								variant="default"
							>
								Back to Videos
							</Button>
						</>
					}
				/>
			) : view === 'list' ? (
				// Video List View
				<Card>
					<CardHeader>
						<CardTitle>Data Preparation</CardTitle>
						<CardDescription>
							Select a video to prepare for data classification tasks.
						</CardDescription>
					</CardHeader>
					<CardContent>
						{loadingVideos ? (
							<div className="text-center py-8">Loading videos...</div>
						) : videos.length === 0 ? (
							<div className="text-center py-8 text-muted-foreground">
								No videos available. Please upload some videos first.
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="w-[100px]">Thumbnail</TableHead>
										<TableHead>Video Name</TableHead>
										<TableHead className="w-[120px]">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{videos.map((video, index) => (
										<TableRow key={index}>
											<TableCell>
												<video
													src={video.signedUrl}
													className="w-16 h-12 object-cover rounded"
													muted
												/>
											</TableCell>
											<TableCell className="font-medium">
												{video.fileName}
											</TableCell>
											<TableCell>
												<Button
													onClick={() => handlePrepareVideo(video)}
													size="sm"
												>
													Prepare
												</Button>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</CardContent>
				</Card>
			) : (
				// Data Prep View
				<div className="flex flex-col items-center justify-center min-h-[70vh] w-full px-0 sm:px-4 max-w-screen-lg mx-auto">
					<div className="w-full flex justify-between items-center mb-6">
						<Button
							variant="outline"
							onClick={handleBackToList}
						>
							← Back to Videos
						</Button>
						<div className="text-sm text-muted-foreground">
							Preparing: {selectedVideo?.fileName}
						</div>
					</div>

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
			)}
		</div>
	);
}
