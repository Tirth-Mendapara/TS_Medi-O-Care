// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAo7nA2YT7W32bVvtqdkjC1KjpOcmiuwzI",
  authDomain: "codequest-shriyan0910.firebaseapp.com",
  projectId: "codequest-shriyan0910",
  storageBucket: "codequest-shriyan0910.firebasestorage.app",
  messagingSenderId: "420139894083",
  appId: "1:420139894083:web:75b67e3fcdf4ce71f49bf6",
  measurementId: "G-CVH1M63QQ5"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Global variables
let dashEmMap = null;
let myLat = null;
let myLng = null;
let currentLocationMarker = null;
let hospitalsLayer = null;
let selectedInjury = '';
let isAvailable = true;

// ========== NAVIGATION ==========
function navigate(page) {
  const pages = ['dashboard', 'blood', 'firstaid', 'about'];
  pages.forEach(p => {
    const pageElement = document.getElementById('page-' + p);
    const navItem = document.querySelector(`[data-page="${p}"]`);
    if (pageElement) {
      if (p === page) {
        pageElement.classList.add('active');
        if (navItem) navItem.classList.add('active');
      } else {
        pageElement.classList.remove('active');
        if (navItem) navItem.classList.remove('active');
      }
    }
  });
  if (page === 'dashboard') setTimeout(() => initDashMap(), 100);
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const page = item.getAttribute('data-page');
    if (page) navigate(page);
  });
});

