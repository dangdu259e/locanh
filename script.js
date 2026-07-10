// ĐIỀN LINK WEB APP GOOGLE SHEETS CỦA BẠN VÀO ĐÂY:
const API_URL = 'https://script.google.com/macros/s/AKfycbwE76XEp9p0DhR7AQRhIL-y1FDXKSnglFIGNvr0uJgvCOQA1TxeyCD_3ZsXbEpJH2TGSg/exec';

let selectedImages = new Set();
let currentIndex = -1;

const gallery = document.getElementById('gallery');
const countDisplay = document.getElementById('selected-count');
const syncStatus = document.getElementById('sync-status');
const preloadedImages = new Set();

// 1. FETCH & ĐỒNG BỘ DỮ LIỆU
async function fetchSelections() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        selectedImages = new Set(data);
        updateUI();
        renderGallery();
        syncStatus.textContent = "✓ Đã đồng bộ";
        syncStatus.style.background = "#e8f8f5";
        syncStatus.style.color = "#27ae60";
        setTimeout(() => syncStatus.style.opacity = '0', 3000);
    } catch (error) {
        syncStatus.textContent = "✕ Lỗi mạng";
        syncStatus.style.background = "#fbeee0";
        syncStatus.style.color = "#e74c3c";
    }
}

async function toggleSelection(fileName) {
    const action = selectedImages.has(fileName) ? 'remove' : 'add';
    if (action === 'add') selectedImages.add(fileName); else selectedImages.delete(fileName);
    updateUI(); updateCardState(fileName);

    try {
        syncStatus.style.opacity = '1';
        syncStatus.textContent = "Đang lưu...";
        syncStatus.style.background = "#fff3cd"; syncStatus.style.color = "#856404";

        await fetch(`${API_URL}?action=${action}&file=${encodeURIComponent(fileName)}`);

        syncStatus.textContent = "✓ Đã lưu";
        syncStatus.style.background = "#e8f8f5"; syncStatus.style.color = "#27ae60";
        setTimeout(() => syncStatus.style.opacity = '0', 2000);
    } catch (e) { console.error("Lỗi đồng bộ"); }
}

const updateUI = () => countDisplay.textContent = selectedImages.size;
const updateCardState = (fileName) => {
    const card = document.querySelector(`.image-card[data-name="${fileName}"]`);
    if (card) selectedImages.has(fileName) ? card.classList.add('selected') : card.classList.remove('selected');
    if (currentIndex > -1 && typeof imageList !== 'undefined' && imageList[currentIndex].name === fileName) {
        const lbHeart = document.getElementById('lb-heart');
        selectedImages.has(fileName) ? lbHeart.classList.add('active') : lbHeart.classList.remove('active');
    }
};

// 2. RENDER GRID & PRELOAD
function preloadHighRes(index) {
    if (index >= 0 && index < imageList.length) {
        const id = imageList[index].id;
        if (!preloadedImages.has(id)) {
            const img = new Image();
            img.src = `https://drive.google.com/thumbnail?id=${id}&sz=s2500`;
            preloadedImages.add(id);
        }
    }
}

const renderGallery = () => {
    gallery.innerHTML = '';
    const fragment = document.createDocumentFragment();

    imageList.forEach((img, index) => {
        const card = document.createElement('div');
        card.className = `image-card ${selectedImages.has(img.name) ? 'selected' : ''}`;
        card.dataset.name = img.name;
        const thumbUrl = `https://drive.google.com/thumbnail?id=${img.id}&sz=w800`;

        card.innerHTML = `<img src="${thumbUrl}" alt="${img.name}" loading="lazy"><button class="heart-btn" aria-label="Chọn ảnh">❤️</button>`;

        let hoverTimer;
        card.addEventListener('mouseenter', () => { hoverTimer = setTimeout(() => preloadHighRes(index), 150); });
        card.addEventListener('mouseleave', () => clearTimeout(hoverTimer));

        card.querySelector('.heart-btn').addEventListener('click', (e) => { e.stopPropagation(); toggleSelection(img.name); });
        card.addEventListener('click', () => openLightbox(index));
        fragment.appendChild(card);
    });
    gallery.appendChild(fragment);
};

// 3. HỆ THỐNG LIGHTBOX & ZOOM ĐA ĐIỂM
const lb = document.getElementById('lightbox'), lbImg = document.getElementById('lb-img');
const lbTitle = document.getElementById('lb-title'), lbHeart = document.getElementById('lb-heart');

