import { useRef, useState, useEffect } from 'react'
import './App.css'

const API = 'http://127.0.0.1:8000'
const demoVideo = '/mixkit-two-thieves-recorded-on-a-security-camera-31372-full-hd.mp4'
const MEMORY_KEY = 'nigraani_investigation_memory'

const cameras = [
  {
    name: 'Main Gate',
    id: 'CAM-01',
    status: 'LOCAL CLIP REQUIRED',
    time: 'Recorded clip',
    video: '/camera_01.mp4',
  },
  {
    name: 'Corridor',
    id: 'CAM-02',
    status: 'LOCAL CLIP REQUIRED',
    time: 'Recorded clip',
    video: '/camera_02.mp4',
  },
  {
    name: 'Parking',
    id: 'CAM-03',
    status: 'LOCAL CLIP REQUIRED',
    time: 'Recorded clip',
    video: '/camera_03.mp4',
  },
  {
    name: 'Entrance Hall',
    id: 'CAM-04',
    status: 'LOCAL CLIP REQUIRED',
    time: 'Recorded clip',
    video: '/camera_04.mp4',
  },
  {
    name: 'Reception',
    id: 'CAM-05',
    status: 'LOCAL CLIP REQUIRED',
    time: 'Recorded clip',
    video: '/camera_05.mp4',
  },
  {
    name: 'Elevator Lobby',
    id: 'CAM-06',
    status: 'LOCAL CLIP REQUIRED',
    time: 'Recorded clip',
    video: '/camera_06.mp4',
  },
  {
    name: 'Back Exit',
    id: 'CAM-07',
    status: 'LOCAL CLIP REQUIRED',
    time: 'Recorded clip',
    video: '/camera_07.mp4',
  },
]

