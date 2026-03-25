# Competitive Rankings - 1v1 Leaderboard

A modern, competitive ranking system for tracking player skill in 1v1 matches. Similar to Faceit, with player levels, ELO ratings, and match history.

## Features

✅ **Global Leaderboard** - All players ranked by ELO rating
✅ **Search & Filtering** - Find players by name, faction, or country
✅ **Player Profiles** - Individual stats including ELO, W/L record, and recent matches
✅ **Match History** - See recent 1v1 match results and scores
✅ **Dark Competitive Theme** - Professional, sharp, and minimal design
✅ **Responsive Design** - Works on desktop, tablet, and mobile
✅ **Real-time Updates** - Easy to update with new players and match data

## How to Use

### 1. Open the Website
Simply open `index.html` in any web browser.

### 2. View Leaderboard
- See all players ranked globally by ELO
- Search for specific players
- Filter by faction or country
- Click any player to view their full profile

### 3. View Player Profiles
- Click a player name or use the Profile tab
- See detailed stats: ELO, level, W/L record, win rate
- View recent match history

### 4. Match History
- See recent 1v1 matches
- View match results and scores
- Track ELO changes

## Customization

### Adding Skill Level Images

The website looks for level icons numbered 1-10. To add custom images:

1. Place PNG files in the same folder as `index.html`:
   - `1.png` (Level 1)
   - `2.png` (Level 2)
   - ... up to...
   - `10.png` (Level 10)

2. Image recommendations:
   - Size: 32x32 pixels minimum
   - Background: Transparent PNG
   - The script will automatically use them if found

### Updating Player Data

To add or modify players, edit `script.js` and update the `playerData` array:

```javascript
const playerData = [
    { username: "PlayerName", faction: "FactionName", country: "Country" },
    // Add more players...
];
```

### Updating Match Results

The website currently generates random match data. To use real data:

1. Create a data file with match history
2. Load it in `script.js`
3. Modify `generateRecentMatches()` to use your actual data
4. Update player ELO ratings based on real results

## Current Players (22 Total)

All players currently set to:
- **Level:** 5
- **ELO:** ~1500 (with variance)
- **Status:** Ready for updates

### Player List by Faction:

**AH** (5 players): doudperfectcom, kbfrm242, Quackenxnator, Ruukke666, stolemyxrp
**CZSK** (3 players): Flexmaster2002, polloxlikop0911, Prehist0rick
**URF** (2 players): hamit_gamer13000, SAMOJEBEAST678
**NDV** (3 players): nessa2008s, Sonyah13, SussyAmogusbals2
**Others** (9 players): 20SovietSO21 (DK), Clown213o (TCL), DaSpokeyNameYT (N/A), Dociusaltius (United Robloxian Federation), fernichtung1 (twl), iownlivy (AH/URF), Jokerkingksh (tae), SwissAbyss1 (TWL)

## File Structure

```
/folder
├── index.html         # Main webpage
├── styles.css         # Styling and themes
├── script.js          # Functionality and data
├── 1.png - 10.png    # Optional skill level icons
└── README.md          # This file
```

## Browser Requirements

Works best in:
- Chrome/Chromium (Latest)
- Firefox (Latest)
- Edge (Latest)
- Safari (Latest)

## Design Highlights

- **Dark Theme:** Easy on eyes during long gaming sessions
- **Cyan Accent Color:** #00d4ff for competitive focus
- **Smooth Animations:** Fade-ins and hover effects
- **Clear Typography:** High contrast and readable fonts
- **Professional Layout:** Grid-based, organized structure

## Future Features (Customizable)

- Real-time ELO updates after matches
- Team statistics and leaderboards
- Player vs Player head-to-head stats
- Streaming integration
- Discord webhook notifications
- Database integration for persistent data

## Support

To modify or extend the website:
1. Edit the files directly in your text editor
2. Open `index.html` to see changes
3. Use browser DevTools (F12) to debug

---

**Ready to add new players?** Just edit `script.js` and add them to the `playerData` array!
