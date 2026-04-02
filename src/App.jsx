import { useState, useEffect } from 'react';
import BottomNav from './components/BottomNav';
import { SettingsIcon } from './components/icons';
import Overview from './pages/Overview';
import Fitness from './pages/Fitness';
import Diet from './pages/Diet';
import Profile from './pages/Profile';
import { getSettings } from './storage';
import './App.css';

function applyAccent(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  document.documentElement.style.setProperty('--accent', hex);
  document.documentElement.style.setProperty('--accent-soft', `rgba(${r},${g},${b},0.12)`);
  document.documentElement.style.setProperty('--accent-glow', `rgba(${r},${g},${b},0.25)`);
}

export default function App() {
  const [tab, setTab] = useState('overview');
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    const s = getSettings();
    if (s.accentColor) applyAccent(s.accentColor);
  }, []);

  function renderPage() {
    switch (tab) {
      case 'fitness':
        return <Fitness />;
      case 'diet':
        return <Diet />;
      default:
        return <Overview />;
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-name">HealthApp</span>
        <button
          className="settings-btn"
          onClick={() => setShowProfile(!showProfile)}
          title="Settings"
        >
          <SettingsIcon size={22} />
        </button>
      </header>

      <main className="app-main">
        <div className="page-transition" key={showProfile ? 'profile' : tab}>
          {showProfile
          ? <Profile onClose={() => setShowProfile(false)} onAccentChange={applyAccent} />
          : renderPage()}
        </div>
      </main>

      {!showProfile && <BottomNav active={tab} onChange={setTab} />}
    </div>
  );
}
