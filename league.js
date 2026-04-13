/* league.js */

const leagueStatusNode = document.getElementById("leagueStatusText");

function initLeague() {
  if (leagueStatusNode) {
    leagueStatusNode.textContent = "Season One: Operations Active";
  }

  // Subtle entrance animation logic for group cards
  const groups = document.querySelectorAll(".league-group");
  groups.forEach((group, index) => {
    group.style.opacity = "0";
    group.style.transform = "translateY(20px)";
    
    setTimeout(() => {
      group.style.transition = "all 0.6s cubic-bezier(0.2, 1, 0.3, 1)";
      group.style.opacity = "1";
      group.style.transform = "translateY(0)";
    }, 100 * index);
  });
}

// Simple hover interactive tracking for future intelligence modules
document.querySelectorAll(".league-faction-row").forEach(row => {
  row.addEventListener("mouseenter", () => {
    const faction = row.getAttribute("data-faction");
    // Placeholder for future intel popups
  });
});

initLeague();
