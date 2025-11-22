// ============================================
// THEME MANAGEMENT
// ============================================

const ThemeManager = {
    // Default theme is dark
    defaultTheme: 'dark',
    
    init() {
        // Check localStorage for saved theme preference
        const savedTheme = localStorage.getItem('theme');
        
        // Use saved theme or default to dark
        const theme = savedTheme || this.defaultTheme;
        
        // Apply theme immediately to prevent flash
        this.setTheme(theme);
        
        // Initialize theme toggle button
        this.initThemeToggle();
        
        // Update Prism.js theme
        this.updatePrismTheme(theme);
    },
    
    setTheme(theme) {
        // Set theme attribute on html element
        document.documentElement.setAttribute('data-theme', theme);
        
        // Save to localStorage
        localStorage.setItem('theme', theme);
        
        // Update Prism.js theme
        this.updatePrismTheme(theme);
        
        // Update toggle button icon
        this.updateToggleIcon(theme);
    },
    
    getTheme() {
        return document.documentElement.getAttribute('data-theme') || this.defaultTheme;
    },
    
    toggle() {
        const currentTheme = this.getTheme();
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    },
    
    initThemeToggle() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.createToggleButton());
        } else {
            this.createToggleButton();
        }
    },
    
    createToggleButton() {
        // Check if toggle button already exists
        let toggleBtn = document.getElementById('theme-toggle');
        
        if (!toggleBtn) {
            // Check if we're on an admin page
            const isAdminPage = document.body.classList.contains('admin-page');
            
            if (isAdminPage) {
                // For admin pages, add to sidebar or header
                const adminSidebar = document.querySelector('.admin-sidebar');
                const adminHeader = document.querySelector('.admin-header');
                
                if (adminSidebar) {
                    // Add to sidebar after the h2
                    const sidebarTitle = adminSidebar.querySelector('h2');
                    if (sidebarTitle) {
                        toggleBtn = document.createElement('div');
                        toggleBtn.id = 'theme-toggle';
                        toggleBtn.className = 'admin-theme-toggle';
                        toggleBtn.innerHTML = `
                            <button id="theme-toggle-btn" class="theme-toggle-btn" aria-label="Toggle theme" style="width: 100%; justify-content: center;">
                                <span class="theme-icon theme-icon-dark">🌙</span>
                                <span class="theme-icon theme-icon-light">☀️</span>
                            </button>
                        `;
                        sidebarTitle.insertAdjacentElement('afterend', toggleBtn);
                    }
                } else if (adminHeader) {
                    // Add to header if no sidebar
                    toggleBtn = document.createElement('div');
                    toggleBtn.id = 'theme-toggle';
                    toggleBtn.className = 'admin-theme-toggle';
                    toggleBtn.innerHTML = `
                        <button id="theme-toggle-btn" class="theme-toggle-btn" aria-label="Toggle theme">
                            <span class="theme-icon theme-icon-dark">🌙</span>
                            <span class="theme-icon theme-icon-light">☀️</span>
                        </button>
                    `;
                    adminHeader.appendChild(toggleBtn);
                }
            } else {
                // For public pages, add to navigation menu
                const navMenu = document.querySelector('.nav-menu');
                
                if (navMenu) {
                    // Create toggle button
                    toggleBtn = document.createElement('li');
                    toggleBtn.id = 'theme-toggle';
                    toggleBtn.className = 'theme-toggle-wrapper';
                    toggleBtn.innerHTML = `
                        <button id="theme-toggle-btn" class="theme-toggle-btn" aria-label="Toggle theme">
                            <span class="theme-icon theme-icon-dark">🌙</span>
                            <span class="theme-icon theme-icon-light">☀️</span>
                        </button>
                    `;
                    
                    // Insert before last item (usually Admin link)
                    navMenu.appendChild(toggleBtn);
                }
            }
            
            // Add click handler if button was created
            if (toggleBtn) {
                const btn = toggleBtn.querySelector('#theme-toggle-btn');
                if (btn) {
                    btn.addEventListener('click', () => this.toggle());
                    
                    // Update icon based on current theme
                    this.updateToggleIcon(this.getTheme());
                }
            }
        }
    },
    
    updateToggleIcon(theme) {
        const darkIcon = document.querySelector('.theme-icon-dark');
        const lightIcon = document.querySelector('.theme-icon-light');
        
        if (darkIcon && lightIcon) {
            if (theme === 'dark') {
                darkIcon.style.display = 'none';
                lightIcon.style.display = 'inline';
            } else {
                darkIcon.style.display = 'inline';
                lightIcon.style.display = 'none';
            }
        }
    },
    
    updatePrismTheme(theme) {
        // Update Prism.js theme stylesheet
        const prismLink = document.querySelector('link[href*="prism"]');
        
        if (prismLink) {
            const currentHref = prismLink.getAttribute('href');
            const newHref = theme === 'dark' 
                ? 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css'
                : 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism.min.css';
            
            if (currentHref !== newHref) {
                prismLink.setAttribute('href', newHref);
            }
        }
    }
};

// Initialize theme on page load (before DOM is ready to prevent flash)
if (document.documentElement) {
    const savedTheme = localStorage.getItem('theme') || ThemeManager.defaultTheme;
    document.documentElement.setAttribute('data-theme', savedTheme);
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

