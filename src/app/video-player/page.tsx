import React, { Suspense } from 'react';
import VideoPlayerScreen from './components/VideoPlayerScreen';

export default function VideoPlayerPage() {
  return (
    <Suspense
      fallback={<div className="min-h-screen bg-background flex items-center justify-center" />}
    >
      <VideoPlayerScreen />
    </Suspense>
  );
}
