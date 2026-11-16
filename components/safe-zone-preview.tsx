"use client";

import React, { useId } from "react";
import { Monitor, Smartphone } from "lucide-react";
import {
  getZonaSeguraComum,
  type RedeSocialConfig,
} from "@/lib/config/redes-sociais";

export function SafeZoneSocialFrame({
  rede,
  imageUrl,
  alt,
  viewport,
  showSafeZones,
  maxHeightPx = 168,
}: {
  rede: RedeSocialConfig;
  imageUrl: string;
  alt: string;
  viewport: "desktop" | "mobile";
  showSafeZones: boolean;
  maxHeightPx?: number;
}) {
  const maskId = useId().replace(/:/g, "_");
  const maxWidthPx = Math.max(
    48,
    Math.round((maxHeightPx * rede.widthPx) / Math.max(1, rede.heightPx))
  );
  const zonaComum = getZonaSeguraComum(rede);
  const activeZone =
    viewport === "mobile" ? rede.safeZoneMobile : rede.safeZoneDesktop;
  const activeAvatarOverlap =
    viewport === "mobile"
      ? rede.avatarOverlapMobile
      : rede.avatarOverlapDesktop;
  const strokeUnit = Math.max(
    2,
    Math.round(Math.min(rede.widthPx, rede.heightPx) / 130)
  );
  const dashLen = strokeUnit * 3;
  const fontSize = Math.max(
    14,
    Math.round(Math.min(rede.widthPx, rede.heightPx) / 22)
  );

  return (
    <div
      data-viewport-frame={viewport}
      className="relative mx-auto w-full overflow-hidden rounded-lg border border-stone-300 bg-stone-100 shadow-2xs"
      style={{
        aspectRatio: `${rede.widthPx} / ${rede.heightPx}`,
        maxWidth: `${maxWidthPx}px`,
      }}
    >
      <img
        src={imageUrl}
        alt={alt}
        className="block h-full w-full object-cover"
      />

      {(showSafeZones || viewport === "mobile" || rede.isCircle) && (
        <svg
          viewBox={`0 0 ${rede.widthPx} ${rede.heightPx}`}
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          {rede.isCircle ? (
            <>
              <defs>
                <mask id={`${maskId}_circle`}>
                  <rect width={rede.widthPx} height={rede.heightPx} fill="white" />
                  <circle
                    cx={rede.widthPx / 2}
                    cy={rede.heightPx / 2}
                    r={Math.min(rede.widthPx, rede.heightPx) * 0.485}
                    fill="black"
                  />
                </mask>
              </defs>
              <rect
                width={rede.widthPx}
                height={rede.heightPx}
                fill="rgba(15, 23, 42, 0.45)"
                mask={`url(#${maskId}_circle)`}
              />
              <circle
                cx={rede.widthPx / 2}
                cy={rede.heightPx / 2}
                r={Math.min(rede.widthPx, rede.heightPx) * 0.485}
                fill="none"
                stroke="#10B981"
                strokeWidth={strokeUnit}
                strokeDasharray={showSafeZones ? `${dashLen} ${dashLen}` : undefined}
              />
              {showSafeZones && (
                <circle
                  cx={rede.widthPx / 2}
                  cy={rede.heightPx / 2}
                  r={Math.min(rede.widthPx, rede.heightPx) * 0.36}
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth={Math.max(1.5, strokeUnit * 0.75)}
                  strokeDasharray={`${dashLen} ${dashLen}`}
                />
              )}
            </>
          ) : (
            <>
              {/* Em vista telemóvel, escurece as áreas exteriores à janela visível no telemóvel */}
              {viewport === "mobile" && (
                <>
                  <defs>
                    <mask id={`${maskId}_mob`}>
                      <rect
                        width={rede.widthPx}
                        height={rede.heightPx}
                        fill="white"
                      />
                      <rect
                        x={rede.safeZoneMobile.x}
                        y={rede.safeZoneMobile.y}
                        width={rede.safeZoneMobile.width}
                        height={rede.safeZoneMobile.height}
                        fill="black"
                      />
                    </mask>
                  </defs>
                  <rect
                    width={rede.widthPx}
                    height={rede.heightPx}
                    fill="rgba(15, 23, 42, 0.48)"
                    mask={`url(#${maskId}_mob)`}
                  />
                </>
              )}

              {/* Faixas obrigatórias de Story 250 px topo e base */}
              {showSafeZones && rede.margemTopoPx && rede.margemBasePx && (
                <>
                  <rect
                    x={0}
                    y={0}
                    width={rede.widthPx}
                    height={rede.margemTopoPx}
                    fill="rgba(220, 38, 38, 0.22)"
                  />
                  <line
                    x1={0}
                    y1={rede.margemTopoPx}
                    x2={rede.widthPx}
                    y2={rede.margemTopoPx}
                    stroke="#F87171"
                    strokeWidth={strokeUnit * 1.1}
                    strokeDasharray={`${dashLen} ${dashLen}`}
                  />
                  <rect
                    x={0}
                    y={rede.heightPx - rede.margemBasePx}
                    width={rede.widthPx}
                    height={rede.margemBasePx}
                    fill="rgba(220, 38, 38, 0.22)"
                  />
                  <line
                    x1={0}
                    y1={rede.heightPx - rede.margemBasePx}
                    x2={rede.widthPx}
                    y2={rede.heightPx - rede.margemBasePx}
                    stroke="#F87171"
                    strokeWidth={strokeUnit * 1.1}
                    strokeDasharray={`${dashLen} ${dashLen}`}
                  />
                  <text
                    x={rede.widthPx / 2}
                    y={rede.margemTopoPx * 0.56}
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize={Math.max(28, fontSize * 0.85)}
                    fontWeight="700"
                  >
                    250 px UI livre (topo)
                  </text>
                  <text
                    x={rede.widthPx / 2}
                    y={rede.heightPx - rede.margemBasePx * 0.44}
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize={Math.max(28, fontSize * 0.85)}
                    fontWeight="700"
                  >
                    250 px UI livre (base)
                  </text>
                </>
              )}

              {/* Zona de sobreposição da foto de perfil (Computador e Telemóvel) */}
              {showSafeZones && activeAvatarOverlap && (
                <g>
                  <rect
                    x={activeAvatarOverlap.x}
                    y={activeAvatarOverlap.y}
                    width={activeAvatarOverlap.width}
                    height={activeAvatarOverlap.height}
                    rx={strokeUnit * 2}
                    fill="rgba(245, 158, 11, 0.25)"
                    stroke="#F59E0B"
                    strokeWidth={strokeUnit}
                    strokeDasharray={`${dashLen} ${dashLen}`}
                  />
                  <circle
                    cx={activeAvatarOverlap.x + activeAvatarOverlap.width / 2}
                    cy={activeAvatarOverlap.y + activeAvatarOverlap.height / 2}
                    r={
                      Math.min(
                        activeAvatarOverlap.width,
                        activeAvatarOverlap.height
                      ) * 0.38
                    }
                    fill="rgba(15, 23, 42, 0.58)"
                    stroke="#FBBF24"
                    strokeWidth={strokeUnit * 0.9}
                  />
                  <text
                    x={activeAvatarOverlap.x + activeAvatarOverlap.width / 2}
                    y={
                      activeAvatarOverlap.y +
                      activeAvatarOverlap.height / 2 +
                      Math.max(
                        11,
                        Math.min(
                          activeAvatarOverlap.width,
                          activeAvatarOverlap.height
                        ) * 0.09
                      )
                    }
                    textAnchor="middle"
                    fill="#FEF3C7"
                    fontSize={Math.max(
                      16,
                      Math.round(
                        Math.min(
                          activeAvatarOverlap.width,
                          activeAvatarOverlap.height
                        ) * 0.24
                      )
                    )}
                    fontWeight="700"
                  >
                    Foto
                  </text>
                </g>
              )}

              {/* Retângulo da zona segura ativa (computador ou telemóvel) */}
              {showSafeZones && (
                <>
                  <rect
                    x={activeZone.x}
                    y={activeZone.y}
                    width={activeZone.width}
                    height={activeZone.height}
                    fill="none"
                    stroke="#10B981"
                    strokeWidth={strokeUnit * 1.1}
                    strokeDasharray={`${dashLen} ${dashLen}`}
                  />
                  {rede.id === "yt-banner" && (
                    <rect
                      x={zonaComum.x}
                      y={zonaComum.y}
                      width={zonaComum.width}
                      height={zonaComum.height}
                      fill="none"
                      stroke="#38BDF8"
                      strokeWidth={strokeUnit * 1.2}
                    />
                  )}
                </>
              )}
            </>
          )}
        </svg>
      )}
    </div>
  );
}

