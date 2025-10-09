import React, { useState, useEffect, useRef } from 'react';
import PlayerCrop from './playerView';

/**
 * Props for the TrackView component.
 */
interface TrackViewProps {
  /**
   * Array of image URLs to display in this track view.
   */
  images: string[];
  /**
   * Unique identifier for this track.
   */
  trackId?: number;
  /**
   * Array of loading states for each image.
   */
  loadingStates: boolean[];
  /**
   * Function to update the loading states.
   */
  setLoadingStates: React.Dispatch<React.SetStateAction<boolean[]>>;
  /**
   * Callback function to handle splitting the track at a specific crop.
   * Receives the trackId and cropImageName as parameters.
   */
  onSplit: (trackId: number, cropImageName: string) => void;
  /**
   * Height of the track view container in pixels.
   * Defaults to 250px if not provided.
   */
  height?: number;
  /**
   * Optional ref to attach to the container element.
   */
  ref?: React.RefObject<HTMLDivElement | null>;
}

/**
 * TrackView component that displays a horizontal scrollable container
 * filled with crops from a group. The container fills the full width
 * of the browser view and enables scrolling when images exceed the available space.
 */
export default function TrackView({
  images,
  trackId,
  loadingStates,
  setLoadingStates,
  onSplit,
  height = 250,
  ref,
}: TrackViewProps) {
  const imageRefs = useRef<(HTMLImageElement | null)[]>([]);

  // Check if images have loaded after a delay as a fallback
  useEffect(() => {
    if (!images || images.length === 0) return;

    console.log(`🔍 Setting up fallback checks for ${images.length} images in track ${trackId}`);

    const checkImagesLoaded = () => {
      console.log(`🔍 Checking ${images.length} images for track ${trackId}...`);
      images.forEach((src, i) => {
        const img = imageRefs.current[i];
        console.log(`🔍 Image ${i} ref:`, img ? 'exists' : 'null', 'loadingState:', loadingStates[i]);
        if (img && loadingStates[i]) {
          console.log(`🔍 Image ${i} - complete: ${img.complete}, naturalWidth: ${img.naturalWidth}, naturalHeight: ${img.naturalHeight}`);
          // Check if image has natural dimensions (indicating it loaded)
          if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            console.log(`✅ Image ${i} for track ${trackId} has dimensions ${img.naturalWidth}x${img.naturalHeight}, marking as loaded`);
            setLoadingStates(prev => {
              const newStates = [...prev];
              newStates[i] = false;
              return newStates;
            });
          } else if (img.complete && img.naturalWidth === 0) {
            // Image failed to load (complete but no dimensions)
            console.warn(`❌ Image ${i} for track ${trackId} failed to load (complete but no dimensions), marking as loaded`);
            setLoadingStates(prev => {
              const newStates = [...prev];
              newStates[i] = false;
              return newStates;
            });
          } else if (img.complete) {
            // Image is complete but we already checked dimensions above
            console.log(`ℹ️ Image ${i} for track ${trackId} is complete but no action needed`);
          } else {
            console.log(`⏳ Image ${i} for track ${trackId} still loading...`);
          }
        } else if (!img) {
          console.warn(`⚠️ Image ${i} ref not available yet`);
        }
      });
    };

    // Check after 3 seconds, then again after 8 seconds as final fallback
    const timeout1 = setTimeout(() => {
      console.log(`🔍 Running 3-second fallback check for track ${trackId}`);
      checkImagesLoaded();
    }, 3000);
    const timeout2 = setTimeout(() => {
      console.log(`🔍 Running 8-second fallback check for track ${trackId}`);
      checkImagesLoaded();
    }, 8000);

    return () => {
      clearTimeout(timeout1);
      clearTimeout(timeout2);
    };
  }, [images, trackId, loadingStates, setLoadingStates]);

  console.log('TrackView for track', trackId, 'has', images?.length || 0, 'images');

  if (!images || !Array.isArray(images) || images.length === 0) {
    console.error('🚨 DATAPREP TRACKVIEW ERROR: TrackView received empty or invalid images array', {
      trackId,
      imagesType: typeof images,
      isArray: Array.isArray(images),
      imagesLength: images?.length || 0,
      imagesValue: images,
      timestamp: new Date().toISOString(),
      troubleshooting: 'This track has no images to display. Check if image extraction or track processing failed for this track.'
    });
    return (
      <div
        ref={ref}
        className="rounded-2xl bg-gray-100 shadow p-3 my-4 flex items-center justify-center w-full box-border"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          flexShrink: 0,
          height: height,
          minHeight: height,
          maxHeight: height,
        }}
      >
        <span className="text-gray-500">No images available</span>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="rounded-2xl bg-white shadow-md border border-gray-200 p-3 my-4 flex gap-2 w-full box-border overflow-x-auto overflow-y-hidden flex-nowrap"
      style={{
        width: '100%',
        boxSizing: 'border-box',
        flexShrink: 0,
        scrollbarWidth: 'thin',
        WebkitOverflowScrolling: 'touch',
        height: height,
        minHeight: height,
        maxHeight: height,
      }}
    >
      {images.map((src, i) => {
        console.log(`Rendering image ${i} for track ${trackId}:`, src);
        // Extract crop image name from the URL (e.g., "crop_960.jpg")
        // First remove query parameters, then get the filename
        const urlWithoutQuery = src.split('?')[0];
        const urlParts = urlWithoutQuery.split('/');
        const cropImageName = urlParts[urlParts.length - 1];

        return (
          <PlayerCrop
            key={i}
            src={src}
            cropImageName={cropImageName}
            trackId={trackId!}
            onSplit={onSplit}
            loading={loadingStates[i]}
            imageRef={(el) => { imageRefs.current[i] = el; }}
            onLoad={() => {
              console.log(`Image ${i} for track ${trackId} loaded successfully`);
              setLoadingStates(prev => {
                const newStates = [...prev];
                newStates[i] = false;
                return newStates;
              });
            }}
            onError={() => {
              console.error('Image failed to load:', src);
              setLoadingStates(prev => {
                const newStates = [...prev];
                newStates[i] = false;
                return newStates;
              });
            }}
          />
        );
      })}
    </div>
  );
}