let scale = 1, currentX = 0, currentY = 0, isPanning = false;
let startX = 0, startY = 0, clickStartX = 0, clickStartY = 0;
let pointers = [], initialDistance = 0, wasPinching = false, lastTapTime = 0;

const resetZoom = () => { scale = 1; currentX = 0; currentY = 0; lbImg.style.transform = `translate(0px, 0px) scale(1)`; lbImg.classList.remove('zoomed'); };

function openLightbox(index) {
    currentIndex = index; const img = imageList[index]; resetZoom();
    lbImg.src = `https://drive.google.com/thumbnail?id=${img.id}&sz=w800`;
    lbImg.classList.add('loading-high-res');
    lbTitle.textContent = img.name;
    selectedImages.has(img.name) ? lbHeart.classList.add('active') : lbHeart.classList.remove('active');
    lb.classList.remove('hidden'); document.body.style.overflow = 'hidden';

    const highResUrl = `https://drive.google.com/thumbnail?id=${img.id}&sz=s2500`;
    const tempImg = new Image(); tempImg.src = highResUrl;
    tempImg.onload = () => { if (currentIndex === index) { lbImg.src = highResUrl; lbImg.classList.remove('loading-high-res'); } };
    preloadHighRes(index + 1); preloadHighRes(index - 1);
}

// Lăn chuột PC
lbImg.addEventListener('wheel', (e) => {
    e.preventDefault();
    let newScale = Math.max(1, Math.min(scale * (e.deltaY < 0 ? 1.15 : 0.85), 20));
    const ratio = 1 - newScale / scale;
    currentX += (e.clientX - window.innerWidth / 2 - currentX) * ratio;
    currentY += (e.clientY - window.innerHeight / 2 - currentY) * ratio;
    scale = newScale;

    scale > 1 ? lbImg.classList.add('zoomed') : (lbImg.classList.remove('zoomed'), currentX = 0, currentY = 0);
    lbImg.style.transition = 'none'; lbImg.style.transform = `translate(${currentX}px, ${currentY}px) scale(${scale})`;

    clearTimeout(lbImg.wheelTimeout);
    lbImg.wheelTimeout = setTimeout(() => lbImg.style.transition = 'transform 0.3s cubic-bezier(0.2, 0, 0.2, 1)', 50);
}, { passive: false });

// Chạm & Vuốt Mobile
lbImg.addEventListener('pointerdown', (e) => {
    e.preventDefault(); pointers.push(e); lbImg.setPointerCapture(e.pointerId);
    if (pointers.length === 1) {
        clickStartX = e.clientX; clickStartY = e.clientY; wasPinching = false;
        if (scale > 1) { isPanning = true; startX = e.clientX - currentX; startY = e.clientY - currentY; lbImg.style.transition = 'none'; }
    } else if (pointers.length === 2) {
        isPanning = false; wasPinching = true;
        initialDistance = Math.hypot(pointers[0].clientX - pointers[1].clientX, pointers[0].clientY - pointers[1].clientY);
    }
});

lbImg.addEventListener('pointermove', (e) => {
    const idx = pointers.findIndex(p => p.pointerId === e.pointerId); if (idx !== -1) pointers[idx] = e;
    if (pointers.length === 1 && isPanning) {
        currentX = e.clientX - startX; currentY = e.clientY - startY;
        lbImg.style.transform = `translate(${currentX}px, ${currentY}px) scale(${scale})`;
    } else if (pointers.length === 2) {
        const dist = Math.hypot(pointers[0].clientX - pointers[1].clientX, pointers[0].clientY - pointers[1].clientY);
        const midX = (pointers[0].clientX + pointers[1].clientX) / 2, midY = (pointers[0].clientY + pointers[1].clientY) / 2;
        let newScale = Math.max(1, Math.min(scale * (dist / initialDistance), 20));
        const ratio = 1 - newScale / scale;
        currentX += (midX - window.innerWidth / 2 - currentX) * ratio; currentY += (midY - window.innerHeight / 2 - currentY) * ratio;
        scale = newScale; initialDistance = dist;
        scale > 1 ? lbImg.classList.add('zoomed') : lbImg.classList.remove('zoomed');
        lbImg.style.transition = 'none'; lbImg.style.transform = `translate(${currentX}px, ${currentY}px) scale(${scale})`;
    }
});

