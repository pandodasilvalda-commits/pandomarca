import sharp from "sharp";
import {
  getZonaSeguraComum,
  type RedeSocialConfig,
  type RedeSocialId,
  type SafeZoneRect,
} from "../config/redes-sociais";

export interface SafeZoneAuditResult {
  redeId: RedeSocialId;
  widthPx: number;
  heightPx: number;
  valida: boolean;
  precisaRegeneracao: boolean;
  motivos: string[];
  aspectRatioEsperado: string;
  aspectRatioUsadoGemini: string;
  safeZoneDesktop: SafeZoneRect;
  safeZoneMobile: SafeZoneRect;
  safeZoneComum: SafeZoneRect;
  avatarOverlapDesktop?: SafeZoneRect;
  avatarOverlapMobile?: SafeZoneRect;
  margemTopoLivre?: boolean;
  margemBaseLivre?: boolean;
  zonaYouTubeLivre?: boolean;
  avatarSemSobreposicao?: boolean;
  avatarSemSobreposicaoMovel?: boolean;
  informacaoDentroZonaSeguraMobile?: boolean;
  cantosCirculoLimpos?: boolean;
  circulo40pxLegivel?: boolean;
  contraste40px?: number;
  opacidadeValida: boolean;
}

function clampRect(rect: SafeZoneRect, w: number, h: number): SafeZoneRect {
  const x = Math.max(0, Math.min(w - 2, Math.round(rect.x)));
  const y = Math.max(0, Math.min(h - 2, Math.round(rect.y)));
  const width = Math.max(2, Math.min(w - x, Math.round(rect.width)));
  const height = Math.max(2, Math.min(h - y, Math.round(rect.height)));
  return { x, y, width, height, nota: rect.nota };
}

/**
 * Mede a fração de transições nítidas de luminância (traços de texto, letras ou logótipos)
 * dentro de uma região retangular da imagem.
 */
function measureCrispStrokeDensity(
  data: Buffer,
  imgW: number,
  imgH: number,
  channels: number,
  rect: SafeZoneRect
): { crispFraction: number; peakTileCrispFraction: number; luminanceRange: number } {
  const r = clampRect(rect, imgW, imgH);
  const stepX = Math.max(1, Math.floor(r.width / 220));
  const stepY = Math.max(1, Math.floor(r.height / 220));
  const dFine = Math.max(1, Math.min(3, Math.round(Math.min(imgW, imgH) / 400)));
  const dSpanX = Math.max(dFine, Math.min(8, Math.round(stepX * 0.5)));
  const dSpanY = Math.max(dFine, Math.min(8, Math.round(stepY * 0.5)));
  const maxProbeX = Math.max(dFine, dSpanX);
  const maxProbeY = Math.max(dFine, dSpanY);

  const cols = 4;
  const rows = 3;
  const tileTotal = new Int32Array(cols * rows);
  const tileCrisp = new Int32Array(cols * rows);

  let total = 0;
  let crisp = 0;
  let minLum = 255;
  let maxLum = 0;

  const getLum = (x: number, y: number): number => {
    const cx = Math.min(imgW - 1, Math.max(0, x));
    const cy = Math.min(imgH - 1, Math.max(0, y));
    const idx = (cy * imgW + cx) * channels;
    return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  };

  for (let y = r.y; y < r.y + r.height - maxProbeY; y += stepY) {
    const ty = Math.min(rows - 1, Math.floor(((y - r.y) / r.height) * rows));
    for (let x = r.x; x < r.x + r.width - maxProbeX; x += stepX) {
      const tx = Math.min(cols - 1, Math.floor(((x - r.x) / r.width) * cols));
      const tileIdx = ty * cols + tx;

      const l = getLum(x, y);
      if (l < minLum) minLum = l;
      if (l > maxLum) maxLum = l;
      const dx = Math.max(
        Math.abs(l - getLum(x + dFine, y)),
        Math.abs(l - getLum(x + dSpanX, y))
      );
      const dy = Math.max(
        Math.abs(l - getLum(x, y + dFine)),
        Math.abs(l - getLum(x, y + dSpanY))
      );
      total++;
      tileTotal[tileIdx]++;
      if (dx + dy > 78) {
        crisp++;
        tileCrisp[tileIdx]++;
      }
    }
  }

  let peakTileCrispFraction = 0;
  for (let i = 0; i < cols * rows; i++) {
    if (tileTotal[i] >= 25) {
      const f = tileCrisp[i] / tileTotal[i];
      if (f > peakTileCrispFraction) peakTileCrispFraction = f;
    }
  }

  return {
    crispFraction: total > 0 ? crisp / total : 0,
    peakTileCrispFraction,
    luminanceRange: total > 0 ? maxLum - minLum : 0,
  };
}

