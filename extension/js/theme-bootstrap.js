/* Apply the saved local report theme before the page is revealed. */
(() => {
    const root = document.documentElement;
    const reveal = theme => {
        const selected = theme === 'light' ? 'light' : 'dark';
        root.dataset.theme = selected;
        root.style.colorScheme = selected;
        root.removeAttribute('data-theme-pending');
    };

    try {
        chrome.storage.local.get(['reportTheme'], result => reveal(result.reportTheme));
    } catch (_) {
        reveal('dark');
    }
})();
