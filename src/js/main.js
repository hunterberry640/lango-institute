/* ═══════════════════════════════════════════════════════════════
   LanGo Institute — Main JS
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── Sticky top bar ─────────────────────────────────────────
  const topBar = document.getElementById('topBar');
  if (topBar) {
    document.body.classList.add('has-topbar');
  }

  // ── Navbar scroll effect ───────────────────────────────────
  const navbar = document.getElementById('navbar');
  const topBarHeight = topBar ? topBar.offsetHeight : 0;
  let lastScroll = 0;

  if (topBar && navbar) {
    navbar.style.top = topBarHeight + 'px';
  }

  function checkScroll() {
    const y = window.scrollY;
    navbar.classList.toggle('navbar--scrolled', y > 60);

    if (topBar) {
      const hidden = y > 400 && y > lastScroll;
      topBar.classList.toggle('top-bar--hidden', hidden);
      if (y <= 60) topBar.classList.remove('top-bar--hidden');

      const isHidden = topBar.classList.contains('top-bar--hidden');
      navbar.style.top = isHidden ? '0' : topBarHeight + 'px';
    }

    lastScroll = y;
  }

  window.addEventListener('scroll', checkScroll, { passive: true });
  checkScroll();

  // ── Mobile nav toggle ──────────────────────────────────────
  const toggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');

  toggle.addEventListener('click', () => {
    navLinks.classList.toggle('navbar__links--open');
    toggle.classList.toggle('open');
  });

  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('navbar__links--open');
      toggle.classList.remove('open');
    });
  });

  // ── Scroll-reveal animations ───────────────────────────────
  const revealTargets = document.querySelectorAll(
    '.welcome, .programs, .linguisticky, .gallery, .newsletter, ' +
    '.stat, .program-card, .session-cta, .abroad, .testimonials, ' +
    '.logos, .free-events, .trip-card, .free-event, .testimonial-card'
  );
  revealTargets.forEach(el => el.classList.add('reveal'));

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal--visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );

  revealTargets.forEach(el => observer.observe(el));

  // ── Counter animation ──────────────────────────────────────
  const counters = document.querySelectorAll('.stat__number[data-target]');
  const counterObserver = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = parseInt(el.dataset.target, 10);
        let current = 0;
        const step = Math.max(1, Math.floor(target / 40));
        const interval = setInterval(() => {
          current += step;
          if (current >= target) {
            current = target;
            clearInterval(interval);
          }
          el.textContent = current;
        }, 35);
        counterObserver.unobserve(el);
      });
    },
    { threshold: 0.5 }
  );

  counters.forEach(el => counterObserver.observe(el));

  // ── Staggered reveal for grid children ─────────────────────
  const gridSelectors = '.programs__grid, .gallery__grid, .stats__inner, .abroad__grid, .free-events__grid';
  document.querySelectorAll(gridSelectors).forEach(grid => {
    const gridObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          Array.from(entry.target.children).forEach((child, i) => {
            child.style.transitionDelay = `${i * 80}ms`;
          });
          gridObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.1 }
    );
    gridObserver.observe(grid);
  });

  // ── Testimonials carousel ──────────────────────────────────
  const track = document.getElementById('testimonialsTrack');
  const btnPrev = document.getElementById('testPrev');
  const btnNext = document.getElementById('testNext');

  if (track && btnPrev && btnNext) {
    const scrollAmount = 360;

    btnNext.addEventListener('click', () => {
      track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    });

    btnPrev.addEventListener('click', () => {
      track.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    });

    let autoScroll = setInterval(() => {
      const maxScroll = track.scrollWidth - track.clientWidth;
      if (track.scrollLeft >= maxScroll - 10) {
        track.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    }, 5000);

    track.addEventListener('mouseenter', () => clearInterval(autoScroll));
    track.addEventListener('mouseleave', () => {
      autoScroll = setInterval(() => {
        const maxScroll = track.scrollWidth - track.clientWidth;
        if (track.scrollLeft >= maxScroll - 10) {
          track.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
      }, 5000);
    });
  }
})();
