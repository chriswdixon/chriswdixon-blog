// ============================================
// THEME MANAGEMENT - DARK MODE ONLY
// ============================================

const ThemeManager = {
    init() {
        // Always set dark mode
        this.setTheme('dark');
        
        // Update Prism.js theme
        this.updatePrismTheme('dark');
    },
    
    setTheme(theme) {
        // Set theme attribute on html element
        document.documentElement.setAttribute('data-theme', theme);
        
        // Save to localStorage (for consistency)
        localStorage.setItem('theme', theme);
        
        // Update Prism.js theme
        this.updatePrismTheme(theme);
    },
    
    updatePrismTheme(theme) {
        // Update Prism.js theme stylesheet
        const prismLink = document.querySelector('link[href*="prism"]');
        
        if (prismLink) {
            const newHref = theme === 'dark' 
                ? 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css'
                : 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism.min.css';
            
            prismLink.setAttribute('href', newHref);
        }
    }
};

// Initialize theme on page load (before DOM is ready to prevent flash)
if (document.documentElement) {
    document.documentElement.setAttribute('data-theme', 'dark');
}

// Initialize theme manager when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ThemeManager.init());
} else {
    ThemeManager.init();
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.ThemeManager = ThemeManager;
}