// ========== DASHBOARD MAP ==========
function initDashMap() {
  if (dashEmMap) {
    setTimeout(() => dashEmMap.invalidateSize(), 100);
    return;
  }
  const mapElement = document.getElementById('emergencyMap');
  if (!mapElement) return;
  dashEmMap = L.map('emergencyMap').setView([28.6139, 77.2090], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(dashEmMap);
  setTimeout(() => dashEmMap.invalidateSize(), 200);
}

function locateAndShowHospitals() {
  if (!navigator.geolocation) {
    alert('Geolocation is not supported');
    return;
  }
  const btn = document.getElementById('locateMeBtn');
  if (!btn) return;
  btn.textContent = 'Getting location...';
  btn.disabled = true;
  navigator.geolocation.getCurrentPosition(
    pos => {
      myLat = pos.coords.latitude;
      myLng = pos.coords.longitude;
      const coordsBadge = document.getElementById('dashCoords');
      if (coordsBadge) {
        coordsBadge.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 1 8 8c0 5.25-8 14-8 14S4 15.25 4 10a8 8 0 0 1 8-8z"/></svg> ${myLat.toFixed(4)}, ${myLng.toFixed(4)}`;
      }
      if (currentLocationMarker && dashEmMap) dashEmMap.removeLayer(currentLocationMarker);
      if (dashEmMap) {
        currentLocationMarker = L.circleMarker([myLat, myLng], { radius: 10, color: '#fff', fillColor: '#2563eb', fillOpacity: 1, weight: 2 }).addTo(dashEmMap).bindPopup('Your Location').openPopup();
        dashEmMap.setView([myLat, myLng], 14);
      }
      findNearbyHospitals(myLat, myLng);
      btn.textContent = 'Show My Location & Nearby Hospitals';
      btn.disabled = false;
    },
    err => {
      btn.textContent = 'Show My Location & Nearby Hospitals';
      btn.disabled = false;
      alert('Could not get location: ' + err.message);
    }
  );
}

function findNearbyHospitals(lat, lng) {
  const overpassUrl = `https://overpass-api.de/api/interpreter?data=[out:json];(node["amenity"="hospital"](around:5000,${lat},${lng});node["amenity"="clinic"](around:5000,${lat},${lng}););out body;`;
  fetch(overpassUrl)
    .then(response => response.json())
    .then(data => {
      if (hospitalsLayer && dashEmMap) dashEmMap.removeLayer(hospitalsLayer);
      if (dashEmMap) hospitalsLayer = L.layerGroup().addTo(dashEmMap);
      const hospitals = [];
      data.elements.forEach(element => {
        const hospitalLat = element.lat;
        const hospitalLng = element.lon;
        const name = element.tags.name || 'Hospital';
        const distance = getDistance(lat, lng, hospitalLat, hospitalLng);
        hospitals.push({ name, lat: hospitalLat, lng: hospitalLng, distance });
        if (hospitalsLayer) {
          L.circleMarker([hospitalLat, hospitalLng], { radius: 8, color: '#fff', fillColor: '#ef4444', fillOpacity: 1, weight: 2 }).addTo(hospitalsLayer).bindPopup(`<strong>${name}</strong><br>Distance: ${distance.toFixed(1)} km<br><a href="https://www.google.com/maps/dir/${lat},${lng}/${hospitalLat},${hospitalLng}" target="_blank">Get Directions →</a>`);
        }
      });
      hospitals.sort((a, b) => a.distance - b.distance);
      displayHospitalList(hospitals.slice(0, 10));
    })
    .catch(error => {
      console.error('Error fetching hospitals:', error);
      displayHospitalList([]);
    });
}

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function displayHospitalList(hospitals) {
  const listDiv = document.getElementById('hospitalList');
  if (!listDiv) return;
  if (hospitals.length === 0) {
    listDiv.innerHTML = '<div class="hospital-item">No hospitals found nearby</div>';
    return;
  }
  listDiv.innerHTML = hospitals.map(h => `
    <div class="hospital-item">
      <div class="hospital-icon">🏥</div>
      <div class="hospital-info">
        <div class="hospital-name">${h.name}</div>
        <div class="hospital-distance">${h.distance.toFixed(1)} km away</div>
      </div>
      <button class="hospital-dir" onclick="window.open('https://www.google.com/maps/dir/${myLat},${myLng}/${h.lat},${h.lng}', '_blank')">Directions →</button>
    </div>
  `).join('');
}

// ========== SOS ==========
function triggerSOS() {
  if (confirm('SOS triggered! TS Medi-O-Care™ will alert emergency contacts. Continue?')) {
    if (myLat && myLng) {
      alert(`EMERGENCY SOS! My location: https://www.google.com/maps?q=${myLat},${myLng}`);
    } else {
      alert('SOS triggered! Please call emergency services immediately at 108');
    }
  }
}

// ========== BLOOD DONOR ==========
function toggleRegisterForm() {
  const form = document.getElementById('registerForm');
  const btn = document.getElementById('registerDonorBtn');
  if (!form || !btn) return;
  if (form.style.display === 'none' || form.style.display === '') {
    form.style.display = 'block';
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Cancel`;
  } else {
    form.style.display = 'none';
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 8v6m-3-3h6"/><circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/></svg> Register as Donor`;
  }
}

function toggleAvailable() {
  const toggle = document.getElementById('availableToggle');
  if (!toggle) return;
  isAvailable = !isAvailable;
  if (isAvailable) toggle.classList.add('active');
  else toggle.classList.remove('active');
}

function registerDonor() {
  const name = document.getElementById('donorName').value.trim();
  const blood = document.getElementById('donorBloodType').value;
  const phone = document.getElementById('donorPhone').value.trim();
  const email = document.getElementById('donorEmail').value.trim();
  if (!name || !blood || !phone || !email) {
    alert('Please fill all fields.');
    return;
  }
  const donorData = { name, blood, phone, email, available: isAvailable, timestamp: firebase.firestore.FieldValue.serverTimestamp() };
  db.collection('donors').add(donorData)
    .then(() => {
      alert('Registered successfully as a blood donor!');
      document.getElementById('donorName').value = '';
      document.getElementById('donorBloodType').value = '';
      document.getElementById('donorPhone').value = '';
      document.getElementById('donorEmail').value = '';
      toggleRegisterForm();
      loadDonors();
    })
    .catch(error => {
      console.error('Error registering donor:', error);
      alert('Error registering. Please try again.');
    });
}

function loadDonors() {
  const donorCountSpan = document.getElementById('donorCount');
  const donorListDiv = document.getElementById('donorList');
  const emptyState = document.getElementById('donorEmptyState');
  if (!donorCountSpan) return;
  donorCountSpan.textContent = 'Loading donors...';
  db.collection('donors').orderBy('timestamp', 'desc').onSnapshot(snapshot => {
    const donors = [];
    snapshot.forEach(doc => donors.push({ id: doc.id, ...doc.data() }));
    const filterSelect = document.getElementById('bloodTypeFilter');
    const filter = filterSelect ? filterSelect.value : '';
    let filteredDonors = donors;
    if (filter) filteredDonors = donors.filter(d => d.blood === filter);
    donorCountSpan.textContent = `${filteredDonors.length} donor${filteredDonors.length !== 1 ? 's' : ''} found`;
    if (filteredDonors.length === 0) {
      if (emptyState) emptyState.style.display = 'flex';
      if (donorListDiv) donorListDiv.style.display = 'none';
      return;
    }
    if (emptyState) emptyState.style.display = 'none';
    if (donorListDiv) donorListDiv.style.display = 'block';
    if (donorListDiv) {
      donorListDiv.innerHTML = filteredDonors.map(donor => `
        <div class="donor-card">
          <span style="background:#fef2f2;color:#dc2626;font-weight:700;padding:6px 12px;border-radius:8px;font-size:15px">${donor.blood}</span>
          <div>
            <div style="font-size:14px;font-weight:600">${donor.name}</div>
            <div style="font-size:12px;color:#64748b">${donor.phone} | ${donor.email}</div>
          </div>
          <span style="margin-left:auto;background:${donor.available ? '#f0fdf4' : '#fef2f2'};color:${donor.available ? '#16a34a' : '#dc2626'};font-size:11px;padding:3px 10px;border-radius:20px;font-weight:500">
            ${donor.available ? 'Available' : 'Not Available'}
          </span>
        </div>
      `).join('');
    }
  });
}

function resetBlood() {
  const filterSelect = document.getElementById('bloodTypeFilter');
  if (filterSelect) filterSelect.value = '';
  loadDonors();
}

if (document.getElementById('bloodTypeFilter')) {
  document.getElementById('bloodTypeFilter').addEventListener('change', loadDonors);
}

// ========== FIRST AID SURVEY ==========
function selectInjury(type) {
  selectedInjury = type;
  const stepInjury = document.getElementById('step-injury');
  const stepSeverity = document.getElementById('step-severity');
  const severityTitle = document.getElementById('severity-title');
  if (stepInjury) stepInjury.style.display = 'none';
  if (severityTitle) severityTitle.textContent = `How severe is the ${type}?`;
  if (stepSeverity) stepSeverity.style.display = 'block';
}

function selectSeverity(level) {
  const stepSeverity = document.getElementById('step-severity');
  const stepGuidance = document.getElementById('step-guidance');
  const guidanceBody = document.getElementById('guidance-body');
  if (stepSeverity) stepSeverity.style.display = 'none';
  if (guidanceBody) {
    const html = getGuidance(selectedInjury, level);
    guidanceBody.innerHTML = html;
  }
  if (stepGuidance) stepGuidance.style.display = 'block';
}

function getGuidance(injury, level) {
  const guidance = {
    Burn: { Mild: `<h4>🔥 Mild Burn — First Aid Steps</h4><ol><li>Cool under cool (not cold) running water for 10–20 min.</li><li>Remove jewellery/clothing near the area (unless stuck).</li><li>Cover loosely with a sterile non-stick bandage.</li><li>Take OTC pain relief if needed.</li><li>Do NOT apply butter, toothpaste or ice.</li></ol>`, Moderate: `<h4>🔥 Moderate Burn — First Aid Steps</h4><ol><li>Cool with running water for at least 20 min.</li><li>Do not break blisters.</li><li>Cover with a clean, non-fluffy material.</li><li>Seek medical attention promptly.</li><li>Monitor for signs of infection.</li></ol>`, Severe: `<h4>🔥 Severe Burn — CALL 108 IMMEDIATELY</h4><ol><li>Call emergency services (108) right away.</li><li>Do NOT remove burned clothing stuck to skin.</li><li>Cover loosely with a clean sheet or cling film.</li><li>Keep the person warm to prevent shock.</li><li>Do not give anything to eat or drink.</li></ol>` },
    Bleeding: { Mild: `<h4>🩸 Mild Bleeding — First Aid Steps</h4><ol><li>Clean hands before touching the wound.</li><li>Apply gentle pressure with a clean cloth.</li><li>Elevate the injured area if possible.</li><li>Apply a bandage once bleeding slows.</li></ol>`, Moderate: `<h4>🩸 Moderate Bleeding — First Aid Steps</h4><ol><li>Apply firm, direct pressure with a clean cloth.</li><li>Elevate the limb above heart level.</li><li>If cloth soaks through, add more — do not remove.</li><li>Seek medical attention.</li></ol>`, Severe: `<h4>🩸 Severe Bleeding — CALL 108 IMMEDIATELY</h4><ol><li>Call 108 immediately.</li><li>Apply strong, direct pressure.</li><li>Use a tourniquet if limb is involved and bleeding is life-threatening.</li><li>Keep the person lying down and calm.</li><li>Monitor breathing until help arrives.</li></ol>` },
    Fracture: { Mild: `<h4>🦴 Possible Fracture — First Aid Steps</h4><ol><li>Immobilise the injured area — do not try to straighten it.</li><li>Apply ice wrapped in cloth to reduce swelling.</li><li>Elevate the limb if possible.</li><li>Visit a doctor for an X-ray.</li></ol>`, Moderate: `<h4>🦴 Fracture — First Aid Steps</h4><ol><li>Keep the person still and calm.</li><li>Splint the injury using a rigid object and bandage.</li><li>Apply ice packs (not directly on skin).</li><li>Go to the emergency room immediately.</li></ol>`, Severe: `<h4>🦴 Severe Fracture — CALL 108 IMMEDIATELY</h4><ol><li>Call 108 immediately.</li><li>Do not move the person if spinal/neck injury is suspected.</li><li>Keep them still and warm.</li><li>Apply pressure to any open wound without pushing on the bone.</li></ol>` },
    'Head Injury': { Mild: `<h4>🧠 Mild Head Injury — First Aid Steps</h4><ol><li>Keep the person awake and still.</li><li>Apply ice to reduce swelling.</li><li>Monitor for confusion, nausea or dizziness.</li><li>Avoid pain relievers like aspirin.</li><li>Seek medical advice even if symptoms seem mild.</li></ol>`, Moderate: `<h4>🧠 Moderate Head Injury — Seek Help Now</h4><ol><li>Go to the ER immediately.</li><li>Keep the person awake if possible.</li><li>Do not give food or water.</li><li>Immobilise the neck if spinal injury is suspected.</li></ol>`, Severe: `<h4>🧠 Severe Head Injury — CALL 108 IMMEDIATELY</h4><ol><li>Call 108 immediately.</li><li>Do not move the person.</li><li>Check breathing — perform CPR if not breathing.</li><li>Control bleeding with gentle pressure.</li><li>Stay with the person until help arrives.</li></ol>` },
    'Chest Pain': { Mild: `<h4>❤️ Chest Pain — First Aid Steps</h4><ol><li>Have the person sit or lie in a comfortable position.</li><li>Loosen tight clothing around the chest.</li><li>Seek medical evaluation promptly.</li><li>Chest pain always warrants assessment.</li></ol>`, Moderate: `<h4>❤️ Chest Pain — Act Quickly</h4><ol><li>Call a doctor or go to the ER immediately.</li><li>If prescribed, take nitroglycerin as directed.</li><li>Have the person rest and stay calm.</li><li>Give aspirin (325 mg) if not allergic.</li></ol>`, Severe: `<h4>❤️ Severe Chest Pain — CALL 108 IMMEDIATELY</h4><ol><li>Call 108 right away — this may be a heart attack.</li><li>Have the person sit or lie down comfortably.</li><li>Give 325 mg aspirin if available and not allergic.</li><li>Loosen any tight clothing.</li><li>Be ready to perform CPR if the person becomes unresponsive.</li></ol>` },
    Shock: { Mild: `<h4>⚡ Early Shock — First Aid Steps</h4><ol><li>Have the person lie down and elevate legs slightly.</li><li>Keep them warm with a blanket.</li><li>Monitor breathing and pulse.</li><li>Reassure and keep calm.</li><li>Seek medical attention.</li></ol>`, Moderate: `<h4>⚡ Moderate Shock — Act Quickly</h4><ol><li>Call for medical help immediately.</li><li>Lay person flat, elevate feet 12 inches unless injury prevents it.</li><li>Do not give food or water.</li><li>Keep warm and still.</li></ol>`, Severe: `<h4>⚡ Severe Shock — CALL 108 IMMEDIATELY</h4><ol><li>Call 108 immediately.</li><li>Lay the person flat, legs elevated.</li><li>Begin CPR if unconscious and not breathing.</li><li>Do not give anything by mouth.</li><li>Stay until help arrives.</li></ol>` },
    Choking: { Mild: `<h4>⚠️ Mild Choking — First Aid Steps</h4><ol><li>Encourage the person to keep coughing.</li><li>Do not slap the back if they can cough effectively.</li><li>Monitor to ensure the object clears.</li><li>Seek help if coughing does not clear the obstruction.</li></ol>`, Moderate: `<h4>⚠️ Choking — First Aid Steps</h4><ol><li>Give up to 5 firm back blows between shoulder blades.</li><li>If unsuccessful, give up to 5 abdominal thrusts (Heimlich).</li><li>Alternate back blows and abdominal thrusts.</li><li>Call 108 if obstruction does not clear.</li></ol>`, Severe: `<h4>⚠️ Severe Choking — CALL 108 IMMEDIATELY</h4><ol><li>Call 108 immediately.</li><li>If person is unconscious, begin CPR.</li><li>Perform abdominal thrusts if conscious.</li><li>For infants: use back blows and chest thrusts only.</li></ol>` },
    Other: { Mild: `<h4>🩺 General First Aid — Mild</h4><ol><li>Keep the person calm and comfortable.</li><li>Assess the situation carefully.</li><li>Apply basic first aid for visible injuries.</li><li>Monitor symptoms and consult a doctor.</li></ol>`, Moderate: `<h4>🩺 General First Aid — Moderate</h4><ol><li>Call a doctor or go to the nearest clinic.</li><li>Describe symptoms clearly.</li><li>Do not administer medication unless prescribed.</li><li>Keep the person still and reassured.</li></ol>`, Severe: `<h4>🩺 Emergency — CALL 108 IMMEDIATELY</h4><ol><li>Call emergency services (108) right away.</li><li>Keep the person still and calm.</li><li>Monitor breathing and consciousness.</li><li>Follow dispatcher instructions until help arrives.</li></ol>` }
  };
  return guidance[injury]?.[level] || '<p>Please consult a medical professional.</p>';
}

function goBack(from) {
  const stepInjury = document.getElementById('step-injury');
  const stepSeverity = document.getElementById('step-severity');
  const stepGuidance = document.getElementById('step-guidance');
  if (from === 'severity') {
    if (stepSeverity) stepSeverity.style.display = 'none';
    if (stepInjury) stepInjury.style.display = 'block';
  } else {
    if (stepGuidance) stepGuidance.style.display = 'none';
    if (stepInjury) stepInjury.style.display = 'block';
  }
}

function switchTab(tab) {
  const surveyTab = document.getElementById('survey-tab');
  const chatTab = document.getElementById('chat-tab');
  const tabSurvey = document.getElementById('tab-survey');
  const tabChat = document.getElementById('tab-chat');
  if (surveyTab) surveyTab.style.display = tab === 'survey' ? 'block' : 'none';
  if (chatTab) chatTab.style.display = tab === 'chat' ? 'block' : 'none';
  if (tabSurvey) tabSurvey.classList.toggle('active', tab === 'survey');
  if (tabChat) tabChat.classList.toggle('active', tab === 'chat');
}

// ========== INTELLIGENT KEYWORD-BASED CHATBOT (NO API, 100% OFFLINE) ==========

// Comprehensive keyword-response database
const chatbotResponses = {
  // Cardiac / Chest
  chest: "⚠️ CHEST PAIN / HEART ATTACK:\n1. Call 108 IMMEDIATELY!\n2. Make the person sit or lie down comfortably.\n3. Loosen tight clothing around the neck and chest.\n4. If not allergic, give 325mg aspirin (chewable).\n5. Ask if they have nitroglycerin – help them take it.\n6. Stay calm and reassure them.\n7. If unconscious, check breathing and start CPR.\n\n⚠️ This is not a substitute for professional medical care.",
  
  heart: "⚠️ HEART ATTACK SIGNS:\n• Chest pain/pressure\n• Pain spreading to arm, jaw, back\n• Shortness of breath\n• Cold sweat, nausea\n\nACTION:\n1. Call 108 immediately!\n2. Have person sit or lie down\n3. Give aspirin if available (325mg, chewable)\n4. Loosen tight clothing\n5. If unconscious, start CPR\n\n⚠️ This is not a substitute for professional medical care.",
  
  // Breathing / Choking
  choking: "⚠️ CHOKING (Heimlich Maneuver):\nFor CONSCIOUS adult/child:\n1. Stand behind, wrap arms around waist.\n2. Make a fist, place above navel.\n3. Grasp fist with other hand, thrust inward and upward.\n4. Repeat until object comes out.\n\nFor INFANT (<1 year):\n1. Place face down on forearm, support head.\n2. Give 5 back blows between shoulder blades.\n3. Turn face up, give 5 chest thrusts (2 fingers).\n4. Repeat until object comes out or help arrives.\n\nIf unconscious: start CPR immediately!\nCall 108 if object doesn't clear.\n\n⚠️ This is not a substitute for professional medical care.",
  
  breath: "⚠️ BREATHING PROBLEMS / ASTHMA ATTACK:\n1. Help person sit upright.\n2. Loosen tight clothing.\n3. Use rescue inhaler if available (blue).\n4. Give 2-4 puffs every 20 minutes if severe.\n5. Encourage slow, deep breaths.\n6. Call 108 if breathing worsens or lips turn blue.\n\n⚠️ This is not a substitute for professional medical care.",
  
  asthma: "⚠️ ASTHMA ATTACK:\n1. Sit upright – never lie down.\n2. Use blue rescue inhaler (2-4 puffs).\n3. Wait 4 minutes, if no improvement take 2-4 more puffs.\n4. If still no improvement, call 108.\n5. Keep calm and breathe slowly.\n\n⚠️ This is not a substitute for professional medical care.",
  
  // Bleeding / Wounds
  bleeding: "🩸 SEVERE BLEEDING:\n1. Apply direct pressure with clean cloth.\n2. Elevate the injured area above heart.\n3. If cloth soaks through, add more – DON'T remove.\n4. Apply pressure to pressure point (armpit/groin).\n5. Use tourniquet ONLY if life-threatening bleeding from limb.\n6. Call 108 immediately!\n7. Keep person warm and calm.\n\n⚠️ This is not a substitute for professional medical care.",
  
  cut: "🔪 CUT / WOUND:\n1. Wash hands before touching wound.\n2. Apply gentle pressure with clean cloth.\n3. Rinse with clean water.\n4. Apply antiseptic.\n5. Cover with sterile bandage.\n6. Watch for signs of infection (redness, swelling, fever).\n\nSee doctor if: deep wound, won't stop bleeding, caused by animal/rusty object.\n\n⚠️ This is not a substitute for professional medical care.",
  
  wound: "🩹 WOUND CARE:\n1. Stop bleeding with pressure.\n2. Clean with saline or clean water.\n3. Remove debris with tweezers (clean).\n4. Apply antibiotic ointment.\n5. Cover with sterile bandage.\n6. Change dressing daily.\n7. Watch for infection signs.\n\n⚠️ This is not a substitute for professional medical care.",
  
  // Burns
  burn: "🔥 BURN TREATMENT:\n1. Cool under running water (not ice) for 20 minutes.\n2. Remove jewellery/clothing near burn.\n3. Cover with sterile non-stick bandage.\n4. Take pain reliever if needed.\n5. DO NOT apply butter, oil, ice, or toothpaste.\n6. DO NOT break blisters.\n\nSeek medical help if: large burn, face/hands/genitals, electrical/chemical burn.\nCall 108 for severe burns!\n\n⚠️ This is not a substitute for professional medical care.",
  
  scald: "🔥 SCALD (HOT LIQUID) BURN:\n1. Remove wet clothing immediately.\n2. Cool under running water for 20 minutes.\n3. Cover with clean, dry cloth.\n4. Seek medical help if skin blisters or is large area.\n\n⚠️ This is not a substitute for professional medical care.",
  
  // Fractures / Sprains
  fracture: "🦴 FRACTURE / BROKEN BONE:\n1. Do NOT try to straighten the bone.\n2. Immobilize the area – use splint if possible.\n3. Apply ice wrapped in cloth (20 min on, 20 off).\n4. Elevate if possible.\n5. Take pain reliever.\n6. Seek medical attention immediately.\n7. If open fracture (bone through skin), cover with clean cloth, DON'T push bone back.\n\nCall 108 if severe pain, deformity, or unable to move.\n\n⚠️ This is not a substitute for professional medical care.",
  
  sprain: "🦵 SPRAIN (Ligament injury):\nR.I.C.E. Method:\n• REST – avoid using injured area\n• ICE – apply ice pack 15-20 min every 2-3 hours\n• COMPRESS – wrap with elastic bandage (not too tight)\n• ELEVATE – raise above heart level\n\nSee doctor if: can't bear weight, severe swelling, deformity.\n\n⚠️ This is not a substitute for professional medical care.",
  
  twist: "🦶 TWISTED ANKLE:\n1. Rest – don't walk on it.\n2. Ice for 15-20 minutes.\n3. Compression with elastic bandage.\n4. Elevate above heart.\n5. Take pain reliever.\n\nSee doctor if can't bear weight or severe swelling.\n\n⚠️ This is not a substitute for professional medical care.",
  
  // Head / Concussion
  head: "🧠 HEAD INJURY / CONCUSSION:\n1. Keep person still and awake.\n2. Apply ice to reduce swelling.\n3. Watch for: confusion, vomiting, unequal pupils, seizure, loss of consciousness.\n4. If any danger signs appear – call 108 immediately!\n5. Don't give pain relievers like aspirin/ibuprofen.\n6. Don't leave person alone for 24 hours.\n\nCall 108 if: loss of consciousness, repeated vomiting, seizure, slurred speech, weakness.\n\n⚠️ This is not a substitute for professional medical care.",
  
  concussion: "🧠 CONCUSSION SYMPTOMS:\n• Headache\n• Dizziness\n• Confusion\n• Nausea\n• Blurred vision\n• Memory problems\n\nACTION: Rest, avoid screens, seek medical evaluation within 24 hours.\n\n⚠️ This is not a substitute for professional medical care.",
  
  // Shock
  shock: "⚡ SHOCK (Medical emergency):\nSIGNS: pale/cold skin, rapid pulse, shallow breathing, weakness.\n\nACTION:\n1. Call 108 immediately!\n2. Lay person flat, elevate legs 12 inches (unless head/leg injury).\n3. Loosen tight clothing.\n4. Keep warm with blanket.\n5. Don't give food or water.\n6. If vomiting, turn head to side.\n\n⚠️ This is not a substitute for professional medical care.",
  
  // Seizures / Epilepsy
  seizure: "⚠️ SEIZURE / EPILEPSY:\nDO:\n1. Clear area of dangerous objects.\n2. Cushion head with soft item.\n3. Time the seizure.\n4. Turn person on side after seizure ends.\n\nDON'T:\n1. DON'T hold person down.\n2. DON'T put anything in mouth.\n3. DON'T give food/water until fully alert.\n\nCall 108 if: seizure lasts >5 minutes, first seizure, pregnant, injured, difficulty breathing.\n\n⚠️ This is not a substitute for professional medical care.",
  
  epilepsy: "⚠️ EPILEPSY / SEIZURE:\nSame as above. Most seizures end in 2-3 minutes. Stay calm, protect from injury, roll to side after.\n\n⚠️ This is not a substitute for professional medical care.",
  
  // Stroke
  stroke: "⚠️ STROKE – ACT F.A.S.T.:\n• FACE – ask to smile (drooping?)\n• ARMS – ask to raise both (one drifting?)\n• SPEECH – ask to repeat sentence (slurred?)\n• TIME – Call 108 immediately!\n\nOther signs: sudden numbness, confusion, vision problems, severe headache, trouble walking.\n\nEvery minute counts! Call 108 immediately!\n\n⚠️ This is not a substitute for professional medical care.",
  
  // Diabetes
  diabetes: "⚠️ DIABETIC EMERGENCY (Low blood sugar):\nSIGNS: sweating, shaking, weakness, confusion.\n\nACTION (if conscious):\n1. Give fast-acting sugar: juice, soda (not diet), candy, glucose tablets.\n2. Wait 15 minutes, recheck.\n3. If no improvement, give more sugar.\n4. If unconscious, DO NOT give food/water – call 108!\n\n⚠️ This is not a substitute for professional medical care.",
  
  hypo: "⚠️ HYPOGLYCEMIA (Low blood sugar):\nSame as diabetes emergency. Give sugar immediately.\n\n⚠️ This is not a substitute for professional medical care.",
  
  // Allergies
  allergy: "⚠️ SEVERE ALLERGIC REACTION (Anaphylaxis):\nSIGNS: difficulty breathing, swollen tongue/face, hives, vomiting, dizziness.\n\nACTION:\n1. Call 108 immediately!\n2. Use epinephrine auto-injector (EpiPen) if available.\n3. Lay person flat, elevate legs.\n4. If breathing stops, start CPR.\n\n⚠️ This is not a substitute for professional medical care.",
  
  anaphylaxis: "⚠️ ANAPHYLAXIS:\nLife-threatening allergic reaction. Call 108 immediately! Use EpiPen if available.\n\n⚠️ This is not a substitute for professional medical care.",
  
  // Poisoning
  poison: "⚠️ POISONING:\n1. Call poison control (1-800-222-1222) or 108.\n2. DO NOT induce vomiting unless told.\n3. If person unconscious, turn on side, check breathing.\n4. Bring poison container to hospital.\n\n⚠️ This is not a substitute for professional medical care.",
  
  overdose: "⚠️ DRUG OVERDOSE:\n1. Call 108 immediately!\n2. Check breathing – start CPR if needed.\n3. Turn person on side to prevent choking.\n4. Don't leave them alone.\n\n⚠️ This is not a substitute for professional medical care.",
  
  // Drowning
  drowning: "⚠️ DROWNING:\n1. Call 108 immediately!\n2. Remove from water.\n3. Check breathing – start CPR if not breathing.\n4. Give 2 rescue breaths, then 30 chest compressions.\n5. Continue until help arrives.\n\n⚠️ This is not a substitute for professional medical care.",
  
  // Heat / Cold
  heatstroke: "⚠️ HEAT STROKE (Life-threatening):\nSIGNS: high body temp, hot/dry skin, rapid pulse, confusion, unconsciousness.\n\nACTION:\n1. Call 108 immediately!\n2. Move to cool area.\n3. Remove excess clothing.\n4. Cool with ice packs (neck, armpits, groin).\n5. Fan while misting with water.\n\n⚠️ This is not a substitute for professional medical care.",
  
  heat: "⚠️ HEAT EXHAUSTION:\nSIGNS: heavy sweating, weakness, nausea, headache.\n\nACTION:\n1. Move to cool area.\n2. Drink cool water.\n3. Apply cool cloths.\n4. Rest.\n\nIf symptoms worsen or last >1 hour, seek medical help.\n\n⚠️ This is not a substitute for professional medical care.",
  
  hypothermia: "❄️ HYPOTHERMIA:\nSIGNS: shivering, confusion, slurred speech, weak pulse.\n\nACTION:\n1. Call 108 if severe.\n2. Move to warm area.\n3. Remove wet clothing.\n4. Warm slowly with blankets (not direct heat).\n5. Give warm drinks (if conscious).\n\n⚠️ This is not a substitute for professional medical care.",
  
  frostbite: "❄️ FROSTBITE:\n1. Move to warm area.\n2. Soak in warm water (not hot) for 30 min.\n3. DON'T rub or use direct heat.\n4. Cover with dry, sterile gauze.\n5. Seek medical attention.\n\n⚠️ This is not a substitute for professional medical care.",
  
  // Bites
  snakebite: "🐍 SNAKE BITE:\n1. Call 108 immediately!\n2. Keep person still and calm.\n3. Remove jewellery/ tight clothing.\n4. Position bite below heart.\n5. Cover bite with clean cloth.\n\nDON'T: cut wound, suck venom, apply ice, use tourniquet.\n\n⚠️ This is not a substitute for professional medical care.",
  
  insect: "🐝 INSECT BITE/STING:\n1. Remove stinger by scraping (don't squeeze).\n2. Wash with soap and water.\n3. Apply ice pack.\n4. Take antihistamine for itching.\n\nCall 108 if signs of allergic reaction (difficulty breathing, swelling face/throat).\n\n⚠️ This is not a substitute for professional medical care.",
  
  dogbite: "🐕 DOG/ANIMAL BITE:\n1. Wash wound with soap and water for 15 minutes.\n2. Apply antibiotic ointment.\n3. Cover with sterile bandage.\n4. Seek medical attention (rabies risk).\n\n⚠️ This is not a substitute for professional medical care.",
  
  // CPR
  cpr: "🫀 CPR (Cardiopulmonary Resuscitation):\nFor UNCONSCIOUS not breathing:\n1. Call 108 immediately.\n2. Place hands on center of chest.\n3. Push hard and fast (100-120 compressions/minute).\n4. Push 2 inches deep.\n5. Allow chest to fully recoil.\n6. Give 30 compressions then 2 rescue breaths.\n7. Continue until help arrives.\n\nFor INFANT: use 2 fingers, push 1.5 inches deep.\n\n⚠️ This is not a substitute for professional medical care.",
  
  // Nosebleed
  nosebleed: "👃 NOSEBLEED:\n1. Sit upright, lean slightly forward.\n2. Pinch nostrils together for 10-15 minutes.\n3. Apply ice pack to nose bridge.\n4. Don't tilt head back.\n5. Don't blow nose for several hours.\n\nSee doctor if bleeding >30 minutes, or after head injury.\n\n⚠️ This is not a substitute for professional medical care.",
  
  // Fainting
  faint: "😵 FAINTING:\n1. Lay person flat.\n2. Elevate legs 12 inches.\n3. Loosen tight clothing.\n4. Check breathing.\n5. If unconscious >1 minute, call 108.\n\n⚠️ This is not a substitute for professional medical care.",
  
  // Pregnancy
  pregnancy: "🤰 PREGNANCY EMERGENCY:\nCall 108 immediately if:\n• Bleeding\n• Severe abdominal pain\n• Water breaks before 37 weeks\n• Seizure\n• Severe headache with vision changes\n• Decreased baby movement\n\n⚠️ This is not a substitute for professional medical care.",
  
  // General / Fallback
  default: "I'm Lifeline AI – your First Aid assistant. I can help with:\n\n• Cardiac: chest pain, heart attack\n• Breathing: choking, asthma\n• Bleeding & wounds\n• Burns & scalds\n• Fractures & sprains\n• Head injuries\n• Shock & seizures\n• Stroke & diabetes emergencies\n• Allergies & poisoning\n• Heatstroke & hypothermia\n• Bites (snake, insect, animal)\n• CPR & nosebleeds\n• Fainting & pregnancy emergencies\n\nPlease describe your emergency clearly.\n\n⚠️ This is not a substitute for professional medical care. Call 108 for emergencies!"
};

// Function to detect keywords and return appropriate response
function getChatbotResponse(message) {
  const lowerMsg = message.toLowerCase();
  
  // Check each keyword category
  if (lowerMsg.includes('chest') || lowerMsg.includes('heart') || lowerMsg.includes('cardiac') || lowerMsg.includes('heart attack')) {
    return chatbotResponses.chest;
  }
  if (lowerMsg.includes('choke') || lowerMsg.includes('choking') || lowerMsg.includes('heimlich')) {
    return chatbotResponses.choking;
  }
  if ((lowerMsg.includes('breath') || lowerMsg.includes('breathing') || lowerMsg.includes('can\'t breathe')) && !lowerMsg.includes('asthma')) {
    return chatbotResponses.breath;
  }
  if (lowerMsg.includes('asthma') || lowerMsg.includes('inhaler')) {
    return chatbotResponses.asthma;
  }
  if (lowerMsg.includes('bleed') || lowerMsg.includes('bleeding') || lowerMsg.includes('hemorrhage')) {
    return chatbotResponses.bleeding;
  }
  if (lowerMsg.includes('cut') && !lowerMsg.includes('bleed')) {
    return chatbotResponses.cut;
  }
  if (lowerMsg.includes('wound')) {
    return chatbotResponses.wound;
  }
  if (lowerMsg.includes('burn') || lowerMsg.includes('burnt')) {
    return chatbotResponses.burn;
  }
  if (lowerMsg.includes('scald')) {
    return chatbotResponses.scald;
  }
  if (lowerMsg.includes('fracture') || lowerMsg.includes('broken bone') || lowerMsg.includes('break')) {
    return chatbotResponses.fracture;
  }
  if (lowerMsg.includes('sprain') || lowerMsg.includes('ligament')) {
    return chatbotResponses.sprain;
  }
  if (lowerMsg.includes('twist') || lowerMsg.includes('twisted')) {
    return chatbotResponses.twist;
  }
  if ((lowerMsg.includes('head') && (lowerMsg.includes('injury') || lowerMsg.includes('hit') || lowerMsg.includes('bump'))) || lowerMsg.includes('concussion')) {
    return chatbotResponses.head;
  }
  if (lowerMsg.includes('shock') && !lowerMsg.includes('electric')) {
    return chatbotResponses.shock;
  }
  if (lowerMsg.includes('seizure') || lowerMsg.includes('convulsion') || lowerMsg.includes('fitting')) {
    return chatbotResponses.seizure;
  }
  if (lowerMsg.includes('epilepsy')) {
    return chatbotResponses.epilepsy;
  }
  if (lowerMsg.includes('stroke') || lowerMsg.includes('fast') || (lowerMsg.includes('face') && lowerMsg.includes('arm') && lowerMsg.includes('speech'))) {
    return chatbotResponses.stroke;
  }
  if (lowerMsg.includes('diabetes') || lowerMsg.includes('diabetic') || lowerMsg.includes('blood sugar') || lowerMsg.includes('hypo')) {
    return chatbotResponses.diabetes;
  }
  if (lowerMsg.includes('allergy') || lowerMsg.includes('allergic') || lowerMsg.includes('anaphylaxis')) {
    return chatbotResponses.allergy;
  }
  if (lowerMsg.includes('poison') || lowerMsg.includes('overdose') || lowerMsg.includes('pill')) {
    return chatbotResponses.poison;
  }
  if (lowerMsg.includes('drown') || lowerMsg.includes('drowning') || lowerMsg.includes('near drowning')) {
    return chatbotResponses.drowning;
  }
  if (lowerMsg.includes('heatstroke') || (lowerMsg.includes('heat') && lowerMsg.includes('stroke'))) {
    return chatbotResponses.heatstroke;
  }
  if (lowerMsg.includes('heat') && (lowerMsg.includes('exhaustion') || lowerMsg.includes('cramp'))) {
    return chatbotResponses.heat;
  }
  if (lowerMsg.includes('hypothermia') || (lowerMsg.includes('cold') && lowerMsg.includes('exposure'))) {
    return chatbotResponses.hypothermia;
  }
  if (lowerMsg.includes('frostbite')) {
    return chatbotResponses.frostbite;
  }
  if (lowerMsg.includes('snake') || lowerMsg.includes('snakebite')) {
    return chatbotResponses.snakebite;
  }
  if (lowerMsg.includes('insect') || lowerMsg.includes('bee') || lowerMsg.includes('wasp') || lowerMsg.includes('sting')) {
    return chatbotResponses.insect;
  }
  if (lowerMsg.includes('dog') || lowerMsg.includes('animal bite') || lowerMsg.includes('cat bite')) {
    return chatbotResponses.dogbite;
  }
  if (lowerMsg.includes('cpr') || lowerMsg.includes('compression') || lowerMsg.includes('rescue breath')) {
    return chatbotResponses.cpr;
  }
  if (lowerMsg.includes('nosebleed') || lowerMsg.includes('nose bleed')) {
    return chatbotResponses.nosebleed;
  }
  if (lowerMsg.includes('faint') || lowerMsg.includes('fainting') || lowerMsg.includes('passed out')) {
    return chatbotResponses.faint;
  }
  if (lowerMsg.includes('pregnant') || lowerMsg.includes('pregnancy')) {
    return chatbotResponses.pregnancy;
  }
  
  // If no specific keywords matched, return default
  return chatbotResponses.default;
}

// AI Chat function (keyword-based, no API)
async function sendChat() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  
  if (!msg) return;
  
  // Clear input and show user message
  input.value = '';
  appendMsg(msg, 'user');
  
  // Show typing indicator
  const typingDiv = appendTyping();
  
  // Simulate processing delay (makes it feel more natural)
  setTimeout(() => {
    // Get response based on keywords
    const response = getChatbotResponse(msg);
    
    // Remove typing indicator and show response
    if (typingDiv) typingDiv.remove();
    appendMsg(response, 'ai');
  }, 500);
}

