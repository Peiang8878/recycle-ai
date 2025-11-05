let net;
const els = {
  file: document.getElementById('fileInput'),
  cameraBtn: document.getElementById('cameraBtn'),
  stopCameraBtn: document.getElementById('stopCameraBtn'),
  img: document.getElementById('previewImg'),
  video: document.getElementById('video'),
  canvas: document.getElementById('canvas'),
  results: document.getElementById('results'),
  pill: document.getElementById('decisionPill'),
  topk: document.getElementById('topk'),
  hint: document.getElementById('hint'),
  stats: document.getElementById('stats'),
  regionSelect: document.getElementById('regionSelect'),
  themeToggle: document.getElementById('themeToggle'),
  findRecycling: document.getElementById('findRecycling')
};

// Region-specific recycling rules
const recyclingRules = {
  'default': { note: 'General guidelines - check local rules' },
  'US-CA': { note: 'California: Most plastics #1-7, all glass & metal', extra: ['pizza box (clean)', 'cartons'] },
  'US-NY': { note: 'New York: Plastics #1-7, no plastic bags', notAllowed: ['plastic bags', 'styrofoam'] },
  'US-TX': { note: 'Texas: Varies by city - check locally', extra: ['cardboard', 'metal cans'] },
  'EU': { note: 'EU: Strict sorting, most packaging recyclable', extra: ['tetra packs', 'all glass'] }
};

let currentRegion = localStorage.getItem('recycleRegion') || 'default';
let stats = JSON.parse(localStorage.getItem('recycleStats') || '{"total":0,"recycled":0,"trash":0}');

const recyclableKeywords = [
  // Glass
  'bottle', 'water bottle', 'wine bottle', 'beer bottle', 'glass bottle', 'soda bottle', 'jar', 'glass jar', 'glass container',
  'beer bottle', 'liquor bottle', 'juice bottle', 'mason jar',
  // Metal
  'can', 'soda can', 'pop can', 'beer can', 'tin', 'tin can', 'aluminium', 'aluminum', 'aluminum can', 'steel', 'metal can',
  'soup can', 'food can', 'aluminum foil', 'metal lid', 'bottle cap', 'steel can', 'metal container',
  // Paper & Cardboard
  'paper', 'newspaper', 'magazine', 'cardboard', 'cardboard box', 'carton', 'paper bag', 'mail', 'envelope',
  'cereal box', 'pizza box', 'shipping box', 'corrugated', 'paperboard', 'office paper', 'notebook',
  'milk carton', 'juice carton', 'egg carton', 'shoe box', 'tissue box',
  // Plastic (common recyclable types)
  'plastic bottle', 'water jug', 'milk jug', 'detergent bottle', 'shampoo bottle', 'conditioner bottle',
  'plastic container', 'yogurt container', 'butter tub', 'storage container', 'tupperware',
  'soda bottle', 'juice bottle', 'cleaning bottle'
];
const likelyTrashKeywords = [
  // Food & organic waste
  'banana', 'peel', 'apple', 'orange', 'pizza', 'burger', 'hotdog', 'sandwich', 'food', 'leftover',
  'meat', 'chicken', 'fish', 'egg', 'eggshell', 'bread', 'fruit', 'vegetable', 'french fries', 'taco',
  'salad', 'pasta', 'rice', 'noodles', 'cake', 'cookie', 'donut', 'bagel',
  // Non-recyclable plastics & materials
  'plastic bag', 'grocery bag', 'shopping bag', 'styrofoam', 'polystyrene', 'foam', 'bubble wrap',
  'chip bag', 'candy wrapper', 'straw', 'plastic wrap', 'cellophane', 'plastic cutlery', 'plastic fork',
  'plastic knife', 'plastic spoon', 'foam container', 'takeout container', 'to-go container',
  // Paper products (contaminated/non-recyclable)
  'tissue', 'napkin', 'paper towel', 'paper plate', 'paper cup', 'coffee cup', 'disposable',
  'used napkin', 'paper napkin', 'kleenex', 'toilet paper',
  // Other trash
  'diaper', 'cigarette', 'cigarette butt', 'wrapper', 'trash', 'garbage', 'waste',
  'dirty', 'soiled', 'greasy', 'contaminated', 'gum', 'chewing gum', 'receipt'
];

function keywordMatch(preds, keywords) {
  const q = keywords.map(k => k.toLowerCase());
  return preds.find(p => q.some(k => p.className.toLowerCase().includes(k)));
}

function decide(preds) {
  const hitRecyclable = keywordMatch(preds, recyclableKeywords);
  const hitTrash = keywordMatch(preds, likelyTrashKeywords);
  
  // Update stats
  stats.total++;
  
  if (hitRecyclable && (!hitTrash || hitRecyclable.probability >= hitTrash.probability * 1.2)) {
    stats.recycled++;
    localStorage.setItem('recycleStats', JSON.stringify(stats));
    if ('vibrate' in navigator) navigator.vibrate(50); // Haptic feedback
    return { decision: 'Recyclable', kind: 'ok', match: hitRecyclable, confidence: hitRecyclable.probability };
  }
  stats.trash++;
  localStorage.setItem('recycleStats', JSON.stringify(stats));
  if ('vibrate' in navigator) navigator.vibrate([30, 50, 30]); // Different pattern
  return { decision: 'Trash', kind: 'bad', match: hitTrash || preds[0], confidence: (hitTrash || preds[0]).probability };
}

function displayLabel(decision) {
  return decision === 'Recyclable' ? 'Throw it in: Recycle' : 'Throw it in: Trash';
}

