const WORDS = [
  "daughter",
  "responsibility",
  "stubbornness",
  "child",
  "sister",
  "wife"
];

const DATA = [
  {
    file: "girl.jpg",
    scores: [0.268, 0.211, 0.216, 0.259, 0.234, 0.211]
  },
  {
    file: "parents.jpg",
    scores: [0.259, 0.240, 0.242, 0.273, 0.233, 0.221]
  },
  {
    file: "care.jpg",
    scores: [0.248, 0.198, 0.220, 0.255, 0.220, 0.217]
  },
  {
    file: "study.jpg",
    scores: [0.211, 0.194, 0.224, 0.209, 0.188, 0.217]
  },
  {
    file: "alone.jpg",
    scores: [0.226, 0.190, 0.197, 0.226, 0.220, 0.230]
  },
  {
    file: "angry.jpg",
    scores: [0.200, 0.206, 0.235, 0.236, 0.193, 0.202]
  },
  {
    file: "wedding.jpg",
    scores: [0.223, 0.188, 0.178, 0.196, 0.227, 0.235]
  },
  {
    file: "housework.jpg",
    scores: [0.228, 0.226, 0.205, 0.231, 0.208, 0.254]
  }
];

const W = 1200;
const H = 940;

const SPACING = 370;
const CELL_W = 310;

const IMAGE_BOTTOM = 390;
const TEXT_TOP = 430;

const TYPE_TOP = 660;
const TYPE_Y = 785;

let imgs = [];
let rows = [];

let position = 0;
let target = 0;
let dragging = false;
let pointerId = null;
let previousX = 0;
let travel = 0;

let positionHistory = [];

let typeMask;
let accumulated;
let movingLayer;
let typeResult;

let destinations = [];
let destinationIndex = 0;
let fragments = [];

function setup() {
  const canvas = createCanvas(W, H);
  pixelDensity(1);

  document.body.style.margin = "0";
  document.body.style.background = "#fff";

  canvas.style("display", "block");
  canvas.style("width", "100%");
  canvas.style("max-width", W + "px");
  canvas.style("height", "auto");
  canvas.style("margin", "0 auto");
  canvas.style("touch-action", "none");

  textFont("Arial");
  noStroke();

  DATA.forEach((item, i) => {
    imgs[i] = null;

    loadImage(
      item.file,
      img => {
        imgs[i] = img;
      },
      () => {
        console.warn("Missing image:", item.file);
      }
    );

    rows[i] = WORDS.map((word, j) => ({
      word,
      score: item.scores[j]
    })).sort((a, b) => b.score - a.score);
  });

  buildTypeMask();
  setupPointer(canvas.elt);
}

