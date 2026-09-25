// 確認用：URL の末尾を #gallery（#gallery=2 で 2 ページ目）にすると、全員の 3D モデルを並べて表示する
function showGallery() {
  const page = Number((location.hash.split("=")[1] ?? "1")) - 1;
  const per = 40, cols = 8;
  const list = ct.slice(page * per, page * per + per);
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "width:1200px;height:760px;display:block";
  Kr.replaceChildren(canvas);
  const renderer = new v1({ canvas, antialias: true });
  renderer.setSize(1200, 760, false);
  const scene = new E1();
  scene.background = new Ge(0x2a2447);
  scene.add(new V1(0xb8b0d8, 1.9));
  const sun = new z1(0xfff0d0, 1.6);
  sun.position.set(2, 4, 5);
  scene.add(sun);
  const cam = new qt(30, 1200 / 760, 0.1, 200);
  cam.position.set(0, 3, 40);
  cam.lookAt(0, 0, 0);
  const labels = [];
  list.forEach((d, i) => {
    const m = buildYokaiModel(d);
    const x = (i % cols - (cols - 1) / 2) * 2.6, y = -(Math.floor(i / cols) - 2) * 3.1 - 1.2;
    m.position.set(x, y, 0);
    m.rotation.y = 0.35;
    scene.add(m);
    labels.push({ d, x, y });
  });
  renderer.render(scene, cam);
  const info = document.createElement("div");
  info.id = "gallery-info";
  info.textContent = list.map(d => d.name).join(" / ");
  Kr.append(info);
  window.__galleryDone = true;
  window.__ids = ct.map(d => d.id);
  window.__dbgModel = id => { const m = buildYokaiModel(ct.find(x => x.id === id)); const inner = m.children[0]; let n = 0, bad = 0; m.traverse(o => { if (o.isMesh) { n++; const e = o.matrixWorld.elements; if (e.some(v => !Number.isFinite(v))) bad++; } }); return { scale: inner.scale.x, y: inner.position.y, h: m.userData.height, meshes: n, bad }; };
}
