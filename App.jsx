// App.jsx — state machine with location + API states
const LOCATION_STATES = {
  NOT_REQUESTED: 'not_requested',
  LOADING: 'loading',
  GRANTED: 'granted',
  DENIED: 'denied',
};

const AIRPORT_STATES = {
  SAFE: 'safe',       // > 4h buffer
  WARNING: 'warning', // 2–4h buffer
  UNSAFE: 'unsafe',   // < 2h buffer
};

// Demo airport departure: 9h 40m from now
const DEMO_FLIGHT_MINS = 9 * 60 + 40;
const AIRPORT_TRANSIT_MINS = 45; // estimated transit to Changi

function getAirportState(flightMinsRemaining) {
  const buffer = flightMinsRemaining - AIRPORT_TRANSIT_MINS;
  if (buffer > 240) return AIRPORT_STATES.SAFE;
  if (buffer > 120) return AIRPORT_STATES.WARNING;
  return AIRPORT_STATES.UNSAFE;
}

const App = () => {
  const [screen, setScreen] = React.useState('setup');
  const [timeOption, setTimeOption] = React.useState(null);
  const [activeQuest, setActiveQuest] = React.useState(null);
  const [unlockedStop, setUnlockedStop] = React.useState(null);
  const [stopIdx, setStopIdx] = React.useState(0);
  const [totalStops, setTotalStops] = React.useState(0);
  const [continueCallback, setContinueCallback] = React.useState(null);
  const [earnedBadgeIds, setEarnedBadgeIds] = React.useState([]);
  const [userXP, setUserXP] = React.useState(120);
  const [transitioning, setTransitioning] = React.useState(false);
  const [transDir, setTransDir] = React.useState('forward');

  // ── Location state ────────────────────────────────────────────────────────
  const [locationState, setLocationState] = React.useState(LOCATION_STATES.NOT_REQUESTED);
  const [userLocation, setUserLocation] = React.useState(null);
  const [demoMode, setDemoMode] = React.useState(true);

  // ── Flight + airport buffer (set by FlightSetup) ──────────────────────────
  const [flightData, setFlightData] = React.useState(null);
  // flightMinsRemaining ticks down from setup value or demo default
  const [flightMinsRemaining, setFlightMinsRemaining] = React.useState(DEMO_FLIGHT_MINS);
  const airportState = getAirportState(flightMinsRemaining);

  const [flightSettingsOpen, setFlightSettingsOpen] = React.useState(false);

  // ── Quest route state (per active quest) ─────────────────────────────────
  const [questRouteState, setQuestRouteState] = React.useState({
    // keyed by questId
    // { status: idle|loading|success|failed, estimatedRouteMins, airportReturnETA, safeBufferMins }
  });

  // Tick down flight timer every real minute
  React.useEffect(() => {
    const t = setInterval(() => setFlightMinsRemaining(m => Math.max(0, m - 1)), 60000);
    return () => clearInterval(t);
  }, []);

  // ── FlightSetup handlers ──────────────────────────────────────────────────
  const handleFlightActivate = React.useCallback((data) => {
    setFlightData(data);
    setFlightMinsRemaining(data.flightMinsRemaining);
    navigate('map');
  }, []);

  const handleDemoMode = React.useCallback(() => {
    setFlightData(null);
    setFlightMinsRemaining(DEMO_FLIGHT_MINS);
    navigate('map');
  }, []);

  const handleFlightSave = React.useCallback((data) => {
    setFlightData(data);
    setFlightMinsRemaining(data.flightMinsRemaining);
    setFlightSettingsOpen(false);
  }, []);

  // ── Location request ──────────────────────────────────────────────────────
  const requestLocation = React.useCallback(async () => {
    setLocationState(LOCATION_STATES.LOADING);
    const loc = await window.GrabMaps.getCurrentLocation();
    if (loc) {
      setUserLocation(loc);
      setLocationState(LOCATION_STATES.GRANTED);
      setDemoMode(false);
    } else {
      setLocationState(LOCATION_STATES.DENIED);
      setDemoMode(true);
    }
  }, []);

  // ── Route ETA fetch (stub) ────────────────────────────────────────────────
  const fetchQuestRoute = React.useCallback(async (quest) => {
    if (questRouteState[quest.id]?.status === 'success') return;
    setQuestRouteState(prev => ({ ...prev, [quest.id]: { status: 'loading' } }));
    try {
      const origin = userLocation || { lat: quest.stops_data[0]?.lat, lng: quest.stops_data[0]?.lng };
      const destination = { lat: quest.stops_data[quest.stops_data.length - 1]?.lat, lng: quest.stops_data[quest.stops_data.length - 1]?.lng };
      const [route, airportRoute] = await Promise.all([
        window.GrabMaps.getRoute(origin, destination),
        window.GrabMaps.getRouteToAirport(destination),
      ]);
      const routeMins = route?.durationSeconds ? Math.ceil(route.durationSeconds / 60) : null;
      const airportMins = airportRoute?.durationSeconds ? Math.ceil(airportRoute.durationSeconds / 60) : null;
      const safeBuffer = airportMins !== null ? flightMinsRemaining - quest.durationMins - airportMins - AIRPORT_TRANSIT_MINS : null;
      setQuestRouteState(prev => ({
        ...prev,
        [quest.id]: {
          status: routeMins !== null ? 'success' : 'failed',
          estimatedRouteMins: routeMins,
          airportReturnMins: airportMins,
          safeBufferMins: safeBuffer,
        }
      }));
    } catch {
      setQuestRouteState(prev => ({ ...prev, [quest.id]: { status: 'failed' } }));
    }
  }, [userLocation, flightMinsRemaining, questRouteState]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const navigate = (newScreen, dir = 'forward') => {
    setTransDir(dir);
    setTransitioning(true);
    setTimeout(() => { setScreen(newScreen); setTransitioning(false); }, 220);
  };

  const handleSelectTime = (opt) => { setTimeOption(opt); navigate('select'); };
  const handleSelectQuest = (quest) => { setActiveQuest(quest); navigate('quest'); };

  const handleStopUnlocked = (stop, idx, total, cb) => {
    setUnlockedStop(stop);
    setStopIdx(idx);
    setTotalStops(total);
    setContinueCallback(() => cb);
    navigate('unlocked');
  };

  const handleContinue = () => {
    if (continueCallback) continueCallback();
    navigate('quest', 'back');
  };

  const handleQuestComplete = (quest) => {
    if (continueCallback) continueCallback();
    setEarnedBadgeIds(prev => prev.includes(quest.badgeId) ? prev : [...prev, quest.badgeId]);
    setUserXP(prev => prev + quest.xpReward);
    navigate('complete');
  };

  const userLevel = Math.floor(userXP / 500) + 1;

  const slideStyle = {
    position: 'absolute', inset: 0, overflowY: 'auto',
    transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1), opacity 0.22s ease',
    transform: transitioning ? (transDir === 'forward' ? 'translateX(-24px)' : 'translateX(24px)') : 'translateX(0)',
    opacity: transitioning ? 0 : 1,
  };

  const renderScreen = () => {
    switch (screen) {
      case 'setup':
        return <FlightSetup onActivate={handleFlightActivate} onDemoMode={handleDemoMode} />;
      case 'map':
        return <QuestMap onSelectTime={handleSelectTime} onOpenPassport={() => navigate('passport')} userXP={userXP} userLevel={userLevel} airportState={airportState} flightMinsRemaining={flightMinsRemaining} onEditFlight={() => setFlightSettingsOpen(true)} />;
      case 'select':
        return <QuestSelect timeOption={timeOption} onSelectQuest={handleSelectQuest} onBack={() => navigate('map', 'back')} questRouteState={questRouteState} onFetchRoute={fetchQuestRoute} flightMinsRemaining={flightMinsRemaining} airportState={airportState} />;
      case 'quest':
        return activeQuest ? <ActiveQuest quest={activeQuest} onStopUnlocked={handleStopUnlocked} onBack={() => navigate('select', 'back')} onComplete={handleQuestComplete} locationState={locationState} userLocation={userLocation} onRequestLocation={requestLocation} demoMode={demoMode} airportState={airportState} flightMinsRemaining={flightMinsRemaining} /> : null;
      case 'unlocked':
        return unlockedStop ? <StopUnlocked stop={unlockedStop} stopIdx={stopIdx} totalStops={totalStops} quest={activeQuest} onContinue={handleContinue} onComplete={() => handleQuestComplete(activeQuest)} userLocation={userLocation} /> : null;
      case 'complete':
        return <QuestComplete quest={activeQuest} xpEarned={activeQuest?.xpReward} onPassport={() => navigate('passport')} onMap={() => navigate('map')} />;
      case 'passport':
        return <Passport onBack={() => navigate('map', 'back')} earnedBadgeIds={earnedBadgeIds} userXP={userXP} userLevel={userLevel} />;
      default: return null;
    }
  };

  return (
    <div style={appStyles.shell}>
      <div style={appStyles.phone}>
        <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
          <div style={slideStyle}>{renderScreen()}</div>
        </div>
        {flightSettingsOpen && (
          <FlightSettingsModal
            flightData={flightData}
            onSave={handleFlightSave}
            onCancel={() => setFlightSettingsOpen(false)}
          />
        )}
      </div>
    </div>
  );
};

