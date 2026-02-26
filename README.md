# Business Recorder

A modern, Excel-like spreadsheet application for recording and managing business transactions with real-time Firebase Firestore synchronization.

## Features

✨ **Excel-Like Data Entry**
- Keyboard navigation with Arrow Keys, Tab, Enter
- Auto-focus and auto-select text on cell entry
- Smooth transitions and professional UX
- Real-time data persistence with Firebase

📊 **Smart Calculations**
- Auto-calculate amount (QTY × Rate)
- Commission calculations based on percentage
- Net amount auto-computation
- Days elapsed and status tracking

🔐 **Enterprise Ready**
- Firebase Authentication (email/password)
- Per-user data isolation (Firestore security rules)
- Real-time data synchronization
- Responsive design

## Local Development

### Prerequisites
- Node.js 16+ 
- npm or yarn
- Firebase project with Firestore enabled

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/MAXSTEEL003/businessrecorder.git
   cd businessrecorder
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create `.env.local` with Firebase credentials**
   ```bash
   cp .env.example .env.local
   ```
   
   Fill in your Firebase credentials from [Firebase Console](https://console.firebase.google.com):
   - Go to Project Settings → Service Accounts
   - Copy the configuration values into `.env.local`

4. **Start development server**
   ```bash
   npm run dev
   ```
   
   The app will be available at `http://localhost:5173`

## Building

```bash
npm run build
```

Builds the app for production to the `dist` folder using Vite.

## Vercel Deployment

### Environment Variables

1. **Go to your Vercel dashboard** → Project Settings → Environment Variables

2. **Add these variables:**
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_MEASUREMENT_ID` (optional)

3. **Redeploy** - Vercel will automatically rebuild with the new environment variables

### Firestore Security Rules

Paste these rules into Firebase Console → Firestore → Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null
                         && request.auth.uid == userId;
    }
  }
}
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Save cell, move right |
| `Shift+Enter` | Save cell, move down |
| `Tab` | Save cell, move right |
| `Shift+Tab` | Save cell, move left |
| `↑` | Save cell, move up |
| `↓` | Save cell, move down |
| `←` | Save cell, move left |
| `→` | Save cell, move right |
| `Home` | Jump to first cell in row |
| `End` | Jump to last cell in row |
| `Esc` | Cancel edit without saving |

## Technology Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Build Tool**: Vite
- **Backend**: Firebase (Auth + Firestore)
- **Hosting**: Vercel
- **Styling**: CSS Grid, Flexbox, CSS Custom Properties

## Project Structure

```
businessrecorder/
├── index.html                 # Main app
├── login.html                 # Authentication page
├── print.html                 # Print view
├── brokerage.html             # Brokerage records view
├── app.js                      # Main application logic
├── firebase.js                 # Firebase configuration
├── style.css                   # Global styles
├── vite.config.js              # Vite configuration
├── firebase-config.json        # Local Firebase config (git-ignored)
├── .env.example                # Environment variables template
└── package.json                # Dependencies
```

## Firebase Structure

User data is organized per-user in Firestore:

```
users/
  {uid}/
    records/
      {recordId}/
        date: string
        millerName: string
        qty: number
        rate: number
        amount: number (auto)
        ...
    meta/
      brokerageRates/
        ccPct: number
        ...
```

## Contributing

1. Create a feature branch
2. Make your changes with clear commits
3. Test thoroughly with Excel-like keyboard navigation
4. Push and create a Pull Request

## License

Private project

## Support

For issues or questions, contact the development team.
