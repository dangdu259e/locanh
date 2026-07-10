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
        updateUI(); renderGallery();
        syncStatus.textContent = "✓ Đã đồng bộ"; syncStatus.style.background = "#e8f8f5"; syncStatus.style.color = "#27ae60";
        setTimeout(() => syncStatus.style.opacity = '0', 3000);
    } catch (error) {
        syncStatus.textContent = "✕ Lỗi mạng"; syncStatus.style.background = "#fbeee0"; syncStatus.style.color = "#e74c3c";
    }
}

async function toggleSelection(fileName) {
    const action = selectedImages.has(fileName) ? 'remove' : 'add';
    if (action === 'add') selectedImages.add(fileName); else selectedImages.delete(fileName);
    updateUI(); updateCardState(fileName);

    try {
        syncStatus.style.opacity = '1'; syncStatus.textContent = "Đang lưu...";
        syncStatus.style.background = "#fff3cd"; syncStatus.style.color = "#856404";
        await fetch(`${API_URL}?action=${action}&file=${encodeURIComponent(fileName)}`);
        syncStatus.textContent = "✓ Đã lưu"; syncStatus.style.background = "#e8f8f5"; syncStatus.style.color = "#27ae60";
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

// 2. RENDER & TẢI TRƯỚC (PREFETCH)
function preloadHighRes(index) {
    if (index >= 0 && index < imageList.length) {
        const id = imageList[index].id;
        if (!preloadedImages.has(id)) {
            const img = new Image(); img.src = `https://drive.google.com/thumbnail?id=${id}&sz=s2500`; preloadedImages.add(id);
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

        // Dùng w800 cho PC hiển thị nét, Mobile load nhanh
        const thumbUrl = `https://drive.google.com/thumbnail?id=${img.id}&sz=w800`;

        card.innerHTML = `<img src="${thumbUrl}" alt="${img.name}" loading="lazy"><button class="heart-btn" aria-label="Chọn ảnh">❤️</button>`;

        // Cảm biến chuột cho PC (Chuẩn bị ảnh trước khi click)
        let hoverTimer;
        card.addEventListener('mouseenter', () => { hoverTimer = setTimeout(() => preloadHighRes(index), 150); });
        card.addEventListener('mouseleave', () => clearTimeout(hoverTimer));

        card.querySelector('.heart-btn').addEventListener('click', (e) => { e.stopPropagation(); toggleSelection(img.name); });
        card.addEventListener('click', () => openLightbox(index));
        fragment.appendChild(card);
    });
    gallery.appendChild(fragment);
};

// 3. ENGINE ZOOM & ĐIỀU KHIỂN (CẢM ỨNG + CHUỘT)
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
    lb.classList.remove('hidden');

    // Khóa cuộn background trên iOS và Windows
    document.body.style.overflow = 'hidden';

    const highResUrl = `https://drive.google.com/thumbnail?id=${img.id}&sz=s2500`;
    const tempImg = new Image(); tempImg.src = highResUrl;
    tempImg.onload = () => { if (currentIndex === index) { lbImg.src = highResUrl; lbImg.classList.remove('loading-high-res'); } };
    preloadHighRes(index + 1); preloadHighRes(index - 1);
}

// Xử lý Lăn chuột PC (Zoom in/out tại điểm chuột)
lbImg.addEventListener('wheel', (e) => {
    e.preventDefault();
    let newScale = Math.max(1, Math.min(scale * (e.deltaY < 0 ? 1.15 : 0.85), 20));
    const ratio = 1 - newScale / scale;
    currentX += (e.clientX - window.innerWidth / 2 - currentX) * ratio; currentY += (e.clientY - window.innerHeight / 2 - currentY) * ratio;
    scale = newScale;

    scale > 1 ? lbImg.classList.add('zoomed') : (lbImg.classList.remove('zoomed'), currentX = 0, currentY = 0);
    lbImg.style.transition = 'none'; lbImg.style.transform = `translate(${currentX}px, ${currentY}px) scale(${scale})`;

    clearTimeout(lbImg.wheelTimeout);
    lbImg.wheelTimeout = setTimeout(() => lbImg.style.transition = 'transform 0.3s cubic-bezier(0.2, 0, 0.2, 1)', 50);
}, { passive: false });

// Xử lý Cảm ứng Đa điểm (Mobile/iPad)
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
    const deltaX = e.clientX - clickStartX; const deltaY = e.clientY - clickStartY;
    const distance = Math.hypot(deltaX, deltaY);
    const isClick = pointers.length === 1 && !wasPinching && distance < 5;

    // Nhận diện vuốt (Swipe) mượt mà trên iPhone/iPad
    const isSwipe = pointers.length === 1 && !wasPinching && scale === 1 && Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY);

    removePointer(e); lbImg.releasePointerCapture(e.pointerId);

    if (isClick) {
        const now = Date.now(), tapLen = now - lastTapTime;
        if (tapLen < 300 && tapLen > 0) { // Double Tap iOS Style
            if (scale === 1) {
                scale = 3; lbImg.classList.add('zoomed');
                const ratio = 1 - scale;
                currentX += (e.clientX - window.innerWidth / 2 - currentX) * ratio; currentY += (e.clientY - window.innerHeight / 2 - currentY) * ratio;
                lbImg.style.transition = 'transform 0.3s cubic-bezier(0.2, 0, 0.2, 1)';
                lbImg.style.transform = `translate(${currentX}px, ${currentY}px) scale(${scale})`;
            } else resetZoom();
            lastTapTime = 0;
        } else lastTapTime = now;
    }
    else if (isSwipe) {
        if (deltaX > 0 && currentIndex > 0) openLightbox(currentIndex - 1); // Vuốt phải
        else if (deltaX < 0 && currentIndex < imageList.length - 1) openLightbox(currentIndex + 1); // Vuốt trái
    }
});
lbImg.addEventListener('pointercancel', (e) => { removePointer(e); lbImg.releasePointerCapture(e.pointerId); });

