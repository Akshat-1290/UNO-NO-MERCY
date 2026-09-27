import gsap from 'gsap';
import { Card } from '@uno/shared/types';
import { playSound, stopCardAnimationSounds } from '../../utils/sound';

export interface FlightDescriptor {
  key: string;
  frontSrc: string;
  revealFace: boolean;
  startX: number;
  startY: number;
  ctrlX: number;
  ctrlY: number;
  endX: number;
  endY: number;
  startScale: number;
  peakScale: number;
  endScale: number;
  startRotZ: number;
  midRotZ: number;
  endRotZ: number;
  delay: number;
  duration: number;
  handCardId?: string;
  targetOpponentId?: string;
  isStarterDiscard?: boolean;
  starterCard?: Card;
  playLaunchSound?: boolean;
  playLandingSound?: boolean;
  soundEnabled?: boolean;
  timeScale?: number;
  onLaunch?: () => void;
  onLandedCallback?: () => void;
}

/**
 * Creates a lightweight, GPU-composited 3D two-sided card DOM node
 * manipulated directly by GSAP with zero React re-render overhead.
 * Cards are 100% solid opaque (no transparency/see-through).
 */
export function create3DCardNode(
  container: HTMLElement,
  cardW: number,
  cardH: number,
  frontSrc: string,
  zIndex: number,
  createdNodes: HTMLElement[]
) {
  const outerRadius = cardW < 65 ? '12px' : '16px';
  const innerRadius = cardW < 65 ? '9px' : '11px';

  const wrapper = document.createElement('div');
  wrapper.className = 'gsap-flight-card';
  wrapper.style.position = 'fixed';
  wrapper.style.top = '0px';
  wrapper.style.left = '0px';
  wrapper.style.width = `${cardW}px`;
  wrapper.style.height = `${cardH}px`;
  wrapper.style.perspective = '950px';
  wrapper.style.pointerEvents = 'none';
  wrapper.style.zIndex = String(zIndex);
  wrapper.style.willChange = 'transform, opacity';
  wrapper.style.opacity = '0';

  const inner = document.createElement('div');
  inner.style.width = '100%';
  inner.style.height = '100%';
  inner.style.position = 'relative';
  inner.style.transformStyle = 'preserve-3d';
  inner.style.willChange = 'transform';

  // Front Face (0deg) - 100% Solid Opaque, pixel-matched to UnoCard
  const front = document.createElement('div');
  front.style.position = 'absolute';
  front.style.inset = '0';
  front.style.borderRadius = outerRadius;
  front.style.background = '#0a0a0f';
  front.style.padding = cardW < 65 ? '1.5px' : '2px';
  front.style.border = '2px solid rgba(0, 0, 0, 0.9)';
  front.style.boxShadow = '0 12px 24px rgba(0,0,0,0.8), 0 0 1px rgba(255,255,255,0.2)';
  front.style.overflow = 'hidden';
  front.style.backfaceVisibility = 'hidden';
  (front.style as any).webkitBackfaceVisibility = 'hidden';
  front.style.transform = 'rotateY(0deg) translateZ(1px)';

  const frontImg = document.createElement('img');
  frontImg.src = frontSrc;
  frontImg.alt = '';
  frontImg.decoding = 'sync';
  frontImg.style.width = '100%';
  frontImg.style.height = '100%';
  frontImg.style.objectFit = 'cover';
  frontImg.style.borderRadius = innerRadius;
  frontImg.style.display = 'block';
  front.appendChild(frontImg);

  // Subtle static sheen matching UnoCard
  const sheen = document.createElement('div');
  sheen.style.position = 'absolute';
  sheen.style.inset = '0';
  sheen.style.borderRadius = innerRadius;
  sheen.style.background =
    'linear-gradient(to top right, rgba(255,255,255,0.15), transparent, rgba(0,0,0,0.1))';
  sheen.style.pointerEvents = 'none';
  front.appendChild(sheen);

  // Specular Foil Glint Sweep (only active in mid-air, hidden before landing)
  const glint = document.createElement('div');
  glint.style.position = 'absolute';
  glint.style.inset = '-20%';
  glint.style.background =
    'linear-gradient(115deg, transparent 32%, rgba(255, 255, 255, 0.38) 48%, rgba(255, 210, 100, 0.2) 54%, transparent 68%)';
  glint.style.transform = 'translateX(-130%)';
  glint.style.opacity = '0';
  glint.style.pointerEvents = 'none';
  front.appendChild(glint);

  // Back Face (180deg) - 100% Solid Opaque
  const back = document.createElement('div');
  back.style.position = 'absolute';
  back.style.inset = '0';
  back.style.borderRadius = outerRadius;
  back.style.background = '#0a0a0f';
  back.style.padding = cardW < 65 ? '1.5px' : '2px';
  back.style.border = '2px solid rgba(0, 0, 0, 0.9)';
  back.style.boxShadow = '0 12px 24px rgba(0,0,0,0.8), 0 0 1px rgba(255,255,255,0.2)';
  back.style.overflow = 'hidden';
  back.style.backfaceVisibility = 'hidden';
  (back.style as any).webkitBackfaceVisibility = 'hidden';
  back.style.transform = 'rotateY(180deg) translateZ(1px)';

  const backImg = document.createElement('img');
  backImg.src = '/cards/card_back.webp';
  backImg.alt = '';
  backImg.decoding = 'sync';
  backImg.style.width = '100%';
  backImg.style.height = '100%';
  backImg.style.objectFit = 'cover';
  backImg.style.borderRadius = innerRadius;
  backImg.style.display = 'block';
  back.appendChild(backImg);

  inner.appendChild(front);
  inner.appendChild(back);
  wrapper.appendChild(inner);
  container.appendChild(wrapper);
  createdNodes.push(wrapper);

  return { wrapper, inner, front, glint };
}