/**
 * Deteta aglomerados bidirecionais de saltos abruptos a 1 px (característicos de letras,
 * palavras e logótipos vetoriais/nítidos), distinguindo-os de fotografia natural, degradês,
 * texturas suaves ou fundos de ambiente que podem extravasar a zona segura móvel.
 */
function measureTextOrLogoLeakCluster(
  data: Buffer,
  imgW: number,
  imgH: number,
  channels: number,
  rect: SafeZoneRect
): { activeGlyphCells: number; maxCellComb: number; hasLeak: boolean } {
  const r = clampRect(rect, imgW, imgH);
  const cell = 32;
  const cols = Math.max(1, Math.ceil(r.width / cell));
  const rows = Math.max(1, Math.ceil(r.height / cell));
  const tot = new Int32Array(cols * rows);
  const hx = new Int32Array(cols * rows);
  const vy = new Int32Array(cols * rows);

  const getLum = (x: number, y: number): number => {
    const px = Math.min(imgW - 1, Math.max(0, x));
    const py = Math.min(imgH - 1, Math.max(0, y));
    const idx = (py * imgW + px) * channels;
    return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  };

  for (let y = r.y; y < r.y + r.height - 1; y++) {
    const cy = Math.min(rows - 1, Math.floor((y - r.y) / cell));
    for (let x = r.x; x < r.x + r.width - 1; x++) {
      const cx = Math.min(cols - 1, Math.floor((x - r.x) / cell));
      const idx = cy * cols + cx;
      const l = getLum(x, y);
      tot[idx]++;
      if (Math.abs(l - getLum(x + 1, y)) > 88) hx[idx]++;
      if (Math.abs(l - getLum(x, y + 1)) > 88) vy[idx]++;
    }
  }

  let activeGlyphCells = 0;
  let maxCellComb = 0;
  for (let i = 0; i < cols * rows; i++) {
    if (tot[i] < 192) continue;
    const fx = hx[i] / tot[i];
    const fy = vy[i] / tot[i];
    const comb = fx + fy;
    if (comb > maxCellComb) maxCellComb = comb;
    if (Math.min(fx, fy) >= 0.022 && comb >= 0.07) {
      activeGlyphCells++;
    }
  }

  return {
    activeGlyphCells,
    maxCellComb,
    hasLeak: activeGlyphCells >= 2 || maxCellComb >= 0.068,
  };
}

/**
 * Mede transições nítidas fora do círculo inscrito nos 4 cantos (máscara circular).
 */
function measureCircleCornersCrispDensity(
  data: Buffer,
  imgW: number,
  imgH: number,
  channels: number
): number {
  const cx = imgW / 2;
  const cy = imgH / 2;
  const safeR = Math.min(imgW, imgH) * 0.455;
  const step = Math.max(1, Math.floor(Math.min(imgW, imgH) / 160));
  const deltaStep = Math.max(1, Math.round(Math.min(imgW, imgH) / 220));

  let cornerTotal = 0;
  let cornerCrisp = 0;

  const getLum = (x: number, y: number): number => {
    const px = Math.min(imgW - 1, Math.max(0, x));
    const py = Math.min(imgH - 1, Math.max(0, y));
    const idx = (py * imgW + px) * channels;
    return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  };

  for (let y = 0; y < imgH - deltaStep; y += step) {
    for (let x = 0; x < imgW - deltaStep; x += step) {
      const dist = Math.hypot(x - cx, y - cy);
      if (dist <= safeR) continue;
      cornerTotal++;
      const l = getLum(x, y);
      const dx = Math.abs(l - getLum(x + deltaStep, y));
      const dy = Math.abs(l - getLum(x, y + deltaStep));
      if (dx + dy > 72) {
        cornerCrisp++;
      }
    }
  }

  return cornerTotal > 0 ? cornerCrisp / cornerTotal : 0;
}

