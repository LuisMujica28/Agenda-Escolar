import React from 'react';

/**
 * Spheres3DBackground - Constelación de Esferas 3D Volumétricas Flotantes
 * Paleta principal: Blanco Puro, Perla Cerámica, Mármol Satinado y Cristal Blanco Translúcido.
 * Crea una atmósfera rica en profundidad, lujo visual y diseño de vanguardia.
 */
export default function DunasBackground() {
  return (
    <div 
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
      aria-hidden="true"
    >
      <style>{`
        @keyframes float-1 {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(-12px, -18px, 0) scale(1.02); }
        }
        @keyframes float-2 {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(14px, 20px, 0) scale(0.98); }
        }
        @keyframes float-3 {
          0%, 100% { transform: translate3d(0, 0, 0); }
          50% { transform: translate3d(-10px, 14px, 0); }
        }
        @keyframes float-4 {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(8px, -14px, 0) scale(1.03); }
        }
        @keyframes float-5 {
          0%, 100% { transform: translate3d(0, 0, 0); }
          50% { transform: translate3d(-14px, 10px, 0); }
        }
        .sphere-f1 { animation: float-1 9s ease-in-out infinite; }
        .sphere-f2 { animation: float-2 11s ease-in-out infinite; }
        .sphere-f3 { animation: float-3 8.5s ease-in-out infinite; }
        .sphere-f4 { animation: float-4 10s ease-in-out infinite; }
        .sphere-f5 { animation: float-5 12s ease-in-out infinite; }
      `}</style>

      {/* 1. Base neutra clara de alta definición */}
      <div className="absolute inset-0 bg-[#f8fafc]" />

      {/* 2. Micro-patrón geométrico de precisión ultra tenue */}
      <div 
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: 'radial-gradient(#0f172a 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }}
      />

      {/* 3. Halos lumínicos suaves de fondo para contraste del blanco */}
      <div 
        className="absolute -top-32 -right-32 w-[650px] h-[650px] rounded-full opacity-35 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(219, 234, 254, 0.45) 0%, rgba(241, 245, 249, 0) 70%)',
          filter: 'blur(55px)'
        }}
      />
      <div 
        className="absolute -bottom-32 -left-32 w-[650px] h-[650px] rounded-full opacity-30 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(224, 231, 255, 0.40) 0%, rgba(248, 250, 252, 0) 70%)',
          filter: 'blur(65px)'
        }}
      />
      <div 
        className="absolute top-[40%] right-[35%] w-[450px] h-[450px] rounded-full opacity-20 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(199, 210, 254, 0.35) 0%, rgba(248, 250, 252, 0) 70%)',
          filter: 'blur(60px)'
        }}
      />

      {/* ========================================================================= */}
      {/* 4. CONSTELACIÓN DE ESFERAS 3D VOLUMÉTRICAS EN TONOS BLANCO Y PERLA       */}
      {/* ========================================================================= */}

      {/* ESFERA 1: Gran Esfera Perla Cerámica 3D (Arriba a la Derecha) */}
      <div className="absolute -top-10 -right-10 sm:top-5 sm:right-8 sphere-f1">
        <div 
          className="w-52 h-52 sm:w-64 sm:h-64 rounded-full relative"
          style={{
            background: `
              radial-gradient(circle at 30% 26%, 
                #ffffff 0%, 
                #ffffff 28%, 
                #f8fafc 48%, 
                #cbd5e1 74%, 
                #94a3b8 90%, 
                #64748b 100%
              )
            `,
            boxShadow: `
              inset -14px -18px 30px rgba(71, 85, 105, 0.35),
              inset 10px 14px 24px rgba(255, 255, 255, 1),
              0 32px 65px -14px rgba(100, 116, 139, 0.20),
              0 14px 28px -8px rgba(100, 116, 139, 0.12)
            `
          }}
        >
          <div 
            className="absolute top-7 left-9 w-18 h-12 rounded-full opacity-90 transform -rotate-30"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 75%)'
            }}
          />
        </div>
      </div>

      {/* ESFERA 2: Esfera 3D Blanco Satinado / Perla Helada (Abajo a la Izquierda) */}
      <div className="absolute -bottom-14 -left-8 sm:bottom-10 sm:left-6 sphere-f2">
        <div 
          className="w-48 h-48 sm:w-60 sm:h-60 rounded-full relative"
          style={{
            background: `
              radial-gradient(circle at 34% 28%, 
                #ffffff 0%, 
                #ffffff 32%, 
                #f1f5f9 55%, 
                #cbd5e1 78%, 
                #94a3b8 92%, 
                #64748b 100%
              )
            `,
            boxShadow: `
              inset -12px -16px 26px rgba(71, 85, 105, 0.32),
              inset 9px 12px 20px rgba(255, 255, 255, 1),
              0 30px 55px -12px rgba(100, 116, 139, 0.18)
            `
          }}
        >
          <div 
            className="absolute top-6 left-8 w-14 h-9 rounded-full opacity-85 transform -rotate-30"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 70%)'
            }}
          />
        </div>
      </div>

      {/* ESFERA 3: Esfera 3D Clave DETRÁS DE ACCESOS RÁPIDOS (Se aprecia a través del vidrio) */}
      <div className="absolute top-[26%] left-[18%] sm:left-[22%] sphere-f4">
        <div 
          className="w-52 h-52 sm:w-64 sm:h-64 rounded-full relative"
          style={{
            background: `
              radial-gradient(circle at 32% 28%, 
                #ffffff 0%, 
                #ffffff 30%, 
                #f1f5f9 52%, 
                #cbd5e1 75%, 
                #94a3b8 92%, 
                #64748b 100%
              )
            `,
            boxShadow: `
              inset -14px -18px 28px rgba(71, 85, 105, 0.35),
              inset 10px 14px 22px rgba(255, 255, 255, 1),
              0 28px 55px -12px rgba(100, 116, 139, 0.22)
            `
          }}
        >
          <div 
            className="absolute top-7 left-9 w-18 h-12 rounded-full opacity-90 transform -rotate-30"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 70%)'
            }}
          />
        </div>
      </div>

      {/* ESFERA 4: Esfera 3D Clave DETRÁS DE ACTIVIDAD RECIENTE (Se aprecia a través del vidrio) */}
      <div className="absolute top-[38%] left-[45%] sm:left-[48%] sphere-f1">
        <div 
          className="w-48 h-48 sm:w-56 sm:h-56 rounded-full relative"
          style={{
            background: `
              radial-gradient(circle at 32% 28%, 
                #ffffff 0%, 
                #ffffff 30%, 
                #f8fafc 52%, 
                #cbd5e1 76%, 
                #94a3b8 92%, 
                #64748b 100%
              )
            `,
            boxShadow: `
              inset -12px -16px 26px rgba(71, 85, 105, 0.35),
              inset 8px 12px 20px rgba(255, 255, 255, 1),
              0 26px 50px -10px rgba(100, 116, 139, 0.20)
            `
          }}
        >
          <div 
            className="absolute top-6 left-8 w-16 h-10 rounded-full opacity-85 transform -rotate-30"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 70%)'
            }}
          />
        </div>
      </div>

      {/* ESFERA 5: Esfera 3D DETRÁS DE LA BARRA SUPERIOR DE SALUDO & KPI */}
      <div className="absolute top-[6%] left-[32%] sm:left-[36%] sphere-f3">
        <div 
          className="w-44 h-44 sm:w-52 sm:h-52 rounded-full relative"
          style={{
            background: `
              radial-gradient(circle at 34% 28%, 
                #ffffff 0%, 
                #ffffff 32%, 
                #f1f5f9 55%, 
                #cbd5e1 78%, 
                #94a3b8 92%, 
                #64748b 100%
              )
            `,
            boxShadow: `
              inset -10px -14px 22px rgba(71, 85, 105, 0.32),
              inset 8px 10px 18px rgba(255, 255, 255, 1),
              0 22px 45px -8px rgba(100, 116, 139, 0.18)
            `
          }}
        >
          <div 
            className="absolute top-5 left-7 w-14 h-9 rounded-full opacity-85 transform -rotate-30"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 70%)'
            }}
          />
        </div>
      </div>

      {/* ESFERA 6: Esfera Mediana Blanco Puro Frosted (Costado Derecho) */}
      <div className="absolute top-[44%] right-6 sm:right-14 sphere-f3">
        <div 
          className="w-32 h-32 sm:w-40 sm:h-40 rounded-full relative"
          style={{
            background: `
              radial-gradient(circle at 32% 28%, 
                #ffffff 0%, 
                #ffffff 35%, 
                #f8fafc 60%, 
                #cbd5e1 82%, 
                #94a3b8 100%
              )
            `,
            boxShadow: `
              inset -8px -11px 20px rgba(71, 85, 105, 0.30),
              inset 7px 9px 18px rgba(255, 255, 255, 1),
              0 22px 42px -8px rgba(100, 116, 139, 0.18)
            `
          }}
        >
          <div 
            className="absolute top-4 left-5 w-9 h-6 rounded-full opacity-85 transform -rotate-30"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 70%)'
            }}
          />
        </div>
      </div>

      {/* ESFERA 7: Esfera 3D Blanco Satinado (Margen Central Inferior) */}
      <div className="absolute top-[65%] left-[28%] sm:left-[32%] sphere-f5">
        <div 
          className="w-36 h-36 sm:w-44 sm:h-44 rounded-full relative"
          style={{
            background: `
              radial-gradient(circle at 33% 27%, 
                #ffffff 0%, 
                #ffffff 30%, 
                #f8fafc 58%, 
                #cbd5e1 80%, 
                #94a3b8 100%
              )
            `,
            boxShadow: `
              inset -8px -10px 20px rgba(71, 85, 105, 0.30),
              inset 6px 8px 16px rgba(255, 255, 255, 1),
              0 20px 38px -8px rgba(100, 116, 139, 0.16)
            `
          }}
        >
          <div 
            className="absolute top-4 left-5 w-10 h-6 rounded-full opacity-80 transform -rotate-30"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 70%)'
            }}
          />
        </div>
      </div>

      {/* ESFERA 8: Esfera Perla Blanca Flotante (Abajo a la Derecha) */}
      <div className="absolute bottom-10 right-[12%] sphere-f2">
        <div 
          className="w-36 h-36 rounded-full relative"
          style={{
            background: `
              radial-gradient(circle at 32% 28%, 
                #ffffff 0%, 
                #ffffff 34%, 
                #f1f5f9 60%, 
                #cbd5e1 82%, 
                #94a3b8 100%
              )
            `,
            boxShadow: `
              inset -9px -12px 22px rgba(71, 85, 105, 0.30),
              inset 8px 10px 18px rgba(255, 255, 255, 1),
              0 24px 44px -10px rgba(100, 116, 139, 0.16)
            `
          }}
        >
          <div 
            className="absolute top-4 left-6 w-10 h-6 rounded-full opacity-80 transform -rotate-30"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 70%)'
            }}
          />
        </div>
      </div>

      {/* ESFERA 9: Micro Perla Blanca Translúcida (Zona Izquierda) */}
      <div className="absolute top-[50%] left-8 sphere-f4 opacity-85">
        <div 
          className="w-16 h-16 rounded-full relative"
          style={{
            background: `
              radial-gradient(circle at 34% 28%, 
                #ffffff 0%, 
                #ffffff 35%, 
                #f1f5f9 68%, 
                #cbd5e1 100%
              )
            `,
            boxShadow: `
              inset -4px -5px 10px rgba(71, 85, 105, 0.28),
              inset 4px 5px 10px #ffffff,
              0 12px 22px -4px rgba(100, 116, 139, 0.14)
            `
          }}
        />
      </div>

      {/* ESFERA 10: Pequeña Esfera Blanca Satinada (Costado Derecho Inferior) */}
      <div className="absolute bottom-[28%] right-5 sphere-f5 hidden md:block opacity-85">
        <div 
          className="w-18 h-18 rounded-full relative"
          style={{
            background: `
              radial-gradient(circle at 32% 28%, 
                #ffffff 0%, 
                #ffffff 30%, 
                #f8fafc 55%, 
                #e2e8f0 82%, 
                #cbd5e1 100%
              )
            `,
            boxShadow: `
              inset -5px -6px 12px rgba(100, 116, 139, 0.22),
              inset 4px 6px 12px rgba(255, 255, 255, 1),
              0 14px 26px -5px rgba(100, 116, 139, 0.13)
            `
          }}
        />
      </div>

      {/* ESFERA 11: Acento Sutil Suave Azul Hielo Cristalino en Profundidad */}
      <div className="absolute top-[22%] right-[22%] sphere-f2 hidden xl:block opacity-45">
        <div 
          className="w-20 h-20 rounded-full relative"
          style={{
            background: `
              radial-gradient(circle at 34% 28%, 
                #ffffff 0%, 
                #eff6ff 30%, 
                #dbeafe 65%, 
                #93c5fd 90%, 
                #3b82f6 100%
              )
            `,
            boxShadow: `
              inset -5px -7px 14px rgba(30, 58, 138, 0.22),
              inset 5px 7px 12px rgba(255, 255, 255, 0.95),
              0 16px 30px -6px rgba(30, 58, 138, 0.11)
            `
          }}
        />
      </div>

      {/* ESFERA 12: Micro Perla Perla Droplet (Extremo Superior Izquierdo) */}
      <div className="absolute top-[3%] left-[8%] sphere-f3 hidden lg:block opacity-80">
        <div 
          className="w-10 h-10 rounded-full relative"
          style={{
            background: `
              radial-gradient(circle at 30% 26%, 
                #ffffff 0%, 
                #f8fafc 50%, 
                #cbd5e1 100%
              )
            `,
            boxShadow: `
              inset -2.5px -3px 6px rgba(100, 116, 139, 0.22),
              inset 2.5px 3px 6px #ffffff,
              0 8px 14px -3px rgba(100, 116, 139, 0.12)
            `
          }}
        />
      </div>
    </div>
  );
}