function appendMsg(text, role) {
  const container = document.getElementById('chatMessages');
  if (!container) return;
  const div = document.createElement('div');
  div.className = `chat-msg${role === 'user' ? ' user' : ''}`;
  if (role === 'ai') {
    div.innerHTML = `<div class="msg-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v8M8 12h8"/></svg></div><div class="msg-bubble">${text.replace(/\n/g, '<br>')}</div>`;
  } else {
    div.innerHTML = `<div class="msg-bubble">${text}</div>`;
  }
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function appendTyping() {
  const container = document.getElementById('chatMessages');
  if (!container) return null;
  const div = document.createElement('div');
  div.className = 'chat-msg';
  div.innerHTML = `<div class="msg-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v8M8 12h8"/></svg></div><div class="msg-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

// ========== DARK MODE TOGGLE ==========
const darkToggleBtn = document.getElementById('darkModeToggle');
if (darkToggleBtn) {
  darkToggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('tsMediDark', document.body.classList.contains('dark'));
    darkToggleBtn.innerHTML = document.body.classList.contains('dark') ? '☀️ Light Mode' : '🌙 Dark Mode';
    if (dashEmMap) setTimeout(() => dashEmMap.invalidateSize(), 100);
  });
  if (localStorage.getItem('tsMediDark') === 'true') {
    document.body.classList.add('dark');
    darkToggleBtn.innerHTML = '☀️ Light Mode';
  }
}

// ========== INITIALIZATION ==========
window.addEventListener('DOMContentLoaded', () => {
  console.log('TS Medi-O-Care™ Started (Keyword-based AI Chatbot)');
  initDashMap();
  loadDonors();
  navigate('dashboard');
});