import React, { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SplitIcon } from '@/components/icons';

/**
 * Props for the PlayerCrop component.
 */
interface PlayerCropProps {
  /**
   * The URL of the image to display for this player crop.
   */
  src: string;
  /**
   * The name of the crop image file (e.g., "crop_960.jpg"), used for splitting the track.
   */
  cropImageName: string;
  /**
   * The unique identifier of the track this crop belongs to.
   */
  trackId: number;
  /**
   * Callback function to handle splitting the track at this crop.
   * Receives the trackId and cropImageName as parameters.
   */
  onSplit: (trackId: number, cropImageName: string) => void;
  /**
   * The height of the player crop box in pixels.
   * Defaults to 250px if not provided. Width adjusts proportionally based on image aspect ratio.
   */
  height?: number;
  /**
   * Whether the image is currently loading.
   * When true, displays a skeleton placeholder instead of the image.
   */
  loading: boolean;
  /**
   * Optional callback function called when the image has finished loading successfully.
   */
  onLoad?: () => void;
  /**
   * Optional callback function called when the image fails to load.
   */
  onError?: () => void;
}

export default function PlayerCrop({
  src,
  cropImageName,
  trackId,
  onSplit,
  height = 250,
  loading,
  onLoad,
  onError,
}: PlayerCropProps) {
  const [calculatedWidth, setCalculatedWidth] = useState<number | null>(null);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const aspectRatio = img.naturalWidth / img.naturalHeight;
    const newWidth = aspectRatio * height;
    setCalculatedWidth(newWidth);
    onLoad?.();
  };

  const handleImageError = () => {
    setCalculatedWidth(null);
    onError?.();
  };

  const containerWidth = calculatedWidth || 200; // Default width before image loads

  return (
    <div className="relative group flex-shrink-0" style={{ width: containerWidth }}>
      {loading && (
        <Skeleton
          className="rounded border"
          style={{ height, width: containerWidth }}
        />
      )}
      <img
        src={src}
        alt="data"
        className={`object-contain rounded border flex-shrink-0 ${loading ? 'hidden' : ''}`}
        style={{ height, width: containerWidth }}
        onLoad={handleImageLoad}
        onError={handleImageError}
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gray-800/80 hover:bg-gray-900 rounded-full p-1 shadow-sm"
            onClick={() => onSplit(trackId, cropImageName)}
            disabled={loading}
          >
            <SplitIcon className="w-4 h-4 text-white" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Split track here</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

// Demo function to showcase the PlayerCrop component
export function PlayerCropDemo() {
  const [splitActions, setSplitActions] = useState<string[]>([]);

  const handleSplit = (trackId: number, cropImageName: string) => {
    setSplitActions(prev => [...prev, `Split track ${trackId} at ${cropImageName}`]);
  };

  const sampleImages = [
    'https://picsum.photos/300/200?random=1',
    'https://picsum.photos/400/250?random=2',
    'https://picsum.photos/250/300?random=3',
  ];

  return (
    <div className="p-8 space-y-6">
      <h2 className="text-2xl font-bold">PlayerCrop Component Demo</h2>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Sample Player Crops</h3>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {sampleImages.map((src, index) => (
            <PlayerCrop
              key={index}
              src={src}
              cropImageName={`crop_${index + 1}.jpg`}
              trackId={100 + index}
              onSplit={handleSplit}
              height={200}
              loading={false}
            />
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Loading State</h3>
        <div className="flex gap-4">
          <PlayerCrop
            src="https://picsum.photos/300/200?random=4"
            cropImageName="loading_crop.jpg"
            trackId={999}
            onSplit={handleSplit}
            height={150}
            loading={true}
          />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Split Actions Log</h3>
        <div className="bg-gray-100 p-4 rounded-lg max-h-40 overflow-y-auto">
          {splitActions.length === 0 ? (
            <p className="text-gray-500">No split actions yet. Hover over images and click the split button!</p>
          ) : (
            <ul className="space-y-1">
              {splitActions.map((action, index) => (
                <li key={index} className="text-sm font-mono">{action}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}