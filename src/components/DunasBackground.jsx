import React from 'react';

/**
 * DunasBackground - Fondo generado 100% con código (SVG + Mesh Gradients)
 * Paleta exclusiva: Blanco y Azul (Azul Marino, Azul Real, Azul Hielo y Blanco Puro)
 * Proporciona profundidad, elegancia orgánica y cero distracción visual.
 */
export default function DunasBackground() {
  return (
    <div 
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* 1. Base Mesh Gradients (Atmósfera lumínica suave) */}
      <div 
        className="absolute inset-0 bg-[#f8fafc]"
        style={{
          backgroundImage: `
            radial-gradient(circle at 90% 12%, rgba(59, 130, 246, 0.15) 0%, rgba(147, 197, 253, 0.08) 35%, transparent 65%),
            radial-gradient(circle at 10% 85%, rgba(30, 58, 138, 0.12) 0%, rgba(37, 99, 235, 0.06) 40%, transparent 60%),
            radial-gradient(circle at 50% 50%, rgba(239, 246, 255, 0.7) 0%, transparent 75%)
          `
        }}
      />

      {/* 2. Micro-patrón sutil de puntos de precisión técnica */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.035]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="dunas-dot-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.2" fill="#1e40af" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dunas-dot-grid)" />
      </svg>

      {/* 3. Esculturas de Dunas y Olas Vectoriales (SVG Puro) */}
      <svg 
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1440 900" 
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Gradiente Duna Posterior Profunda */}
          <linearGradient id="duna-deep-blue" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e3a8a" stopOpacity="0.05" />
            <stop offset="50%" stopColor="#2563eb" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#93c5fd" stopOpacity="0.015" />
          </linearGradient>

          {/* Gradiente Duna Media Azul Real */}
          <linearGradient id="duna-royal-blue" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.08" />
            <stop offset="45%" stopColor="#60a5fa" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#dbeafe" stopOpacity="0.02" />
          </linearGradient>

          {/* Gradiente Duna Suave Hielo */}
          <linearGradient id="duna-ice-blue" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#dbeafe" stopOpacity="0.35" />
            <stop offset="50%" stopColor="#eff6ff" stopOpacity="0.60" />
            <stop offset="100%" stopColor="#bfdbfe" stopOpacity="0.25" />
          </linearGradient>

          {/* Gradiente Cinta de Luz Blanca */}
          <linearGradient id="duna-white-crest" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.90" />
          </linearGradient>

          {/* Filtro de sombra suave para relieve de duna */}
          <filter id="duna-soft-shadow" x="-5%" y="-5%" width="110%" height="120%">
            <feDropShadow dx="0" dy="12" stdDeviation="16" floodColor="#1e3a8a" floodOpacity="0.03" />
          </filter>

          <filter id="duna-crest-shadow" x="-5%" y="-5%" width="110%" height="120%">
            <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#2563eb" floodOpacity="0.04" />
          </filter>
        </defs>

        {/* DUNA 1: Curva superior fluida desde la derecha */}
        <path 
          d="M 600,0 C 850,80 1100,40 1440,160 L 1440,0 Z" 
          fill="url(#duna-deep-blue)" 
        />

        {/* DUNA 2: Gran curva envolvente de fondo */}
        <path 
          d="M 0,420 C 320,310 650,560 1020,440 C 1220,380 1350,420 1440,480 L 1440,900 L 0,900 Z" 
          fill="url(#duna-deep-blue)" 
        />

        {/* DUNA 3: Duna media con silueta sinuosa orgánica y relieve */}
        <path 
          d="M 0,560 C 260,460 520,680 880,550 C 1140,460 1320,530 1440,590 L 1440,900 L 0,900 Z" 
          fill="url(#duna-royal-blue)" 
          filter="url(#duna-soft-shadow)"
        />

        {/* Cresta iluminada de la duna media (Línea de luz) */}
        <path 
          d="M 0,560 C 260,460 520,680 880,550 C 1140,460 1320,530 1440,590" 
          fill="none" 
          stroke="rgba(147, 197, 253, 0.45)" 
          strokeWidth="2" 
        />

        {/* DUNA 4: Duna inferior frontal en tonos blanco y azul hielo */}
        <path 
          d="M 0,690 C 350,620 620,790 980,680 C 1220,600 1360,670 1440,710 L 1440,900 L 0,900 Z" 
          fill="url(#duna-ice-blue)" 
          filter="url(#duna-crest-shadow)"
        />

        {/* Línea de cresta blanca pura sobre la duna frontal */}
        <path 
          d="M 0,690 C 350,620 620,790 980,680 C 1220,600 1360,670 1440,710" 
          fill="none" 
          stroke="url(#duna-white-crest)" 
          strokeWidth="3" 
        />

        {/* DUNA 5: Capa de base blanca limpia para elevar el contenido inferior */}
        <path 
          d="M 0,790 C 420,740 760,860 1150,780 C 1310,750 1400,770 1440,800 L 1440,900 L 0,900 Z" 
          fill="#ffffff" 
          fillOpacity="0.70" 
        />
      </svg>
    </div>
  );
}