/**
 * Vista dupla obrigatória: mostra sempre LADO A LADO Computador e Telemóvel,
 * assinalando zonas seguras e áreas ocupadas pela foto de perfil em ambos.
 */
export function SafeZoneDualPreview({
  rede,
  imageUrl,
  alt,
  showSafeZones,
  maxHeightPx = 180,
}: {
  rede: RedeSocialConfig;
  imageUrl: string;
  alt: string;
  showSafeZones: boolean;
  maxHeightPx?: number;
}) {
  const hasAvatarZone = Boolean(
    rede.avatarOverlapDesktop || rede.avatarOverlapMobile || rede.isCircle
  );

  return (
    <div data-dual-preview={rede.id} className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 items-start">
        <div
          data-dual-column="desktop"
          className="min-w-0 rounded-xl border border-stone-200 bg-white/80 p-2 space-y-1.5"
        >
          <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-stone-800">
            <span className="inline-flex items-center gap-1 truncate">
              <Monitor className="h-3.5 w-3.5 shrink-0 text-stone-700" />
              <span className="truncate">Computador</span>
            </span>
            <span className="hidden sm:inline font-mono text-[9px] font-semibold text-stone-500 shrink-0">
              {rede.safeZoneDesktop.width}×{rede.safeZoneDesktop.height}
            </span>
          </div>
          <SafeZoneSocialFrame
            rede={rede}
            imageUrl={imageUrl}
            alt={`${alt} — vista computador`}
            viewport="desktop"
            showSafeZones={showSafeZones}
            maxHeightPx={maxHeightPx}
          />
        </div>

        <div
          data-dual-column="mobile"
          className="min-w-0 rounded-xl border border-stone-200 bg-white/80 p-2 space-y-1.5"
        >
          <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-stone-800">
            <span className="inline-flex items-center gap-1 truncate">
              <Smartphone className="h-3.5 w-3.5 shrink-0 text-amber-800" />
              <span className="truncate">Telemóvel</span>
            </span>
            <span className="hidden sm:inline font-mono text-[9px] font-semibold text-stone-500 shrink-0">
              {rede.safeZoneMobile.width}×{rede.safeZoneMobile.height}
            </span>
          </div>
          <SafeZoneSocialFrame
            rede={rede}
            imageUrl={imageUrl}
            alt={`${alt} — vista telemóvel`}
            viewport="mobile"
            showSafeZones={showSafeZones}
            maxHeightPx={maxHeightPx}
          />
        </div>
      </div>

      {showSafeZones && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[10px] font-medium text-stone-600">
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-xs border-2 border-dashed border-emerald-500" />
            Zona segura (PC / Móvel)
          </span>
          {hasAvatarZone && (
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full border-2 border-amber-500 bg-amber-500/20" />
              Foto de perfil
            </span>
          )}
          {rede.id === "yt-banner" && (
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-xs border-2 border-sky-400" />
              Centro 1546×423
            </span>
          )}
          {rede.id === "ig-story" && (
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-xs border border-red-400 bg-red-500/25" />
              250 px UI livre
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function Circle40pxTestPreview({
  imageUrl,
  nome,
  contraste,
  legivel,
}: {
  imageUrl: string;
  nome: string;
  contraste?: number;
  legivel?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2.5 rounded-xl border border-stone-200 bg-[#FAF7F2] px-3 py-2 text-[11px]">
      <div className="flex items-center gap-2.5">
        <div
          className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-stone-300 bg-white shadow-2xs"
          title={`Teste de leitura em círculo a 40×40 px (${nome})`}
        >
          <img
            src={imageUrl}
            alt={`Miniatura 40 px — ${nome}`}
            width={40}
            height={40}
            className="h-10 w-10 object-cover"
          />
        </div>
        <div>
          <p className="font-bold text-stone-900">Teste círculo 40 px</p>
          <p className="text-[10px] text-stone-600">
            Recorte real de comentário/lista
          </p>
        </div>
      </div>

      {typeof contraste === "number" && (
        <span
          className={`rounded-md px-2 py-0.5 font-bold shrink-0 ${
            legivel !== false
              ? "bg-emerald-100 text-emerald-950"
              : "bg-red-100 text-red-900"
          }`}
        >
          {legivel !== false ? `Legível (${contraste})` : `Fraco (${contraste})`}
        </span>
      )}
    </div>
  );
}
