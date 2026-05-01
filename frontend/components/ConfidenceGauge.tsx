"use client";

import React, { useEffect, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// ConfidenceGauge — Animated semicircular gauge for ML confidence scores
//
// Props:
//   score        : number   — confidence value between 0.0 and 1.0
//   label        : string   — e.g., "Very High", "High", "Medium", "Low"
//   size         : number   — diameter in pixels (default: 160)
//   animate      : boolean  — whether to animate on mount (default: true)
//   showPercent  : boolean  — show percentage label inside gauge (default: true)
// ─────────────────────────────────────────────────────────────────────────────

interface ConfidenceGaugeProps {
  score: number;
  label?: string;
  size?: number;
  animate?: boolean;
  showPercent?: boolean;
  className?: string;
}

// ── Color palette based on confidence level ────────────────────────────────
function getColor(score: number): { stroke: string; glow: string; bg: string } {
  if (score >= 0.85) {
    return {
      stroke: "#22c55e",  // green-500
      glow:   "rgba(34, 197, 94, 0.4)",
      bg:     "rgba(34, 197, 94, 0.08)",
    };
  } else if (score >= 0.70) {
    return {
      stroke: "#3b82f6",  // blue-500
      glow:   "rgba(59, 130, 246, 0.4)",
      bg:     "rgba(59, 130, 246, 0.08)",
    };
  } else if (score >= 0.55) {
    return {
      stroke: "#f59e0b",  // amber-500
      glow:   "rgba(245, 158, 11, 0.4)",
      bg:     "rgba(245, 158, 11, 0.08)",
    };
  }
  return {
    stroke: "#ef4444",  // red-500
    glow:   "rgba(239, 68, 68, 0.4)",
    bg:     "rgba(239, 68, 68, 0.08)",
  };
}

function getLabelColor(score: number): string {
  if (score >= 0.85) return "#22c55e";
  if (score >= 0.70) return "#3b82f6";
  if (score >= 0.55) return "#f59e0b";
  return "#ef4444";
}

export default function ConfidenceGauge({
  score,
  label,
  size      = 160,
  animate   = true,
  showPercent = true,
  className = "",
}: ConfidenceGaugeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number>(0);
  const startTime = useRef<number>(0);

  const clampedScore = Math.max(0, Math.min(1, score));
  const colors       = getColor(clampedScore);
  const pct          = Math.round(clampedScore * 100);
  const ANIM_DURATION = 1200; // ms

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx    = canvas.getContext("2d");
    if (!ctx)    return;

    const dpr    = window.devicePixelRatio || 1;
    canvas.width  = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width  = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const cx      = size / 2;
    const cy      = size / 2 + size * 0.08;
    const radius  = size * 0.38;
    const trackW  = size * 0.065;
    const startA  = Math.PI;        // 180° (left side)
    const endA    = 0;              // 0°  (right side)

    function draw(currentScore: number) {
      ctx!.clearRect(0, 0, size, size);

      // ── Background glow ────────────────────────────────────────────────────
      const grd = ctx!.createRadialGradient(cx, cy, radius * 0.3, cx, cy, radius * 1.1);
      grd.addColorStop(0, colors.bg);
      grd.addColorStop(1, "transparent");
      ctx!.beginPath();
      ctx!.arc(cx, cy, radius * 1.1, 0, Math.PI * 2);
      ctx!.fillStyle = grd;
      ctx!.fill();

      // ── Track (full arc background) ────────────────────────────────────────
      ctx!.beginPath();
      ctx!.arc(cx, cy, radius, startA, endA, false);
      ctx!.strokeStyle = "rgba(255,255,255,0.06)";
      ctx!.lineWidth   = trackW;
      ctx!.lineCap     = "round";
      ctx!.stroke();

      // ── Value arc ─────────────────────────────────────────────────────────
      const fillAngle = startA + currentScore * Math.PI;
      if (currentScore > 0) {
        // Shadow/glow effect
        ctx!.shadowColor = colors.glow;
        ctx!.shadowBlur  = 14;
        ctx!.beginPath();
        ctx!.arc(cx, cy, radius, startA, fillAngle, false);
        ctx!.strokeStyle = colors.stroke;
        ctx!.lineWidth   = trackW;
        ctx!.lineCap     = "round";
        ctx!.stroke();
        ctx!.shadowBlur = 0;
      }

      // ── Tick marks ────────────────────────────────────────────────────────
      for (let i = 0; i <= 10; i++) {
        const tickAngle  = Math.PI + (i / 10) * Math.PI;
        const innerR     = radius - trackW * 0.8;
        const outerR     = radius + trackW * 0.35;
        const isMajor    = i % 5 === 0;
        const tx1 = cx + innerR * Math.cos(tickAngle);
        const ty1 = cy + innerR * Math.sin(tickAngle);
        const tx2 = cx + (isMajor ? outerR : innerR + trackW * 0.5) * Math.cos(tickAngle);
        const ty2 = cy + (isMajor ? outerR : innerR + trackW * 0.5) * Math.sin(tickAngle);
        ctx!.beginPath();
        ctx!.moveTo(tx1, ty1);
        ctx!.lineTo(tx2, ty2);
        ctx!.strokeStyle = isMajor
          ? "rgba(255,255,255,0.35)"
          : "rgba(255,255,255,0.12)";
        ctx!.lineWidth = isMajor ? 1.5 : 0.8;
        ctx!.stroke();
      }

      // ── Needle indicator dot ──────────────────────────────────────────────
      if (currentScore >= 0) {
        const needleAngle = Math.PI + currentScore * Math.PI;
        const nx = cx + radius * Math.cos(needleAngle);
        const ny = cy + radius * Math.sin(needleAngle);
        ctx!.beginPath();
        ctx!.arc(nx, ny, trackW * 0.55, 0, Math.PI * 2);
        ctx!.fillStyle = colors.stroke;
        ctx!.shadowColor = colors.glow;
        ctx!.shadowBlur  = 10;
        ctx!.fill();
        ctx!.shadowBlur = 0;
      }

      // ── End cap labels ────────────────────────────────────────────────────
      const labelFont = `${Math.round(size * 0.075)}px sans-serif`;
      ctx!.font      = labelFont;
      ctx!.fillStyle = "rgba(255,255,255,0.3)";
      ctx!.textAlign = "center";
      ctx!.fillText("0%",   cx - radius * 1.05, cy + size * 0.05);
      ctx!.fillText("100%", cx + radius * 1.05, cy + size * 0.05);
    }

    if (animate) {
      startTime.current = 0;
      function frame(ts: number) {
        if (!startTime.current) startTime.current = ts;
        const elapsed  = ts - startTime.current;
        const progress = Math.min(elapsed / ANIM_DURATION, 1);
        // Ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        draw(eased * clampedScore);
        if (progress < 1) {
          animRef.current = requestAnimationFrame(frame);
        }
      }
      animRef.current = requestAnimationFrame(frame);
    } else {
      draw(clampedScore);
    }

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [score, size, colors.stroke, colors.glow, colors.bg, clampedScore, animate]);

  return (
    <div
      className={`flex flex-col items-center gap-1 ${className}`}
      role="meter"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Prediction confidence: ${pct}%`}
    >
      {/* Canvas gauge */}
      <div style={{ position: "relative", width: size, height: size * 0.65 }}>
        <canvas ref={canvasRef} style={{ position: "absolute", top: 0, left: 0 }} />

        {/* Center text overlaid on canvas */}
        {showPercent && (
          <div
            style={{
              position   : "absolute",
              bottom     : "12%",
              left       : "50%",
              transform  : "translateX(-50%)",
              textAlign  : "center",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                fontSize   : Math.round(size * 0.175) + "px",
                fontWeight : 700,
                color      : colors.stroke,
                letterSpacing: "-0.02em",
                lineHeight : 1,
                textShadow : `0 0 12px ${colors.glow}`,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {pct}%
            </div>
          </div>
        )}
      </div>

      {/* Label */}
      {label && (
        <div
          style={{
            fontSize    : Math.round(size * 0.082) + "px",
            fontWeight  : 600,
            color       : getLabelColor(clampedScore),
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            marginTop   : -4,
          }}
        >
          {label}
        </div>
      )}

      {/* Sub-label */}
      <div
        style={{
          fontSize : Math.round(size * 0.068) + "px",
          color    : "rgba(255,255,255,0.4)",
          marginTop: -2,
        }}
      >
        Confidence Score
      </div>
    </div>
  );
}