// 4. XỬ LÝ TẢI ẢNH GỐC (DUNG LƯỢNG 100%)
document.getElementById('lb-download').addEventListener('click', () => {
    const img = imageList[currentIndex];

    // Nhận diện iPhone/iPad để xử lý riêng
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (isIOS) {
        const guideDiv = document.createElement('div');
        guideDiv.className = 'ios-download-guide';
        const originalViewUrl = `https://drive.google.com/uc?export=view&id=${img.id}`;

        guideDiv.innerHTML = `
            <div class="ios-guide-text">👇 CÔ/CHÚ ẤN GIỮ VÀO ẢNH DƯỚI ĐÂY 3 GIÂY RỒI CHỌN "LƯU VÀO ẢNH" 👇</div>
            <img src="${originalViewUrl}" alt="Ảnh cần tải">
            <button class="ios-guide-close">Xong / Đóng</button>
        `;
        document.body.appendChild(guideDiv);

        guideDiv.querySelector('.ios-guide-close').addEventListener('click', () => document.body.removeChild(guideDiv));
    } else {
        // Tải ẩn tự động cho Win 11 / Android
        const a = document.createElement('a');
        a.href = `https://drive.google.com/uc?export=download&id=${img.id}`;
        a.setAttribute('download', img.name);
        a.style.display = 'none';

        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
});

// 5. BÀN PHÍM WIN 11, ĐIỀU HƯỚNG & KHỞI CHẠY
document.getElementById('lb-prev').addEventListener('click', () => { if (currentIndex > 0) openLightbox(currentIndex - 1); });
document.getElementById('lb-next').addEventListener('click', () => { if (currentIndex < imageList.length - 1) openLightbox(currentIndex + 1); });
lbHeart.addEventListener('click', () => toggleSelection(imageList[currentIndex].name));

const closeLightbox = () => { lb.classList.add('hidden'); currentIndex = -1; document.body.style.overflow = ''; };
document.getElementById('lb-close').addEventListener('click', closeLightbox);
lb.addEventListener('click', (e) => { if (e.target === lb || e.target.classList.contains('lb-content')) closeLightbox(); });

// Hỗ trợ Bàn phím Win 11 (Mũi tên & ESC)
document.addEventListener('keydown', (e) => {
    if (currentIndex === -1) return;
    if (e.key === 'ArrowLeft' && currentIndex > 0) openLightbox(currentIndex - 1);
    else if (e.key === 'ArrowRight' && currentIndex < imageList.length - 1) openLightbox(currentIndex + 1);
    else if (e.key === 'Escape') closeLightbox();
});

document.addEventListener('DOMContentLoaded', () => {
    if (typeof imageList !== 'undefined' && imageList.length > 0 && API_URL.includes('script.google.com')) fetchSelections();
    else gallery.innerHTML = '<h3 style="grid-column: 1/-1; text-align: center; color: #ff4757; margin-top: 50px;">Lỗi: Chưa tải dữ liệu</h3>';
});