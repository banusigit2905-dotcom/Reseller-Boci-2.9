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
let currentRankPage = 0; // 0 = 1-10, 1 = 11-20, dst.
let allRankings = [];

const ping = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
let loadOrders = true, loadReturns = true, loadComplaints = true, loadRedeems = true, loadActivations = true;

// --- LOGIKA AUTH & CEK AKTIVASI ---
auth.onAuthStateChanged(async (user) => {
    if (user) {
        const doc = await db.collection("users").doc(user.uid).get();
        if (doc.exists) {
            const userData = doc.data();
            
            // CEK STATUS AKTIF (Kecuali Admin)
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
    // 1. Tampilkan Aplikasi
    document.getElementById("loginScreen").classList.add("hidden");
    document.getElementById("appWrapper").classList.remove("hidden");
    
    // 2. Isi Nama & Custom ID (Agar tidak muncul tanda strip)
    document.getElementById("userGreetName").innerText = currentUser.nama || "User";
    if(document.getElementById("customId")) {
        document.getElementById("customId").innerText = currentUser.customId || "-";
    }

    // 3. Isi Form Profil
    if(document.getElementById("profEmail")) document.getElementById("profEmail").value = currentUser.email || "";
    if(document.getElementById("profNama")) document.getElementById("profNama").value = currentUser.nama || "";
    if(document.getElementById("profHp")) document.getElementById("profHp").value = currentUser.hp || "";

    // 4. Jalankan Menu
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
    }
}
// --- LOGIKA DAFTAR (CUSTOM ID & WA) ---
document.getElementById("registerForm").onsubmit = async (e) => {
    e.preventDefault();
    const nama = document.getElementById("regNama").value;
    const email = document.getElementById("regEmail").value;
    const pass = document.getElementById("regPassword").value;
    const hp = document.getElementById("regHp").value;

    // RULE ID: 4 huruf nama + 5 angka acak (Contoh: febi45678)
    const cleanNama = nama.replace(/\s/g, '').substring(0, 4).toLowerCase();
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const customId = cleanNama + randomNum;

    try {
        const cred = await auth.createUserWithEmailAndPassword(email, pass);
        await db.collection("users").doc(cred.user.uid).set({
            customId: customId,
            nama: nama,
            email: email,
            hp: hp,
            role: 'reseller',
            isActive: false, 
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        const waMsg = `Halo Admin, saya ingin aktivasi akun OKTSHOP17.%0ANama: ${nama}%0AEmail: ${email}%0ANo. HP: ${hp}%0AID User: ${customId}`;
        const adminWA = "62895345452412"; 

        alert("Pendaftaran Berhasil!\nID USER ANDA: " + customId + "\nKlik OK untuk kirim data aktivasi ke WhatsApp.");
        window.open(`https://wa.me/${adminWA}?text=${waMsg}`, '_blank');
        auth.signOut(); 
    } catch (err) {
        alert("Gagal Daftar: " + err.message);
    }
};

// --- LOGIKA POIN RESELLER ---
function loadResellerData() {
    const startDate = document.getElementById("filterStart").value;
    const endDate = document.getElementById("filterEnd").value;

    db.collection("orders").where("resellerId", "==", currentUser.id).onSnapshot(sOrders => {
        db.collection("redemptions").where("resellerId", "==", currentUser.id).where("status", "==", "Selesai").onSnapshot(sRedeems => {
            let q = 0, t = 0;
            
            // Hitung total poin & qty tanpa filter (untuk kartu statistik)
            sOrders.docs.forEach(d => {
                const o = d.data();
                if(o.status === 'Selesai') { q += (o.jumlah || 0); t += (o.total || 0); }
            });

            let usedPoints = 0;
            sRedeems.docs.forEach(d => { usedPoints += (d.data().points || 0); });
            currentPointsVal = Math.floor(t / 100) - usedPoints;

            document.getElementById("resQty").innerText = q;
            document.getElementById("resTotal").innerText = "Rp " + t.toLocaleString('id-ID');
            document.getElementById("resPoin").innerText = currentPointsVal.toLocaleString('id-ID');
            document.getElementById("displayMyPoints").innerText = currentPointsVal.toLocaleString('id-ID');

            // Render Tabel dengan Filter Tanggal
            let filteredDocs = sOrders.docs;
            if (startDate && endDate) {
                const start = new Date(startDate).getTime();
                const end = new Date(endDate).setHours(23,59,59,999);
                
                filteredDocs = sOrders.docs.filter(d => {
                    const created = d.data().createdAt?.toDate().getTime();
                    return created >= start && created <= end;
                });
            }

            document.getElementById("resellerOrderTable").innerHTML = filteredDocs.map(d => {
                const o = d.data();
                return `<tr><td>${o.customerName}</td><td>${o.produk}</td><td>Rp ${o.total.toLocaleString('id-ID')}</td><td>${o.status}</td></tr>`;
            }).join('');
        });
    });
}

// --- LOGIKA ADMIN DATA & AKTIVASI ---
function loadAdminData() {
    // 1. Monitor Aktivasi Akun (BARU: Badge & Suara)
    db.collection("users")
        .where("role", "==", "reseller")
        .where("isActive", "==", false)
        .onSnapshot(snap => {
            if (!loadActivations) {
                snap.docChanges().forEach(change => {
                    if (change.type === "added") ping.play().catch(e => {});
                });
            }
            loadActivations = false;
            const badgeAct = document.getElementById("badgeActivation");
            if(badgeAct) badgeAct.innerText = snap.size;
        });

    // 2. Pesanan
    db.collection("orders").orderBy("createdAt", "desc").onSnapshot(snap => {
        if (!loadOrders) snap.docChanges().forEach(c => { if(c.type === "added") ping.play().catch(e=>{}); });
        loadOrders = false;
        let q=0, t=0, pending=0;
        document.getElementById("adminOrderTable").innerHTML = snap.docs.map(d => {
            const o = d.data();
            if(o.status === 'Selesai') { q++; t += (o.total || 0); }
            if(o.status === 'pending') pending++;
            return `<tr><td>${o.resellerName}</td><td>${o.customerName}</td><td>${o.produk}</td><td>${o.status==='pending'?`<button onclick="updateStat('orders','${d.id}')" style="background:#F2A93B; border:none; padding:5px 10px; border-radius:5px; color:white; font-weight:bold; cursor:pointer;">Selesai</button>`:'✅'}</td></tr>`;
        }).join('');
        document.getElementById("badgeOrder").innerText = pending;
        document.getElementById("admQty").innerText = q;
        document.getElementById("admTotal").innerText = "Rp "+t.toLocaleString('id-ID');
        document.getElementById("admPoin").innerText = Math.floor(t/100).toLocaleString('id-ID');
    });

    // 3. Retur
    db.collection("returns").orderBy("createdAt", "desc").onSnapshot(snap => {
        if (!loadReturns) snap.docChanges().forEach(c => { if(c.type === "added") ping.play().catch(e=>{}); });
        loadReturns = false;
        document.getElementById("badgeReturn").innerText = snap.docs.filter(d => d.data().status === 'proses').length;
        document.getElementById("adminReturnTable").innerHTML = snap.docs.map(d => {
            const r = d.data();
            return `<tr><td><b>${r.nama}</b><br><small>${r.hp}</small></td><td>${r.produk}<br><i style="font-size:10px">${r.alasan}</i></td><td>${r.status === 'proses' ? `<button onclick="updateStat('returns','${d.id}')" style="background:#C62828; color:white; border:none; padding:5px; border-radius:4px; cursor:pointer;">Selesai</button>` : '✅'}</td></tr>`;
        }).join('');
    });

    // 4. Keluhan
    db.collection("complaints").orderBy("createdAt", "desc").onSnapshot(snap => {
        if (!loadComplaints) snap.docChanges().forEach(c => { if(c.type === "added") ping.play().catch(e=>{}); });
        loadComplaints = false;
        document.getElementById("badgeComplaint").innerText = snap.docs.filter(d => d.data().status === 'proses').length;
        document.getElementById("adminCompTable").innerHTML = snap.docs.map(d => {
            const c = d.data();
            return `<tr><td><b>${c.nama}</b><br><small>${c.hp}</small></td><td>${c.pesan}</td><td>${c.status === 'proses' ? `<button onclick="updateStat('complaints','${d.id}')" style="background:#C62828; color:white; border:none; padding:5px; border-radius:4px; cursor:pointer;">Selesai</button>` : '✅'}</td></tr>`;
        }).join('');
    });

    // 5. Penukaran Poin
    db.collection("redemptions").orderBy("createdAt", "desc").onSnapshot(snap => {
        if (!loadRedeems) snap.docChanges().forEach(c => { if(c.type === "added") ping.play().catch(e=>{}); });
        loadRedeems = false;
        document.getElementById("adminRedeemTable").innerHTML = snap.docs.map(d => {
            const r = d.data();
            return `<tr><td><b>${r.resellerName}</b></td><td>${r.redeemName}</td><td>${r.points.toLocaleString()}</td><td>${r.wa}</td><td>${r.status === 'proses' ? `<button onclick="updateStat('redemptions','${d.id}')" style="background:#4A633C; color:white; border:none; padding:5px; border-radius:4px; cursor:pointer;">Selesai</button>` : '✅'}</td></tr>`;
        }).join('');
    });
}

// KHUSUS ADMIN: LOAD DATA AKTIVASI
function loadActivationList() {
    db.collection("users").where("role", "==", "reseller").where("isActive", "==", false).onSnapshot(snap => {
        const table = document.getElementById("adminActivationTable");
        if(!table) return;
        table.innerHTML = snap.docs.map(doc => {
            const u = doc.data();
            return `<tr>
                <td><b>${u.customId || '-'}</b></td>
                <td>${u.nama}</td>
                <td>${u.email}<br><small>${u.hp || '-'}</small></td>
                <td><button onclick="activateUser('${doc.id}')" style="background:#4A633C; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">AKTIFKAN</button></td>
            </tr>`;
        }).join('');
    });
}

async function activateUser(uid) {
    if(confirm("Aktifkan user ini?")) {
        await db.collection("users").doc(uid).update({ isActive: true });
        alert("User diaktifkan!");
    }
}

// --- KATALOG, ORDER, & CART ---
function syncCatalog() {
    db.collection("products").onSnapshot(s => {
        catalog = s.docs.map(d => ({ id: d.id, ...d.data() }));
        const cs = document.getElementById("ordCatSelect");
        if(cs) {
            const cats = [...new Set(catalog.map(p => p.kategori || "Tanpa Kategori"))];
            cs.innerHTML = '<option value="Semua">-- Semua Kategori --</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');
        }
        filterProductsByCategory();
        if (currentUser.role === 'admin') loadAdminCatalog();
    });
}

function filterProductsByCategory() {
    const cat = document.getElementById("ordCatSelect")?.value || "Semua";
    const ps = document.getElementById("ordProdSelect");
    if(!ps) return;
    let f = catalog;
    if (cat !== "Semua") f = catalog.filter(p => (p.kategori || "Tanpa Kategori") === cat);
    ps.innerHTML = f.map(p => `<option value="${p.id}">${p.nama} - Rp${p.harga.toLocaleString('id-ID')}</option>`).join('');
}

function loadAdminCatalog() {
    const table = document.getElementById("adminCatalogTable");
    if(!table) return;
    table.innerHTML = catalog.map(p => `<tr><td><b>${p.nama}</b></td><td>${p.kategori || '-'}</td><td>Rp ${p.harga.toLocaleString('id-ID')}</td><td><button onclick="prepareEditProduct('${p.id}')">Edit</button> <button onclick="deleteProduct('${p.id}')">Hapus</button></td></tr>`).join('');
}

function addToCart() {
    const pid = document.getElementById("ordProdSelect").value;
    const qty = parseInt(document.getElementById("ordQtyInput").value);
    const p = catalog.find(item => item.id === pid);
    if (p && qty > 0) { cart.push({ nama: p.nama, qty, subtotal: p.harga * qty }); renderCart(); }
}

function renderCart() {
    const tb = document.getElementById("cartTableBody"); let t = 0;
    tb.innerHTML = cart.map((item, index) => { t += item.subtotal; return `<tr><td>${item.nama}</td><td>${item.qty}</td><td>Rp ${item.subtotal.toLocaleString('id-ID')}</td><td><button onclick="removeFromCart(${index})">X</button></td></tr>`; }).join('');
    document.getElementById("cartTotalText").innerText = "Total: Rp " + t.toLocaleString('id-ID');
}

function removeFromCart(i) { cart.splice(i, 1); renderCart(); }

document.getElementById("orderFormFinal").onsubmit = async (e) => {
    e.preventDefault();
    const cust = document.getElementById("ordCustomer").value, hp = document.getElementById("ordHp").value, pay = document.getElementById("ordPayment").value;
    const total = cart.reduce((s, i) => s + i.subtotal, 0);
    const ringkasan = cart.map(i => `${i.nama} (${i.qty}x)`).join(", ");
    try {
        await db.collection("orders").add({ resellerId: currentUser.id, resellerName: currentUser.nama, customerName: cust, customerHp: hp, produk: ringkasan, total, jumlah: cart.reduce((s, i) => s + i.qty, 0), metode: pay, status: "pending", createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        let pesan = `PESANAN BARU\nReseller: ${currentUser.nama}\nPenerima: ${cust}\nHP: ${hp}\nMetode: ${pay}\n\nDetail:\n` + cart.map((item, i) => `  ${i+1}. ${item.nama} (${item.qty}x) = Rp ${item.subtotal.toLocaleString('id-ID')}`).join("\n") + `\n\nTOTAL: Rp ${total.toLocaleString('id-ID')}`;
        closeOrderModal(); window.open(`https://wa.me/62895345452412?text=${encodeURIComponent(pesan)}`, '_blank');
    } catch(err) { alert(err.message); }
};

// --- NAVIGATION & UI ---
function renderSidebar() {
    const nav = document.getElementById("sidebarNav");
    let menu = '';
    if (currentUser.role === 'admin') {
        menu = `<div class="nav-item" onclick="showSection('secAdminDashboard')">📊 Dashboard Admin</div>
        <div class="nav-item" onclick="showSection('secAdminActivation')">🔑 Aktivasi Akun</div>
        <div class="nav-item" onclick="showSection('secAdminRedeem')">🎁 Penukaran Poin</div>
        <div class="nav-item" onclick="showSection('secAdminCatalog')">📦 Update Katalog</div>
        <div class="nav-item" onclick="showSection('secAdminRankings')">🏆 Peringkat Reseller</div>
        <div class="nav-item" onclick="showSection('secAdminReturn')">📥 Returan Masuk</div>
        <div class="nav-item" onclick="showSection('secAdminComplaint')">📢 Keluhan Masuk</div>`;
    } else {
        menu = `<div class="nav-item" onclick="showSection('secResellerDashboard')">📊 Dashboard Reseller</div>
        <div class="nav-item" onclick="showSection('secResellerReturn')">📦 Retur Barang</div>
        <div class="nav-item" onclick="showSection('secResellerComplaint')">📢 Laporan Keluhan</div>`;
    }
    menu += `<div class="nav-item" onclick="showSection('secProfile')">👤 Profil Akun</div>`;
    nav.innerHTML = menu;
}

function showSection(id) {
    document.querySelectorAll('.app-section').forEach(s => s.classList.add('hidden'));
    const t = document.getElementById(id);
    if(t) t.classList.remove('hidden');
    
    if(id === 'secAdminActivation') loadActivationList();
    if(id === 'secAdminRankings') loadRankings();
    if(id === 'secResellerDashboard') { loadResellerData(); loadResellerLeaderboard(); }
    toggleSidebar(false);
}

// --- FUNGSI PENDUKUNG LAINNYA ---
async function loadRankings() {
    const us = await db.collection("users").where("role", "==", "reseller").get();
    const os = await db.collection("orders").where("status", "==", "Selesai").get();
    const all = os.docs.map(d => d.data());
    let ranks = us.docs.map(u => {
        const total = all.filter(o => o.resellerId === u.id).reduce((s, o) => s + (o.total || 0), 0);
        return { nama: u.data().nama, total, poin: Math.floor(total / 100) };
    });
    ranks.sort((a, b) => b.total - a.total);
    document.getElementById("adminRankTable").innerHTML = ranks.map((r, i) => `<tr><td>${i+1}</td><td>${r.nama}</td><td>${r.poin}</td><td>Rp ${r.total.toLocaleString('id-ID')}</td></tr>`).join('');
}

async function loadResellerLeaderboard() {
    const us = await db.collection("users").where("role", "==", "reseller").get();
    const os = await db.collection("orders").where("status", "==", "Selesai").get();
    const allOrders = os.docs.map(d => d.data());

    // Hitung semua rangking
    allRankings = us.docs.map(u => {
        const total = allOrders.filter(o => o.resellerId === u.id).reduce((s, o) => s + (o.total || 0), 0);
        return { nama: u.data().nama, poin: Math.floor(total / 100) };
    });

    // Urutkan dari poin tertinggi
    allRankings.sort((a, b) => b.poin - a.poin);

    renderRankTable();
}

function renderRankTable() {
    const startIdx = currentRankPage * 10;
    const endIdx = startIdx + 10;
    const pageData = allRankings.slice(startIdx, endIdx);

    // Update Tampilan Tabel
    document.getElementById("resellerLeaderboardTable").innerHTML = pageData.map((res, i) => `
        <tr>
            <td>${startIdx + i + 1}</td>
            <td>${res.nama}</td>
            <td>${res.poin.toLocaleString('id-ID')} Poin</td>
        </tr>
    `).join('');

    // Update Info Halaman
    document.getElementById("rankPageInfo").innerText = `Rangking ${startIdx + 1} - ${Math.min(endIdx, 50)}`;

    // Update Button State
    document.getElementById("prevRank").disabled = (currentRankPage === 0);
    // Maksimal 50 rangking = 5 halaman (0,1,2,3,4)
    document.getElementById("nextRank").disabled = (currentRankPage >= 4 || endIdx >= allRankings.length);
}

function changeRankPage(dir) {
    currentRankPage += dir;
    if (currentRankPage < 0) currentRankPage = 0;
    if (currentRankPage > 4) currentRankPage = 4;
    renderRankTable();
}

async function updateStat(coll, id) { if(confirm("Tandai Selesai?")) await db.collection(coll).doc(id).update({ status: "Selesai" }); }
function logout() { auth.signOut(); }
function toggleSidebar(f) {
    const s = document.getElementById("sidebar"), o = document.getElementById("sidebarOverlay");
    if(f===false){ s.classList.remove("active"); o.classList.remove("active"); }
    else { s.classList.toggle("active"); o.classList.toggle("active"); }
}
function switchAuth(m) {
    document.getElementById("loginForm").classList.toggle("hidden", m==='register');
    document.getElementById("registerForm").classList.toggle("hidden", m==='login');
    document.getElementById("tLog").classList.toggle("active", m==='login');
    document.getElementById("tReg").classList.toggle("active", m==='register');
}
function openOrderModal() { document.getElementById("orderModal").classList.remove("hidden"); cart = []; renderCart(); goToStep1(); }
function closeOrderModal() { document.getElementById("orderModal").classList.add("hidden"); }
function goToStep2() { if (cart.length === 0) return alert("Pilih produk!"); document.getElementById("orderStep1").classList.add("hidden"); document.getElementById("orderStep2").classList.remove("hidden"); }
function goToStep1() { document.getElementById("orderStep1").classList.remove("hidden"); document.getElementById("orderStep2").classList.add("hidden"); }

document.getElementById("loginForm").onsubmit = (e) => { e.preventDefault(); auth.signInWithEmailAndPassword(document.getElementById("loginEmail").value, document.getElementById("loginPassword").value); };
document.getElementById("editProfileForm").onsubmit = async (e) => { e.preventDefault(); await db.collection("users").doc(currentUser.id).update({ nama: document.getElementById("profNama").value, hp: document.getElementById("profHp").value }); alert("Profil Update!"); };
document.getElementById("resellerReturnForm").onsubmit = async (e) => { e.preventDefault(); await db.collection("returns").add({ resellerId: currentUser.id, nama: currentUser.nama, produk: document.getElementById("retProd").value, alasan: document.getElementById("retReason").value, hp: document.getElementById("retHp").value, status: "proses", createdAt: firebase.firestore.FieldValue.serverTimestamp() }); alert("Retur Dikirim!"); e.target.reset(); };
document.getElementById("resellerComplaintForm").onsubmit = async (e) => { e.preventDefault(); await db.collection("complaints").add({ resellerId: currentUser.id, nama: document.getElementById("compNama").value, hp: document.getElementById("compHp").value, pesan: document.getElementById("compText").value, status: "proses", createdAt: firebase.firestore.FieldValue.serverTimestamp() }); alert("Keluhan Dikirim!"); e.target.reset(); };
