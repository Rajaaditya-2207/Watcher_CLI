// Install tab switching
document.querySelectorAll('.install-tab').forEach(function(tab) {
  tab.addEventListener('click', function() {
    document.querySelectorAll('.install-tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('.install-panel').forEach(function(p) { p.classList.remove('active'); });
    tab.classList.add('active');
    var target = document.getElementById(tab.getAttribute('data-target'));
    if (target) target.classList.add('active');
  });
});

// Copy button
document.querySelectorAll('.copy-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var code = btn.parentElement.querySelector('code');
    if (!code) return;
    navigator.clipboard.writeText(code.textContent).then(function() {
      var original = btn.innerHTML;
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#39FF14" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>';
      setTimeout(function() { btn.innerHTML = original; }, 1500);
    });
  });
});

// Smooth scroll for nav links
document.querySelectorAll('a[href^="#"]').forEach(function(link) {
  link.addEventListener('click', function(e) {
    var target = document.querySelector(link.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// Fade-in on scroll
var observer = new IntersectionObserver(function(entries) {
  entries.forEach(function(entry) {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.feature-card, .command, .faq-item, .stat').forEach(function(el) {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  observer.observe(el);
});

// Add visible class styles
var style = document.createElement('style');
style.textContent = '.visible { opacity: 1 !important; transform: translateY(0) !important; }';
document.head.appendChild(style);
