// CONFIGURASI FIREBASE
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

// VARIABEL GLOBAL
let currentUser = null;
let catalog = [];
let cart = [];
let currentPointsVal = 0;

// SISTEM SUARA & INITIAL LOAD TRACKER
const ping = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
let loadOrders = true, loadReturns = true, loadComplaints = true, loadRedeems = true;

// MONITORING STATUS LOGIN
auth.onAuthStateChanged(async function(user) {
    if (user) {
        const doc = await db.collection("users").doc(user.uid).get();
        if (doc.exists) {
            const data = doc.data();
            
            // CEK STATUS AKTIVASI
            if (data.role !== 'admin' && data.status !== 'aktif') {
                auth.signOut();
                showAuthMsg("Akun Anda belum aktif. Tunggu aktivasi Admin.", "error");
                return;
            }

            currentUser = { id: user.uid, ...data };
            initApp();
        }
    } else {
        document.getElementById("appWrapper").classList.add("hidden");
        document.getElementById("loginScreen").classList.remove("hidden");
    }
});

// FUNGSI INISIALISASI UTAMA
function initApp() {
    document.getElementById("loginScreen").classList.add("hidden");
    document.getElementById("appWrapper").classList.remove("hidden");
    document.getElementById("userGreetName").innerText = currentUser.nama || "User";
    
    // Set Data Profil
    document.getElementById("profId").value = currentUser.userId || "None";
    document.getElementById("profEmail").value = currentUser.email || "";
    document.getElementById("profNama").value = currentUser.nama || "";
    document.getElementById("profHp").value = currentUser.hp || "";

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

// FUNGSI BUAT ID USER (4 HURUF + 5 ANGKA)
function generateUserID(nama) {
    let clean = nama.toUpperCase().replace(/\s/g, '');
    let text = clean.substring(0, 4).padEnd(4, 'X');
    let numbers = Math.floor(10000 + Math.random() * 90000);
    return text + numbers;
}

// LOGIKA PENDAFTARAN
document.getElementById("registerForm").onsubmit = async function(e) {
    e.preventDefault();
    const nama = document.getElementById("regNama").value;
    const email = document.getElementById("regEmail").value;
    const pass = document.getElementById("regPassword").value;
    const newID = generateUserID(nama);

    try {
        const cred = await auth.createUserWithEmailAndPassword(email, pass);
        await db.collection("users").doc(cred.user.uid).set({
            nama: nama,
            email: email,
            userId: newID,
            role: 'reseller',
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        const waMsg = `HALO ADMIN OKTSHOP17\nSaya daftar reseller.\n\nNama: ${nama}\nID User: ${newID}\nEmail: ${email}\n\nMohon aktivasi akun saya agar bisa mulai login. Terimakasih!`;
        
        auth.signOut();
        showAuthMsg("Berhasil! Kirim pesan WA Aktivasi untuk mulai.", "success");
        window.open(`https://wa.me/62895345452412?text=${encodeURIComponent(waMsg)}`, '_blank');
        switchAuth('login');
    } catch(err) { alert(err.message); }
};

// --- LOGIKA DATA ADMIN ---
function loadAdminData() {
    // Orders
    db.collection("orders").onSnapshot(function(snap) {
        if (!loadOrders) snap.docChanges().forEach(c => { if(c.type === "added") ping.play().catch(e=>{}); });
        loadOrders = false;
        
        let q=0, t=0, pending=0, rows = "";
        snap.docs.forEach(doc => {
            const o = doc.data();
            if(o.status === 'Selesai') { q++; t += o.total; }
            if(o.status === 'pending') { pending++; }
            rows += `<tr><td>${o.resellerName}</td><td>${o.customerName}</td><td>${o.produk}</td><td>${o.status === 'pending' ? `<button onclick="updateStat('orders','${doc.id}')">Selesai</button>` : '✅'}</td></tr>`;
        });
        document.getElementById("adminOrderTable").innerHTML = rows;
        document.getElementById("badgeOrder").innerText = pending;
        document.getElementById("admQty").innerText = q;
        document.getElementById("admTotal").innerText = "Rp " + t.toLocaleString('id-ID');
        document.getElementById("admPoin").innerText = Math.floor(t/100).toLocaleString('id-ID');
    });

    // Aktivasi Akun
    db.collection("users").where("status", "==", "pending").onSnapshot(function(snap) {
        let rows = "";
        snap.docs.forEach(doc => {
            const u = doc.data();
            rows += `<tr><td><b>${u.nama}</b><br><small>${u.userId}</small></td><td>${u.email}</td><td><button onclick="activateUser('${doc.id}')" style="background:#2ecc71; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">AKTIFKAN</button></td></tr>`;
        });
        document.getElementById("adminActivationTable").innerHTML = rows;
    });

    // Penukaran Poin
    db.collection("redemptions").onSnapshot(function(snap) {
        if (!loadRedeems) snap.docChanges().forEach(c => { if(c.type === "added") ping.play().catch(e=>{}); });
        loadRedeems = false;
        
        let rows = "";
        snap.docs.forEach(doc => {
            const r = doc.data();
            rows += `<tr><td><b>${r.resellerName}</b></td><td>${r.redeemName}</td><td>${r.points.toLocaleString()}</td><td>${r.wa}</td><td>${r.status === 'proses' ? `<button onclick="updateStat('redemptions','${doc.id}')">Selesai</button>` : '✅'}</td></tr>`;
        });
        document.getElementById("adminRedeemTable").innerHTML = rows;
    });

    // Retur & Keluhan
    db.collection("returns").onSnapshot(s => {
        if (!loadReturns) s.docChanges().forEach(c => { if(c.type === "added") ping.play().catch(e=>{}); });
        loadReturns = false;
        document.getElementById("badgeReturn").innerText = s.docs.filter(d => d.data().status==='proses').length;
        document.getElementById("adminReturnTable").innerHTML = s.docs.map(d => {
            const r = d.data();
            return `<tr><td><b>${r.nama}</b></td><td>${r.produk}</td><td>${r.status==='proses'?`<button onclick="updateStat('returns','${d.id}')">Selesai</button>`:'✅'}</td></tr>`;
        }).join('');
    });
    db.collection("complaints").onSnapshot(s => {
        if (!loadComplaints) s.docChanges().forEach(c => { if(c.type === "added") ping.play().catch(e=>{}); });
        loadComplaints = false;
        document.getElementById("badgeComplaint").innerText = s.docs.filter(d => d.data().status==='proses').length;
        document.getElementById("adminCompTable").innerHTML = s.docs.map(d => {
            const c = d.data();
            return `<tr><td><b>${c.nama}</b></td><td>${c.pesan}</td><td>${c.status==='proses'?`<button onclick="updateStat('complaints','${d.id}')">Selesai</button>`:'✅'}</td></tr>`;
        }).join('');
    });
}

// AKTIFKAN USER (ADMIN)
async function activateUser(id) {
    if(confirm("Aktifkan akun ini?")) {
        await db.collection("users").doc(id).update({ status: "aktif" });
    }
}

// --- LOGIKA DATA RESELLER ---
function loadResellerData() {
    db.collection("orders").where("resellerId", "==", currentUser.id).onSnapshot(sO => {
        db.collection("redemptions").where("resellerId", "==", currentUser.id).where("status", "==", "Selesai").onSnapshot(sR => {
            let q = 0, t = 0, rows = "";
            sO.docs.forEach(d => {
                const o = d.data();
                if(o.status === 'Selesai') { q += o.jumlah; t += o.total; }
                rows += `<tr><td>${o.customerName}</td><td>${o.produk}</td><td>Rp ${o.total.toLocaleString('id-ID')}</td><td>${o.status}</td></tr>`;
            });

            let used = 0; sR.docs.forEach(d => { used += d.data().points; });
            currentPointsVal = Math.floor(t / 100) - used;

            document.getElementById("resQty").innerText = q;
            document.getElementById("resTotal").innerText = "Rp " + t.toLocaleString('id-ID');
            document.getElementById("resPoin").innerText = currentPointsVal.toLocaleString('id-ID');
            document.getElementById("displayMyPoints").innerText = currentPointsVal.toLocaleString('id-ID');
            document.getElementById("resellerOrderTable").innerHTML = rows;
        });
    });
}

// RIWAYAT RESELLER
function loadResellerHistory() {
    db.collection("returns").where("resellerId", "==", currentUser.id).onSnapshot(s => {
        document.getElementById("resellerReturnHistory").innerHTML = s.docs.map(doc => {
            const d = doc.data(); return `<tr><td><b>${d.produk}</b></td><td>${d.nama}</td><td style="color:${d.status==='Selesai'?'green':'orange'}">${d.status}</td></tr>`;
        }).join('');
    });
    db.collection("complaints").where("resellerId", "==", currentUser.id).onSnapshot(s => {
        document.getElementById("resellerCompHistory").innerHTML = s.docs.map(doc => {
            const d = doc.data(); return `<tr><td>${d.pesan}</td><td>${d.nama}</td><td style="color:${d.status==='Selesai'?'green':'orange'}">${d.status}</td></tr>`;
        }).join('');
    });
}

// --- LOGIKA KATALOG & PESANAN ---
function syncCatalog() {
    db.collection("products").onSnapshot(function(s) {
        catalog = s.docs.map(d => ({ id: d.id, ...d.data() }));
        
        const cs = document.getElementById("ordCatSelect");
        if(cs) {
            const cats = [...new Set(catalog.map(p => p.kategori || "Umum"))];
            let opt = '<option value="Semua">-- Semua --</option>';
            cats.forEach(c => { opt += `<option value="${c}">${c}</option>`; });
            cs.innerHTML = opt;
            filterProductsByCategory();
        }
        if (currentUser && currentUser.role === 'admin') loadAdminCatalog();
    });
}

function filterProductsByCategory() {
    const cat = document.getElementById("ordCatSelect")?.value || "Semua";
    const ps = document.getElementById("ordProdSelect");
    if(!ps) return;
    let filtered = catalog;
    if (cat !== "Semua") filtered = catalog.filter(p => (p.kategori || "Umum") === cat);
    
    let html = "";
    filtered.forEach(p => { html += `<option value="${p.id}">${p.nama} - Rp${p.harga.toLocaleString('id-ID')}</option>`; });
    ps.innerHTML = html;
}

// WHATSAPP PESANAN
document.getElementById("orderFormFinal").onsubmit = async function(e) {
    e.preventDefault();
    const cust = document.getElementById("ordCustomer").value, hp = document.getElementById("ordHp").value, pay = document.getElementById("ordPayment").value;
    const total = cart.reduce((s, i) => s + i.subtotal, 0);
    const ringkasan = cart.map(i => `${i.nama} (${i.qty}x)`).join(", ");
    
    try {
        await db.collection("orders").add({
            resellerId: currentUser.id, resellerName: currentUser.nama, customerName: cust, customerHp: hp, produk: ringkasan, total: total, jumlah: cart.reduce((s, i) => s + i.qty, 0), metode: pay, status: "pending", createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        let waText = `PESANAN BARU\nReseller: ${currentUser.nama}\nPenerima: ${cust}\nHP: ${hp}\nMetode: ${pay}\n\nDetail:\n`;
        cart.forEach((it, idx) => { waText += `  ${idx+1}. ${it.nama} (${it.qty}x) = Rp ${it.subtotal.toLocaleString('id-ID')}\n`; });
        waText += `\nTOTAL: Rp ${total.toLocaleString('id-ID')}`;

        closeOrderModal();
        window.open(`https://wa.me/62895345452412?text=${encodeURIComponent(waText)}`, '_blank');
    } catch(err) { alert(err.message); }
};

// --- FUNGSI TOOLS UI ---
function switchAuth(m) {
    document.getElementById("loginForm").classList.toggle("hidden", m==='register');
    document.getElementById("registerForm").classList.toggle("hidden", m==='login');
    document.getElementById("tLog").classList.toggle("active", m==='login');
    document.getElementById("tReg").classList.toggle("active", m==='register');
}
function showAuthMsg(t, type) {
    const b = document.getElementById("authMessage"); b.innerText = t;
    b.className = type === "success" ? "bg-success" : "bg-error"; b.classList.remove("hidden");
    setTimeout(() => b.classList.add("hidden"), 8000);
}
function toggleSidebar(f) {
    const s = document.getElementById("sidebar"), o = document.getElementById("sidebarOverlay");
    if(f===false){ s.classList.remove("active"); o.classList.remove("active"); } else { s.classList.toggle("active"); o.classList.toggle("active"); }
}
function showSection(id) {
    document.querySelectorAll('.app-section').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(id); if(target) target.classList.remove('hidden');
    if(id === 'secAdminRankings') loadRankings();
    if(id === 'secResellerDashboard') { loadResellerData(); loadResellerLeaderboard(); }
    toggleSidebar(false);
}
function logout() { auth.signOut(); }
async function updateStat(coll, id) { 
    if(confirm("Tandai Selesai?")) await db.collection(coll).doc(id).update({ status: "Selesai" }); 
}

// PROFIL & KATALOG UTILS
document.getElementById("loginForm").onsubmit = (e) => { e.preventDefault(); auth.signInWithEmailAndPassword(document.getElementById("loginEmail").value, document.getElementById("loginPassword").value); };
document.getElementById("editProfileForm").onsubmit = async (e) => { e.preventDefault(); await db.collection("users").doc(currentUser.id).update({ nama: document.getElementById("profNama").value, hp: document.getElementById("profHp").value }); alert("Profil Update!"); };

function loadAdminCatalog() {
    let h = ""; catalog.forEach(p => { h += `<tr><td><b>${p.nama}</b></td><td>${p.kategori}</td><td>Rp ${p.harga.toLocaleString('id-ID')}</td><td><button onclick="prepareEditProduct('${p.id}')">Edit</button> <button onclick="deleteProduct('${p.id}')">Hapus</button></td></tr>`; });
    document.getElementById("adminCatalogTable").innerHTML = h;
}
function prepareEditProduct(id) {
    const p = catalog.find(i => i.id === id); if(p) { document.getElementById("prodId").value = p.id; document.getElementById("prodNama").value = p.nama; document.getElementById("prodHarga").value = p.harga; document.getElementById("prodKategori").value = p.kategori; document.getElementById("btnSaveProduct").innerText = "UPDATE"; window.scrollTo({ top: 0, behavior: 'smooth' }); }
}
async function deleteProduct(id) { if(confirm("Hapus?")) await db.collection("products").doc(id).delete(); }
document.getElementById("adminProductForm").onsubmit = async (e) => {
    e.preventDefault(); const id = document.getElementById("prodId").value; const data = { nama: document.getElementById("prodNama").value, harga: parseInt(document.getElementById("prodHarga").value), kategori: document.getElementById("prodKategori").value };
    if(id) await db.collection("products").doc(id).update(data); else await db.collection("products").add(data);
    e.target.reset(); document.getElementById("prodId").value = ""; document.getElementById("btnSaveProduct").innerText = "SIMPAN";
};

// CART UTILS
function openOrderModal() { document.getElementById("orderModal").classList.remove("hidden"); cart = []; renderCart(); goToStep1(); }
function closeOrderModal() { document.getElementById("orderModal").classList.add("hidden"); }
function goToStep1() { document.getElementById("orderStep1").classList.remove("hidden"); document.getElementById("orderStep2").classList.add("hidden"); }
function goToStep2() { if(cart.length===0) return; document.getElementById("orderStep1").classList.add("hidden"); document.getElementById("orderStep2").classList.remove("hidden"); }
function addToCart() {
    const pid = document.getElementById("ordProdSelect").value, qty = parseInt(document.getElementById("ordQtyInput").value), p = catalog.find(i => i.id === pid);
    if (p && qty > 0) { cart.push({ nama: p.nama, qty: qty, subtotal: p.harga * qty }); renderCart(); }
}
function renderCart() {
    let h = "", total = 0; cart.forEach((it, idx) => { total += it.subtotal; h += `<tr><td>${it.nama}</td><td>${it.qty}</td><td>Rp ${it.subtotal.toLocaleString('id-ID')}</td><td><button onclick="removeFromCart(${idx})" style="color:red;border:none;background:none;">X</button></td></tr>`; });
    document.getElementById("cartTableBody").innerHTML = h; document.getElementById("cartTotalText").innerText = "Total: Rp " + total.toLocaleString('id-ID');
}
function removeFromCart(i) { cart.splice(i, 1); renderCart(); }

// REDEEM UTILS
function openRedeemModal() { document.getElementById("redeemModal").classList.remove("hidden"); goToRedeemStep1(); }
function closeRedeemModal() { document.getElementById("redeemModal").classList.add("hidden"); }
function goToRedeemStep1() { document.getElementById("redeemStep1").classList.remove("hidden"); document.getElementById("redeemStep2").classList.add("hidden"); }
function goToRedeemStep2() { if(currentPointsVal < parseInt(document.getElementById("redeemAmountSelect").value)) return alert("Poin tidak cukup!"); document.getElementById("redeemStep1").classList.add("hidden"); document.getElementById("redeemStep2").classList.remove("hidden"); }
document.getElementById("formRedeemPoints").onsubmit = async (e) => {
    e.preventDefault(); await db.collection("redemptions").add({ resellerId: currentUser.id, resellerName: currentUser.nama, redeemName: document.getElementById("redName").value, wa: document.getElementById("redWa").value, points: parseInt(document.getElementById("redeemAmountSelect").value), status: "proses", createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    alert("Berhasil!"); closeRedeemModal();
};

// RANKING
async function loadRankings() {
    const us = await db.collection("users").where("role", "==", "reseller").get();
    const os = await db.collection("orders").where("status", "==", "Selesai").get();
    let ranks = [];
    us.forEach(u => {
        let t = 0; os.forEach(o => { if(o.data().resellerId === u.id) t += o.data().total; });
        ranks.push({ nama: u.data().nama, total: t, poin: Math.floor(t/100) });
    });
    ranks.sort((a, b) => b.total - a.total);
    let h = ""; ranks.forEach((r, i) => { h += `<tr><td>${i+1}</td><td>${r.nama}</td><td>${r.poin}</td><td>Rp ${r.total.toLocaleString('id-ID')}</td></tr>`; });
    document.getElementById("adminRankTable").innerHTML = h;
}
async function loadResellerLeaderboard() {
    const us = await db.collection("users").where("role", "==", "reseller").get();
    const os = await db.collection("orders").where("status", "==", "Selesai").get();
    let list = [];
    us.forEach(u => {
        let t = 0; os.forEach(o => { if(o.data().resellerId === u.id) t += o.data().total; });
        list.push({ nama: u.data().nama, poin: Math.floor(t/100) });
    });
    list.sort((a, b) => b.poin - a.poin);
    let h = ""; list.slice(0,10).forEach((it, i) => { h += `<tr><td>${i+1}</td><td>${it.nama}</td><td>${it.poin.toLocaleString('id-ID')} Poin</td></tr>`; });
    document.getElementById("resellerLeaderboardTable").innerHTML = h;
}

// RETUR & COMPLAINT SUBMITS
document.getElementById("resellerReturnForm").onsubmit = async (e) => { e.preventDefault(); await db.collection("returns").add({ resellerId: currentUser.id, nama: currentUser.nama, produk: document.getElementById("retProd").value, alasan: document.getElementById("retReason").value, hp: document.getElementById("retHp").value, status: "proses", createdAt: firebase.firestore.FieldValue.serverTimestamp() }); alert("Terkirim!"); e.target.reset(); };
document.getElementById("resellerComplaintForm").onsubmit = async (e) => { e.preventDefault(); await db.collection("complaints").add({ resellerId: currentUser.id, nama: document.getElementById("compNama").value, hp: document.getElementById("compHp").value, pesan: document.getElementById("compText").value, status: "proses", createdAt: firebase.firestore.FieldValue.serverTimestamp() }); alert("Terkirim!"); e.target.reset(); };