class PhotoGalleryApp {
    constructor() {
        this.photos = [];
        this.currentLightboxIndex = 0;
        this.maxPhotos = 49;
        this.supportedFormats = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        
        this.elements = {
            loadPhotosBtn: document.getElementById('loadPhotosBtn'),
            photoInput: document.getElementById('photoInput'),
            photoInfo: document.getElementById('photoInfo'),
            photoCount: document.getElementById('photoCount'),
            resetBtn: document.getElementById('resetBtn'),
            loading: document.getElementById('loading'),
            photoGrid: document.getElementById('photoGrid'),
            emptyState: document.getElementById('emptyState'),
            lightbox: document.getElementById('lightbox'),
            lightboxImage: document.getElementById('lightboxImage'),
            lightboxClose: document.getElementById('lightboxClose'),
            lightboxPrev: document.getElementById('lightboxPrev'),
            lightboxNext: document.getElementById('lightboxNext'),
            lightboxCounter: document.getElementById('lightboxCounter'),
            lightboxBackdrop: document.getElementById('lightboxBackdrop'),
            installBtn: document.getElementById('installBtn')
        };

        this.deferredPrompt = null;
        this.touchStartX = 0;
        this.touchEndX = 0;
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkPWAInstallability();
    }

    bindEvents() {
        // Photo loading - ensure proper event binding
        this.elements.loadPhotosBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.triggerFileInput();
        });
        
        // Also handle touch events for mobile
        this.elements.loadPhotosBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.triggerFileInput();
        });
        
        this.elements.photoInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileSelection(e.target.files);
            }
        });

        // Reset functionality
        this.elements.resetBtn.addEventListener('click', () => {
            this.resetGallery();
        });

        // Lightbox events
        this.elements.lightboxClose.addEventListener('click', () => {
            this.closeLightbox();
        });
        
        this.elements.lightboxBackdrop.addEventListener('click', () => {
            this.closeLightbox();
        });
        
        this.elements.lightboxPrev.addEventListener('click', () => {
            this.navigateLightbox(-1);
        });
        
        this.elements.lightboxNext.addEventListener('click', () => {
            this.navigateLightbox(1);
        });

        // Touch events for swipe navigation
        this.elements.lightbox.addEventListener('touchstart', (e) => {
            this.touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        this.elements.lightbox.addEventListener('touchend', (e) => {
            this.touchEndX = e.changedTouches[0].screenX;
            this.handleSwipe();
        }, { passive: true });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (this.elements.lightbox.style.display === 'block') {
                switch(e.key) {
                    case 'Escape':
                        this.closeLightbox();
                        break;
                    case 'ArrowLeft':
                        this.navigateLightbox(-1);
                        break;
                    case 'ArrowRight':
                        this.navigateLightbox(1);
                        break;
                }
            }
        });

        // PWA install
        this.elements.installBtn.addEventListener('click', () => {
            this.installPWA();
        });
    }

    triggerFileInput() {
        // Create a new click event and dispatch it
        const clickEvent = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true
        });
        this.elements.photoInput.dispatchEvent(clickEvent);
        
        // Fallback method
        setTimeout(() => {
            this.elements.photoInput.click();
        }, 10);
    }

    async handleFileSelection(files) {
        const validFiles = Array.from(files)
            .filter(file => this.supportedFormats.includes(file.type))
            .slice(0, this.maxPhotos);

        if (validFiles.length === 0) {
            alert('Neboli vybrané žiadne podporované obrázky. Podporované formáty: JPEG, PNG, WebP, GIF');
            return;
        }

        if (files.length > this.maxPhotos) {
            alert(`Môžete vybrať maximálne ${this.maxPhotos} fotografií. Prvých ${this.maxPhotos} bolo načítaných.`);
        }

        this.showLoading(true);
        this.photos = [];

        try {
            for (let i = 0; i < validFiles.length; i++) {
                const file = validFiles[i];
                const photoData = await this.processPhoto(file);
                this.photos.push(photoData);
            }

            this.renderPhotos();
            this.updatePhotoCount();
            this.showPhotoInfo(true);
            this.showEmptyState(false);
        } catch (error) {
            console.error('Chyba pri spracovaní fotografií:', error);
            alert('Nastala chyba pri načítavaní fotografií. Skúste to znova.');
        } finally {
            this.showLoading(false);
        }
    }

    async processPhoto(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const thumbnail = this.createThumbnail(img);
                    resolve({
                        original: e.target.result,
                        thumbnail: thumbnail,
                        name: file.name,
                        size: file.size
                    });
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    createThumbnail(img, size = 200) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Calculate dimensions to maintain aspect ratio
        const aspectRatio = img.width / img.height;
        let width, height;
        
        if (aspectRatio > 1) {
            width = size;
            height = size / aspectRatio;
        } else {
            width = size * aspectRatio;
            height = size;
        }
        
        canvas.width = size;
        canvas.height = size;
        
        // Fill background
        ctx.fillStyle = '#1E1E1E';
        ctx.fillRect(0, 0, size, size);
        
        // Center the image
        const x = (size - width) / 2;
        const y = (size - height) / 2;
        
        ctx.drawImage(img, x, y, width, height);
        
        return canvas.toDataURL('image/jpeg', 0.8);
    }

    renderPhotos() {
        this.elements.photoGrid.innerHTML = '';
        
        this.photos.forEach((photo, index) => {
            const photoItem = document.createElement('div');
            photoItem.className = 'photo-item';
            photoItem.innerHTML = `<img src="${photo.thumbnail}" alt="Fotografia ${index + 1}" loading="lazy">`;
            
            photoItem.addEventListener('click', () => {
                this.openLightbox(index);
            });

            // Add keyboard support
            photoItem.setAttribute('tabindex', '0');
            photoItem.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.openLightbox(index);
                }
            });
            
            this.elements.photoGrid.appendChild(photoItem);
        });
    }

    openLightbox(index) {
        this.currentLightboxIndex = index;
        this.elements.lightboxImage.src = this.photos[index].original;
        this.updateLightboxCounter();
        this.updateLightboxNavigation();
        this.elements.lightbox.style.display = 'block';
        document.body.style.overflow = 'hidden';
        
        // Focus management
        this.elements.lightboxClose.focus();
    }

    closeLightbox() {
        this.elements.lightbox.style.display = 'none';
        document.body.style.overflow = '';
    }

    navigateLightbox(direction) {
        const newIndex = this.currentLightboxIndex + direction;
        
        if (newIndex >= 0 && newIndex < this.photos.length) {
            this.currentLightboxIndex = newIndex;
            this.elements.lightboxImage.src = this.photos[newIndex].original;
            this.updateLightboxCounter();
            this.updateLightboxNavigation();
        }
    }

    updateLightboxCounter() {
        this.elements.lightboxCounter.textContent = 
            `${this.currentLightboxIndex + 1} / ${this.photos.length}`;
    }

    updateLightboxNavigation() {
        this.elements.lightboxPrev.disabled = this.currentLightboxIndex === 0;
        this.elements.lightboxNext.disabled = this.currentLightboxIndex === this.photos.length - 1;
    }

    handleSwipe() {
        const swipeThreshold = 50;
        const diff = this.touchStartX - this.touchEndX;
        
        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                // Swipe left - next photo
                this.navigateLightbox(1);
            } else {
                // Swipe right - previous photo
                this.navigateLightbox(-1);
            }
        }
    }

    resetGallery() {
        this.photos = [];
        this.elements.photoGrid.innerHTML = '';
        this.elements.photoInput.value = '';
        this.showPhotoInfo(false);
        this.showEmptyState(true);
        this.closeLightbox();
    }

    updatePhotoCount() {
        this.elements.photoCount.textContent = this.photos.length;
    }

    showLoading(show) {
        this.elements.loading.style.display = show ? 'flex' : 'none';
    }

    showPhotoInfo(show) {
        this.elements.photoInfo.style.display = show ? 'flex' : 'none';
    }

    showEmptyState(show) {
        this.elements.emptyState.style.display = show ? 'block' : 'none';
    }

    // PWA functionality
    checkPWAInstallability() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            this.elements.installBtn.style.display = 'inline-flex';
        });

        window.addEventListener('appinstalled', () => {
            this.elements.installBtn.style.display = 'none';
            this.deferredPrompt = null;
        });

        // Show install button for testing even if beforeinstallprompt doesn't fire
        setTimeout(() => {
            if (!this.deferredPrompt && this.elements.installBtn.style.display === 'none') {
                this.elements.installBtn.style.display = 'inline-flex';
                this.elements.installBtn.textContent = '📱 PWA Ready';
                this.elements.installBtn.addEventListener('click', () => {
                    alert('Pre inštaláciu aplikácie použite menu prehliadača "Pridať na domácu obrazovku"');
                });
            }
        }, 2000);
    }

    async installPWA() {
        if (!this.deferredPrompt) {
            return;
        }

        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            this.deferredPrompt = null;
            this.elements.installBtn.style.display = 'none';
        }
    }
}

// Service Worker registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        const swCode = `
            const CACHE_NAME = 'photo-gallery-v1';
            const urlsToCache = [
                '/',
                '/style.css',
                '/app.js'
            ];

            self.addEventListener('install', (event) => {
                event.waitUntil(
                    caches.open(CACHE_NAME)
                        .then((cache) => cache.addAll(urlsToCache))
                );
            });

            self.addEventListener('fetch', (event) => {
                event.respondWith(
                    caches.match(event.request)
                        .then((response) => {
                            if (response) {
                                return response;
                            }
                            return fetch(event.request);
                        })
                );
            });
        `;

        const blob = new Blob([swCode], { type: 'application/javascript' });
        const swUrl = URL.createObjectURL(blob);

        navigator.serviceWorker.register(swUrl)
            .then((registration) => {
                console.log('Service Worker zaregistrovaný:', registration);
            })
            .catch((error) => {
                console.log('Chyba pri registrácii Service Worker:', error);
            });
    });
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new PhotoGalleryApp();
});