// ── Quest Complete (inline lightweight screen) ────────────────────────────────
const QuestComplete = ({ quest, xpEarned, onPassport, onMap }) => {
  const badge = window.BADGES.find(b => b.id === quest?.badgeId);
  return (
    <div style={{ minHeight: '100vh', background: '#0b0d1a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', textAlign: 'center', fontFamily: "'DM Sans', sans-serif", color: '#f0f2ff' }}>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', background: `radial-gradient(ellipse at 50% 40%, ${quest?.color || '#f0bc42'}28, transparent 70%)` }} />
      <div style={{ fontSize: 64, marginBottom: 8, animation: 'float 3s ease-in-out infinite', filter: `drop-shadow(0 0 24px ${quest?.color || '#f0bc42'})` }}>🏆</div>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.15em', color: 'rgba(240,242,255,0.35)', textTransform: 'uppercase', fontFamily: "'Space Grotesk', sans-serif", marginBottom: 8 }}>Quest Complete</div>
      <h1 style={{ fontSize: 30, fontWeight: 900, margin: '0 0 8px', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}>{quest?.name}</h1>
      <p style={{ fontSize: 15, color: 'rgba(240,242,255,0.5)', margin: '0 0 32px' }}>You explored Singapore like a local.</p>
      {badge && (
        <div style={{ background: badge.color + '14', border: `2px solid ${badge.color}55`, borderRadius: 20, padding: '24px 32px', marginBottom: 24, boxShadow: `0 0 40px ${badge.color}20` }}>
          <div style={{ fontSize: 48, color: badge.color, textShadow: `0 0 20px ${badge.color}`, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 8 }}>{badge.symbol}</div>
          <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 4 }}>{badge.name}</div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: badge.color, textTransform: 'uppercase', fontFamily: "'Space Grotesk', sans-serif" }}>Badge Earned</div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
        <div style={{ background: 'rgba(240,188,66,0.1)', border: '1px solid rgba(240,188,66,0.25)', borderRadius: 12, padding: '12px 20px' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#f0bc42', fontFamily: "'Space Grotesk', sans-serif" }}>+{xpEarned}</div>
          <div style={{ fontSize: 11, color: 'rgba(240,242,255,0.4)', fontWeight: 600 }}>XP EARNED</div>
        </div>
        <div style={{ background: 'rgba(46,203,130,0.1)', border: '1px solid rgba(46,203,130,0.25)', borderRadius: 12, padding: '12px 20px' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#2ecb82', fontFamily: "'Space Grotesk', sans-serif" }}>{quest?.stops}/{quest?.stops}</div>
          <div style={{ fontSize: 11, color: 'rgba(240,242,255,0.4)', fontWeight: 600 }}>STOPS DONE</div>
        </div>
      </div>
      <button onClick={onPassport} style={{ width: '100%', padding: '15px', borderRadius: 14, marginBottom: 12, background: `linear-gradient(135deg, ${quest?.color || '#f0bc42'}, #7c4dcc)`, border: 'none', color: 'white', fontWeight: 800, fontSize: 16, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}>View My Passport ◈</button>
      <button onClick={onMap} style={{ width: '100%', padding: '13px', borderRadius: 14, background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(240,242,255,0.5)', fontWeight: 600, fontSize: 15, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}>Back to Quest Map</button>
    </div>
  );
};

const appStyles = {
  shell: { minHeight: '100vh', background: '#060810', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 0' },
  phone: { width: '100%', maxWidth: 430, minHeight: '100vh', background: '#0b0d1a', position: 'relative', display: 'flex', flexDirection: 'column', boxShadow: '0 0 80px rgba(0,0,0,0.6)', overflow: 'hidden' },
};

// Export to window
Object.assign(window, { App, LOCATION_STATES, AIRPORT_STATES, getAirportState });

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
