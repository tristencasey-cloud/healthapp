import { OverviewIcon, FitnessIcon, DietIcon } from './icons';

const tabs = [
  { id: 'overview', label: 'Overview', Icon: OverviewIcon },
  { id: 'fitness', label: 'Fitness', Icon: FitnessIcon },
  { id: 'diet', label: 'Diet', Icon: DietIcon },
];

export default function BottomNav({ active, onChange }) {
  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`nav-tab ${active === tab.id ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          <span className="nav-icon">
            <tab.Icon size={24} />
          </span>
          <span className="nav-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
