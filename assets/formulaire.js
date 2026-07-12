
// Fonction pour mettre à jour les liens de navigation actifs
function updateActiveNavLink() {
  const sections = document.querySelectorAll('section[id], footer[id]');
  const navLinks = document.querySelectorAll('.nav-link');
  
  let currentSection = 'accueil'; // par défaut
  
  // Vérifier quelle section est actuellement visible
  sections.forEach(section => {
    const rect = section.getBoundingClientRect();
    // Si la section est en haut de la fenêtre (avec offset pour la navbar)
    if (rect.top <= 100 && rect.bottom > 0) {
      currentSection = section.id;
    }
  });
  
  // Mettre à jour les styles de tous les liens
  navLinks.forEach(link => {
    const section = link.getAttribute('data-section');
    
    if (section === currentSection) {
      // Lien actif
      link.classList.remove('text-white/70');
      link.classList.add('text-[#84fe58]', 'border-b-2', 'border-[#84fe58]');
    } else {
      // Lien inactif
      link.classList.remove('text-[#84fe58]', 'border-b-2', 'border-[#84fe58]');
      link.classList.add('text-white/70');
    }
  });
}

// Mettre à jour au scroll
window.addEventListener('scroll', updateActiveNavLink);

// Mettre à jour au chargement
document.addEventListener('DOMContentLoaded', () => {
  updateActiveNavLink();
  setupGalleryLightbox();
});

function setupGalleryLightbox() {
  const lightbox = document.getElementById('galleryLightbox');
  const image = document.getElementById('galleryLightboxImage');
  const caption = document.getElementById('galleryLightboxCaption');
  const closeBtn = document.getElementById('galleryLightboxClose');

  if (!lightbox || !image) return;

  document.querySelectorAll('.gallery-item').forEach((item) => {
    item.addEventListener('click', () => {
      image.src = item.dataset.gallerySrc;
      image.alt = item.dataset.galleryCaption || '';
      if (caption) caption.textContent = item.dataset.galleryCaption || '';
      lightbox.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    });
  });

  const closeLightbox = () => {
    lightbox.classList.add('hidden');
    image.src = '';
    document.body.style.overflow = '';
  };

  closeBtn?.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !lightbox.classList.contains('hidden')) {
      closeLightbox();
    }
  });
}