function setupPointer(element) {
  function getX(event) {
    const rect = element.getBoundingClientRect();
    return (event.clientX - rect.left) * W / rect.width;
  }

  element.addEventListener("pointerdown", event => {
    if (!event.isPrimary || event.button !== 0) return;

    dragging = true;
    pointerId = event.pointerId;
    previousX = getX(event);

    element.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  element.addEventListener("pointermove", event => {
    if (!dragging || event.pointerId !== pointerId) return;

    const x = getX(event);
    const dx = x - previousX;

    previousX = x;
    position -= dx / SPACING;
    travel += Math.abs(dx);

    let count = 0;

    while (travel >= 10 && count < 20) {
      addFragment();
      travel -= 10;
      count++;
    }

    travel = Math.min(travel, 100);
    event.preventDefault();
  });

  function release(event) {
    if (event.pointerId !== pointerId) return;

    dragging = false;
    pointerId = null;
    target = Math.round(position);

    if (element.hasPointerCapture(event.pointerId)) {
      element.releasePointerCapture(event.pointerId);
    }
  }

  element.addEventListener("pointerup", release);
  element.addEventListener("pointercancel", release);

  element.addEventListener("lostpointercapture", event => {
    if (event.pointerId === pointerId) {
      dragging = false;
      pointerId = null;
      target = Math.round(position);
    }
  });
}

function buildTypeMask() {
  typeMask = createGraphics(W, H);
  accumulated = createGraphics(W, H);
  movingLayer = createGraphics(W, H);
  typeResult = createGraphics(W, H);

  for (const layer of [
    typeMask,
    accumulated,
    movingLayer,
    typeResult
  ]) {
    layer.pixelDensity(1);
    layer.clear();
  }

  // 이 글자는 마스크로만 사용하며 화면에는 직접 그리지 않음
  typeMask.textFont("Arial");
  typeMask.textStyle(BOLD);
  typeMask.textAlign(CENTER, CENTER);

  let fontSize = 240;
  typeMask.textSize(fontSize);

  while (typeMask.textWidth("daughter") > W - 110) {
    fontSize--;
    typeMask.textSize(fontSize);
  }

  typeMask.noStroke();
  typeMask.fill(255);
  typeMask.text("daughter", W / 2, TYPE_Y);
  typeMask.loadPixels();

  destinations = [];

  for (let y = TYPE_TOP; y < H - 20; y += 12) {
    for (let x = 40; x < W - 40; x += 12) {
      const alpha = typeMask.pixels[(y * W + x) * 4 + 3];

      if (alpha > 180) {
        destinations.push({ x, y });
      }
    }
  }

  shuffle(destinations, true);
}

function draw() {
  background(255);

  const dt = Math.min(deltaTime, 50);

  if (!dragging) {
    const ease = 1 - Math.exp(-dt / 100);
    position += (target - position) * ease;

    if (Math.abs(target - position) < 0.0001) {
      position = target;
    }
  }

  positionHistory.push(position);

  if (positionHistory.length > 16) {
    positionHistory.shift();
  }

  cursor(dragging ? "grabbing" : "grab");

  drawCarousel();

  const index = mod(Math.round(position), DATA.length);
  drawScores(index);

  updateFragments(dt);
  drawType();
}

function drawCarousel() {
  const first = Math.floor(position) - 2;
  const last = Math.ceil(position) + 2;

  for (let slot = first; slot <= last; slot++) {
    const index = mod(slot, DATA.length);
    const offset = slot - position;
    const cx = W / 2 + offset * SPACING;

    if (cx < -CELL_W || cx > W + CELL_W) continue;

    const proximity =
      1 - constrain(Math.abs(offset), 0, 1);

    const scale = lerp(0.76, 1, proximity);
    const boxW = 250 * scale;
    const boxH = 320 * scale;

    // 各画像と残像を独立した領域内に制限
    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.rect(
      cx - CELL_W / 2,
      35,
      CELL_W,
      365
    );
    drawingContext.clip();

    const img = imgs[index];

    if (img) {
      // 残像の移動幅を制限して隣の画像と重ならないようにする
      for (let j = 0; j < positionHistory.length; j += 2) {
        const past = positionHistory[j];

        const lag = constrain(
          (position - past) * SPACING,
          -26,
          26
        );

        tint(
          255,
          map(j, 0, positionHistory.length, 8, 55)
        );

        fitImage(
          img,
          cx - boxW / 2 + lag,
          IMAGE_BOTTOM - boxH,
          boxW,
          boxH
        );
      }

      noTint();

      fitImage(
        img,
        cx - boxW / 2,
        IMAGE_BOTTOM - boxH,
        boxW,
        boxH
      );
    } else {
      push();
      fill(0);
      noStroke();
      textFont("Arial");
      textStyle(NORMAL);
      textSize(13);
      textAlign(CENTER, CENTER);
      text(DATA[index].file, cx, 220);
      pop();
    }

    drawingContext.restore();
  }

  noTint();
}

function fitImage(img, x, y, w, h) {
  if (!img) return;

  const scale = Math.min(w / img.width, h / img.height);
  const iw = img.width * scale;
  const ih = img.height * scale;

  image(
    img,
    x + (w - iw) / 2,
    y + h - ih,
    iw,
    ih
  );
}

function drawScores(index) {
  push();

  fill(0);
  noStroke();
  textFont("Arial");
  textStyle(NORMAL);
  textSize(15);

  rows[index].forEach((row, i) => {
    const y = TEXT_TOP + i * 27;

    textAlign(LEFT, TOP);
    text(row.word, W / 2 - 120, y);

    textAlign(RIGHT, TOP);
    text(row.score.toFixed(3), W / 2 + 120, y);
  });

  pop();
}

function addFragment() {
  if (!destinations.length || fragments.length >= 220) return;

  const index = mod(Math.round(position), DATA.length);
  if (!imgs[index]) return;

  const destination =
    destinations[destinationIndex % destinations.length];

  destinationIndex++;

  fragments.push({
    index,

    // 목적지 주변에서 지연되며 겹쳐지는 이미지
    x: destination.x + random(-65, 65),
    y: destination.y + random(-30, 30),

    tx: destination.x,
    ty: destination.y,

    size: random(28, 43),
    ease: random(0.035, 0.07),
    age: 0
  });
}

function drawTile(layer, img, x, y, size) {
  const scale = Math.min(
    size / img.width,
    size / img.height
  );

  const iw = img.width * scale;
  const ih = img.height * scale;

  layer.image(
    img,
    x - iw / 2,
    y - ih / 2,
    iw,
    ih
  );
}

function updateFragments(dt) {
  movingLayer.clear();

  for (let i = fragments.length - 1; i >= 0; i--) {
    const f = fragments[i];
    const img = imgs[f.index];

    f.age += dt;

    const ease =
      1 - Math.pow(1 - f.ease, dt / 16.667);

    f.x = lerp(f.x, f.tx, ease);
    f.y = lerp(f.y, f.ty, ease);

    // 잔상도 아래에서 글자 마스크 안으로 함께 잘림
    for (let echo = 3; echo >= 1; echo--) {
      const ex = lerp(f.x, f.tx, -echo * 0.12);
      const ey = lerp(f.y, f.ty, -echo * 0.12);

      movingLayer.tint(255, 22);
      drawTile(movingLayer, img, ex, ey, f.size);
    }

    movingLayer.tint(255, 190);
    drawTile(movingLayer, img, f.x, f.y, f.size);
    movingLayer.noTint();

    if (
      dist(f.x, f.y, f.tx, f.ty) < 1.5 ||
      f.age > 4000
    ) {
      drawTile(
        accumulated,
        img,
        f.tx,
        f.ty,
        f.size
      );

      fragments.splice(i, 1);
    }
  }

  movingLayer.noTint();
}

function drawType() {
  typeResult.clear();

  typeResult.image(accumulated, 0, 0);
  typeResult.image(movingLayer, 0, 0);

  const ctx = typeResult.drawingContext;

  ctx.save();
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(typeMask.canvas, 0, 0);
  ctx.restore();

  // 完成した文字全体ではなく、実際にある画像部分だけに薄い影
  drawingContext.save();

  drawingContext.beginPath();
  drawingContext.rect(0, TYPE_TOP, W, H - TYPE_TOP);
  drawingContext.clip();

  drawingContext.shadowColor = "rgba(0, 0, 0, 0.10)";
  drawingContext.shadowBlur = 2;
  drawingContext.shadowOffsetX = 0;
  drawingContext.shadowOffsetY = 1;

  image(typeResult, 0, 0);

  drawingContext.restore();
}

function mod(value, count) {
  return ((value % count) + count) % count;
}

// R: 누적 이미지 초기화
function keyPressed() {
  if (key === "r" || key === "R") {
    accumulated.clear();
    movingLayer.clear();
    typeResult.clear();

    fragments = [];
    positionHistory = [];
    destinationIndex = 0;
    travel = 0;
  }
}