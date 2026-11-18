/**
 * prototype/shell/lazy-media.js
 * Shared lazy media loader and playback manager:
 * - Loads video src from data-src only within 300px of viewport (IntersectionObserver)
 * - Sets video poster from data-poster within 300px
 * - At most 3 videos play at the same time (pauses the farthest)
 * - Pauses videos when scrolled out of view
 * - Respects prefers-reduced-motion and Save-Data (shows poster only, never autoplays)
 * - Uses mobile variant (-m.mp4, assets/m/) on screens < 700px
 * - Zero external dependencies
 */
(function () {
  'use strict';

  if (typeof window === 'undefined') return;

  const isReducedMotion = () => {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  };

  const isSaveData = () => {
    return Boolean(navigator.connection && navigator.connection.saveData);
  };

  const canAutoplay = () => {
    return !isReducedMotion() && !isSaveData();
  };

  const KNOWN_MOBILE_VARIANTS = new Set([
    'baikal-loop.mp4', 'baikal-reveal.mp4',
    'kamchatka-loop.mp4', 'kamchatka-reveal.mp4',
    'kazan-loop.mp4', 'kazan-reveal.mp4',
    'moscow-loop.mp4', 'moscow-reveal.mp4',
    'murmansk-loop.mp4', 'murmansk-reveal.mp4',
    'sochi-loop.mp4', 'sochi-reveal.mp4',
    'spb-loop.mp4', 'spb-reveal.mp4',
    'train-loop.mp4',
    'vladivostok-loop.mp4', 'vladivostok-reveal.mp4'
  ]);

  function resolveSrc(url, videoEl) {
    if (!url) return '';
    const isMobile = window.innerWidth < 700;
    if (isMobile) {
      if (videoEl && videoEl.dataset.srcMobile) {
        return videoEl.dataset.srcMobile;
      }
      const filename = url.split('/').pop().split('?')[0];
      if (KNOWN_MOBILE_VARIANTS.has(filename)) {
        if (url.includes('/assets/') && !url.includes('/assets/m/')) {
          return url.replace('/assets/', '/assets/m/');
        }
        if (url.startsWith('assets/') && !url.startsWith('assets/m/')) {
          return url.replace('assets/', 'assets/m/');
        }
      }
      if (url.endsWith('.mp4') && !url.endsWith('-m.mp4')) {
        const candidate = url.replace(/\.mp4$/, '-m.mp4');
        if (videoEl && videoEl.dataset.hasMobileVariant === 'true') {
          return candidate;
        }
      }
    }
    return url;
  }

  const activePlaying = new Set();
  const visibleVideos = new Set();

  function getViewportCenterDist(el) {
    const rect = el.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    return Math.abs(mid - window.innerHeight / 2);
  }

  function enforceMaxPlaying(maxCount = 3) {
    if (activePlaying.size <= maxCount) return;

    // Sort playing videos by distance from center of viewport (descending: farthest first)
    const sorted = Array.from(activePlaying).sort((a, b) => {
      return getViewportCenterDist(b) - getViewportCenterDist(a);
    });

    while (sorted.length > maxCount) {
      const farthest = sorted.shift();
      if (farthest && !farthest.paused) {
        try { farthest.pause(); } catch (e) {}
        activePlaying.delete(farthest);
      }
    }
  }

  function playVideo(video) {
    if (!canAutoplay()) return;
    if (!video.src && video.dataset.src) {
      video.src = resolveSrc(video.dataset.src, video);
      video.preload = 'none';
    }
    activePlaying.add(video);
    enforceMaxPlaying(3);

    const promise = video.play();
    if (promise !== undefined) {
      promise.catch(() => {
        activePlaying.delete(video);
      });
    }
  }

  function pauseVideo(video) {
    activePlaying.delete(video);
    if (!video.paused) {
      try { video.pause(); } catch (e) {}
    }
  }

  function initLazyMedia() {
    const videos = document.querySelectorAll('video');
    const lazyImages = document.querySelectorAll('img[data-src]');
    if (!videos.length && !lazyImages.length) return;

    if (videos.length) {
      // Observer 1: Near-viewport loading (rootMargin: 300px)
      let loadObserver = null;
    if ('IntersectionObserver' in window) {
      loadObserver = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const v = entry.target;
            if (v.dataset.poster && !v.poster) {
              v.poster = v.dataset.poster;
            }
            if (v.dataset.src && !v.src) {
              v.src = resolveSrc(v.dataset.src, v);
              v.preload = 'none';
            }
            obs.unobserve(v);
          }
        });
      }, { rootMargin: '300px 0px 300px 0px' });
    }

    // Observer 2: Playback viewport intersection
    let playbackObserver = null;
    if ('IntersectionObserver' in window) {
      playbackObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const v = entry.target;
          if (entry.isIntersecting) {
            visibleVideos.add(v);
            const wantsAutoplay = v.hasAttribute('data-autoplay') || v.hasAttribute('autoplay');
            if (wantsAutoplay && canAutoplay()) {
              if (v.id === 'dHeroVideo' || v.hasAttribute('data-hero')) {
                playVideo(v);
              } else {
                if (v.__dwellTimer) clearTimeout(v.__dwellTimer);
                v.__dwellTimer = setTimeout(() => {
                  v.__dwellTimer = null;
                  if (visibleVideos.has(v)) {
                    playVideo(v);
                  }
                }, 200);
              }
            }
          } else {
            if (v.__dwellTimer) {
              clearTimeout(v.__dwellTimer);
              v.__dwellTimer = null;
            }
            visibleVideos.delete(v);
            pauseVideo(v);
          }
        });
      }, { threshold: [0, 0.25] });
    }

    // Pointer hover & focus triggers playback on interactive cards
    document.addEventListener('pointerenter', (e) => {
      const card = e.target.closest && e.target.closest('.d-card, .exp-card, .frame');
      if (card) {
        const v = card.querySelector('video');
        if (v) playVideo(v);
      }
    }, true);
    document.addEventListener('pointerleave', (e) => {
      const card = e.target.closest && e.target.closest('.d-card, .exp-card, .frame');
      if (card) {
        const v = card.querySelector('video');
        if (v) pauseVideo(v);
      }
    }, true);

    videos.forEach(v => {
      // Ensure preload is none if outside first screen and not dHeroVideo
      if (v.id !== 'dHeroVideo' && !v.hasAttribute('data-hero')) {
        v.preload = 'none';
      }

      // If video has autoplay attribute, convert to data-autoplay to control playback cleanly
      if (v.hasAttribute('autoplay')) {
        v.removeAttribute('autoplay');
        v.setAttribute('data-autoplay', '');
      }

      v.addEventListener('play', () => {
        activePlaying.add(v);
        enforceMaxPlaying(3);
      });

      v.addEventListener('pause', () => {
        activePlaying.delete(v);
      });

      v.addEventListener('ended', () => {
        activePlaying.delete(v);
      });

      if (loadObserver) {
        if (v.dataset.src || v.dataset.poster) {
          loadObserver.observe(v);
        }
      } else {
        // Fallback for no IntersectionObserver
        if (v.dataset.poster && !v.poster) v.poster = v.dataset.poster;
        if (v.dataset.src && !v.src) v.src = resolveSrc(v.dataset.src, v);
      }

      if (playbackObserver) {
        playbackObserver.observe(v);
      }
    });
    }

    // Also support images with data-src if any
    if (lazyImages.length && 'IntersectionObserver' in window) {
      const imgObs = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            if (img.dataset.srcset) img.srcset = img.dataset.srcset;
            obs.unobserve(img);
          }
        });
      }, { rootMargin: '300px 0px 300px 0px' });
      lazyImages.forEach(img => imgObs.observe(img));
    } else if (lazyImages.length) {
      lazyImages.forEach(img => {
        img.src = img.dataset.src;
        if (img.dataset.srcset) img.srcset = img.dataset.srcset;
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLazyMedia);
  } else {
    initLazyMedia();
  }

  window.__ROTW_LAZY_MEDIA = {
    init: initLazyMedia,
    activePlaying
  };
})();
