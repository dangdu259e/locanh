// ĐIỀN LINK WEB APP GOOGLE SHEETS CỦA BẠN VÀO ĐÂY:
const API_URL = 'https://script.google.com/macros/s/AKfycbwE76XEp9p0DhR7AQRhIL-y1FDXKSnglFIGNvr0uJgvCOQA1TxeyCD_3ZsXbEpJH2TGSg/exec';

let selectedImages = new Set();
let currentIndex = -1;

const gallery = document.getElementById('gallery');
const countDisplay = document.getElementById('selected-count');
const syncStatus = document.getElementById('sync-status');

// Bộ nhớ đệm giữ các ảnh đã tải trước
const preloadedImages = new Set();

// 1. Fetch Dữ liệu từ Google Sheets
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

// 2. Logic Thả tim & Gửi API ngầm
async function toggleSelection(fileName) {
    const action = selectedImages.has(fileName) ? 'remove' : 'add';

    if (action === 'add') selectedImages.add(fileName);
    else selectedImages.delete(fileName);

    updateUI();
    updateCardState(fileName);

    try {
        syncStatus.style.opacity = '1';
        syncStatus.textContent = "Đang lưu...";
        syncStatus.style.background = "#fff3cd";
        syncStatus.style.color = "#856404";

        await fetch(`${API_URL}?action=${action}&file=${encodeURIComponent(fileName)}`);

        syncStatus.textContent = "✓ Đã lưu";
        syncStatus.style.background = "#e8f8f5";
        syncStatus.style.color = "#27ae60";
        setTimeout(() => syncStatus.style.opacity = '0', 2000);
    } catch (e) {
        console.error("Lỗi đồng bộ");
    }
}

const updateUI = () => countDisplay.textContent = selectedImages.size;

const updateCardState = (fileName) => {
    const card = document.querySelector(`.image-card[data-name="${fileName}"]`);
    if (card) {
        selectedImages.has(fileName) ? card.classList.add('selected') : card.classList.remove('selected');
    }
    if (currentIndex > -1 && typeof imageList !== 'undefined' && imageList[currentIndex].name === fileName) {
        const lbHeart = document.getElementById('lb-heart');
        selectedImages.has(fileName) ? lbHeart.classList.add('active') : lbHeart.classList.remove('active');
    }
};

// --- 3. BỘ MÁY PRELOAD & RENDER TỐC ĐỘ CAO ---
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

        card.innerHTML = `
            <img src="${thumbUrl}" alt="${img.name}" loading="lazy">
            <button class="heart-btn" aria-label="Chọn ảnh">❤️</button>
        `;

        let hoverTimer;
        card.addEventListener('mouseenter', () => { hoverTimer = setTimeout(() => preloadHighRes(index), 150); });
        card.addEventListener('mouseleave', () => clearTimeout(hoverTimer));

        card.querySelector('.heart-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSelection(img.name);
        });

        card.addEventListener('click', () => openLightbox(index));
        fragment.appendChild(card);
    });
    gallery.appendChild(fragment);
};

// --- 4. HỆ THỐNG ZOOM ĐA ĐIỂM (PINCH & WHEEL) ---
const lb = document.getElementById('lightbox');
const lbImg = document.getElementById('lb-img');
const lbTitle = document.getElementById('lb-title');
const lbHeart = document.getElementById('lb-heart');

let scale = 1;
let currentX = 0, currentY = 0;
let isPanning = false;
let startX = 0, startY = 0;
let clickStartX = 0, clickStartY = 0;

// Các biến cho cảm ứng đa điểm (Vuốt 2 ngón tay)
let pointers = [];
let initialDistance = 0;
let wasPinching = false;

const resetZoom = () => {
    scale = 1;
    currentX = 0;
    currentY = 0;
    lbImg.style.transform = `translate(0px, 0px) scale(1)`;
    lbImg.classList.remove('zoomed');
};

