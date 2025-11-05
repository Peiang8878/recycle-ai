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
};

const recyclableKeywords = [
  // Glass
  'bottle', 'water bottle', 'wine bottle', 'beer bottle', 'glass bottle', 'jar', 'glass jar',
  // Metal
  'can', 'soda can', 'pop can', 'beer can', 'tin', 'tin can', 'aluminium', 'aluminum', 'aluminum can', 'steel', 'metal can',
  // Paper & Cardboard
  'paper', 'newspaper', 'magazine', 'cardboard', 'cardboard box', 'carton', 'paper bag', 'mail', 'envelope',
  'cereal box', 'pizza box', 'shipping box', 'corrugated',
  // Plastic (common recyclable types)
  'plastic bottle', 'water jug', 'milk jug', 'detergent bottle', 'shampoo bottle',
  'plastic container', 'yogurt container', 'butter tub'
];
const likelyTrashKeywords = [
  // Food & organic waste
  'banana', 'peel', 'apple', 'orange', 'pizza', 'burger', 'hotdog', 'sandwich', 'food', 'leftover',
  'meat', 'chicken', 'fish', 'egg', 'eggshell', 'bread', 'fruit', 'vegetable',
  // Non-recyclable plastics & materials
  'plastic bag', 'grocery bag', 'shopping bag', 'styrofoam', 'polystyrene', 'foam', 'bubble wrap',
  'chip bag', 'candy wrapper', 'straw', 'plastic wrap', 'cellophane',
  // Paper products (contaminated/non-recyclable)
  'tissue', 'napkin', 'paper towel', 'paper plate', 'paper cup', 'coffee cup', 'disposable',
  // Other trash
  'diaper', 'cigarette', 'cigarette butt', 'wrapper', 'trash', 'garbage', 'waste',
  'dirty', 'soiled', 'greasy', 'contaminated'
];

function keywordMatch(preds, keywords) {
  const q = keywords.map(k => k.toLowerCase());
  return preds.find(p => q.some(k => p.className.toLowerCase().includes(k)));
}

function decide(preds) {
  const hitRecyclable = keywordMatch(preds, recyclableKeywords);
  const hitTrash = keywordMatch(preds, likelyTrashKeywords);
  if (hitRecyclable && (!hitTrash || hitRecyclable.probability >= hitTrash.probability * 1.2)) {
    return { decision: 'Recyclable', kind: 'ok', match: hitRecyclable };
  }
  return { decision: 'Trash', kind: 'bad', match: hitTrash || preds[0] };
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
  els.hint.textContent = result.decision === 'Recyclable'
    ? 'Rinse if dirty. Check local rules for caps and labels.'
    : 'Likely landfill. If it is a clean bottle/can/jar/box, it can be recyclable.';
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

// Event wiring
els.file.addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if (file) useImage(file);
});
els.cameraBtn.addEventListener('click', startCamera);
els.stopCameraBtn.addEventListener('click', stopCamera);

// PWA bits
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(console.warn);
  });
}
