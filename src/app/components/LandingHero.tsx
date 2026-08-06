'use client';

import React, { useRef } from 'react';
import Link from 'next/link';

// Replace this URL with your actual Supabase Storage video URL
// e.g. `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/hero-video/background.mp4`
const VIDEO_URL =
  'https://videos.pexels.com/video-files/3252925/3252925-uhd_2560_1440_25fps.mp4';

export default function LandingHero() {
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <section className="relative w-full min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background video */}
      <video
        ref={videoRef}
        src={VIDEO_URL}
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover object-center z-0"
      />

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/60 z-10" />

      {/* Centered content */}
      <div className="relative z-20 flex flex-col items-center justify-center text-center px-6 max-w-3xl mx-auto">
        <h1 className="text-5xl font-bold text-white mb-6 leading-tight">
          Esto es Glew Studio
        </h1>

        <p className="text-lg text-white mb-10 leading-relaxed">
          Accede a nuevos cursos cada mes y domina la fotografía con los mejores instructores del mundo.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link
            href="/sign-up-login"
            className="px-8 py-3 bg-white text-black font-semibold text-base rounded hover:bg-gray-100 transition-colors"
          >
            Empieza tu Suscripción Mensual
          </Link>

          <Link
            href="/courses"
            className="px-8 py-3 bg-transparent text-white font-semibold text-base rounded border border-white hover:bg-white/10 transition-colors"
          >
            Explora todos los cursos
          </Link>
        </div>
      </div>
    </section>
  );
}