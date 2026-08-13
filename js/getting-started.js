/**
 * ReviewPort getting-started guide.
 * Uses only local Chrome preferences and opens local extension pages.
 */

(() => {
    const themeToggle = document.getElementById('themeToggle');
    const themeToggleLabel = document.getElementById('themeToggleLabel');
    const openReport = document.getElementById('openReport');

    themeToggle.addEventListener('click', () => {
        const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        applyTheme(nextTheme);
        chrome.storage.local.set({ reportTheme: nextTheme });
    });

    openReport.addEventListener('click', async () => {
        try {
            await chrome.tabs.create({ url: chrome.runtime.getURL('review-studio.html') });
        } catch (error) {
            console.error('ReviewPort could not open the full report from the guide:', error);
        }
    });

    chrome.storage.local.get(['reportTheme'], result => {
        applyTheme(result.reportTheme === 'light' ? 'light' : 'dark');
    });

    function applyTheme(theme) {
        const isDark = theme === 'dark';
        document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
        document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
        themeToggle.setAttribute('aria-pressed', String(isDark));
        themeToggle.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
        themeToggleLabel.textContent = isDark ? 'Light' : 'Dark';
    }
})();
