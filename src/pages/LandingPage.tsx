import { useEffect } from 'react';
import dealifyLogo from '../assets/logosvg.svg';
import '../styles/landing.css';

const DealifyMark = ({ size = 18 }: { size?: number }) => (
  <img
    src={dealifyLogo}
    alt="Dealify"
    style={{ width: size, height: size, borderRadius: 4, display: 'block' }}
  />
);

export default function LandingPage() {

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION OBSERVER
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const sections = document.querySelectorAll('.snap-section');
    const dots = document.querySelectorAll('.snap-dot');

    const playingClasses = ['s1-playing', 's2-playing', 's3-playing', 's4-playing'];

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const section = entry.target as HTMLElement;
          const idx = parseInt(section.dataset.sectionIdx || '0');
          const cls = playingClasses[idx];

          if (entry.isIntersecting) {
            section.classList.add(cls);
            dots.forEach((d, i) =>
              d.classList.toggle('active', i === idx)
            );
            const titleCard = section.querySelector<HTMLElement>('.snap-title-card');
            if (titleCard) {
              titleCard.style.animation = 'none';
              void titleCard.offsetHeight;
              titleCard.style.animation = '';
            }
          } else {
            section.classList.remove(cls);
          }
        });
      },
      { threshold: 0.6 }
    );

    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const animatedEls = document.querySelectorAll(
      '.lp-sc-item, .lp-section-header'
    );

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('lp-in-view');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    animatedEls.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const s1Section = document.querySelector<HTMLElement>(
      '.snap-section[data-section-idx="0"]'
    );
    if (!s1Section) return;

    let timers: ReturnType<typeof setTimeout>[] = [];

    function resetNotifs(section: HTMLElement) {
      section
        .querySelectorAll<HTMLElement>('.s1-notif')
        .forEach((n) => {
          n.classList.remove('s1-notif--in', 's1-notif--out', 's1-notif--gone');
        });
      section
        .querySelectorAll<HTMLElement>('.s1-phone-payoff')
        .forEach((n) => {
          n.classList.remove('s1-phone-payoff--in', 's1-phone-payoff--out');
        });
    }

    function runSequence(section: HTMLElement) {
      timers.forEach(clearTimeout);
      timers = [];
      resetNotifs(section);

      const chaos = Array.from(
        section.querySelectorAll<HTMLElement>('.s1-notif--chaos')
      );
      const dealify = section.querySelector<HTMLElement>('.s1-notif--dealify');
      const payoff = section.querySelector<HTMLElement>('.s1-phone-payoff');
      const sell = section.querySelector<HTMLElement>('.s1-notif--sell');

      chaos.forEach((n, i) => {
        timers.push(
          setTimeout(() => n.classList.add('s1-notif--in'), i * 450)
        );
      });

      timers.push(
        setTimeout(() => {
          chaos.forEach((n) => {
            n.classList.remove('s1-notif--in');
            n.classList.add('s1-notif--out');
          });
        }, 3500)
      );

      timers.push(
        setTimeout(() => {
          chaos.forEach((n) => n.classList.add('s1-notif--gone'));
        }, 3900)
      );

      if (dealify) {
        timers.push(
          setTimeout(() => dealify.classList.add('s1-notif--in'), 4500)
        );
      }

      if (payoff) {
        timers.push(
          setTimeout(() => payoff.classList.add('s1-phone-payoff--in'), 5100)
        );
      }

      if (sell) {
        timers.push(
          setTimeout(() => sell.classList.add('s1-notif--in'), 5300)
        );
      }

      timers.push(
        setTimeout(() => {
          [dealify, sell].forEach((el) => {
            if (!el) return;
            el.classList.remove('s1-notif--in');
            el.classList.add('s1-notif--out');
          });
          if (payoff) {
            payoff.classList.remove('s1-phone-payoff--in');
            payoff.classList.add('s1-phone-payoff--out');
          }
        }, 8500)
      );

      timers.push(setTimeout(() => runSequence(section), 10000));
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            runSequence(entry.target as HTMLElement);
          } else {
            timers.forEach(clearTimeout);
            timers = [];
            resetNotifs(entry.target as HTMLElement);
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(s1Section);
    return () => {
      observer.disconnect();
      timers.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    const stickyBar = document.getElementById('lp-sticky-bar');
    const snapContainer = document.querySelector('.snap-container');
    const footer = document.querySelector<HTMLElement>('.lp-footer');
    let snapObs: IntersectionObserver | null = null;
    let footerObs: IntersectionObserver | null = null;

    if (stickyBar && snapContainer) {
      snapObs = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) {
            stickyBar.classList.add('lp-sticky-bar--visible');
          } else {
            stickyBar.classList.remove('lp-sticky-bar--visible');
          }
        },
        { threshold: 0.05 }
      );
      snapObs.observe(snapContainer);
    }

    if (stickyBar && footer) {
      footerObs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            stickyBar.classList.remove('lp-sticky-bar--visible');
          }
        },
        { threshold: 0.1 }
      );
      footerObs.observe(footer);
    }

    return () => {
      snapObs?.disconnect();
      footerObs?.disconnect();
    };
  }, []);

  useEffect(() => {
    const members = [
      {
        id: 'legal',
        avatar: 'ΑΝ', name: 'Αλεξάνδρα Ν. · Δικηγόρος',
        color: '#7360F2',
        incoming: '📩 Νέα εργασία: Πιστ. Βαρών',
        msg: 'Εκκρεμεί: Πιστ. Βαρών',
        file: 'Πιστοποιητικό Βαρών',
        nodeId: 'node-legal', statusId: 'node-legal-status',
      },
      {
        id: 'tech',
        avatar: 'ΠΙ', name: 'Πέτρος Ι. · Μηχανικός',
        color: '#F59E0B',
        incoming: '📩 Νέα εργασία: Τοπογραφικό',
        msg: 'Εκκρεμεί: Τοπογραφικό',
        file: 'Τοπογραφικό Διάγραμμα',
        nodeId: 'node-tech', statusId: 'node-tech-status',
      },
      {
        id: 'org',
        avatar: 'ΚΣ', name: 'Κων. Σπ. · Συμβολαιογράφος',
        color: '#60A5FA',
        incoming: '📩 Νέα εργασία: Εκκαθαριστικό',
        msg: 'Εκκρεμεί: Εκκαθαριστικό',
        file: 'Εκκαθαριστικό Σημείωμα',
        nodeId: 'node-org', statusId: 'node-org-status',
      },
    ];

    let step = 0;
    let timer: ReturnType<typeof setTimeout>;
    let rafId: number;

    function animateBubble(
      bubble: HTMLElement,
      fromX: number, fromY: number,
      toX: number, toY: number,
      duration: number,
      onComplete: () => void
    ) {
      const start = performance.now();
      bubble.style.opacity = '1';
      bubble.style.left = fromX + 'px';
      bubble.style.top = fromY + 'px';

      function tick(now: number) {
        const t = Math.min((now - start) / duration, 1);
        const ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
        const x = fromX + (toX - fromX) * ease;
        const y = fromY + (toY - fromY) * ease;
        bubble.style.left = x + 'px';
        bubble.style.top = y + 'px';
        if (t < 1) {
          rafId = requestAnimationFrame(tick);
        } else {
          bubble.style.opacity = '0';
          onComplete();
        }
      }
      rafId = requestAnimationFrame(tick);
    }

    function runStep() {
      const m = members[step % 3];
      const prevIdx = (step - 1 + 3) % 3;
      const prev = members[prevIdx];

      // Reset node that ran 3 steps ago
      if (step >= 3) {
        const prevNode = document.getElementById(prev.nodeId);
        const prevStatus = document.getElementById(prev.statusId);
        if (prevNode && prevStatus) {
          prevNode.className = 's2-node';
          prevStatus.textContent = '⚠ Εκκρεμεί';
          prevStatus.className = 's2-ns s2-ns--r';
        }
      }

      // Get positions
      const pingBtn = document.getElementById(`ping-${m.id}`);
      const memberRow = document.getElementById(`member-${m.id}`);
      const nodeEl = document.getElementById(m.nodeId);
      const phoneEl = document.querySelector('.s2-phone-frame') as HTMLElement;
      const bubble = document.getElementById('s2-bubble-travel') as HTMLElement;

      if (!pingBtn || !nodeEl || !phoneEl || !bubble) {
        step++;
        timer = setTimeout(runStep, 500);
        return;
      }

      // Highlight active member row
      if (memberRow) memberRow.classList.add('s2-member-row--active');
      if (pingBtn) pingBtn.classList.add('s2-ping-btn--active');

      // Get bounding rects
      const pingRect = pingBtn.getBoundingClientRect();
      const phoneRect = phoneEl.getBoundingClientRect();
      const nodeRect = nodeEl.getBoundingClientRect();

      const fromX = pingRect.right - 20;
      const fromY = pingRect.top + pingRect.height / 2 - 10;
      const toPhoneX = phoneRect.left + phoneRect.width / 2 - 20;
      const toPhoneY = phoneRect.top + 80;
      const toNodeX = nodeRect.left + nodeRect.width / 2 - 20;
      const toNodeY = nodeRect.top + nodeRect.height / 2 - 10;

      // Update phone content immediately
      const avatar = document.getElementById('s2-portal-avatar');
      const name = document.getElementById('s2-portal-name');
      const incomingText = document.getElementById('s2-incoming-text');
      const notifMsg = document.getElementById('s2-notif-msg');
      const uploadFile = document.getElementById('s2-upload-file');
      if (avatar) { avatar.textContent = m.avatar; avatar.style.background = m.color; }
      if (name) name.textContent = m.name;
      if (incomingText) incomingText.textContent = m.incoming;
      if (notifMsg) notifMsg.textContent = m.msg;
      if (uploadFile) uploadFile.textContent = m.file;

      // Phase 1: bubble travels from ping button → phone
      bubble.textContent = '📩';
      bubble.className = 's2-bubble-travel s2-bubble-travel--out';

      animateBubble(bubble, fromX, fromY, toPhoneX, toPhoneY, 490, () => {
        // Show incoming notification
        const incoming = document.getElementById('s2-portal-incoming');
        if (incoming) incoming.classList.add('s2-portal-incoming--visible');

        // Phase 2: after 1s, bubble returns from phone → node
        timer = setTimeout(() => {
          if (incoming) incoming.classList.remove('s2-portal-incoming--visible');

          bubble.textContent = '✓ Αρχείο';
          bubble.className = 's2-bubble-travel s2-bubble-travel--in';

          animateBubble(bubble, toPhoneX, toPhoneY, toNodeX, toNodeY, 490, () => {
            // Node turns "Σε έλεγχο"
            const node = document.getElementById(m.nodeId);
            const status = document.getElementById(m.statusId);
            if (node) node.className = 's2-node s2-node--checking';
            if (status) {
              status.textContent = '🔄 Σε έλεγχο';
              status.className = 's2-ns s2-ns--t';
            }

            // Cleanup
            if (memberRow) memberRow.classList.remove('s2-member-row--active');
            if (pingBtn) pingBtn.classList.remove('s2-ping-btn--active');

            step++;
            timer = setTimeout(runStep, 1540);
          });
        }, 700);
      });
    }

    timer = setTimeout(runStep, 560);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    const screens = Array.from(
      document.querySelectorAll<HTMLElement>('.lp-sc-screen')
    );
    const desktopItems = Array.from(
      document.querySelectorAll<HTMLElement>('.lp-sc-item[data-idx]')
    );
    let mobIdx = 0;

    function activate(index: number) {
      screens.forEach((s, i) =>
        s.classList.toggle('lp-sc-screen--active', i === index)
      );
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = parseInt(
              (entry.target as HTMLElement).dataset.idx ?? '0'
            );
            activate(idx);
            desktopItems.forEach((el, i) =>
            el.classList.toggle('lp-sc-item--active', i === idx)
          );
        }
      });
    },
      { threshold: 0.6, rootMargin: '-15% 0px -15% 0px' }
    );
    desktopItems.forEach((el) => io.observe(el));

    const screenData = [
      {
        title: 'Ένα deal. Μία σελίδα.',
        desc: 'Pipeline από την αρχή ως την υπογραφή. Ξέρεις πάντα πού βρίσκεσαι χωρίς να ρωτάς κανέναν.',
      },
      {
        title: 'Κάθε μέλος ξέρει τι του αναλογεί.',
        desc: 'Νομικά, τεχνικά, οικονομικά τρέχουν ταυτόχρονα. Αυτόματες ειδοποιήσεις καθυστέρησης — χωρίς να σε ρωτάει κανείς.',
      },
      {
        title: 'Στέλνεις ένα link. Τελείωσε.',
        desc: 'Χωρίς app, χωρίς εγγραφή, χωρίς εξήγηση. Αρχεία ανεβαίνουν απευθείας στο deal.',
      },
      {
        title: 'Εγκρίνεις — το σύστημα κάνει τα υπόλοιπα.',
        desc: 'Αυτόματη ειδοποίηση για επανυποβολή. Πλήρες ιστορικό εγγράφων που δεν χάνεται ποτέ.',
      },
    ];

    function mobUpdate() {
      activate(mobIdx);
      const dots = document.querySelectorAll<HTMLElement>('.lp-sc-mob-dot');
      dots.forEach((d, i) =>
        d.classList.toggle('lp-sc-mob-dot--active', i === mobIdx)
      );
      const titleEl = document.getElementById('lp-sc-mob-title');
      const descEl = document.getElementById('lp-sc-mob-desc');
      if (titleEl) titleEl.textContent = screenData[mobIdx].title;
      if (descEl) descEl.textContent = screenData[mobIdx].desc;
      const prevBtn = document.getElementById('lp-sc-prev') as HTMLButtonElement | null;
      const nextBtn = document.getElementById('lp-sc-next') as HTMLButtonElement | null;
      if (prevBtn) prevBtn.disabled = mobIdx === 0;
      if (nextBtn) nextBtn.disabled = mobIdx === screenData.length - 1;
    }

    const prevHandler = () => {
      if (mobIdx > 0) { mobIdx--; mobUpdate(); }
    };
    const nextHandler = () => {
      if (mobIdx < screenData.length - 1) { mobIdx++; mobUpdate(); }
    };

    desktopItems.forEach((el, i) => {
      el.addEventListener('click', () => {
        activate(i);
        desktopItems.forEach((item, j) =>
          item.classList.toggle('lp-sc-item--active', i === j)
        );
      });
    });

    document.getElementById('lp-sc-prev')?.addEventListener('click', prevHandler);
    document.getElementById('lp-sc-next')?.addEventListener('click', nextHandler);

    activate(0);
    desktopItems[0]?.classList.add('lp-sc-item--active');
    mobUpdate();

    return () => {
      io.disconnect();
      document.getElementById('lp-sc-prev')?.removeEventListener('click', prevHandler);
      document.getElementById('lp-sc-next')?.removeEventListener('click', nextHandler);
    };
  }, []);

  useEffect(() => {
    const statsRow = document.getElementById('s3-stats-row');
    if (!statsRow) return;

    let rafIds: number[] = [];

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();

        const statEls = statsRow.querySelectorAll<HTMLElement>('.s3-stat--anim');
        statEls.forEach((el) => el.classList.add('s3-stat--visible'));

        statsRow.querySelectorAll<HTMLElement>('.s3-stat-val[data-target]').forEach((el, i) => {
          const target = parseInt(el.dataset.target || '0', 10);
          if (target === 0) { el.textContent = '0'; return; }
          const delay = i * 200 + 400;
          const duration = 900;
          const startTime = performance.now() + delay;

          function tick(now: number) {
            if (now < startTime) { rafIds.push(requestAnimationFrame(tick)); return; }
            const t = Math.min((now - startTime) / duration, 1);
            const ease = 1 - Math.pow(1 - t, 3);
            el.textContent = String(Math.round(ease * target));
            if (t < 1) rafIds.push(requestAnimationFrame(tick));
          }
          rafIds.push(requestAnimationFrame(tick));
        });
      },
      { threshold: 0.6 }
    );

    io.observe(statsRow);
    return () => {
      io.disconnect();
      rafIds.forEach(cancelAnimationFrame);
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // JSX
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="landing-page">

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <nav className="landing-nav">
        <div className="landing-nav__brand">
          <img
            src={dealifyLogo}
            alt="Dealify"
            className="landing-logo-img"
          />
          <span className="landing-nav__wordmark">Dealify</span>
        </div>
        <div className="landing-nav__links">
          <a className="landing-nav__link" href="#showcase">Πώς λειτουργεί</a>
          <a className="landing-nav__link" href="#pricing">Τιμολόγηση</a>
          <a className="landing-nav__link" href="#contact">Επικοινωνία</a>
        </div>
        <button className="landing-nav__cta" type="button">Ζήτησε demo</button>
      </nav>

      <main className="landing-main">
        <div className="lp-sticky-bar" id="lp-sticky-bar">
          <span className="lp-sticky-bar__text">
            Dealify · Πιλοτικό πρόγραμμα — περιορισμένες θέσεις
          </span>
          <button
            className="lp-sticky-bar__btn"
            type="button"
            onClick={() => {
              document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            Ζήτησε πρόσβαση →
          </button>
        </div>

        {/* ── HERO ──────────────────────────────────────────────────────── */}
        <section className="landing-hero">
          <div className="lp-hero-notif lp-hero-notif--1" aria-hidden="true">
            <div className="lp-hero-notif-dot" style={{background:'#4ADE80'}} />
            <span>Αλεξάνδρα · Πιστ. Βαρών ολοκληρώθηκε</span>
          </div>
          <div className="lp-hero-notif lp-hero-notif--2" aria-hidden="true">
            <div className="lp-hero-notif-dot" style={{background:'#00BFA6'}} />
            <span>Πέτρος · Τοπογραφικό ανεβλήθηκε</span>
          </div>
          <div className="lp-hero-notif lp-hero-notif--3" aria-hidden="true">
            <div className="lp-hero-notif-dot" style={{background:'#60A5FA'}} />
            <span>Κ. Σπύρου · Εκκαθαριστικό σε έλεγχο</span>
          </div>
          <div className="lp-hero-notif lp-hero-notif--4" aria-hidden="true">
            <div className="lp-hero-notif-dot" style={{background:'#F59E0B'}} />
            <span>Deal · Κλείσιμο σε 3 μέρες</span>
          </div>
          <div className="landing-badge">
            <span className="landing-badge__dot" />
            <span>Για Έλληνες Μεσίτες</span>
          </div>
          <h1 className="landing-hero__title">
            Πόσα WhatsApp groups έχεις ανοιχτά <span>για μία αγοραπωλησία;</span>
          </h1>
          <p className="landing-hero__subtitle">
            Ο δικηγόρος, ο μηχανικός, ο συμβολαιογράφος — ο καθένας παίρνει ένα link και ανεβάζει ό,τι του αναλογεί, χωρίς app και χωρίς εγγραφή. Εσύ βλέπεις τα πάντα σε ένα μέρος.
          </p>
          <div className="landing-hero__actions">
            <button className="landing-hero__button landing-hero__button--primary" type="button">
              Ζήτησε demo →
            </button>
            <button className="landing-hero__button landing-hero__button--secondary" type="button">
              Δες πώς δουλεύει
            </button>
          </div>
          <p className="landing-hero__note">Δωρεάν pilot για τους πρώτους μεσίτες</p>
          <div className="lp-hero-card-wrap">

            <div className="lp-hero-card-glow" aria-hidden="true" />

            <div className="lp-hero-card">

              <div className="lp-hc-head">
                <div className="lp-hc-head-row">
                  <div>
                    <div className="lp-hc-ref">REF · SYN-002 · 2 Απρ 2026</div>
                    <div className="lp-hc-title">Φιλελλήνων 8, Σύνταγμα</div>
                  </div>
                  <div className="lp-hc-done">
                    <div className="lp-hc-done-icon">✓</div>
                    <span className="lp-hc-done-text">Ολοκληρώθηκε</span>
                  </div>
                </div>
                <div className="lp-hc-bar-wrap">
                  <div className="lp-hc-bar" />
                </div>
              </div>

              <div className="lp-hc-stats">
                {([
                  { val: '47',      label: 'ημέρες',         teal: true  },
                  { val: '€280.000',label: 'αξία ακινήτου',  teal: false },
                  { val: '0',       label: 'χαμένα email',   teal: false },
                ] as { val: string; label: string; teal: boolean }[]).map((s, i) => (
                  <div key={i} className="lp-hc-stat">
                    <div className={`lp-hc-stat-val${s.teal ? ' lp-hc-stat-val--teal' : ''}`}>{s.val}</div>
                    <div className="lp-hc-stat-lbl">{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="lp-hc-foot">
                <div className="lp-hc-members">
                  {([
                    { initials: 'ΑΝ', color: '#7360F2' },
                    { initials: 'ΠΙ', color: '#F59E0B' },
                    { initials: 'ΚΣ', color: '#60A5FA' },
                  ] as { initials: string; color: string }[]).map((m) => (
                    <div key={m.initials} className="lp-hc-av" style={{ background: m.color }}>
                      {m.initials}
                    </div>
                  ))}
                </div>
                <span className="lp-hc-timestamp">Κλείστηκε · 2 Απρ 2026, 14:32</span>
              </div>

            </div>

            <div className="lp-hero-pills">
              {(['6 μέλη ομάδας', '0 τηλεφωνήματα', '1 link για όλους'] as string[]).map((p) => (
                <div key={p} className="lp-hero-pill">{p}</div>
              ))}
            </div>

            <p className="lp-hero-tagline">— αυτό είναι το επόμενο deal σου —</p>

          </div>
        </section>

        {/* ── SNAP DOTS ─────────────────────────────────────────────────────────── */}
        <div className="snap-dots" aria-hidden="true">
          {[0,1].map(i => (
            <div key={i} className="snap-dot" data-dot={i} />
          ))}
        </div>

        {/* ── SNAP CONTAINER ────────────────────────────────────────────────────── */}
        <div className="snap-container">

          {/* ── SECTION 1 — ΧΑΟΣ ──────────────────────────────────────────────────── */}
          <section className="snap-section" data-section-idx="0">
            <div className="snap-title-card">
              <span className="snap-title-step">01</span>
              <span className="snap-title-label">Το Πρόβλημα</span>
            </div>
            <div className="snap-section-bg-teal" />
            <div className="snap-left" style={{background:'#0A0A0C'}}>
              <div className="phone-wrapper" style={{position:'relative',transform:'none',left:'auto',top:'auto'}}>
                <div className="phone-frame">
                  <div className="phone-screen">
                    <div className="s1-lock-screen">
                      <div className="dynamic-island" />
                      <div className="time-display">9:41</div>
                      <div style={{fontSize:'9px',color:'rgba(255,255,255,0.3)',textAlign:'center',marginBottom:'10px'}}>Τρίτη, 8 Απριλίου</div>
                      <div className="s1-notif-stack">

                        <div className="s1-notif s1-notif--chaos">
                          <div className="s1-app-icon s1-app-icon--wa">
                            <svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                          </div>
                          <div className="s1-notif-content">
                            <div className="s1-notif-header">
                              <span className="s1-notif-app">WhatsApp</span>
                              <span className="s1-notif-time">τώρα</span>
                            </div>
                            <span className="s1-notif-sender">Αλεξάνδρα Νικολάου</span>
                            <span className="s1-notif-msg">Στείλε μου τη σύμβαση αγοραπωλησίας</span>
                          </div>
                        </div>

                        <div className="s1-notif s1-notif--chaos">
                          <div className="s1-app-icon s1-app-icon--ph">
                            <svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>
                          </div>
                          <div className="s1-notif-content">
                            <div className="s1-notif-header">
                              <span className="s1-notif-app">Τηλέφωνο</span>
                              <span className="s1-notif-time">2λ</span>
                            </div>
                            <span className="s1-notif-sender">Γ. Παπαδόπουλος (Αγοραστής)</span>
                            <span className="s1-notif-msg">Αναπάντητη κλήση · ×3</span>
                          </div>
                        </div>

                        <div className="s1-notif s1-notif--chaos">
                          <div className="s1-app-icon s1-app-icon--vb">
                            <svg viewBox="0 0 24 24"><path d="M11.4 0C7.34.024 3.2 1.66 1.2 5.4-.8 9-.4 14 2 17.6l.4.6v3.4c0 .4.4.8.8.6l3.2-1.2.6.4c2 1.2 4.2 1.8 6.4 1.8 2.6 0 5.2-.8 7.2-2.4 4.2-3.2 5.4-9 3-13.6C21.4 2.4 16.6-.03 11.4 0zm5 15.4c-.6.6-1.4 1-2.2.8-.4 0-.8-.2-1.2-.4-2-.8-3.6-2.2-4.8-3.8-.6-.8-1-1.6-1.4-2.6-.2-.6-.2-1.2.2-1.6l.6-.8c.4-.4 1-.4 1.4 0l1.2 1.6c.4.4.4 1 0 1.4l-.4.4c.4.8 1 1.4 1.8 2 .4.2.6.4 1 .6l.4-.4c.4-.4 1-.4 1.4 0l1.6 1.2c.4.4.4 1-.6 1.6z"/></svg>
                          </div>
                          <div className="s1-notif-content">
                            <div className="s1-notif-header">
                              <span className="s1-notif-app">Viber</span>
                              <span className="s1-notif-time">15λ</span>
                            </div>
                            <span className="s1-notif-sender">Πέτρος Ιωάννου (Μηχανικός)</span>
                            <span className="s1-notif-msg">Ποια ακριβώς αρχεία χρειάζεσαι;</span>
                          </div>
                        </div>

                        <div className="s1-notif s1-notif--chaos">
                          <div className="s1-app-icon s1-app-icon--ml">
                            <svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
                          </div>
                          <div className="s1-notif-content">
                            <div className="s1-notif-header">
                              <span className="s1-notif-app">Mail</span>
                              <span className="s1-notif-time">1ω</span>
                            </div>
                            <span className="s1-notif-sender">Τράπεζα Πειραιώς</span>
                            <span className="s1-notif-msg">RE: Φάκελος δανείου — λείπουν 3 έγγραφα</span>
                          </div>
                        </div>

                        <div className="s1-notif s1-notif--chaos">
                          <div className="s1-app-icon s1-app-icon--sms">
                            <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                          </div>
                          <div className="s1-notif-content">
                            <div className="s1-notif-header">
                              <span className="s1-notif-app">Μηνύματα</span>
                              <span className="s1-notif-time">2ω</span>
                            </div>
                            <span className="s1-notif-sender">Μαρία Αντωνίου (Πωλήτρια)</span>
                            <span className="s1-notif-msg">Πότε υπογράφουμε; Έχω ταξίδι αύριο</span>
                          </div>
                        </div>

                        <div className="s1-notif s1-notif--dealify">
                          <div className="s1-app-icon s1-app-icon--dealify">
                            <img
                              src={dealifyLogo}
                              alt="Dealify"
                              style={{ width: 18, height: 18, borderRadius: 4, display: 'block' }}
                            />
                          </div>
                          <div className="s1-notif-content">
                            <div className="s1-notif-header">
                              <span className="s1-notif-app s1-notif-app--dealify">Dealify</span>
                              <span className="s1-notif-time">τώρα</span>
                            </div>
                            <span className="s1-notif-sender" style={{color:'#00BFA6'}}>Φιλελλήνων 8 · Ολοκληρώθηκε ✓</span>
                            <span className="s1-notif-msg">Όλα μαζί. Σε ένα μέρος. Χωρίς WhatsApp.</span>
                          </div>
                        </div>

                        <div className="s1-phone-payoff-wrap" aria-hidden="true">
                          <div className="s1-phone-payoff">
                            <span>Ένα μέρος. Μηδέν χάος. Πλήρης εικόνα.</span>
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="snap-right">
              <span className="snap-copy-label">Το πρόβλημα</span>
              <h2 className="snap-copy-h2">6 άνθρωποι.<br />5 apps.<br />1 broker στη μέση.</h2>
              <p className="snap-copy-p">Αγοραστής, πωλητής, δικηγόρος, μηχανικός, συμβολαιογράφος, τράπεζα — όλοι περιμένουν. Ο broker κρατά όλη τη διαδικασία στο κεφάλι του.</p>
            </div>
          </section>

          {/* ── SECTION 2 — SKILL TREE + PHONE ── */}
          <section className="snap-section s2-section" data-section-idx="1">
            <div className="snap-title-card">
              <span className="snap-title-step">02</span>
              <span className="snap-title-label">Η Λύση</span>
            </div>

            {/* LEFT — Skill Tree 60% */}
            <div className="s2-left">
              <div className="s2-header">
                <span style={{width:'7px',height:'7px',borderRadius:'50%',background:'#F59E0B',flexShrink:0,boxShadow:'0 0 6px rgba(245,158,11,0.5)'}} />
                <span>Deal #2024-089</span>
                <span style={{color:'rgba(255,255,255,0.25)',margin:'0 2px'}}>·</span>
                <span style={{color:'rgba(255,255,255,0.75)'}}>Βούλα, Διαμ. 3ος</span>
                <span style={{marginLeft:'auto',fontSize:'9px',background:'rgba(245,158,11,0.12)',border:'1px solid rgba(245,158,11,0.25)',color:'rgba(245,158,11,0.8)',padding:'2px 8px',borderRadius:'10px'}}>Σε εξέλιξη</span>
              </div>

              <div className="s2-grid">

                {/* ΝΟΜΙΚΑ */}
                <div className="s2-col">
                  <div className="s2-badge s2-badge--legal">Νομικά</div>
                  <div className={`s2-node s2-node--done`}>
                    <span className="s2-ns s2-ns--g">✓ Ολοκλ.</span>
                    <span className="s2-nn">Έλεγχος Τίτλων</span>
                    <span className="s2-nw">Αλεξάνδρα Ν.</span>
                  </div>
                  <div className="s2-line s2-line--legal" />
                  <div className="s2-node" id="node-legal">
                    <span className="s2-ns" id="node-legal-status">⚠ Εκκρεμεί</span>
                    <span className="s2-nn">Πιστ. Βαρών</span>
                    <span className="s2-nw">Αλεξάνδρα Ν.</span>
                  </div>
                </div>

                {/* ΤΕΧΝΙΚΑ */}
                <div className="s2-col">
                  <div className="s2-badge s2-badge--tech">Τεχνικά</div>
                  <div className="s2-node s2-node--over">
                    <span className="s2-ns s2-ns--r">⚠ +5 μέρες</span>
                    <span className="s2-nn">ΗΤΚ</span>
                    <span className="s2-nw">Πέτρος Ι.</span>
                  </div>
                  <div className="s2-line s2-line--tech" />
                  <div className="s2-node" id="node-tech">
                    <span className="s2-ns" id="node-tech-status">⚠ Εκκρεμεί</span>
                    <span className="s2-nn">Τοπογραφικό</span>
                    <span className="s2-nw">Πέτρος Ι.</span>
                  </div>
                </div>

                {/* ΟΙΚΟΝΟΜΙΚΑ */}
                <div className="s2-col">
                  <div className="s2-badge s2-badge--org">Οικονομικά</div>
                  <div className="s2-node s2-node--done">
                    <span className="s2-ns s2-ns--g">✓ Ολοκλ.</span>
                    <span className="s2-nn">Φάκελος Δανείου</span>
                    <span className="s2-nw">Αγοραστής</span>
                  </div>
                  <div className="s2-line s2-line--org" />
                  <div className="s2-node" id="node-org">
                    <span className="s2-ns" id="node-org-status">⚠ Εκκρεμεί</span>
                    <span className="s2-nn">Εκκαθαριστικό</span>
                    <span className="s2-nw">Πωλητής</span>
                  </div>
                </div>

              </div>

              <div className="s2-converge">
                <div className="s2-converge-line s2-converge-line--left" />
                <div className="s2-converge-line s2-converge-line--center" />
                <div className="s2-converge-line s2-converge-line--right" />
              </div>
              <div className="s2-final">
                <div className="s2-final-label">Ολοκλήρωση — Συμβολαιογραφική Πράξη</div>
                <div className="s2-final-sub">Αναμένει: Πιστ. Βαρών · Τοπογραφικό · Εκκαθαριστικό</div>
              </div>

              <div className="s2-copy-block">
                <div className="snap-copy-label">Το feature</div>
                <div className="s2-copy-h2">Στέλνεις ειδοποιήσεις σε όποιον χρειάζεται.<br/>Κάθε αρχείο πάντα στη θέση του.</div>
                <p className="s2-copy-p">Ένα μήνυμα φτάνει ταυτόχρονα σε δικηγόρο, μηχανικό, συμβολαιογράφο. Ο καθένας ανεβάζει από το κινητό του, χωρίς να περιμένει κανέναν.</p>
              </div>

              {/* Members sidebar */}
              <div className="s2-members">
                {[
                  { id: 'legal', avatar: 'ΑΝ', name: 'Αλεξάνδρα Ν.', role: 'Δικηγόρος', color: '#7360F2' },
                  { id: 'tech',  avatar: 'ΠΙ', name: 'Πέτρος Ι.',    role: 'Μηχανικός', color: '#F59E0B' },
                  { id: 'org',   avatar: 'ΚΣ', name: 'Κων. Σπ.',     role: 'Συμβολαιογράφος', color: '#60A5FA' },
                ].map(m => (
                  <div key={m.id} className="s2-member-row" id={`member-${m.id}`}>
                    <div className="s2-member-avatar" style={{background: m.color}}>{m.avatar}</div>
                    <div className="s2-member-info">
                      <span className="s2-member-name">{m.name}</span>
                      <span className="s2-member-role">{m.role}</span>
                    </div>
                    <div className="s2-sms-btn">💬</div>
                    <div className="s2-ping-btn" id={`ping-${m.id}`}>📱</div>
                  </div>
                ))}
              </div>

              {/* Travel bubble */}
              <div className="s2-bubble-travel" id="s2-bubble-travel" />

            </div>{/* end s2-left */}

            {/* RIGHT — Member Phone 40% */}
            <div className="s2-right">
              <div className="s2-phone-wrap">
                <div className="s2-phone-frame">
                  <div className="s2-phone-screen">
                    <div style={{width:'26px',height:'6px',background:'#000',borderRadius:'3px',margin:'6px auto 5px'}} />

                    {/* Portal — cycles via JS */}
                    <div className="s2-portal" id="s2-portal">
                      <div className="s2-portal-head">
                        <div className="s2-portal-title">Portal Μέλους</div>
                        <div className="s2-portal-who">
                          <div className="s2-avatar" id="s2-portal-avatar" style={{background:'#7360F2'}}>ΑΝ</div>
                          <span className="s2-portal-name" id="s2-portal-name">Αλεξάνδρα Ν. · Δικηγόρος</span>
                        </div>
                      </div>

                      <div className="s2-portal-body">
                        <div>
                          <div className="s2-portal-incoming" id="s2-portal-incoming">
                            <div className="s2-incoming-dot" />
                            <span id="s2-incoming-text">📩 Νέα εργασία: Πιστ. Βαρών</span>
                          </div>
                          <div className="s2-portal-history">
                            <div className="s2-history-label">Ολοκληρωμένα</div>
                            <div className="s2-history-item">
                              <span className="s2-history-check">✓</span>
                              <span className="s2-history-text">Έλεγχος Τίτλων · 3 Μαρ</span>
                            </div>
                            <div className="s2-history-item">
                              <span className="s2-history-check">✓</span>
                              <span className="s2-history-text">Φορολογική Ενημερότητα · 28 Φεβ</span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="s2-portal-notif" id="s2-portal-notif">
                            <div className="s2-notif-icon" id="s2-notif-icon">!</div>
                            <div>
                              <span className="s2-notif-app" id="s2-notif-app">Dealify</span>
                              <span className="s2-notif-msg" id="s2-notif-msg">Εκκρεμεί: Πιστ. Βαρών</span>
                            </div>
                          </div>
                          <div className="s2-portal-upload">
                            <span className="s2-upload-file" id="s2-upload-file">Πιστοποιητικό Βαρών</span>
                            <div className="s2-upload-btn">✓ Υποβολή</div>
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
              <p style={{fontSize:'11px',color:'rgba(255,255,255,0.3)',textAlign:'center',marginTop:'10px'}}>Αυτό βλέπει ο δικηγόρος στο κινητό του</p>
              <div className="s2-phone-caption">Κάθε μέλος λαμβάνει το δικό του link</div>
            </div>

          </section>

        </div>{/* end snap-container */}

        {/* ── SHOWCASE SECTION ─────────────────────────────────────────────────── */}
        <section className="lp-showcase" id="showcase">

          <div className="lp-showcase-inner">

            <div className="lp-section-header">
              <span className="lp-section-tag">Η εφαρμογή</span>
              <h2 className="lp-section-title">Ένα σύστημα.<br />Όλοι μέσα.</h2>
              <p className="lp-section-sub">
                Ο μεσίτης στήνει το deal. Οι υπόλοιποι μπαίνουν με ένα link —
                χωρίς app, χωρίς εγγραφή, χωρίς εξήγηση.
              </p>
            </div>

            <div className="lp-sc-desktop">
              <div className="lp-sc-sticky-wrap">
                <div className="lp-sc-frame">
                  <div className="lp-sc-frame-bar">
                    <span className="lp-sc-frame-dot lp-sc-frame-dot--r" />
                    <span className="lp-sc-frame-dot lp-sc-frame-dot--y" />
                    <span className="lp-sc-frame-dot lp-sc-frame-dot--g" />
                    <span className="lp-sc-frame-url">app.dealify.gr</span>
                  </div>

                  <div className="lp-sc-screen lp-sc-screen--active" data-screen="0">
                    <div className="lp-sc-s0-sidebar">
                      <div className="lp-sc-s0-logo" />
                      {[0,1,2,3].map(i=>(
                        <div key={i} className={`lp-sc-s0-nav ${i===0?'lp-sc-s0-nav--on':''}`} />
                      ))}
                    </div>
                    <div className="lp-sc-s0-main">
                      <div className="lp-sc-s0-topbar">
                        <span className="lp-sc-s0-tbtitle">Dashboard Μεσίτη</span>
                        <span className="lp-sc-s0-tbcta">+ Νέα Συναλλαγή</span>
                      </div>
                      <div className="lp-sc-s0-stats">
                        {[{v:'4',l:'Deals',c:''},{v:'3',l:'Καθυστ.',c:'r'},{v:'38',l:'Μέρες',c:''},{v:'1',l:'Ολοκλ.',c:''}].map((s,i)=>(
                          <div key={i} className="lp-sc-s0-stat">
                            <div className={`lp-sc-s0-sv ${s.c==='r'?'lp-sc-s0-sv--r':''}`}>{s.v}</div>
                            <div className="lp-sc-s0-sl">{s.l}</div>
                          </div>
                        ))}
                      </div>
                      <div className="lp-sc-s0-kanban">
                        {[
                          {h:'Προετοιμασία',  t:'Σκουφά 14',       p:25,  badge:false},
                          {h:'Νομικός',       t:'Φιλελλήνων 8',    p:45,  badge:true},
                          {h:'Τεχνικός',      t:'Κηφισίας 120',    p:65,  badge:false},
                          {h:'Υπογραφή',      t:'Βας. Αλεξάνδρου', p:100, badge:false},
                        ].map((c,i)=>(
                          <div key={i} className="lp-sc-s0-col">
                            <div className="lp-sc-s0-ch">{c.h}</div>
                            <div className="lp-sc-s0-card">
                              <div className="lp-sc-s0-ct">{c.t}</div>
                              {c.badge && <div className="lp-sc-s0-badge">⚠ εκπρόθεσμο</div>}
                              <div className="lp-sc-s0-bw"><div className="lp-sc-s0-bar" style={{width:`${c.p}%`}} /></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="lp-sc-screen" data-screen="1">
                    <div className="lp-sc-s1-wrap">
                      <div className="lp-sc-s1-topbar">
                        <span className="lp-sc-s1-dot" style={{background:'#F59E0B'}} />
                        <span className="lp-sc-s1-deal">Deal #2024-089 · Βούλα, Διαμ. 3ος</span>
                        <span className="lp-sc-s1-badge">Σε εξέλιξη</span>
                      </div>
                      <div className="lp-sc-s1-grid">
                        {[
                          {label:'Νομικά', color:'#7360F2', colorMuted:'rgba(115,96,242,0.15)', borderColor:'rgba(115,96,242,0.3)',
                           nodes:[{s:'✓ Ολοκλ.',sc:'g',n:'Έλεγχος Τίτλων',done:true},{s:'⚠ Εκκρεμεί',sc:'',n:'Πιστ. Βαρών',done:false}]},
                          {label:'Τεχνικά', color:'#F59E0B', colorMuted:'rgba(245,158,11,0.12)', borderColor:'rgba(245,158,11,0.25)',
                           nodes:[{s:'⚠ +5 μέρες',sc:'r',n:'ΗΤΚ',done:false},{s:'⚠ Εκκρεμεί',sc:'',n:'Τοπογραφικό',done:false}]},
                          {label:'Οικονομικά', color:'#60A5FA', colorMuted:'rgba(96,165,250,0.12)', borderColor:'rgba(96,165,250,0.25)',
                           nodes:[{s:'✓ Ολοκλ.',sc:'g',n:'Φάκελος Δανείου',done:true},{s:'⚠ Εκκρεμεί',sc:'',n:'Εκκαθαριστικό',done:false}]},
                        ].map((col,ci)=>(
                          <div key={ci} className="lp-sc-s1-col">
                            <div className="lp-sc-s1-badge-col" style={{background:col.colorMuted,color:col.color,borderColor:col.borderColor}}>{col.label}</div>
                            {col.nodes.map((node,ni)=>(
                              <div key={ni}>
                                <div className={`lp-sc-s1-node ${node.done?'lp-sc-s1-node--done':''}`}>
                                  <span className={`lp-sc-s1-ns ${node.sc==='g'?'lp-sc-s1-ns--g':node.sc==='r'?'lp-sc-s1-ns--r':''}`}>{node.s}</span>
                                  <span className="lp-sc-s1-nn">{node.n}</span>
                                </div>
                                {ni===0 && <div className="lp-sc-s1-line" style={{borderColor:col.borderColor}} />}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                      <div className="lp-sc-s1-final">
                        <span className="lp-sc-s1-final-label">Συμβολαιογραφική Πράξη</span>
                        <span className="lp-sc-s1-final-sub">Αναμένει: Πιστ. Βαρών · Τοπογραφικό · Εκκαθαριστικό</span>
                      </div>
                    </div>
                  </div>

                  <div className="lp-sc-screen" data-screen="2">
                    <div className="lp-sc-s2-wrap">
                      <div className="lp-sc-s2-header">
                        <div className="lp-sc-s2-logo-mark" />
                        <span className="lp-sc-s2-logo-word">Dealify</span>
                        <span className="lp-sc-s2-role-pill">Δικηγόρος</span>
                      </div>
                      <div className="lp-sc-s2-banner">
                        Ανεβάστε τα έγγραφά σας. Ο μεσίτης θα τα ελέγξει και θα σας ενημερώσει.
                      </div>
                      <div className="lp-sc-s2-body">
                        <div className="lp-sc-s2-card">
                          <div className="lp-sc-s2-card-title">Στοιχεία Μέλους</div>
                          <div className="lp-sc-s2-row"><span className="lp-sc-s2-lbl">Όνομα</span><span className="lp-sc-s2-val">Αλεξάνδρα Νικολάου</span></div>
                          <div className="lp-sc-s2-row"><span className="lp-sc-s2-lbl">Ρόλος</span><span className="lp-sc-s2-val">Δικηγόρος</span></div>
                          <div className="lp-sc-s2-row"><span className="lp-sc-s2-lbl">Ακίνητο</span><span className="lp-sc-s2-val">Φιλελλήνων 8, Σύνταγμα</span></div>
                        </div>
                        <div className="lp-sc-s2-card">
                          <div className="lp-sc-s2-card-title">Έγγραφά μου</div>
                          <div className="lp-sc-s2-doc-row">
                            <span className="lp-sc-s2-doc-name">Έλεγχος Τίτλων.pdf</span>
                            <span className="lp-sc-s2-status lp-sc-s2-status--ok">Εγκεκριμένο</span>
                          </div>
                          <div className="lp-sc-s2-doc-row">
                            <span className="lp-sc-s2-doc-name">Πιστ. Βαρών.pdf</span>
                            <span className="lp-sc-s2-status lp-sc-s2-status--pending">Εκκρεμεί</span>
                          </div>
                          <div className="lp-sc-s2-dropzone">
                            <span>+ Ανέβασμα αρχείου</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="lp-sc-screen" data-screen="3">
                    <div className="lp-sc-s3-wrap">
                      <div className="lp-sc-s3-topbar">
                        <span className="lp-sc-s3-title">Έλεγχος Εγγράφων</span>
                        <span className="lp-sc-s3-progress">1/3 εγκεκριμένα · 33%</span>
                      </div>
                      <div className="lp-sc-s3-prog-bar"><div className="lp-sc-s3-prog-fill" style={{width:'33%'}} /></div>
                      <div className="lp-sc-s3-table">
                        <div className="lp-sc-s3-thead">
                          <span>Έγγραφο</span><span>Κατάσταση</span><span>Ενέργειες</span>
                        </div>
                        {[
                          {name:'Πιστοποιητικό βαρών.pdf', status:'Εγκεκριμένο',  st:'ok'},
                          {name:'Έκθεση ΗΤΚ.pdf',          status:'Απορρίφθηκε',   st:'bad'},
                          {name:'ID buyer.pdf',           status:'Ανεβασμένο',    st:'pending'},
                        ].map((doc,i)=>(
                          <div key={i} className="lp-sc-s3-row">
                            <span className="lp-sc-s3-doc-name">{doc.name}</span>
                            <span className={`lp-sc-s3-badge lp-sc-s3-badge--${doc.st}`}>{doc.status}</span>
                            <div className="lp-sc-s3-actions">
                              {doc.st==='pending' && <>
                                <button className="lp-sc-s3-btn lp-sc-s3-btn--ok">Έγκριση</button>
                                <button className="lp-sc-s3-btn lp-sc-s3-btn--bad">Απόρριψη</button>
                              </>}
                              {doc.st!=='pending' && <span className="lp-sc-s3-done">—</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              <div className="lp-sc-items">
                {([
                  {
                    num: '01',
                    tag: 'Deals',
                    title: 'Ένα deal.\nΜία σελίδα.',
                    desc: 'Κάθε αγοραπωλησία έχει τη δική της σελίδα με όλα τα μέλη, τα έγγραφα και τα στάδια.',
                    gains: [
                      'Ξέρεις πάντα πού βρίσκεσαι — χωρίς να ρωτάς κανέναν',
                      'Καθυστερήσεις φαίνονται αμέσως, στο χρώμα',
                      'Pipeline από την αρχή ως την υπογραφή — ένα σημείο',
                    ],
                  },
                  {
                    num: '02',
                    tag: 'Συναλλαγή',
                    title: 'Κάθε μέλος ξέρει\nτι του αναλογεί.',
                    desc: 'Νομικά, τεχνικά, οικονομικά τρέχουν ταυτόχρονα. Αυτόματες ειδοποιήσεις καθυστέρησης — χωρίς να σε ρωτάει κανείς.',
                    gains: [
                      'Κανένας δεν σταματά κανέναν χωρίς λόγο',
                      'Ειδοποιήσεις καθυστέρησης αυτόματα σε κάθε εμπλεκόμενο',
                      'Ολοκλήρωση χωρίς να κρατάς τίποτα στο κεφάλι σου',
                    ],
                  },
                  {
                    num: '03',
                    tag: 'Portal',
                    title: 'Στέλνεις ένα link.\nΤελείωσε.',
                    desc: 'Δικηγόρος, μηχανικός, συμβολαιογράφος — ο καθένας βλέπει μόνο ό,τι τον αφορά, χωρίς εγγραφή.',
                    gains: [
                      'Χωρίς app, χωρίς εγγραφή, χωρίς εξήγηση',
                      'Ο πελάτης βλέπει την πρόοδο ανά πάσα στιγμή',
                      'Αρχεία ανεβαίνουν απευθείας στο deal',
                    ],
                  },
                  {
                    num: '04',
                    tag: 'Έγγραφα',
                    title: 'Εγκρίνεις ή απορρίπτεις.\nΤο σύστημα κάνει τα υπόλοιπα.',
                    desc: 'Αυτόματη ειδοποίηση για επανυποβολή. Πλήρες ιστορικό εγγράφων που δεν χάνεται ποτέ.',
                    gains: [
                      'Εγκεκριμένο / Απορρίφθηκε / Εκκρεμεί — ένα κλικ',
                      'Αυτόματη ειδοποίηση στο μέλος για επανυποβολή',
                      'Πλήρες ιστορικό κάθε αλλαγής, ανά deal',
                    ],
                  },
                ] as {num:string;tag:string;title:string;desc:string;gains:string[]}[]).map((item, i) => (
                  <div
                    key={i}
                    className="lp-sc-item"
                    data-idx={String(i)}
                  >
                    <div className="lp-sc-item-num">{item.num}</div>
                    <div className="lp-sc-item-body">
                      <div className="lp-sc-item-tag">{item.tag}</div>
                      <h3 className="lp-sc-item-title">
                        {item.title.split('\n').map((line, j) => (
                          <span key={j}>{line}{j === 0 && <br />}</span>
                        ))}
                      </h3>
                      <p className="lp-sc-item-desc">{item.desc}</p>
                      <ul className="lp-sc-item-gains">
                        {item.gains.map((g, j) => (
                          <li key={j} className="lp-sc-item-gain">
                            <span className="lp-sc-item-gain-icon" aria-hidden="true" />
                            {g}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>

            </div>

            <div className="lp-sc-mobile">
              <div className="lp-sc-mob-screens">
                <div className="lp-sc-mob-frame">
                  <div className="lp-sc-mob-frame-bar">
                    <span className="lp-sc-frame-dot lp-sc-frame-dot--r" />
                    <span className="lp-sc-frame-dot lp-sc-frame-dot--y" />
                    <span className="lp-sc-frame-dot lp-sc-frame-dot--g" />
                    <span className="lp-sc-frame-url">app.dealify.gr</span>
                  </div>
                  <div className="lp-sc-mob-screen-viewport">
                    <div className="lp-sc-mob-screen-msg">Dashboard</div>
                  </div>
                </div>
              </div>

              <div className="lp-sc-mob-copy">
                <h3 className="lp-sc-mob-title" id="lp-sc-mob-title">Dashboard — Όλα σε μία ματιά</h3>
                <p className="lp-sc-mob-desc" id="lp-sc-mob-desc">
                  Kanban pipeline, stat cards, 4 deals ενεργά. Ο broker βλέπει ακριβώς πού βρίσκεται.
                </p>
              </div>

              <div className="lp-sc-mob-dots">
                {[0,1,2,3].map(i => (
                  <div key={i} className={`lp-sc-mob-dot ${i===0?'lp-sc-mob-dot--active':''}`} />
                ))}
              </div>

              <div className="lp-sc-mob-nav">
                <button className="lp-sc-mob-btn" id="lp-sc-prev" type="button" disabled>← Πίσω</button>
                <button className="lp-sc-mob-btn" id="lp-sc-next" type="button">Επόμενο →</button>
              </div>
            </div>

          </div>
        </section>

        {/* ── SECTION 3 — PAYOFF ────────────────────────────────────────────────── */}
        <section
          style={{flexDirection:'row',alignItems:'stretch',padding:0,background:'linear-gradient(135deg,#071714 0%,#0B1E1A 50%,#071714 100%)'}}>

          {/* LEFT — Numbers */}
          <div className="s3-content-left">
            <div className="s3-numbers">
              <div className="s3-check-ring">
                <div className="s3-check-icon">✓</div>
              </div>
              <div style={{textAlign:'center'}}>
                <div className="s3-big-number" id="s3-big-number">47</div>
                <div className="s3-number-label">ημέρες</div>
              </div>
              <div className="s3-stats-row" id="s3-stats-row">
                <div className="s3-stat s3-stat--anim" style={{'--si': 0} as React.CSSProperties}>
                  <div className="s3-stat-val" data-target="0">0</div>
                  <div className="s3-stat-label">ατελείωτες κλήσεις</div>
                </div>
                <div className="s3-stat-divider" />
                <div className="s3-stat s3-stat--anim" style={{'--si': 1} as React.CSSProperties}>
                  <div className="s3-stat-val" data-target="0">0</div>
                  <div className="s3-stat-label">χαμένα email</div>
                </div>
                <div className="s3-stat-divider" />
                <div className="s3-stat s3-stat--anim" style={{'--si': 2} as React.CSSProperties}>
                  <div className="s3-stat-val" data-target="6">0</div>
                  <div className="s3-stat-label">μέλη ομάδας</div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT — Copy + CTA */}
          <div className="s3-content-right">
            <span className="snap-copy-label">Το αποτέλεσμα</span>
            <h2 className="snap-copy-h2">Αυτό είναι<br />το επόμενο<br />deal σου.</h2>
            <div className="s3-deal-card">
              <div className="s3-deal-row">
                <span className="s3-deal-label">Ακίνητο</span>
                <span className="s3-deal-val">Βούλα — Διαμ. 3ος</span>
              </div>
              <div className="s3-deal-row">
                <span className="s3-deal-label">Αξία</span>
                <span className="s3-deal-val s3-deal-val--teal">€280.000</span>
              </div>
              <div className="s3-deal-row">
                <span className="s3-deal-label">Διάρκεια</span>
                <span className="s3-deal-val">47 ημέρες</span>
              </div>
              <div className="s3-status-pill">✓ Ολοκληρώθηκε · 2 Απρ 2026</div>
            </div>
            <button className="s3-cta-btn" type="button">Ζήτησε demo →</button>
            <p className="s3-cta-note">Χωρίς δέσμευση · Στα ελληνικά · 30 λεπτά αρκούν</p>
          </div>

        </section>

        {/* ── PRICING SECTION ─────────────────────────────────────────────────────── */}
        <section className="lp-pricing" id="pricing">
          <div className="lp-pricing-inner">

            <div className="lp-section-header">
              <span className="lp-section-tag">Τιμολόγηση</span>
              <h2 className="lp-section-title">Απλή τιμολόγηση.<br />Βρες το πλάνο σου.</h2>
              <p className="lp-section-sub">
                Πιλοτικό πρόγραμμα σε εξέλιξη — οι τιμές οριστικοποιούνται σύντομα.
                Επικοινώνησε μαζί μας για πρόωρη πρόσβαση.
              </p>
            </div>

            <div className="lp-pricing-grid">

              <div className="lp-plan-card">
                <div className="lp-plan-tag">Starter</div>
                <div className="lp-plan-desc">
                  Για μεμονωμένους μεσίτες που ξεκινούν.
                </div>
                <div className="lp-plan-price">
                  <span className="lp-plan-amount">—</span>
                  <span className="lp-plan-period">/ μήνα</span>
                </div>
                <ul className="lp-plan-features">
                  <li className="lp-plan-feature lp-plan-feature--empty">—</li>
                  <li className="lp-plan-feature lp-plan-feature--empty">—</li>
                  <li className="lp-plan-feature lp-plan-feature--empty">—</li>
                </ul>
                <button className="lp-plan-cta" type="button">Επικοινώνησε μαζί μας</button>
              </div>

              <div className="lp-plan-card">
                <div className="lp-plan-tag">Pro</div>
                <div className="lp-plan-desc">
                  Για ενεργούς μεσίτες με πολλά deals.
                </div>
                <div className="lp-plan-price">
                  <span className="lp-plan-amount">—</span>
                  <span className="lp-plan-period">/ μήνα</span>
                </div>
                <ul className="lp-plan-features">
                  <li className="lp-plan-feature lp-plan-feature--empty">—</li>
                  <li className="lp-plan-feature lp-plan-feature--empty">—</li>
                  <li className="lp-plan-feature lp-plan-feature--empty">—</li>
                </ul>
                <button className="lp-plan-cta" type="button">Επικοινώνησε μαζί μας</button>
              </div>

              <div className="lp-plan-card lp-plan-card--featured">
                <div className="lp-plan-badge">Πιο δημοφιλές</div>
                <div className="lp-plan-tag">Team</div>
                <div className="lp-plan-desc">
                  Για γραφεία με ομάδα μεσιτών.
                </div>
                <div className="lp-plan-price">
                  <span className="lp-plan-amount">—</span>
                  <span className="lp-plan-period">/ μήνα</span>
                </div>
                <ul className="lp-plan-features">
                  <li className="lp-plan-feature lp-plan-feature--empty">—</li>
                  <li className="lp-plan-feature lp-plan-feature--empty">—</li>
                  <li className="lp-plan-feature lp-plan-feature--empty">—</li>
                </ul>
                <button className="lp-plan-cta lp-plan-cta--featured" type="button">Επικοινώνησε μαζί μας</button>
              </div>

              <div className="lp-plan-card">
                <div className="lp-plan-tag">Enterprise</div>
                <div className="lp-plan-desc">
                  Για δίκτυα γραφείων και franchises.
                </div>
                <div className="lp-plan-price">
                  <span className="lp-plan-amount">Κατόπιν<br />επικοινωνίας</span>
                </div>
                <ul className="lp-plan-features">
                  <li className="lp-plan-feature lp-plan-feature--empty">—</li>
                  <li className="lp-plan-feature lp-plan-feature--empty">—</li>
                  <li className="lp-plan-feature lp-plan-feature--empty">—</li>
                </ul>
                <button className="lp-plan-cta" type="button">Επικοινώνησε μαζί μας</button>
              </div>

            </div>

            <p className="lp-pricing-note">
              Όλα τα πλάνα περιλαμβάνουν δωρεάν onboarding · Στα ελληνικά · Χωρίς δέσμευση
            </p>

          </div>
        </section>

        {/* ── CTA BLOCK ─────────────────────────────────────────────────────────── */}
        <section className="lp-cta" id="contact">
          <div className="lp-cta-inner">
            <div className="lp-cta-tag">Πιλοτικό πρόγραμμα</div>
            <h2 className="lp-cta-title">Το επόμενο deal σου — χωρίς το χάος.</h2>
            <p className="lp-cta-sub">
              Πιλοτικό πρόγραμμα για μεσιτικά γραφεία. Ο μεσίτης στήνει το
              deal — οι υπόλοιποι μπαίνουν με ένα link. Χωρίς δέσμευση.
            </p>
            <div className="lp-cta-form">
              <input
                className="lp-cta-input"
                type="email"
                placeholder="το email σου"
              />
              <button className="lp-cta-btn" type="button">
                Ζήτησε πρόσβαση →
              </button>
            </div>
            <p className="lp-cta-note">
              Θα επικοινωνήσουμε σε 1–2 εργάσιμες · Στα ελληνικά · 30 λεπτά αρκούν
            </p>
          </div>
        </section>

        {/* ── FOOTER ────────────────────────────────────────────────────────────── */}
        <footer className="lp-footer">
          <div className="lp-footer-brand">
            <img
              src={dealifyLogo}
              alt="Dealify"
              className="landing-logo-img"
            />
            <span className="landing-nav__wordmark">Dealify</span>
          </div>
          <div className="lp-footer-meta">© 2026 Dealify · dealify.gr</div>
          <div className="lp-footer-links">
            <a href="/terms" className="lp-footer-link">Όροι Χρήσης</a>
            <span className="lp-footer-sep">·</span>
            <a href="/privacy" className="lp-footer-link">Πολιτική Απορρήτου</a>
          </div>
        </footer>
      </main>
    </div>
  );
}