function prettyClassName(name) {
  const first = name.split(',')[0].trim();
  const trimmed = first.length > 28 ? first.slice(0, 25) + '…' : first;
  return trimmed;
}

async function loadModel() {
  els.pill.textContent = 'Loading model…';
  els.results.hidden = false;
  net = await mobilenet.load({ version: 2, alpha: 1.0, modelUrl: './vendor/mobilenet/model.json' });
  els.pill.textContent = 'Ready';
}

async function classifySource(srcEl) {
  if (!net) await loadModel();
  const preds = await net.classify(srcEl, 5);
  const result = decide(preds);
  els.pill.textContent = displayLabel(result.decision);
  els.pill.className = `pill ${result.kind}`;
  els.topk.innerHTML = preds.map(p => `${(p.probability*100).toFixed(1)}% · ${prettyClassName(p.className)}`).join('<br/>');
  
  // Show confidence score
  const confidence = (result.confidence * 100).toFixed(0);
  const regionInfo = recyclingRules[currentRegion];
  els.hint.innerHTML = `
    <strong>${confidence}% confident</strong><br>
    ${result.decision === 'Recyclable' 
      ? 'Rinse if dirty. Check local rules for caps and labels.' 
      : 'Likely landfill. If it is a clean bottle/can/jar/box, it might be recyclable.'}
    <br><small>${regionInfo.note}</small>
  `;
  
  // Update stats display
  updateStatsDisplay();
  els.results.hidden = false;
}

function useImage(file) {
  const url = URL.createObjectURL(file);
  els.img.onload = async () => {
    URL.revokeObjectURL(url);
    await classifySource(els.img);
  };
  els.img.src = url;
  els.img.hidden = false;
  els.video.hidden = true;
}

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    els.video.srcObject = stream;
    await els.video.play();
    els.video.hidden = false;
    els.img.hidden = true;
    els.stopCameraBtn.hidden = false;
    els.cameraBtn.disabled = true;
    loopClassifyVideo();
  } catch (e) {
    alert('Camera access failed. You can still upload a photo.');
    console.error(e);
  }
}

function stopCamera() {
  const stream = els.video.srcObject;
  if (stream) {
    for (const t of stream.getTracks()) t.stop();
  }
  els.video.srcObject = null;
  els.video.hidden = true;
  els.stopCameraBtn.hidden = true;
  els.cameraBtn.disabled = false;
}

async function loopClassifyVideo() {
  if (!net) await loadModel();
  let running = true;
  const tick = async () => {
    if (els.video.hidden || !els.video.srcObject) { running = false; return; }
    try {
      const preds = await net.classify(els.video, 5);
      const result = decide(preds);
      els.pill.textContent = displayLabel(result.decision);
      els.pill.className = `pill ${result.kind}`;
      els.topk.innerHTML = preds.map(p => `${(p.probability*100).toFixed(1)}% · ${prettyClassName(p.className)}`).join('<br/>');
      els.hint.textContent = result.decision === 'Recyclable'
        ? 'Rinse if dirty. Check local rules for caps and labels.'
        : 'Likely landfill. If it is a clean bottle/can/jar/box, it can be recyclable.';
      els.results.hidden = false;
    } catch (e) {
      console.error(e);
    }
    if (running) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// Stats display
function updateStatsDisplay() {
  if (els.stats) {
    const percentage = stats.total > 0 ? Math.round((stats.recycled / stats.total) * 100) : 0;
    els.stats.innerHTML = `📊 ${stats.total} items checked | ♻️ ${stats.recycled} recycled (${percentage}%) | 🗑️ ${stats.trash} trash`;
  }
}

// Theme toggle
function toggleTheme() {
  const html = document.documentElement;
  const currentTheme = html.getAttribute('data-theme') || 'dark';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  if (els.themeToggle) {
    els.themeToggle.textContent = newTheme === 'dark' ? '☀️' : '🌙';
  }
}

// Region selection
function changeRegion() {
  if (els.regionSelect) {
    currentRegion = els.regionSelect.value;
    localStorage.setItem('recycleRegion', currentRegion);
  }
}

// Find nearby recycling centers
function findRecyclingCenters() {
  if ('geolocation' in navigator) {
    els.findRecycling.textContent = 'Locating...';
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        // Open Google Maps with recycling center search
        const url = `https://www.google.com/maps/search/recycling+center/@${latitude},${longitude},14z`;
        window.open(url, '_blank');
        els.findRecycling.textContent = '📍 Find Recycling Centers';
      },
      (error) => {
        alert('Location access denied. Opening general search...');
        window.open('https://www.google.com/maps/search/recycling+center', '_blank');
        els.findRecycling.textContent = '📍 Find Recycling Centers';
      }
    );
  } else {
    window.open('https://www.google.com/maps/search/recycling+center', '_blank');
  }
}

// Initialize
function init() {
  // Load theme
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  if (els.themeToggle) {
    els.themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
  }
  
  // Load region
  if (els.regionSelect) {
    els.regionSelect.value = currentRegion;
  }
  
  // Update stats
  updateStatsDisplay();
}

// Event wiring
els.file.addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if (file) useImage(file);
});
els.cameraBtn.addEventListener('click', startCamera);
els.stopCameraBtn.addEventListener('click', stopCamera);

if (els.themeToggle) els.themeToggle.addEventListener('click', toggleTheme);
if (els.regionSelect) els.regionSelect.addEventListener('change', changeRegion);
if (els.findRecycling) els.findRecycling.addEventListener('click', findRecyclingCenters);

// Initialize on load
init();

// PWA bits
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(console.warn);
  });
}