function openLightbox(index) {
    currentIndex = index;
    const img = imageList[index];
    resetZoom();

    const cachedThumbUrl = `https://drive.google.com/thumbnail?id=${img.id}&sz=w800`;
    const highResUrl = `https://drive.google.com/thumbnail?id=${img.id}&sz=s2500`;

    lbImg.src = cachedThumbUrl;
    lbImg.classList.add('loading-high-res');

    lbTitle.textContent = img.name;
    selectedImages.has(img.name) ? lbHeart.classList.add('active') : lbHeart.classList.remove('active');
    lb.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    const tempImg = new Image();
    tempImg.src = highResUrl;
    tempImg.onload = () => {
        if (currentIndex === index) {
            lbImg.src = highResUrl;
            lbImg.classList.remove('loading-high-res');
        }
    };

    preloadHighRes(index + 1);
    preloadHighRes(index - 1);
}

// XỬ LÝ LĂN CHUỘT ĐỂ ZOOM (CHO PC)
lbImg.addEventListener('wheel', (e) => {
    e.preventDefault(); // Ngăn cuộn trang

    const zoomSensitivity = 0.15;
    const delta = e.deltaY < 0 ? 1 + zoomSensitivity : 1 - zoomSensitivity;
    let newScale = scale * delta;

    // Giới hạn zoom từ 1x đến 20x
    newScale = Math.max(1, Math.min(newScale, 20));

    // Tính toán bù trừ tọa độ để zoom chính xác vào con trỏ chuột
    const ratio = 1 - newScale / scale;
    currentX += (e.clientX - window.innerWidth / 2 - currentX) * ratio;
    currentY += (e.clientY - window.innerHeight / 2 - currentY) * ratio;

    scale = newScale;

    if (scale > 1) {
        lbImg.classList.add('zoomed');
    } else {
        lbImg.classList.remove('zoomed');
        currentX = 0; currentY = 0; // Trả về chính giữa nếu zoom out hết cỡ
    }

    lbImg.style.transition = 'none'; // Phản hồi tức thì khi lăn chuột
    lbImg.style.transform = `translate(${currentX}px, ${currentY}px) scale(${scale})`;

    // Trả lại hiệu ứng mượt mà khi ngừng lăn
    clearTimeout(lbImg.wheelTimeout);
    lbImg.wheelTimeout = setTimeout(() => {
        lbImg.style.transition = 'transform 0.3s cubic-bezier(0.2, 0, 0.2, 1)';
    }, 50);
}, { passive: false });


// XỬ LÝ CẢM ỨNG ĐA ĐIỂM (CHO ĐIỆN THOẠI)
lbImg.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    pointers.push(e);
    lbImg.setPointerCapture(e.pointerId);

    if (pointers.length === 1) {
        clickStartX = e.clientX;
        clickStartY = e.clientY;
        wasPinching = false;

        if (scale > 1) {
            isPanning = true;
            startX = e.clientX - currentX;
            startY = e.clientY - currentY;
            lbImg.style.transition = 'none';
        }
    } else if (pointers.length === 2) {
        isPanning = false;
        wasPinching = true;
        initialDistance = Math.hypot(
            pointers[0].clientX - pointers[1].clientX,
            pointers[0].clientY - pointers[1].clientY
        );
    }
});

