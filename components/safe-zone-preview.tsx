"use client";

import React, { useId } from "react";
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
  const strokeUnit = Math.max(2, Math.round(Math.min(rede.widthPx, rede.heightPx) / 140));
  const dashLen = strokeUnit * 3;
  const fontSize = Math.max(12, Math.round(Math.min(rede.widthPx, rede.heightPx) / 22));

  return (
    <div
      className="relative mx-auto overflow-hidden rounded-lg border border-stone-300 bg-stone-100 shadow-2xs"
      style={{
        aspectRatio: `${rede.widthPx} / ${rede.heightPx}`,
        width: `min(100%, ${maxWidthPx}px)`,
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
              {/* Em vista telemóvel, escurece as laterais/margens fora da zona visível no telemóvel */}
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
                    fill="rgba(15, 23, 42, 0.46)"
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

              {/* Zona de sobreposição de avatar em capas de computador */}
              {showSafeZones &&
                viewport === "desktop" &&
                rede.avatarOverlapDesktop && (
                  <g>
                    <rect
                      x={rede.avatarOverlapDesktop.x}
                      y={rede.avatarOverlapDesktop.y}
                      width={rede.avatarOverlapDesktop.width}
                      height={rede.avatarOverlapDesktop.height}
                      rx={strokeUnit * 2}
                      fill="rgba(245, 158, 11, 0.24)"
                      stroke="#F59E0B"
                      strokeWidth={strokeUnit}
                      strokeDasharray={`${dashLen} ${dashLen}`}
                    />
                    <circle
                      cx={
                        rede.avatarOverlapDesktop.x +
                        rede.avatarOverlapDesktop.width / 2
                      }
                      cy={
                        rede.avatarOverlapDesktop.y +
                        rede.avatarOverlapDesktop.height / 2
                      }
                      r={
                        Math.min(
                          rede.avatarOverlapDesktop.width,
                          rede.avatarOverlapDesktop.height
                        ) * 0.4
                      }
                      fill="rgba(15, 23, 42, 0.5)"
                      stroke="#FBBF24"
                      strokeWidth={strokeUnit * 0.85}
                    />
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
