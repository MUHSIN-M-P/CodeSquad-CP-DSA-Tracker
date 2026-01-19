# CodeSquad Tracker 

**Track LeetCode & Codeforces contest rankings, build your coding squad, and compete with friends!**

CodeSquad Tracker is a Chrome extension built with **React + Vite + TypeScript** that enhances your competitive programming experience by allowing you to search for users in contest rankings, manage a squad of friends, track upcoming contests, and access daily coding challenges.

---

## 📸 Screenshots
<div align="center">
  <img src="https://github.com/user-attachments/assets/e236b4a6-dd2f-40b7-a93f-5f1ec880299a" alt="Screenshot 1" width="30%" style="border-radius: 8px; border: 1px solid #ccc; margin-right: 10px;">
  <img src="https://github.com/user-attachments/assets/3053a22f-78ed-4007-8e01-2e1c07134234" alt="Screenshot 2" width="30%" style="border-radius: 8px; border: 1px solid #ccc;">
</div>

---

## ✨ Features
### 🚀 **Multi-Platform Support (NEW!)**
- Track users from both **LeetCode** and **Codeforces**
- Combined leaderboards and stats
- Platform-specific badges and colors
- View Codeforces ratings and ranks (Expert, Master, etc.)

### 🖱️ **Drag-and-Drop Merging (NEW!)**
- **Merge Accounts:** Drag one profile onto another to link them (e.g., merge "userLC" with "userCF")
- See combined stats for the same person across platforms
- Split profiles easily with a single click
- Intuitive drag-and-drop interface with visual cues

### 🎯 **Upcoming Contests**
- View upcoming contests from **LeetCode** and **Codeforces**
- Real-time countdown timers (updates every second)
- Filter contests within the next **7 days**
- **Problem of the Day** links for LeetCode & GeeksforGeeks

### 🌓 **Theme Toggle**
- Switch between light and dark modes
- Persistent theme selection (synced with Chrome storage)
- Respects system preference on first load
- Smooth color transitions

### 🔍 **Smart Contest Search**
- Search for specific usernames within LeetCode & Codeforces contest rankings
- Define custom rank ranges to narrow your search
- Fuzzy matching to find similar usernames
- Add found users directly to your squad

### 👥 **Squad Management**
- Build and manage your coding squad
- **Privacy Fallback:** Tracking works even if a user has hidden LeetCode submissions (tracks total count changes)
- Edit display names (double-click to rename)
- Visual friend list with avatars from both platforms
- Real-time stats tracking

### 🏆 **Performance Leaderboard**
- Track total problems solved by difficulty (Easy/Medium/Hard for LeetCode)
- See rankings among your squad members
- Medal system for top performers (🥇🥈🥉)
- Shows solved count for today (with "✓ LC" or "✓ CF" indicators)

---

##Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool & development server
- **Chrome Extension API** - Browser integration
- **LeetCode GraphQL API** - Data fetching

---

## Project Structure

```
CodeSquad-CP-DSA-Tracker/
├── public/
│   ├── manifest.json       # Chrome extension manifest
│   ├── popup.html          # Extension popup entry point
│   └── icon*.png           # Extension icons
├── src/
│   ├── components/         # React components
│   │   ├── Header.tsx
│   │   ├── TabBar.tsx
│   │   ├── ErrorBox.tsx
│   │   ├── SearchTab.tsx
│   │   └── SquadTab.tsx
│   ├── popup/              # Popup entry
│   │   ├── index.tsx       # Main popup app
│   │   └── popup.css       # Global styles
│   ├── content/            # Content scripts
│   │   └── content.ts      # LeetCode page integration
│   ├── background/         # Background scripts
│   │   └── background.ts   # Service worker
│   ├── utils/              # Utilities
│   │   └── leetcode-api.ts # LeetCode GraphQL API wrapper
│   └── types/              # TypeScript types
│       └── index.ts
├── vite.config.ts          # Vite configuration
├── tsconfig.json           # TypeScript configuration
└── package.json            # Dependencies
```

---

##  Installation

### Development Setup

1. **Clone the repository:**

```bash
git clone https://github.com/MUHSIN-M-P/CodeSquad-CP-DSA-Tracker.git
cd CodeSquad-CP-DSA-Tracker
```

2. **Install dependencies:**

```bash
npm install
```

3. **Build the extension:**

```bash
npm run build:extension
```

The built extension will be in the `dist/` folder.

### Load into Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer Mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `dist/` folder

---

## API Integration

The extension uses LeetCode's GraphQL API to fetch:
- User profiles and stats
- Problem-solving statistics (Easy/Medium/Hard)
- Recent submissions
- User verification

See `src/utils/leetcode-api.ts` for API implementation.

---

## ⚠️ Limitations

-   Uses **unofficial** LeetCode GraphQL API (may break with changes)
-   Codeforces API has rate limiting
-   Leaderboard shows all-time stats (not contest-specific)
-   Rate limiting may apply with many friends
-   Requires internet connection for API queries

---

## Contributing

Feel free to submit issues or pull requests to improve CodeSquad Tracker!

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test the extension
5. Submit a pull request

---

Made with ❤️ by competitive programmers, for competitive programmers!