/**
 * Safely destroys and removes all DOM nodes created during an animation sequence.
 */
export function cleanupFlightNodes(nodes: HTMLElement[]) {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    gsap.killTweensOf(node);
    if (node.parentNode) {
      node.parentNode.removeChild(node);
    }
  }
  nodes.length = 0;
}

/**
 * Animates a single FlightDescriptor along a Quadratic Bezier curve with
 * 3D perspective banking, optional 180-degree face reveal, and guaranteed DOM removal.
 */
export function scheduleCardFlight(
  tl: gsap.core.Timeline,
  container: HTMLElement,
  desc: FlightDescriptor,
  cardW: number,
  cardH: number,
  zIndex: number,
  createdNodes: HTMLElement[],
  onCardLanded?: (cardId: string) => void,
  onRevealStarterCard?: (card: Card) => void
) {
  const { wrapper, inner, front, glint } = create3DCardNode(
    container,
    cardW,
    cardH,
    desc.frontSrc,
    zIndex,
    createdNodes
  );

  const progressObj = { t: 0 };
  let landedTriggered = false;
  let starterImpactSoundTriggered = false;

  gsap.set(wrapper, {
    x: desc.startX - cardW / 2,
    y: desc.startY - cardH / 2,
    scale: desc.startScale,
    opacity: 0,
    force3D: true,
  });

  gsap.set(inner, {
    rotateY: -180,
    rotateX: 22,
    rotateZ: desc.startRotZ,
    force3D: true,
  });

  tl.to(
    progressObj,
    {
      t: 1,
      duration: desc.duration,
      ease: 'power2.out',
      onStart: () => {
        wrapper.style.opacity = '1';
        desc.onLaunch?.();
        if (desc.soundEnabled !== false && desc.playLaunchSound !== false) {
          if (desc.isStarterDiscard) {
            stopCardAnimationSounds(0.02, 'card-shuffle');
            playSound('card_throw', {
              actionKey: `starter_throw_${desc.key}`,
              timeScale: desc.timeScale,
            });
          } else {
            playSound('card_pick', {
              actionKey: `pick_${desc.key}`,
              timeScale: desc.timeScale,
            });
          }
        }
      },
      onUpdate: () => {
        const t = progressObj.t;
        const inv = 1 - t;

        // Quadratic Bezier position B(t) = (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
        const bx = inv * inv * desc.startX + 2 * inv * t * desc.ctrlX + t * t * desc.endX;
        const by = inv * inv * desc.startY + 2 * inv * t * desc.ctrlY + t * t * desc.endY;

        // Parabolic scale envelope
        const scale =
          t < 0.45
            ? gsap.utils.interpolate(desc.startScale, desc.peakScale, t / 0.45)
            : gsap.utils.interpolate(desc.peakScale, desc.endScale, (t - 0.45) / 0.55);

        // 3D Pitch (rotateX) & Roll (rotateZ)
        const rotX =
          t < 0.5
            ? gsap.utils.interpolate(22, -8, t / 0.5)
            : gsap.utils.interpolate(-8, 0, (t - 0.5) / 0.5);

        const rotZ =
          t < 0.45
            ? gsap.utils.interpolate(desc.startRotZ, desc.midRotZ, t / 0.45)
            : gsap.utils.interpolate(desc.midRotZ, desc.endRotZ, (t - 0.45) / 0.55);

        // 3D Y-Axis Flip
        let rotY = -180;
        if (desc.revealFace) {
          if (t <= 0.18) {
            rotY = -180;
            glint.style.opacity = '0';
          } else if (t >= 0.76) {
            rotY = 0;
            glint.style.opacity = '0';
          } else {
            const flipProgress = (t - 0.18) / (0.76 - 0.18);
            const easedFlip =
              flipProgress < 0.5
                ? 2 * flipProgress * flipProgress
                : 1 - Math.pow(-2 * flipProgress + 2, 2) / 2;
            rotY = -180 * (1 - easedFlip);
            const glintX = -130 + easedFlip * 260;
            glint.style.opacity = String(Math.sin(flipProgress * Math.PI) * 0.85);
            glint.style.transform = `translateX(${glintX}%)`;
          }
        } else {
          rotY = -180 + Math.sin(t * Math.PI) * 24;
        }

        // Smoothly settle elevation shadow during the final 25% of flight so handoff is invisible
        if (t > 0.75) {
          const settleP = (t - 0.75) / 0.25;
          const blur = gsap.utils.interpolate(24, 6, settleP).toFixed(1);
          const yOff = gsap.utils.interpolate(12, 2, settleP).toFixed(1);
          const alpha = gsap.utils.interpolate(0.8, 0.55, settleP).toFixed(2);
          front.style.boxShadow = `0 ${yOff}px ${blur}px rgba(0,0,0,${alpha})`;
        }

        // For opponent seat flights, smoothly absorb into their nameplate during the last 14% of flight
        if (desc.targetOpponentId && t > 0.86) {
          const fadeOut = Math.max(0, (1 - t) / 0.14);
          wrapper.style.opacity = fadeOut.toFixed(2);
        } else {
          wrapper.style.opacity = '1';
        }

        wrapper.style.transform = `translate3d(${(bx - cardW / 2).toFixed(1)}px, ${(by - cardH / 2).toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
        inner.style.transform = `rotateY(${rotY.toFixed(1)}deg) rotateX(${rotX.toFixed(1)}deg) rotateZ(${rotZ.toFixed(1)}deg)`;

        // Trigger starter discard or final roulette landing sound at t=0.72 so its 115ms transient finishes right at t=1.0
        if (
          !starterImpactSoundTriggered &&
          (desc.isStarterDiscard || desc.playLandingSound) &&
          t >= 0.72
        ) {
          starterImpactSoundTriggered = true;
          if (desc.soundEnabled !== false) {
            playSound('card_land', {
              actionKey: `starter_land_${desc.key}`,
              timeScale: desc.timeScale,
            });
          }
        }
      },
      onComplete: () => {
        // Snap flying card to exact final resting coordinates first
        wrapper.style.transform = `translate3d(${(desc.endX - cardW / 2).toFixed(1)}px, ${(desc.endY - cardH / 2).toFixed(1)}px, 0) scale(${desc.endScale})`;
        inner.style.transform = 'rotateY(0deg) rotateX(0deg) rotateZ(0deg)';
        front.style.boxShadow = '0 2px 6px -1px rgba(0, 0, 0, 0.55)';
        glint.style.opacity = '0';

        // Reveal the static card underneath only once the flying card has 100% reached its resting slot
        if (!landedTriggered) {
          landedTriggered = true;
          if (desc.handCardId && onCardLanded) {
            onCardLanded(desc.handCardId);
          }
          if (desc.isStarterDiscard && desc.starterCard && onRevealStarterCard) {
            onRevealStarterCard(desc.starterCard);
          }
          desc.onLandedCallback?.();
        }

        // Hold flying card at resting coordinates for 2 animation frames while React commits underneath
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (wrapper.parentNode) {
              wrapper.parentNode.removeChild(wrapper);
            }
          });
        });
      },
    },
    desc.delay
  );
}