/**
 * Simula a redução real do avatar para 40×40 px dentro de um círculo
 * e avalia o contraste dinâmico central (P95 - P05).
 */
async function measure40pxCircleContrast(
  buffer: Buffer
): Promise<{ legivel: boolean; contraste: number }> {
  const { data } = await sharp(buffer)
    .resize(40, 40, { fit: "cover", position: "centre" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const lums: number[] = [];
  for (let y = 0; y < 40; y++) {
    for (let x = 0; x < 40; x++) {
      if (Math.hypot(x - 19.5, y - 19.5) > 17.2) continue;
      const idx = (y * 40 + x) * 4;
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      lums.push(lum);
    }
  }

  if (lums.length === 0) return { legivel: false, contraste: 0 };
  lums.sort((a, b) => a - b);
  const p05 = lums[Math.floor(lums.length * 0.05)];
  const p95 = lums[Math.floor(lums.length * 0.95)];
  const contraste = Math.round(p95 - p05);
  return {
    legivel: contraste >= 40,
    contraste,
  };
}

/**
 * Corta e redimensiona uma imagem bruta vinda do fornecedor para as medidas exactas da rede social,
 * preservando o centro seguro em formatos panorâmicos ou verticais.
 */
export async function cropResizeToRedeSpec(
  rawBuf: Buffer,
  rede: RedeSocialConfig
): Promise<Buffer> {
  const meta = await sharp(rawBuf).metadata();
  const srcW = meta.width || rede.widthPx;
  const srcH = meta.height || rede.heightPx;

  let pipeline = sharp(rawBuf);

  if (srcW !== rede.widthPx || srcH !== rede.heightPx) {
    pipeline = pipeline.resize(rede.widthPx, rede.heightPx, {
      fit: "cover",
      position: "centre",
    });
  }

  if (rede.opaque) {
    // Amostra o pixel do topo esquerdo para achatar fundo sólido coerente caso haja transparência
    const cornerPixel = await sharp(rawBuf)
      .resize(1, 1)
      .removeAlpha()
      .raw()
      .toBuffer();
    const bg = {
      r: cornerPixel[0] ?? 250,
      g: cornerPixel[1] ?? 247,
      b: cornerPixel[2] ?? 242,
    };
    pipeline = pipeline.flatten({ background: bg });
  }

  return pipeline.png().toBuffer();
}

/**
 * Valida zonas seguras e regras de camadas por formato:
 * - Chumba (`precisaRegeneracao = true`) se logótipo ou texto ficar fora da zona segura móvel,
 *   ou por baixo da foto de perfil / UI (desktop, mobile, 250 px Story, fora 1546×423 YouTube).
 * - Aceita quando apenas fundos, texturas, padrões ou fotografia de ambiente sangram fora da zona móvel.
 */
export async function validarZonaSegura(
  buffer: Buffer,
  rede: RedeSocialConfig
): Promise<SafeZoneAuditResult> {
  const safeZoneComum = getZonaSeguraComum(rede);
  const motivos: string[] = [];

  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const W = info.width;
  const H = info.height;
  const ch = info.channels;

  if (W !== rede.widthPx || H !== rede.heightPx) {
    motivos.push(
      `Dimensão obtida (${W}×${H} px) diferente da medida obrigatória (${rede.widthPx}×${rede.heightPx} px).`
    );
  }

  // Verificar transparência quando é exigido fundo opaco
  let opacidadeValida = true;
  if (rede.opaque) {
    const step = Math.max(1, Math.floor((W * H) / 4000));
    for (let i = 0; i < W * H; i += step) {
      if (data[i * ch + 3] < 250) {
        opacidadeValida = false;
        break;
      }
    }
    if (!opacidadeValida) {
      motivos.push(
        `Canal transparente detetado em ${rede.nome}: esta plataforma exige imagem opaca.`
      );
    }
  }

  let margemTopoLivre: boolean | undefined;
  let margemBaseLivre: boolean | undefined;
  let zonaYouTubeLivre: boolean | undefined;
  let avatarSemSobreposicao: boolean | undefined;
  let avatarSemSobreposicaoMovel: boolean | undefined;
  let informacaoDentroZonaSeguraMobile: boolean | undefined;
  let cantosCirculoLimpos: boolean | undefined;
  let circulo40pxLegivel: boolean | undefined;
  let contraste40px: number | undefined;

  // 1. Verificar margens de Story (250 px topo e base)
  if (rede.id === "ig-story" && rede.margemTopoPx && rede.margemBasePx) {
    const topBand = {
      x: 24,
      y: 0,
      width: W - 48,
      height: Math.round(rede.margemTopoPx * 0.9),
    };
    const bottomBand = {
      x: 24,
      y: H - Math.round(rede.margemBasePx * 0.9),
      width: W - 48,
      height: Math.round(rede.margemBasePx * 0.9),
    };
    const topCrisp = measureCrispStrokeDensity(data, W, H, ch, topBand);
    const bottomCrisp = measureCrispStrokeDensity(data, W, H, ch, bottomBand);
    const topText = measureTextOrLogoLeakCluster(data, W, H, ch, topBand);
    const bottomText = measureTextOrLogoLeakCluster(data, W, H, ch, bottomBand);

    margemTopoLivre =
      !topText.hasLeak &&
      topCrisp.crispFraction <= 0.048 &&
      topCrisp.peakTileCrispFraction <= 0.08;
    margemBaseLivre =
      !bottomText.hasLeak &&
      bottomCrisp.crispFraction <= 0.048 &&
      bottomCrisp.peakTileCrispFraction <= 0.08;

    if (!margemTopoLivre) {
      motivos.push(
        "Logótipo ou texto de alto contraste invade a margem superior de 250 px do Story."
      );
    }
    if (!margemBaseLivre) {
      motivos.push(
        "Logótipo ou texto de alto contraste invade a margem inferior de 250 px do Story."
      );
    }
  }

  // 2. Verificar zona segura universal 1546×423 do YouTube Banner (fundo TV pode sangrar; texto/logo não)
  if (rede.id === "yt-banner") {
    const safeMob = rede.safeZoneMobile; // 1546×423 centrada em x=507, y=508
    const outerYtBands: SafeZoneRect[] = [
      { x: 24, y: 18, width: W - 48, height: Math.max(40, safeMob.y - 26) },
      {
        x: 24,
        y: safeMob.y + safeMob.height + 8,
        width: W - 48,
        height: Math.max(40, H - (safeMob.y + safeMob.height + 26)),
      },
      { x: 18, y: safeMob.y, width: Math.max(40, safeMob.x - 26), height: safeMob.height },
      {
        x: safeMob.x + safeMob.width + 8,
        y: safeMob.y,
        width: Math.max(40, W - (safeMob.x + safeMob.width + 26)),
        height: safeMob.height,
      },
    ];
    const ytLeak = outerYtBands.some(
      (band) => measureTextOrLogoLeakCluster(data, W, H, ch, band).hasLeak
    );
    zonaYouTubeLivre = !ytLeak;
    if (!zonaYouTubeLivre) {
      motivos.push(
        "Logótipo ou texto sai fora da zona segura universal 1546×423 px do banner do YouTube."
      );
    }
  }

  // 3. Verificar sobreposição da foto de perfil em computador e em telemóvel
  if (rede.avatarOverlapDesktop) {
    const overlapStats = measureCrispStrokeDensity(
      data,
      W,
      H,
      ch,
      rede.avatarOverlapDesktop
    );
    const overlapLeak = measureTextOrLogoLeakCluster(
      data,
      W,
      H,
      ch,
      rede.avatarOverlapDesktop
    );
    avatarSemSobreposicao =
      !overlapLeak.hasLeak &&
      overlapStats.crispFraction <= 0.055 &&
      overlapStats.peakTileCrispFraction <= 0.085;
    if (!avatarSemSobreposicao) {
      motivos.push(
        `Logótipo ou texto detetado na zona de sobreposição inferior esquerda da foto de perfil em computador (${rede.nome}).`
      );
    }
  }

  if (rede.avatarOverlapMobile) {
    const mobStats = measureCrispStrokeDensity(data, W, H, ch, rede.avatarOverlapMobile);
    const mobLeak = measureTextOrLogoLeakCluster(data, W, H, ch, rede.avatarOverlapMobile);
    avatarSemSobreposicaoMovel =
      !mobLeak.hasLeak &&
      mobStats.crispFraction <= 0.055 &&
      mobStats.peakTileCrispFraction <= 0.085;
    if (!avatarSemSobreposicaoMovel) {
      motivos.push(
        `Logótipo ou texto detetado sob a área da foto de perfil na vista de telemóvel (${rede.nome}).`
      );
    }
  }

  // 4. Para capas, publicações e stories onde o fundo pode sangrar até às bordas,
  // garantir que nenhum logótipo ou texto sai fora de `safeZoneMobile`
  if (rede.tipoPeca !== "perfil" && rede.composicao.fundoPodeExtravasarMobile) {
    const edgeInset = 8;
    const safeMob = rede.safeZoneMobile;
    const candidates: SafeZoneRect[] = [
      {
        x: edgeInset,
        y: edgeInset,
        width: Math.max(0, safeMob.x - edgeInset - 6),
        height: Math.max(0, H - edgeInset * 2),
      },
      {
        x: safeMob.x + safeMob.width + 6,
        y: edgeInset,
        width: Math.max(0, W - edgeInset - (safeMob.x + safeMob.width + 6)),
        height: Math.max(0, H - edgeInset * 2),
      },
      {
        x: safeMob.x,
        y: edgeInset,
        width: safeMob.width,
        height: Math.max(0, safeMob.y - edgeInset - 6),
      },
      {
        x: safeMob.x,
        y: safeMob.y + safeMob.height + 6,
        width: safeMob.width,
        height: Math.max(0, H - edgeInset - (safeMob.y + safeMob.height + 6)),
      },
    ];

    let outerTextOrLogoFound = false;
    for (const band of candidates) {
      if (band.width < 28 || band.height < 28) continue;
      const res = measureTextOrLogoLeakCluster(data, W, H, ch, band);
      if (res.hasLeak) {
        outerTextOrLogoFound = true;
        break;
      }
    }

    informacaoDentroZonaSeguraMobile = !outerTextOrLogoFound;
    if (!informacaoDentroZonaSeguraMobile) {
      motivos.push(
        `Logótipo ou texto de alto contraste detetado fora da zona segura de telemóvel (${rede.nome}). Fundos e texturas podem sangrar, mas a informação tem de permanecer na zona segura.`
      );
    }
  }

  // 5. Verificar cantos recortados em máscara circular
  if (rede.isCircle) {
    const cornerCrisp = measureCircleCornersCrispDensity(data, W, H, ch);
    cantosCirculoLimpos = cornerCrisp <= 0.05;
    if (!cantosCirculoLimpos) {
      motivos.push(
        `Traços ou letras encostam demasiado aos cantos exteriores da máscara circular em ${rede.nome}.`
      );
    }
  }

  // 6. Teste de legibilidade a 40×40 px em círculo para avatares
  if (rede.test40px) {
    const res40 = await measure40pxCircleContrast(buffer);
    circulo40pxLegivel = res40.legivel;
    contraste40px = res40.contraste;
    if (!circulo40pxLegivel) {
      motivos.push(
        `Baixo contraste ao reduzir o avatar para círculo de 40 px (${res40.contraste}/255; mínimo recomendado 40/255).`
      );
    }
  }

  // 7. Garantir que o interior da zona segura comum tem presença visual real
  const centerStats = measureCrispStrokeDensity(data, W, H, ch, safeZoneComum);
  if (centerStats.luminanceRange < 20) {
    motivos.push(
      `A zona segura de ${rede.nome} apresenta contraste visual insuficiente (${Math.round(centerStats.luminanceRange)}).`
    );
  }

  const precisaRegeneracao = motivos.length > 0;
  return {
    redeId: rede.id,
    widthPx: W,
    heightPx: H,
    valida: !precisaRegeneracao,
    precisaRegeneracao,
    motivos,
    aspectRatioEsperado: rede.proporcaoAlvo,
    aspectRatioUsadoGemini: rede.aspectRatioGemini,
    safeZoneDesktop: rede.safeZoneDesktop,
    safeZoneMobile: rede.safeZoneMobile,
    safeZoneComum,
    avatarOverlapDesktop: rede.avatarOverlapDesktop,
    avatarOverlapMobile: rede.avatarOverlapMobile,
    margemTopoLivre,
    margemBaseLivre,
    zonaYouTubeLivre,
    avatarSemSobreposicao,
    avatarSemSobreposicaoMovel,
    informacaoDentroZonaSeguraMobile,
    cantosCirculoLimpos,
    circulo40pxLegivel,
    contraste40px,
    opacidadeValida,
  };
}
