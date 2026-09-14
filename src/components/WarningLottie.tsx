"use client";

import React, { useEffect, useRef } from "react";
import warningAnimData from "@/lib/warningAnimation.json";

interface WarningLottieProps {
  className?: string;
  size?: number;
}

export default function WarningLottie({ className = "", size = 160 }: WarningLottieProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animInstanceRef = useRef<any>(null);

  useEffect(() => {
    let isCancelled = false;

    function renderAnimation() {
      if (isCancelled || !containerRef.current) return;
      const lottie = (window as any).lottie;
      if (!lottie) return;

      // Clear any previous rendered children
      containerRef.current.innerHTML = "";

      try {
        animInstanceRef.current = lottie.loadAnimation({
          container: containerRef.current,
          renderer: "svg",
          loop: true,
          autoplay: true,
          animationData: warningAnimData,
          rendererSettings: {
            preserveAspectRatio: "xMidYMid meet",
          },
        });
      } catch (err) {
        console.error("WarningLottie animation error:", err);
      }
    }

    if (typeof window !== "undefined") {
      if ((window as any).lottie) {
        renderAnimation();
      } else {
        // Load local vendor script
        let script = document.querySelector('script[data-lottie-script="true"]') as HTMLScriptElement;
        if (!script) {
          script = document.createElement("script");
          script.src = "/vendor/lottie.min.js";
          script.setAttribute("data-lottie-script", "true");
          script.async = true;
          document.body.appendChild(script);
        }

        const onLoad = () => {
          renderAnimation();
        };

        script.addEventListener("load", onLoad);
        return () => {
          script.removeEventListener("load", onLoad);
          isCancelled = true;
          if (animInstanceRef.current) {
            animInstanceRef.current.destroy();
            animInstanceRef.current = null;
          }
        };
      }
    }

    return () => {
      isCancelled = true;
      if (animInstanceRef.current) {
        animInstanceRef.current.destroy();
        animInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center justify-center pointer-events-none select-none ${className}`}
      style={{ width: size, height: size }}
      aria-label="Animasi Peringatan"
    />
  );
}