// Demo function to showcase the TrackView component
export function TrackViewDemo() {
  const [splitActions, setSplitActions] = useState<string[]>([]);
  const [loadingStates1, setLoadingStates1] = useState<boolean[]>([true, true, true, true]);
  const [loadingStates2, setLoadingStates2] = useState<boolean[]>([true, true]);

  const handleSplit = (trackId: number, cropImageName: string) => {
    setSplitActions(prev => [...prev, `Split track ${trackId} at ${cropImageName}`]);
  };

  const track1Images = [
    'https://picsum.photos/300/200?random=1',
    'https://picsum.photos/400/250?random=2',
    'https://picsum.photos/250/300?random=3',
    'https://picsum.photos/350/200?random=4',
  ];

  const track2Images = [
    'https://picsum.photos/500/300?random=5',
    'https://picsum.photos/400/250?random=6',
  ];

  return (
    <div className="p-8 space-y-6">
      <h2 className="text-2xl font-bold">TrackView Component Demo</h2>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Track 1 - Multiple Images (Scrollable)</h3>
        <TrackView
          images={track1Images}
          trackId={101}
          loadingStates={loadingStates1}
          setLoadingStates={setLoadingStates1}
          onSplit={handleSplit}
          height={200}
        />
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Track 2 - Fewer Images</h3>
        <TrackView
          images={track2Images}
          trackId={102}
          loadingStates={loadingStates2}
          setLoadingStates={setLoadingStates2}
          onSplit={handleSplit}
          height={180}
        />
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Empty Track</h3>
        <TrackView
          images={[]}
          trackId={103}
          loadingStates={[]}
          setLoadingStates={() => {}}
          onSplit={handleSplit}
          height={150}
        />
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