const removePointer = (e) => {
    pointers = pointers.filter(p => p.pointerId !== e.pointerId);
    if (pointers.length < 2) initialDistance = 0;
    if (pointers.length === 1 && scale > 1) { isPanning = true; startX = pointers[0].clientX - currentX; startY = pointers[0].clientY - currentY; }
    if (pointers.length === 0) {
        if (isPanning) { isPanning = false; lbImg.style.transition = 'transform 0.3s cubic-bezier(0.2, 0, 0.2, 1)'; }
        if (scale === 1) resetZoom();
    }
};

lbImg.addEventListener('pointerup', (e) => {
    const isClick = pointers.length === 1 && !wasPinching && Math.hypot(e.clientX - clickStartX, e.clientY - clickStartY) < 5;
    removePointer(e); lbImg.releasePointerCapture(e.pointerId);

    if (isClick) {
        const now = Date.now(), tapLen = now - lastTapTime;
        if (tapLen < 300 && tapLen > 0) {
            if (scale === 1) {
                scale = 3; lbImg.classList.add('zoomed');
                const ratio = 1 - scale;
                currentX += (e.clientX - window.innerWidth / 2 - currentX) * ratio; currentY += (e.clientY - window.innerHeight / 2 - currentY) * ratio;
                lbImg.style.transition = 'transform 0.3s'; lbImg.style.transform = `translate(${currentX}px, ${currentY}px) scale(${scale})`;
            } else resetZoom();
            lastTapTime = 0;
        } else lastTapTime = now;
    }
});
lbImg.addEventListener('pointercancel', (e) => { removePointer(e); lbImg.releasePointerCapture(e.pointerId); });

// 4. XỬ LÝ TẢI ẢNH (iOS & PC)
document.getElementById('lb-download').addEventListener('click', async () => {
    const img = imageList[currentIndex];
    const btn = document.getElementById('lb-download');
    const originalIcon = btn.innerHTML;
    btn.innerHTML = '⏳'; btn.style.pointerEvents = 'none';

    try {
        const highResUrl = `https://drive.google.com/thumbnail?id=${img.id}&sz=s2500`;
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(highResUrl)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error("CORS Proxy Error");

        const blob = await response.blob();
        const file = new File([blob], img.name, { type: blob.type || 'image/jpeg' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: img.name });
        } else {
            const blobUrl = URL.createObjectURL(blob); const a = document.createElement('a');
            a.href = blobUrl; a.download = img.name; document.body.appendChild(a);
            a.click(); document.body.removeChild(a); URL.revokeObjectURL(blobUrl);
        }
    } catch (error) {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (isIOS) {
            alert("iPhone: Bạn hãy [Ấn Giữ] vào bức ảnh hiện ra và chọn 'Lưu vào ảnh' (Save to Photos).");
            window.open(`https://drive.google.com/thumbnail?id=${img.id}&sz=s2500`, '_blank');
        } else window.open(`https://drive.google.com/uc?export=download&id=${img.id}`, '_blank');
    }
    btn.innerHTML = originalIcon; btn.style.pointerEvents = 'auto';
});

// 5. NÚT ĐIỀU HƯỚNG & KHỞI CHẠY
document.getElementById('lb-prev').addEventListener('click', () => { if (currentIndex > 0) openLightbox(currentIndex - 1); });
document.getElementById('lb-next').addEventListener('click', () => { if (currentIndex < imageList.length - 1) openLightbox(currentIndex + 1); });
lbHeart.addEventListener('click', () => toggleSelection(imageList[currentIndex].name));
const closeLightbox = () => { lb.classList.add('hidden'); currentIndex = -1; document.body.style.overflow = ''; };
document.getElementById('lb-close').addEventListener('click', closeLightbox);
lb.addEventListener('click', (e) => { if (e.target === lb || e.target.classList.contains('lb-content')) closeLightbox(); });

document.addEventListener('DOMContentLoaded', () => {
    if (typeof imageList !== 'undefined' && imageList.length > 0 && API_URL.includes('script.google.com')) fetchSelections();
    else gallery.innerHTML = '<h3 style="grid-column: 1/-1; text-align: center; color: #ff4757; margin-top: 50px;">Lỗi: Chưa tải dữ liệu</h3>';
});