lbImg.addEventListener('pointermove', (e) => {
    // Cập nhật vị trí con trỏ hiện tại
    const index = pointers.findIndex(p => p.pointerId === e.pointerId);
    if (index !== -1) pointers[index] = e;

    if (pointers.length === 1 && isPanning) {
        currentX = e.clientX - startX;
        currentY = e.clientY - startY;
        lbImg.style.transform = `translate(${currentX}px, ${currentY}px) scale(${scale})`;
    } else if (pointers.length === 2) {
        // Thuật toán Pinch-to-zoom (Vuốt 2 ngón tay)
        const currentDistance = Math.hypot(
            pointers[0].clientX - pointers[1].clientX,
            pointers[0].clientY - pointers[1].clientY
        );

        // Tính toán tâm điểm giữa 2 ngón tay
        const midX = (pointers[0].clientX + pointers[1].clientX) / 2;
        const midY = (pointers[0].clientY + pointers[1].clientY) / 2;

        let newScale = scale * (currentDistance / initialDistance);
        newScale = Math.max(1, Math.min(newScale, 20)); // Giới hạn zoom tối đa 20x

        const ratio = 1 - newScale / scale;
        currentX += (midX - window.innerWidth / 2 - currentX) * ratio;
        currentY += (midY - window.innerHeight / 2 - currentY) * ratio;

        scale = newScale;
        initialDistance = currentDistance;

        if (scale > 1) lbImg.classList.add('zoomed'); else lbImg.classList.remove('zoomed');
        lbImg.style.transition = 'none';
        lbImg.style.transform = `translate(${currentX}px, ${currentY}px) scale(${scale})`;
    }
});

const removePointer = (e) => {
    pointers = pointers.filter(p => p.pointerId !== e.pointerId);
    if (pointers.length < 2) initialDistance = 0;

    if (pointers.length === 1 && scale > 1) {
        isPanning = true;
        startX = pointers[0].clientX - currentX;
        startY = pointers[0].clientY - currentY;
    }

    if (pointers.length === 0) {
        if (isPanning) {
            isPanning = false;
            lbImg.style.transition = 'transform 0.3s cubic-bezier(0.2, 0, 0.2, 1)';
        }
        if (scale === 1) resetZoom(); // Đảm bảo trả về chuẩn nếu vô tình vuốt quá 1x
    }
};

lbImg.addEventListener('pointerup', (e) => {
    // Nếu chỉ chạm thả 1 ngón mà chưa từng vuốt 2 ngón -> Đó là Click phóng to/thu nhỏ nhanh
    const isClick = pointers.length === 1 && !wasPinching && Math.hypot(e.clientX - clickStartX, e.clientY - clickStartY) < 5;

    removePointer(e);
    lbImg.releasePointerCapture(e.pointerId);

    if (isClick) {
        if (scale === 1) {
            scale = 3; // Click 1 phát zoom 3x
            lbImg.classList.add('zoomed');

            const ratio = 1 - scale / 1;
            currentX += (e.clientX - window.innerWidth / 2 - currentX) * ratio;
            currentY += (e.clientY - window.innerHeight / 2 - currentY) * ratio;

            lbImg.style.transition = 'transform 0.3s cubic-bezier(0.2, 0, 0.2, 1)';
            lbImg.style.transform = `translate(${currentX}px, ${currentY}px) scale(${scale})`;
        } else {
            resetZoom();
        }
    }
});

lbImg.addEventListener('pointercancel', (e) => { removePointer(e); lbImg.releasePointerCapture(e.pointerId); });


// 5. ĐIỀU HƯỚNG VÀ KHỞI CHẠY
document.getElementById('lb-prev').addEventListener('click', () => { if (currentIndex > 0) openLightbox(currentIndex - 1); });
document.getElementById('lb-next').addEventListener('click', () => { if (currentIndex < imageList.length - 1) openLightbox(currentIndex + 1); });

lbHeart.addEventListener('click', () => toggleSelection(imageList[currentIndex].name));

const closeLightbox = () => {
    lb.classList.add('hidden');
    currentIndex = -1;
    document.body.style.overflow = '';
};

document.getElementById('lb-close').addEventListener('click', closeLightbox);
lb.addEventListener('click', (e) => {
    if (e.target === lb || e.target.classList.contains('lb-content')) closeLightbox();
});

// Khởi chạy Ứng dụng
document.addEventListener('DOMContentLoaded', () => {
    if (typeof imageList !== 'undefined' && imageList.length > 0 && API_URL.includes('script.google.com')) {
        fetchSelections();
    } else {
        gallery.innerHTML = '<h3 style="grid-column: 1/-1; text-align: center; color: var(--primary); margin-top: 50px;">Vui lòng tải file danh_sach_anh.js và điền API_URL vào script.js</h3>';
    }
});