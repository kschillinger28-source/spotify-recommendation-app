/**
 * Loading spinner utilities
 */
export function showLoadingSpinner(message = "Loading...") {
  const overlay = document.getElementById("loadingOverlay");
  const spinnerText = document.getElementById("spinnerText");
  if (overlay && spinnerText) {
    spinnerText.textContent = message;
    overlay.classList.add("show");
  }
}

export function hideLoadingSpinner() {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) {
    overlay.classList.remove("show");
  }
}

/**
 * Scroll position management for tab switching
 */
const scrollPositions = {
  player: 0,
  vibe: 0,
  settings: 0
};

export function saveScrollPosition(tabName) {
  if (scrollPositions.hasOwnProperty(tabName)) {
    scrollPositions[tabName] = window.scrollY;
  }
}

export function restoreScrollPosition(tabName) {
  if (scrollPositions.hasOwnProperty(tabName)) {
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollPositions[tabName]);
    });
  }
}

/**
 * Tab navigation with scroll preservation
 * Note: This wraps around existing setActiveAppView function in app.js
 */
export function enhanceTabNavigation() {
  const tabs = document.querySelectorAll(".app-nav-tab");

  tabs.forEach((tab) => {
    const originalClickHandler = tab.onclick;

    tab.addEventListener("click", (e) => {
      const viewName = e.currentTarget.dataset.view;
      if (viewName) {
        // Save current scroll position before switching
        const currentView = document.querySelector(".app-view.is-active");
        if (currentView) {
          const currentViewName = currentView.id.replace("view-", "");
          saveScrollPosition(currentViewName);
        }

        // Let the original handler run (setActiveAppView is called elsewhere)
        // Just restore scroll after view change completes
        requestAnimationFrame(() => {
          restoreScrollPosition(viewName);
        });
      }
    });
  });
}

/**
 * Enhanced form input focus management
 */
export function enhanceFormInputs() {
  const inputs = document.querySelectorAll(
    "input[type='text'], input[type='number'], input[type='range'], select"
  );

  inputs.forEach((input) => {
    // Add smooth transition effects
    input.addEventListener("focus", () => {
      input.style.transition = "all 0.2s ease";
    });
  });
}

/**
 * Dynamic tab aria-selected attribute update
 */
export function updateTabAriaAttributes(activeViewName) {
  const tabs = document.querySelectorAll(".app-nav-tab");
  tabs.forEach((tab) => {
    const isActive = tab.dataset.view === activeViewName;
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
  });
}
