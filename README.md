# CodeSquad Tracker ���

**Track LeetCode & Codeforces contest rankings, build your coding squad, and compete with friends!**

CodeSquad Tracker is a Chrome extension built with **React + Vite + TypeScript** that enhances your competitive programming experience by allowing you to search for users in contest rankings, manage a squad of friends, track upcoming contests, and access daily coding challenges.

---

## 📸 Screenshots

> **Note:** Place your screenshots in a `screenshots/` folder in the project root.

### Main Features
![Squad Tab](screenshots/squad-tab.png)
![Contests Tab](screenshots/contests-tab.png)
![Search Tab](screenshots/search-tab.png)
![Dark Theme](screenshots/dark-theme.png)

---

## ✨ Features

### 🎯 **Upcoming Contests (NEW!)**

-   View upcoming contests from **LeetCode** and **Codeforces**
-   Real-time countdown timers (updates every second)
-   Filter contests within the next **7 days**
-   Platform badges with color coding
-   Direct links to **Problem of the Day**:
    -   💻 LeetCode Daily Challenge
    -   📚 GeeksforGeeks Problem of the Day

### 🌓 **Theme Toggle (NEW!)**

-   Switch between light and dark modes
-   Persistent theme selection (saved to localStorage)
-   Respects system preference on first load
-   Smooth color transitions

### 🔍 **Smart Contest Search**

-   Search for specific usernames within LeetCode & Codeforces contest rankings
-   Define custom rank ranges to narrow your search
-   Fuzzy matching to find similar usernames
-   Direct links to user profiles
-   Add found users directly to your squad

### 👥 **Squad Management**

-   Build and manage your coding squad
-   Add friends by username with validation (LeetCode & Codeforces)
-   Quick access to friend profiles
-   Visual friend list with avatars
-   Real-time stats tracking

### 🏆 **Performance Leaderboard**

-   Track total problems solved by difficulty (Easy/Medium/Hard)
-   See rankings among your squad members
-   Medal system for top performers (🥇🥈🥉)
-   Real-time stats via LeetCode & Codeforces APIs

---

## ✨ Features

### ��� **Smart Contest Search**

-   Search for specific usernames within LeetCode contest rankings
-   Define custom rank ranges to narrow your search
-   Fuzzy matching to find similar usernames
-   Direct links to user profiles
-   **NEW:** Add found users directly to your squad!

### ��� **Squad Management**

-   Build and manage your coding squad
-   Add friends by username with validation
-   Quick access to friend profiles
-   Visual friend list with avatars

### ��� **Performance Leaderboard**

-   Track total problems solved by difficulty (Easy/Medium/Hard)
-   See rankings among your squad members
-   Medal system for top performers (���������)
-   Real-time stats via LeetCode's GraphQL API

---

## ���️ Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool & development server
- **Chrome Extension API** - Browser integration
- **LeetCode GraphQL API** - Data fetching

---

## ��� Project Structure

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

## ��� Installation

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

## ��� How to Use

### Searching for Users

1. Navigate to a LeetCode contest ranking page:
   ```
   https://leetcode.com/contest/weekly-contest-XXX/ranking/1/
   ```

2. Click the extension icon in your toolbar
3. Go to **"Search"** tab
4. Enter usernames (comma-separated)
   ��� Use usernames as shown in ranking, not UserIds
5. Set rank range (optional)
6. Click **"Start Search"**

The extension will:
- Navigate through pages automatically
- Use fuzzy matching to find similar usernames
- Display results with profile links
- Allow adding found users to your squad

### Managing Your Squad

1. Click the extension icon
2. Go to **"Squad"** tab
3. Enter a LeetCode username
4. Click **"+"** to add to squad
5. View rankings sorted by total problems solved

---

## ��� Development

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run build:extension` - Build extension and copy manifest
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

### Development Workflow

1. Make changes to source files in `src/`
2. Run `npm run dev` to see changes in development mode
3. Run `npm run build:extension` to create production build
4. Load/reload the `dist/` folder in Chrome extensions

---

## ��� API Integration

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

## ��� Contributing

Feel free to submit issues or pull requests to improve CodeSquad Tracker!

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test the extension
5. Submit a pull request

---

## ��� License

MIT

---

## ��� Author

**MUHSIN-M-P**

---

## ��� Version

**3.0.0 - Enhanced Edition**
- ✨ Added Contests tab with LeetCode & Codeforces integration
- 📝 Added Problem of the Day quick links
- 🌓 Theme toggle (light/dark mode)
- 🎨 Improved UI with better color schemes
- ⏱️ Real-time contest countdowns

---

## 📧 Contact & Support

- **Issues**: [GitHub Issues](https://github.com/MUHSIN-M-P/CodeSquad-CP-DSA-Tracker/issues)
- **Email**: Add your support email
- **Twitter**: Add your Twitter handle

---

Made with ❤️ by competitive programmers, for competitive programmers!