function App() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchMessage, setSearchMessage] = useState('')
  
  const [clarifyLocation, setClarifyLocation] = useState(null)
  
  const [memory, setMemory] = useState(() => {
    const saved = localStorage.getItem(MEMORY_KEY)
    return saved ? JSON.parse(saved) : { locations: {}, target: '' }
  })

  const [countRows, setCountRows] = useState([])
  const [auditOpen, setAuditOpen] = useState(false)
  const [auditRows, setAuditRows] = useState([])
  const [integrity, setIntegrity] = useState({})
  const [videoSource, setVideoSource] = useState(demoVideo)
  const [pendingSeek, setPendingSeek] = useState(null)
  const [isInvestigationMode, setIsInvestigationMode] = useState(false)
  const [showResearch, setShowResearch] = useState(false)
  const [showAlertModal, setShowAlertModal] = useState(false)
  const [activeAlert, setActiveAlert] = useState(null)
  const [alertForm, setAlertForm] = useState({ object_label: 'person', location: '', time_after: '20:00', description: '' })
  
  const videoRef = useRef(null)

  useEffect(() => {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(memory))
  }, [memory])

  useEffect(() => {
    const pollAlerts = async () => {
      try {
        const response = await fetch(`${API}/api/check_alerts`)
        const data = await response.json()
        if (data && data.length > 0) {
          setActiveAlert(data[0])
          setShowAlertModal(true)
        }
      } catch (e) { /* silent fail */ }
    }
    const interval = setInterval(pollAlerts, 10000)
    return () => clearInterval(interval)
  }, [])

  async function searchFootage(searchText = query, fromClarification = false) {
    let cleaned = searchText.trim()
    if (!cleaned) return

    const q = cleaned.toLowerCase()
    const potentialLocations = ['main gate', 'corridor', 'parking', 'entrance', 'exit']
    const foundLocation = potentialLocations.find(loc => q.includes(loc))
    
    if (foundLocation) {
      const locationName = foundLocation.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
      if (!memory.locations[locationName]) {
        setClarifyLocation({ location: locationName })
        setSearchMessage(`I need one clarification: Which camera represents the ${locationName}?`)
        setResults([])
        return
      }
    }

    const countQuestion = /how many|people involved|number of people|எத்தனை பேர்|எத்தனை நபர்|कितने लोग|कितने व्यक्ति|kitne log|ethanai per/i.test(cleaned)
    const hasVisualClue = /red|blue|green|black|white|yellow|சிவப்பு|நீலம்|பச்சை|கருப்பு|வெள்ளை|लाल|नीला|हरा|काला|सफेद|சுமைபை|backpack|bag|பை|बैഗ|sivappu|neelam|karuppu|laal|neela|kala/i.test(cleaned)
    const asksForPerson = /person|people|man|woman|guy|girl|நபர்|ஆள்|பேர்|व्यक्ति|आदमी|लोग|aadmi|aalu|ponnu/i.test(cleaned)
    const refersToPriorSubject = /that person|same person|where next|where did .* go|where are they|them|he|she|அவர்|அவள்|वह|उस व्यक्ति/i.test(cleaned)
    
        if (refersToPriorSubject && memory.target && !hasVisualClue) cleaned = `${cleaned} ${memory.target}`
    
    setQuery(cleaned)
    setSearching(true)
    setSearchMessage('Searching the indexed moments…')
    setResults([])
    setCountRows([])
    try {
      const response = await fetch(`${API}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: cleaned }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Search could not be completed.')
      setResults(data.results || [])
      setCountRows(data.per_second_counts || [])
      const message = data.answer
        ? `${data.answer}. ${data.message || ''}`
        : data.message || `${data.results.length} indexed moment${data.results.length === 1 ? '' : 's'} found. Review each clip before drawing a conclusion.`
      setSearchMessage(message)
    } catch (error) {
      setSearchMessage('Search service is not running or footage has not been indexed yet. Start the API and index the video, then search again.')
    } finally {
      setSearching(false)
    }
  }

  function runSearch(event) {
    event.preventDefault()
    searchFootage()
  }

  function tryDemo() {
    const demoQuery = 'Find the person in a red shirt'
    setQuery(demoQuery)
    searchFootage(demoQuery)
  }

  function mapLocation(camId) {
    if (!clarifyLocation) return
    setMemory(prev => ({
      ...prev,
      locations: { ...prev.locations, [clarifyLocation.location]: camId }
    }))
    setClarifyLocation(null)
    searchFootage(query, true)
  }

  async function createAlert() {
    try {
      const response = await fetch(`${API}/api/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alertForm),
      })
      if (response.ok) {
        alert('Alert created successfully!')
        setAlertForm({ object_label: 'person', location: '', time_after: '20:00', description: '' })
      }
    } catch (e) {
      alert('Failed to create alert.')
    }
  }

  function clearCaseMemory() {
    setMemory({ locations: {}, target: '' })
    setSearchMessage('Started a new investigation. Memory cleared.')
  }

  function reviewMoment(item) {
    setVideoSource(`${API}${item.video_url}`)
    setPendingSeek(item.seconds)
    document.querySelector('.camera-grid')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function seekAndPlay() {
    if (pendingSeek === null || !videoRef.current) return
    videoRef.current.currentTime = pendingSeek
    videoRef.current.play().catch(() => {})
    setPendingSeek(null)
  }

  async function verifyEvidence(id) {
    setIntegrity((old) => ({ ...old, [id]: 'Checking…' }))
    try {
      const response = await fetch(`${API}/api/integrity/${id}`)
      const data = await response.json()
      setIntegrity((old) => ({ ...old, [id]: data.evidence_hash_matches ? 'Hash matches indexed evidence' : 'Hash mismatch — review required' }))
    } catch {
      setIntegrity((old) => ({ ...old, [id]: 'Integrity service unavailable' }))
    }
  }

  async function toggleAudit() {
    const next = !auditOpen
    setAuditOpen(next)
    if (!next) return
    try {
      const response = await fetch(`${API}/api/audit`)
      setAuditRows(await response.json())
    } catch {
      setAuditRows([])
    }
  }

  const lastSeen = results.length > 0 ? results[results.length - 1] : null;
  const movementPath = results.map(r => r.camera).filter((v, i, a) => a.indexOf(v) === i).join(' → ');

  return (
    <main className="app-shell">
      {showAlertModal && activeAlert && (
        <div className="alert-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div className="alert-card" style={{ background: '#1a1a1a', border: '2px solid #ff9800', borderRadius: '12px', padding: '30px', maxWidth: '500px', width: '100%', color: '#fff', textAlign: 'center', boxShadow: '0 0 50px rgba(255, 152, 0, 0.3)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '10px' }}>🟠</div>
            <h2 style={{ color: '#ff9800', marginBottom: '10px', letterSpacing: '1px' }}>ALERT TRIGGERED</h2>
            <div style={{ fontSize: '1.2rem', marginBottom: '20px' }}>
              <strong>{activeAlert.camera_id}</strong> · {activeAlert.camera}<br />
              {activeAlert.time}
            </div>
            <p style={{ opacity: 0.8, marginBottom: '30px', fontStyle: 'italic' }}>"{activeAlert.description}"</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button className="review-button" onClick={() => { setVideoSource(activeAlert.video_url); setPendingSeek(activeAlert.seconds); setShowAlertModal(false); }} style={{ background: '#ff9800', color: '#000', fontWeight: 'bold' }}>REVIEW FOOTAGE ▶</button>
              <button className="review-button" onClick={() => setShowAlertModal(false)} style={{ background: 'transparent', color: '#fff' }}>DISMISS</button>
            </div>
          </div>
        </div>
      )}

      <header className="topbar">
        <div className="brand-mark">N</div>
        <div><strong>NIGAAANI <span>AI</span></strong><small>VIDEO INVESTIGATION DESK</small></div>
        <div className="top-status"><i /> LOCAL DEMO</div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <span className="language" title="The interface is currently English; search supports a limited set of Tamil and Hindi keywords">TAMIL / HINDI KEYWORD SEARCH</span>
          <button className="review-button" onClick={() => setShowResearch(true)} style={{ padding: '4px 10px', fontSize: '0.7rem', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}>RESEARCH</button>
        </div>
      </header>

      {showResearch ? (
        <section className="research-view" style={{ padding: '40px', maxWidth: '900px', margin: '0 auto', color: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px', marginBottom: '32px' }}>
            <div>
              <p className="eyebrow">IMPLEMENTATION NOTES</p>
              <h1 style={{ fontSize: '2.2rem' }}>Prototype Capabilities & Validation</h1>
              <p style={{ maxWidth: '680px', lineHeight: '1.7', color: '#b6b6c2' }}>
                This page separates code-backed prototype capabilities from work that has not yet been implemented or validated. No benchmark accuracy claims are published here.
              </p>
            </div>
            <button className="review-button" onClick={() => setShowResearch(false)} style={{ padding: '8px 20px' }}>BACK TO DASHBOARD</button>
          </div>
          <div className="research-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '28px' }}>
            <div className="research-card" style={{ background: 'rgba(76, 175, 80, 0.08)', padding: '26px', borderRadius: '12px', border: '1px solid rgba(76, 175, 80, 0.25)' }}>
              <h3 style={{ color: '#7cd992', marginBottom: '16px', fontSize: '1rem', letterSpacing: '1px' }}>IMPLEMENTED IN THIS PROTOTYPE</h3>
              <ul style={{ paddingLeft: '22px', lineHeight: '1.85', color: '#e1e1e9' }}>
                <li>YOLO-based object detection and within-clip tracking during video indexing.</li>
                <li>CLIP text-to-frame similarity search over indexed evidence frames.</li>
                <li>Approximate clothing-colour cues from image pixels.</li>
                <li>SQLite event records, simple alert filters, and a local activity log.</li>
                <li>SHA-256 checks for detecting changes to saved evidence images.</li>
              </ul>
            </div>
            <div className="research-card" style={{ background: 'rgba(255, 152, 0, 0.06)', padding: '26px', borderRadius: '12px', border: '1px solid rgba(255, 152, 0, 0.25)' }}>
              <h3 style={{ color: '#ffbd69', marginBottom: '16px', fontSize: '1rem', letterSpacing: '1px' }}>NOT YET ESTABLISHED</h3>
              <ul style={{ paddingLeft: '22px', lineHeight: '1.85', color: '#e1e1e9' }}>
                <li>Identity matching or verified movement paths across independent cameras.</li>
                <li>Synchronization of clips to a shared real-world clock.</li>
                <li>Calibrated confidence probabilities or validated benchmark accuracy.</li>
                <li>General-purpose Tamil/Hindi translation or speech understanding.</li>
                <li>Production authentication, encryption, or forensic chain-of-custody controls.</li>
              </ul>
            </div>
          </div>
          <div className="benchmark-section" style={{ background: 'rgba(255,255,255,0.04)', padding: '26px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ marginBottom: '12px', fontSize: '1.2rem' }}>How to interpret a match</h3>
            <p style={{ lineHeight: '1.8', color: '#c4c4ce' }}>
              The displayed score is based on CLIP cosine similarity between the text query and an indexed frame. It is a retrieval-ranking signal—not the probability that a match is correct, the identity of a person, or the likelihood of wrongdoing. Review source footage and context before recording a finding.
            </p>
            <p style={{ lineHeight: '1.8', color: '#9b9ba9', marginBottom: 0 }}>
              Formal evaluation should be added only after defining a documented dataset, ground-truth labels, an evaluation protocol, and reproducible metrics.
            </p>
          </div>
        </section>
      ) : isInvestigationMode ? (
        <section className="investigation-mode" style={{ 
          padding: '40px', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          gap: '30px' 
        }}>
          <div className="investigation-header" style={{ 
            width: '100%', 
            maxWidth: '600px', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '20px'
          }}>
            <h2 style={{ fontSize: '1.5rem', letterSpacing: '1px' }}>🔎 INVESTIGATION #024</h2>
            <button className="review-button" onClick={() => setIsInvestigationMode(false)} style={{ padding: '5px 15px', fontSize: '0.8rem' }}>
              EXIT MODE
            </button>
          </div>

          <div className="investigation-summary" style={{ 
            width: '100%', 
            maxWidth: '600px', 
            background: 'rgba(255,255,255,0.05)', 
            border: '1px solid rgba(255,255,255,0.1)', 
            borderRadius: '12px', 
            padding: '30px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            fontFamily: 'monospace'
          }}>
            <div className="summary-group" style={{ marginBottom: '25px' }}>
              <div className="summary-label" style={{ color: '#aaa', fontSize: '0.8rem', marginBottom: '5px' }}>TARGET</div>
              <div className="summary-value" style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#fff' }}>{memory.target || 'Unknown Subject'}</div>
            </div>

            <div className="summary-group" style={{ marginBottom: '25px' }}>
              <div className="summary-label" style={{ color: '#aaa', fontSize: '0.8rem', marginBottom: '5px' }}>LAST SEEN</div>
              <div className="summary-value" style={{ fontSize: '1.2rem', color: '#fff' }}>
                {lastSeen ? `${lastSeen.camera_id} · ${lastSeen.camera} · ${lastSeen.time}` : 'No sightings yet'}
              </div>
            </div>

            <div className="summary-group" style={{ marginBottom: '25px' }}>
              <div className="summary-label" style={{ color: '#aaa', fontSize: '0.8rem', marginBottom: '5px' }}>MOVEMENT</div>
              <div className="summary-value" style={{ fontSize: '1.2rem', color: '#4caf50', fontWeight: 'bold' }}>
                {movementPath || 'No sequence detected'}
              </div>
            </div>

            <div className="summary-group" style={{ marginBottom: '30px', display: 'flex', gap: '40px' }}>
              <div style={{ flex: 1 }}>
                <div className="summary-label" style={{ color: '#aaa', fontSize: '0.8rem', marginBottom: '5px' }}>EVIDENCE</div>
                <div className="summary-value" style={{ fontSize: '1.1rem', color: '#fff' }}>
                  {results.length} verified frames<br />
                  {results.length} source clips
                </div>
              </div>
            </div>

            <button className="review-button" style={{ width: '100%', padding: '15px', fontSize: '1.1rem', fontWeight: 'bold', background: '#4caf50', color: '#000' }}>
              EXPORT INVESTIGATION 📄
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="intro">
            <div className="intro-main" style={{ display: 'flex', justifyContent: 'space-between', gap: '40px', alignItems: 'flex-start' }}>
              <div className="intro-left" style={{ flex: 1 }}>
                <p className="eyebrow">MULTI-CAMERA VIDEO INVESTIGATION</p>
                <h1>Find the moment.<br /><span>Review the evidence.</span></h1>
                <p className="subtext">Search indexed footage. Inspect the camera, timestamp, and frame before making a decision.</p>
                <button 
                  className="review-button" 
                  style={{ marginTop: '20px', padding: '12px 24px', fontWeight: 'bold', fontSize: '1rem' }}
                  onClick={() => setIsInvestigationMode(true)}
                >
                  START INVESTIGATION ↗
                </button>
              </div>
              <div className="intro-right" style={{ width: '320px' }}>
                <div className="case-card">
                  <div className="case-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <small>ACTIVE INVESTIGATION</small>
                    <strong style={{ fontSize: '1.1rem' }}>CASE · 024</strong>
                  </div>
                  <div className="case-status" style={{ marginBottom: '20px', opacity: 0.8, fontSize: '0.9rem' }}>
                    <span className="status-dot" style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#4caf50', marginRight: '8px' }}></span>
                    3 recordings loaded · multi-camera active
                  </div>
                  
                  <div className="memory-section" style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '20px' }}>
                    <div className="memory-title" style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#aaa', marginBottom: '10px', letterSpacing: '1px' }}>🧠 INVESTIGATION MEMORY</div>
                    <div className="memory-grid" style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '15px' }}>
                      {Object.entries(memory.locations).length === 0 && !memory.target && <div className="memory-empty" style={{ fontSize: '0.8rem', opacity: 0.5, fontStyle: 'italic' }}>No persistent mappings yet</div>}
                      {Object.entries(memory.locations).map(([loc, cam]) => (
                        <div key={loc} className="memory-item" style={{ fontSize: '0.85rem', color: '#eee', display: 'flex', justifyContent: 'space-between' }}>
                          <span>{loc}</span>
                          <span style={{ color: '#4caf50', fontWeight: 'bold' }}>{cam}</span>
                        </div>
                      ))}
                      {memory.target && <div className="memory-item target" style={{ fontSize: '0.85rem', color: '#eee', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Target</span>
                        <span style={{ color: '#4caf50', fontWeight: 'bold' }}>{memory.target}</span>
                      </div>}
                    </div>
                    <div className="memory-footer" style={{ fontSize: '0.7rem', textAlign: 'right', opacity: 0.6 }}>
                      Memory status: <span style={{ color: '#4caf50', fontWeight: 'bold' }}>PERSISTED</span>
                    </div>
                  </div>
                  <button className="clear-memory" onClick={clearCaseMemory}>Start new investigation</button>
                </div>
              </div>
            </div>
          </section>

          <section className="search-panel">
            <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
              <div style={{ flex: 1 }}>
                <form onSubmit={runSearch}>
                  <label htmlFor="query">SEARCH THE VIDEO INDEX</label>
                  <div className="search-row">
                    <span className="search-icon">⌕</span>
                    <input id="query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try: Find the person in a red shirt" />
                    <button type="submit" disabled={searching}>{searching ? 'Searching…' : 'Search footage'} <span>→</span></button>
                  </div>
                </form>
                <button className="demo-link" type="button" onClick={tryDemo}>▶ &nbsp;Try sample query</button>
                <p className="language-hint">Search vocabulary includes selected English, Tamil, Hindi, and Romanized colour/person terms.</p>
                {searchMessage && <p className="search-message" role="status">{searchMessage}</p>}
                
                
                {clarifyLocation && <div className="clarify-box">
                  <strong>Which camera represents the {clarifyLocation.location}?</strong>
                  <div className="clue-options">
                    {cameras.map(cam => <button key={cam.id} onClick={() => mapLocation(cam.id)}>{cam.id}</button>)}
                  </div>
                </div>}

                {countRows.length > 0 && (
                  <div className="second-counts">
                    <strong>People detected by elapsed second</strong>
                    {countRows.map((row, index) => (
                      <span key={`${row.video_name}-${row.time}-${index}`}>
                        {row.time} · {row.people} tracked
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="alert-creation-panel" style={{ width: '300px', background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="alert-title" style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '15px', color: '#ff9800' }}>🔔 CREATE STANDING ALERT</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: '#aaa', display: 'block', marginBottom: '4px' }}>OBJECT</label>
                    <select 
                      style={{ width: '100%', background: '#000', color: '#fff', border: '1px solid #444', padding: '5px', borderRadius: '4px' }}
                      value={alertForm.object_label} 
                      onChange={e => setAlertForm({...alertForm, object_label: e.target.value})}
                    >
                      <option value="person">Person</option>
                      <option value="car">Car</option>
                      <option value="bag">Bag</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: '#aaa', display: 'block', marginBottom: '4px' }}>LOCATION (OPTIONAL)</label>
                    <input 
                      style={{ width: '100%', background: '#000', color: '#fff', border: '1px solid #444', padding: '5px', borderRadius: '4px' }}
                      value={alertForm.location} 
                      onChange={e => setAlertForm({...alertForm, location: e.target.value})} 
                      placeholder="e.g. Parking"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: '#aaa', display: 'block', marginBottom: '4px' }}>TIME AFTER (HH:MM)</label>
                    <input 
                      style={{ width: '100%', background: '#000', color: '#fff', border: '1px solid #444', padding: '5px', borderRadius: '4px' }}
                      type="time" 
                      value={alertForm.time_after} 
                      onChange={e => setAlertForm({...alertForm, time_after: e.target.value})} 
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: '#aaa', display: 'block', marginBottom: '4px' }}>ALERT DESCRIPTION</label>
                    <textarea 
                      style={{ width: '100%', background: '#000', color: '#fff', border: '1px solid #444', padding: '5px', borderRadius: '4px', resize: 'none' }}
                      value={alertForm.description} 
                      onChange={e => setAlertForm({...alertForm, description: e.target.value})} 
                      placeholder="Person enters restricted zone..."
                      rows={2}
                    />
                  </div>
                  <button className="review-button" onClick={createAlert} style={{ background: '#ff9800', color: '#000', fontWeight: 'bold' }}>
                    CREATE ALERT 🔔
                  </button>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      <section className="section-heading">
        <div><p className="eyebrow">RECORDED FOOTAGE</p><h2>Camera feeds</h2></div>
        <span className="muted">LOCAL PROTOTYPE</span>
      </section>

      <section className="camera-grid">
        {cameras.map((camera, index) => (
          <article className="camera-card" key={camera.id}>
            <div className={`camera-view view-${index + 1}`}>
              {camera.video && <video ref={videoRef} className="camera-video" src={videoSource === demoVideo ? camera.video : videoSource} controls muted playsInline onLoadedMetadata={seekAndPlay} />}
              <span className="rec"><i /> FILE</span>
              <span className="camera-number">{camera.id}</span>
              {!camera.video && <span className="no-footage">Add a recording to this camera</span>}
            </div>
            <div className="camera-info"><div><strong>{camera.name}</strong><small>{camera.id} · {camera.time}</small></div><span className={camera.video ? 'online' : 'offline'}>{camera.status}</span></div>
          </article>
        ))}
      </section>

      {results.length > 0 && (
        <section className="results">
          <div className="section-heading">
            <div><p className="eyebrow">RETRIEVAL RESULTS</p><h2>Candidate Frame Matches</h2></div>
            <span className="match-count">{results.length} candidate matches</span>
          </div>
          <p className="review-caution">Sorted by CLIP similarity score. Timestamps are elapsed within each file; this prototype does not infer identity or verify a cross-camera journey.</p>
          <div className="journey-map">
            {results.map((item, index) => (
              <div key={item.id} className="journey-step">
                <div className="journey-node">
                  <div className="node-time">{item.time}</div>
                  <div className="node-location">{item.camera}</div>
                </div>
                <article className="event-card">
                  <div className="event-marker">{String(index + 1).padStart(2, '0')}</div>
                  <img className="evidence-thumb" src={`${API}${item.evidence_url}`} alt={`Evidence frame from ${item.camera} at ${item.time}`} />
                  <div className="event-main">
                    <div className="grounding-header">
                      <span className="camera-tag">{item.camera_id}</span>
                      <span className="location-tag">{item.camera}</span>
                      <span className="time-tag">{item.time}</span>
                    </div>
                    
                    {item.similarity_score >= 70 ? (
                      <div className="match-details high-conf">
                        <div className="reason-title">WHY THIS MATCHED</div>
                        <div className="grounding-reasons">
                          {item.reasons && item.reasons.map((reason, rIdx) => (
                            <div key={rIdx} className="reason-item">✓ {reason}</div>
                          ))}
                        </div>
                        

                        <div className="confidence-box">
                          <small>CLIP SIMILARITY SCORE</small>
                          <strong className="conf-high">{item.similarity_score}%</strong>
                        </div>
                      </div>
                    ) : (
                      <div className="match-details low-conf">
                        <div className="warning-title">⚠ LOWER SIMILARITY — REVIEW</div>
                        <div className="low-conf-info">
                          <strong>{item.camera_id}</strong>
                          <strong className="conf-low">{item.similarity_score}%</strong>
                        </div>
                        <div className="grounding-reasons">
                          {item.reasons && item.reasons.map((reason, rIdx) => (
                            <div key={rIdx} className="reason-item warn">! {reason}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="event-actions">
                    <button className="review-button" onClick={() => reviewMoment(item)}>
                      {item.similarity_score >= 70 ? 'EVIDENCE CLIP ▶' : 'REVIEW MANUALLY'}
                    </button>
                    <button className="verify-button" onClick={() => verifyEvidence(item.id)}>Verify frame hash</button>
                    {integrity[item.id] && <small className="integrity-status">{integrity[item.id]}</small>}
                  </div>
                </article>
                {index < results.length - 1 && <div className="journey-connector">↓</div>}
              </div>
            ))}
          </div>
          <div className="responsible-ai-banner">
            <strong>Disclaimer:</strong> A high CLIP similarity score is not proof of identity, wrongdoing, or a calibrated probability. Review the original footage and context before recording any finding.
          </div>
        </section>
      )}

      <section className="security-panel">
        <div><p className="eyebrow">EVIDENCE HANDLING</p><h2>Integrity & activity</h2><p>Indexed evidence frames receive SHA-256 hashes. Searches and integrity checks are recorded in a local audit log.</p><small>Prototype safeguard: this does not encrypt files or replace authenticated, access-controlled evidence storage.</small></div>
        <button className="review-button" onClick={toggleAudit}>{auditOpen ? 'Hide activity' : 'View activity log'}</button>
      </section>
      {auditOpen && <section className="audit-list">{auditRows.length ? auditRows.map((row, index) => <div className="audit-row" key={`${row.happened_at}-${index}`}><span>{new Date(row.happened_at).toLocaleString()}</span><strong>{row.action}</strong><span>{row.query_text || '—'}</span><span>{row.result_count} result(s)</span></div>) : <p>No audit entries yet, or the local API is unavailable.</p>}</section>}

      <footer>ASK IN YOUR LANGUAGE <span className="sep">·</span> REVIEW THE SOURCE VIDEO <span className="sep">·</span> LOCAL DEMO DATA</footer>
    </main>
  )
}

export default App
