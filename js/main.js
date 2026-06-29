/* main.js — アーサー学院 Website
   Shared script for all pages (SITE_TEMPLATE.md §4).
   Header scroll state · mobile menu · scroll fade-in · active nav ·
   contact form validation + AJAX submit · news filter · FAQ accordion. */

document.addEventListener('DOMContentLoaded', () => {
  requestAnimationFrame(() => document.body.classList.add('page-loaded'));

  initHeader();
  initMobileMenu();
  initScrollFade();
  setActiveNav();
  initContactForm();
  initNewsFilter();
  initFaq();
});

/* ---- Sticky Header ---- */
function initHeader() {
  const header = document.querySelector('.header');
  if (!header) return;
  let ticking = false, isScrolled = false;
  const apply = () => {
    const shouldScroll = window.scrollY > 40;
    if (shouldScroll !== isScrolled) {
      isScrolled = shouldScroll;
      header.classList.toggle('scrolled', shouldScroll);
    }
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(apply);
  }, { passive: true });
  apply();
}

/* ---- Mobile Menu ---- */
function initMobileMenu() {
  const btn  = document.querySelector('.nav-hamburger');
  const menu = document.querySelector('.nav-mobile');
  if (!btn || !menu) return;

  const close = () => {
    btn.classList.remove('open');
    menu.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'メニューを開く');
  };

  btn.addEventListener('click', () => {
    const isOpen = btn.classList.toggle('open');
    menu.classList.toggle('open', isOpen);
    btn.setAttribute('aria-expanded', String(isOpen));
    btn.setAttribute('aria-label', isOpen ? 'メニューを閉じる' : 'メニューを開く');
  });

  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', close));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

/* ---- Scroll Fade-in ---- */
function initScrollFade() {
  const els = document.querySelectorAll('.fade-in');
  if (!els.length) return;
  if (!('IntersectionObserver' in window)) {
    els.forEach(el => el.classList.add('visible'));
    return;
  }
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  els.forEach(el => obs.observe(el));
}

/* ---- Active Nav Link ---- */
function setActiveNav() {
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a, .nav-mobile a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === page || (page === '' && href === 'index.html')) {
      a.classList.add('active');
      a.setAttribute('aria-current', 'page');
    }
  });
}

/* ---- Contact Form: validation + AJAX submit ---- */
function initContactForm() {
  const form = document.querySelector('.c-form');
  if (!form) return;

  // Pre-select inquiry type from ?type= (brochure / trial / general)
  const params = new URLSearchParams(location.search);
  const type = params.get('type');
  const typeSel = form.querySelector('[name="種別"], #inquiry-type');
  if (type && typeSel) {
    const map = { brochure: '資料請求', trial: '無料体験', general: 'その他' };
    const want = map[type];
    if (want) {
      [...typeSel.options].forEach(o => { if (o.value === want || o.textContent.trim() === want) typeSel.value = o.value; });
    }
  }

  const showError = (field, msg) => {
    field.classList.add('error');
    field.setAttribute('aria-invalid', 'true');
    const err = field.closest('.form-row')?.querySelector('.form-error');
    if (err) { err.textContent = msg; err.classList.add('show'); }
  };
  const clearError = (field) => {
    field.classList.remove('error');
    field.removeAttribute('aria-invalid');
    const err = field.closest('.form-row')?.querySelector('.form-error');
    if (err) err.classList.remove('show');
  };

  form.querySelectorAll('.form-control').forEach(f => {
    f.addEventListener('input', () => clearError(f));
    f.addEventListener('blur', () => { if (f.value.trim()) clearError(f); });
  });

  const validate = () => {
    let ok = true;
    let firstBad = null;
    // clean slate so stale errors never linger
    form.querySelectorAll('.form-control, [type="checkbox"]').forEach(clearError);
    form.querySelectorAll('[required]').forEach(field => {
      const val = (field.value || '').trim();
      if (field.type === 'checkbox') {
        if (!field.checked) { ok = false; if (!firstBad) firstBad = field; showError(field, '同意が必要です。'); }
        return;
      }
      if (!val) { ok = false; if (!firstBad) firstBad = field; showError(field, 'この項目は必須です。'); return; }
      if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        ok = false; if (!firstBad) firstBad = field; showError(field, 'メールアドレスの形式をご確認ください。');
      }
      if (field.dataset.type === 'tel' && !/^[0-9０-９\-ー\s()]{8,}$/.test(val)) {
        ok = false; if (!firstBad) firstBad = field; showError(field, '電話番号の形式をご確認ください。');
      }
    });
    if (firstBad) firstBad.focus();
    return ok;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const btn = form.querySelector('[type="submit"]');
    const original = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '送信中…'; }

    const endpoint = form.getAttribute('action') || '';
    const isPlaceholder = !endpoint || endpoint.includes('FORM_ID') || endpoint.includes('〔');

    const finish = (success) => {
      const panel = document.querySelector('.form-success');
      if (success && panel) {
        form.style.display = 'none';
        panel.classList.add('show');
        panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        if (btn) { btn.disabled = false; btn.textContent = original; }
        alert('送信に失敗しました。お手数ですが、お電話にてお問い合わせください。');
      }
    };

    // No live Formspree endpoint yet (sample): simulate success so the UX is reviewable.
    if (isPlaceholder) { setTimeout(() => finish(true), 600); return; }

    try {
      const res = await fetch(endpoint, {
        method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' }
      });
      finish(res.ok);
    } catch (_) { finish(false); }
  });
}

/* ---- News Filter (全校 / 校舎別 + category) ---- */
function initNewsFilter() {
  const bar = document.querySelector('.news-filter');
  const list = document.querySelector('.news-list');
  if (!bar || !list) return;

  // reflect selected state to assistive tech
  bar.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.classList.contains('active'))));

  bar.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    bar.querySelectorAll('button').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
    const filter = btn.dataset.filter; // 'all' or a token present in data-tags
    list.querySelectorAll('.news-item').forEach(item => {
      const tags = (item.dataset.tags || '').split(/\s+/);
      const show = filter === 'all' || tags.includes(filter);
      item.classList.toggle('is-hidden', !show);
    });
  });
}

/* ---- FAQ Accordion ---- */
function initFaq() {
  const items = document.querySelectorAll('.faq-item');
  if (!items.length) return;
  items.forEach(item => {
    const q = item.querySelector('.faq-q');
    const a = item.querySelector('.faq-a');
    if (!q || !a) return;
    q.setAttribute('aria-expanded', 'false');
    q.addEventListener('click', () => {
      const open = q.getAttribute('aria-expanded') === 'true';
      q.setAttribute('aria-expanded', String(!open));
      a.style.maxHeight = open ? null : a.scrollHeight + 'px';
    });
    // keep open panel sized correctly on resize
    window.addEventListener('resize', () => {
      if (q.getAttribute('aria-expanded') === 'true') a.style.maxHeight = a.scrollHeight + 'px';
    });
  });
}
