const firebaseConfig = {
    apiKey: "AIzaSyCkH8ACVHoRxYru1g9oPa9tMD4yBUYQcZM",
    authDomain: "member-reseller-boci.firebaseapp.com",
    projectId: "member-reseller-boci",
    storageBucket: "member-reseller-boci.firebasestorage.app",
    messagingSenderId: "279521008637",
    appId: "1:279521008637:web:0923c9cb51818da7945794"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let catalog = [];
let cart = [];
let currentPointsVal = 0; 
let currentRankPage = 0; 
let allRankings = [];

const ping = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
let loadOrders = true, loadReturns = true, loadComplaints = true, loadRedeems = true, loadActivations = true;

// --- LOGIKA AUTH & CEK AKTIVASI ---
auth.onAuthStateChanged(async (user) => {
    if (user) {
        const doc = await db.collection("users").doc(user.uid).get();
        if (doc.exists) {
            const userData = doc.data();
            if (userData.role !== 'admin' && userData.isActive !== true) {
                alert("Akun Anda (" + (userData.customId || 'User') + ") belum aktif.\nSilakan hubungi Admin via WhatsApp untuk aktivasi.");
                auth.signOut();
                return;
            }
            currentUser = { id: user.uid, ...userData };
            initApp();
        }
    } else {
        document.getElementById("appWrapper").classList.add("hidden");
        document.getElementById("loginScreen").classList.remove("hidden");
    }
});

function initApp() {
    document.getElementById("loginScreen").classList.add("hidden");
    document.getElementById("appWrapper").classList.remove("hidden");
    document.getElementById("userGreetName").innerText = currentUser.nama || "User";
    if(document.getElementById("customId")) document.getElementById("customId").innerText = currentUser.customId || "-";

    if(document.getElementById("profEmail")) document.getElementById("profEmail").value = currentUser.email || "";
    if(document.getElementById("profNama")) document.getElementById("profNama").value = currentUser.nama || "";
    if(document.getElementById("profHp")) document.getElementById("profHp").value = currentUser.hp || "";

    renderSidebar();
    syncCatalog();

    if (currentUser.role === 'admin') {
        document.getElementById("adminNotifHeader").classList.remove("hidden");
        document.getElementById("btnTukarPoinHeader").classList.add("hidden");
        showSection('secAdminDashboard');
        loadAdminData();
    } else {
        document.getElementById("adminNotifHeader").classList.add("hidden");
        document.getElementById("btnTukarPoinHeader").classList.remove("hidden");
        showSection('secResellerDashboard');
        loadResellerData();
        loadResellerHistory();
        loadResellerLeaderboard();
    }
}

// --- LOGIKA DAFTAR ---
document.getElementById("registerForm").onsubmit = async (e) => {
    e.preventDefault();
    const nama = document.getElementById("regNama").value;
    const email = document.getElementById("regEmail").value;
    const pass = document.getElementById("regPassword").value;
    const hp = document.getElementById("regHp").value;
    const cleanNama = nama.replace(/\s/g, '').substring(0, 4).toLowerCase();
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const customId = cleanNama + randomNum;
    try {
        const cred = await auth.createUserWithEmailAndPassword(email, pass);
        await db.collection("users").doc(cred.user.uid).set({
            customId, nama, email, hp, role: 'reseller', isActive: false, createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        const waMsg = `Halo Admin, saya ingin aktivasi akun OKTSHOP17.%0ANama: ${nama}%0AID User: ${customId}`;
        alert("Pendaftaran Berhasil! ID USER: " + customId);
        window.open(`https://wa.me/62895345452412?text=${waMsg}`, '_blank');
        auth.signOut(); 
    } catch (err) { alert("Gagal Daftar: " + err.message); }
};

// --- LOGIKA FILTER & RESET ---
function resetOrderFilter() {
    document.getElementById("filterStart").value = "";
    document.getElementById("filterEnd").value = "";
    loadResellerData();
}

function loadResellerData() {
    const startDate = document.getElementById("filterStart") ? document.getElementById("filterStart").value : null;
    const endDate = document.getElementById("filterEnd") ? document.getElementById("filterEnd").value : null;

    db.collection("orders").where("resellerId", "==", currentUser.id).onSnapshot(sOrders => {
        db.collection("redemptions").where("resellerId", "==", currentUser.id).where("status", "==", "Selesai").onSnapshot(sRedeems => {
            let q = 0, t = 0;
            let allDocs = sOrders.docs.sort((a, b) => (b.data().createdAt?.seconds || 0) - (a.data().createdAt?.seconds || 0));

            allDocs.forEach(d => {
                const o = d.data();
                if(o.status === 'Selesai') { q += (o.jumlah || 0); t += (o.total || 0); }
            });

            let usedPoints = 0;
            sRedeems.docs.forEach(d => { usedPoints += (d.data().points || 0); });
            currentPointsVal = Math.floor(t / 100) - usedPoints;

            document.getElementById("resQty").innerText = q.toLocaleString('id-ID');
            document.getElementById("resTotal").innerText = "Rp " + t.toLocaleString('id-ID');
            document.getElementById("resPoin").innerText = currentPointsVal.toLocaleString('id-ID');
            document.getElementById("displayMyPoints").innerText = currentPointsVal.toLocaleString('id-ID');

            let filteredDocs = [];
            let emptyMsg = "Tidak ada order hari ini";

            if (startDate && endDate) {
                const startRange = new Date(startDate).setHours(0, 0, 0, 0);
                const endRange = new Date(endDate).setHours(23, 59, 59, 999);
                filteredDocs = allDocs.filter(d => {
                    const created = d.data().createdAt?.toDate().getTime();
                    return created >= startRange && created <= endRange;
                });
                emptyMsg = "Tidak ada pesanan pada periode ini";
            } else {
                const todayStart = new Date().setHours(0, 0, 0, 0);
                const todayEnd = new Date().setHours(23, 59, 59, 999);
                filteredDocs = allDocs.filter(d => {
                    const created = d.data().createdAt?.toDate().getTime();
                    return created >= todayStart && created <= todayEnd;
                });
            }

            const tableBody = document.getElementById("resellerOrderTable");
            tableBody.innerHTML = filteredDocs.length > 0 ? filteredDocs.map(d => {
                const o = d.data();
                return `<tr><td>${o.customerName}</td><td>${o.produk}</td><td>Rp ${o.total.toLocaleString('id-ID')}</td><td><span style="color:${o.status==='Selesai'?'green':'orange'}; font-weight:800;">${o.status}</span></td></tr>`;
            }).join('') : `<tr><td colspan="4" style="text-align:center; padding:20px; color:#666;">${emptyMsg}</td></tr>`;
        });
    });
}

function loadResellerHistory() {
    // History Retur (4 Kolom)
    db.collection("returns").where("resellerId", "==", currentUser.id).onSnapshot(s => {
        let sorted = s.docs.sort((a, b) => (b.data().createdAt?.seconds || 0) - (a.data().createdAt?.seconds || 0));
        document.getElementById("resellerReturnHistory").innerHTML = sorted.map(doc => {
            const d = doc.data();
            return `<tr><td>${d.produk}</td><td><small>${d.alasan}</small></td><td>${d.hp}</td><td style="color:${d.status==='Selesai'?'green':'orange'}">${d.status || 'proses'}</td></tr>`;
        }).join('') || '<tr><td colspan="4" style="text-align:center">Belum ada riwayat retur</td></tr>';
    });

    // History Keluhan (4 Kolom)
    db.collection("complaints").where("resellerId", "==", currentUser.id).onSnapshot(s => {
        let sorted = s.docs.sort((a, b) => (b.data().createdAt?.seconds || 0) - (a.data().createdAt?.seconds || 0));
        document.getElementById("resellerCompHistory").innerHTML = sorted.map(doc => {
            const d = doc.data();
            return `<tr><td>${d.nama}</td><td><small>${d.pesan}</small></td><td>${d.hp}</td><td style="color:${d.status==='Selesai'?'green':'orange'}">${d.status || 'proses'}</td></tr>`;
        }).join('') || '<tr><td colspan="4" style="text-align:center">Belum ada riwayat keluhan</td></tr>';
    });
}

function loadResellerLeaderboard() {
    db.collection("users").where("role", "==", "reseller").onSnapshot(sUsers => {
        db.collection("orders").where("status", "==", "Selesai").onSnapshot(sOrders => {
            const allOrders = sOrders.docs.map(d => d.data());
            allRankings = sUsers.docs.map(u => {
                const total = allOrders.filter(o => o.resellerId === u.id).reduce((sum, o) => sum + (o.total || 0), 0);
                return { nama: u.data().nama, poin: Math.floor(total / 100) };
            }).sort((a, b) => b.poin - a.poin);
            renderRankTable();
        });
    });
}

function renderRankTable() {
    const startIdx = currentRankPage * 10;
    const endIdx = startIdx + 10;
    const pageData = allRankings.slice(startIdx, endIdx);

    document.getElementById("resellerLeaderboardTable").innerHTML = pageData.map((res, i) => `
        <tr>
            <td style="text-align: center;">${startIdx + i + 1}</td>
            <td style="text-align: left;">${res.nama}</td>
            <td style="text-align: right; padding-right: 20px; font-weight: bold;">
                ${res.poin.toLocaleString('id-ID')} Poin
            </td>
        </tr>
    `).join('') || '<tr><td colspan="3" style="text-align:center">Memuat...</td></tr>';
    
    if(document.getElementById("rankPageInfo")) {
        document.getElementById("rankPageInfo").innerText = `Rangking ${startIdx + 1} - ${Math.min(endIdx, 50, allRankings.length)}`;
    }
    if(document.getElementById("prevRank")) document.getElementById("prevRank").disabled = (currentRankPage === 0);
    if(document.getElementById("nextRank")) document.getElementById("nextRank").disabled = (currentRankPage >= 4 || startIdx + 10 >= allRankings.length);
}

function changeRankPage(dir) {
    currentRankPage += dir;
    renderRankTable();
}

function loadAdminData() {
    db.collection("users").where("role", "==", "reseller").where("isActive", "==", false).onSnapshot(snap => {
        if (!loadActivations) snap.docChanges().forEach(c => { if(c.type === "added") ping.play().catch(e=>{}); });
        loadActivations = false;
        if(document.getElementById("badgeActivation")) document.getElementById("badgeActivation").innerText = snap.size;
    });

    db.collection("orders").onSnapshot(snap => {
        if (!loadOrders) snap.docChanges().forEach(c => { if(c.type === "added") ping.play().catch(e=>{}); });
        loadOrders = false;
        let q=0, t=0, pending=0;
        let sorted = snap.docs.sort((a, b) => (b.data().createdAt?.seconds || 0) - (a.data().createdAt?.seconds || 0));
        document.getElementById("adminOrderTable").innerHTML = sorted.map(d => {
            const o = d.data();
            if(o.status === 'Selesai') { q++; t += (o.total || 0); }
            if(o.status === 'pending') pending++;
            return `<tr><td>${o.resellerName}</td><td>${o.customerName}</td><td>${o.produk}</td><td>${o.status==='pending'?`<button onclick="updateStat('orders','${d.id}')" style="background:#F2A93B; border:none; padding:5px 10px; border-radius:5px; color:white; font-weight:bold; cursor:pointer;">Selesai</button>`:'✅'}</td></tr>`;
        }).join('');
        document.getElementById("badgeOrder").innerText = pending;
        document.getElementById("admQty").innerText = q;
        document.getElementById("admTotal").innerText = "Rp " + t.toLocaleString('id-ID');
        document.getElementById("admPoin").innerText = Math.floor(t/100).toLocaleString('id-ID');
    });

    db.collection("returns").onSnapshot(snap => {
        if (!loadReturns) snap.docChanges().forEach(c => { if(c.type === "added") ping.play().catch(e=>{}); });
        loadReturns = false;
        document.getElementById("badgeReturn").innerText = snap.docs.filter(d => d.data().status === 'proses').length;
        document.getElementById("adminReturnTable").innerHTML = snap.docs.map(d => {
            const r = d.data();
            return `<tr><td><b>${r.nama}</b></td><td>${r.produk}</td><td>${r.status === 'proses' ? `<button onclick="updateStat('returns','${d.id}')">Selesai</button>` : '✅'}</td></tr>`;
        }).join('');
    });

    db.collection("complaints").onSnapshot(snap => {
        if (!loadComplaints) snap.docChanges().forEach(c => { if(c.type === "added") ping.play().catch(e=>{}); });
        loadComplaints = false;
        document.getElementById("badgeComplaint").innerText = snap.docs.filter(d => d.data().status === 'proses').length;
        document.getElementById("adminCompTable").innerHTML = snap.docs.map(d => {
            const c = d.data();
            return `<tr><td><b>${c.nama}</b></td><td>${c.pesan}</td><td>${c.status === 'proses' ? `<button onclick="updateStat('complaints','${d.id}')">Selesai</button>` : '✅'}</td></tr>`;
        }).join('');
    });

    db.collection("redemptions").onSnapshot(snap => {
        if (!loadRedeems) snap.docChanges().forEach(c => { if(c.type === "added") ping.play().catch(e=>{}); });
        loadRedeems = false;
        document.getElementById("adminRedeemTable").innerHTML = snap.docs.map(d => {
            const r = d.data();
            return `<tr><td><b>${r.resellerName}</b></td><td>${r.points.toLocaleString()}</td><td>${r.status === 'proses' ? `<button onclick="updateStat('redemptions','${d.id}')">Selesai</button>` : '✅'}</td></tr>`;
        }).join('');
    });
}

function loadActivationList() {
    db.collection("users").where("role", "==", "reseller").where("isActive", "==", false).onSnapshot(snap => {
        document.getElementById("adminActivationTable").innerHTML = snap.docs.map(doc => {
            const u = doc.data();
            return `<tr><td><b>${u.customId}</b></td><td>${u.nama}</td><td>${u.email}</td><td><button onclick="activateUser('${doc.id}')">AKTIFKAN</button></td></tr>`;
        }).join('');
    });
}

async function activateUser(uid) { if(confirm("Aktifkan?")) await db.collection("users").doc(uid).update({ isActive: true }); }
async function updateStat(coll, id) { if(confirm("Selesai?")) await db.collection(coll).doc(id).update({ status: "Selesai" }); }

function syncCatalog() {
    db.collection("products").onSnapshot(s => {
        catalog = s.docs.map(d => ({ id: d.id, ...d.data() }));
        const cs = document.getElementById("ordCatSelect");
        if(cs) {
            const cats = [...new Set(catalog.map(p => p.kategori || "Umum"))];
            cs.innerHTML = '<option value="Semua">Semua</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');
        }
        filterProductsByCategory();
    });
}

function filterProductsByCategory() {
    const cat = document.getElementById("ordCatSelect")?.value || "Semua";
    const ps = document.getElementById("ordProdSelect");
    if(!ps) return;
    let f = (cat === "Semua") ? catalog : catalog.filter(p => p.kategori === cat);
    ps.innerHTML = f.map(p => `<option value="${p.id}">${p.nama} - Rp${p.harga.toLocaleString('id-ID')}</option>`).join('');
}

function addToCart() {
    const pid = document.getElementById("ordProdSelect").value;
    const qty = parseInt(document.getElementById("ordQtyInput").value);
    const p = catalog.find(item => item.id === pid);
    if (p && qty > 0) { cart.push({ nama: p.nama, qty, subtotal: p.harga * qty }); renderCart(); }
}

function renderCart() {
    const tb = document.getElementById("cartTableBody"); let t = 0;
    tb.innerHTML = cart.map((item, index) => { t += item.subtotal; return `<tr><td>${item.nama} (${item.qty}x)</td><td>Rp ${item.subtotal.toLocaleString('id-ID')}</td><td onclick="cart.splice(${index},1);renderCart()" style="color:red; cursor:pointer;">X</td></tr>`; }).join('');
    document.getElementById("cartTotalText").innerText = "Total: Rp " + t.toLocaleString('id-ID');
}

document.getElementById("orderFormFinal").onsubmit = async (e) => {
    e.preventDefault();
    const cust = document.getElementById("ordCustomer").value, hp = document.getElementById("ordHp").value, pay = document.getElementById("ordPayment").value;
    const total = cart.reduce((s, i) => s + i.subtotal, 0);
    const detail = cart.map(i => `${i.nama} (${i.qty}x)`).join(", ");
    const detailWA = cart.map(i => `- ${i.nama} (${i.qty}x)`).join("%0A");

    try {
        await db.collection("orders").add({ resellerId: currentUser.id, resellerName: currentUser.nama, customerName: cust, customerHp: hp, produk: detail, total, jumlah: cart.reduce((s, i) => s + i.qty, 0), metode: pay, status: "pending", createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        const waText = `*--- PESANAN BARU ---*%0ANama: ${cust}%0AHP: ${hp}%0APembayaran: ${pay}%0A%0A*Detail:*%0A${detailWA}%0A%0ATotal: Rp ${total.toLocaleString('id-ID')}`;
        closeOrderModal(); window.open(`https://wa.me/62895345452412?text=${waText}`, '_blank');
    } catch(err) { alert(err.message); }
};

function renderSidebar() {
    const nav = document.getElementById("sidebarNav");
    let menu = (currentUser.role === 'admin') ? 
        `<div class="nav-item" onclick="showSection('secAdminDashboard')">📊 Dashboard Admin</div><div class="nav-item" onclick="showSection('secAdminActivation')">🔑 Aktivasi Akun</div><div class="nav-item" onclick="showSection('secAdminRedeem')">🎁 Penukaran Poin</div><div class="nav-item" onclick="showSection('secAdminRankings')">🏆 Peringkat Reseller</div>` :
        `<div class="nav-item" onclick="showSection('secResellerDashboard')">📊 Dashboard Reseller</div><div class="nav-item" onclick="showSection('secResellerReturn')">📦 Retur Barang</div><div class="nav-item" onclick="showSection('secResellerComplaint')">📢 Laporan Keluhan</div>`;
    nav.innerHTML = menu + `<div class="nav-item" onclick="showSection('secProfile')">👤 Profil Akun</div>`;
}

function showSection(id) {
    document.querySelectorAll('.app-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if(id === 'secAdminActivation') loadActivationList();
    toggleSidebar(false);
}

document.getElementById("loginForm").onsubmit = (e) => { 
    e.preventDefault(); 
    auth.signInWithEmailAndPassword(document.getElementById("loginEmail").value, document.getElementById("loginPassword").value)
    .catch(err => alert("Login Gagal: " + err.message));
};

// Fungsi pendukung UI lainnya tetap sama...
function logout() { auth.signOut(); }
function toggleSidebar(f) { document.getElementById("sidebar").classList.toggle("active", f); document.getElementById("sidebarOverlay").classList.toggle("active", f); }
function switchAuth(m) {
    document.getElementById("loginForm").classList.toggle("hidden", m==='register'); document.getElementById("registerForm").classList.toggle("hidden", m==='login');
    document.getElementById("tLog").classList.toggle("active", m==='login'); document.getElementById("tReg").classList.toggle("active", m==='register');
}
function openOrderModal() { document.getElementById("orderModal").classList.remove("hidden"); cart = []; renderCart(); goToStep1(); }
function closeOrderModal() { document.getElementById("orderModal").classList.add("hidden"); }
function goToStep2() { if(!cart.length) return alert("Pilih produk!"); document.getElementById("orderStep1").classList.add("hidden"); document.getElementById("orderStep2").classList.remove("hidden"); }
function goToStep1() { document.getElementById("orderStep1").classList.remove("hidden"); document.getElementById("orderStep2").classList.add("hidden"); }
function openRedeemModal() { document.getElementById("redeemModal").classList.remove("hidden"); }
function closeRedeemModal() { document.getElementById("redeemModal").classList.add("hidden"); }