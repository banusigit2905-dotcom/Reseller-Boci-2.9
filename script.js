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

// SISTEM NOTIFIKASI SUARA
const ping = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
let loadOrders = true, loadReturns = true, loadComplaints = true, loadRedeems = true;

// MONITORING STATUS LOGIN
auth.onAuthStateChanged(async (user) => {
    if (user) {
        const doc = await db.collection("users").doc(user.uid).get();
        if (doc.exists) {
            const data = doc.data();
            
            // PROTEKSI AKTIVASI (Kecuali Admin)
            if (data.role !== 'admin' && data.status !== 'aktif') {
                auth.signOut();
                showAuthMsg("Akun belum aktif. Silakan hubungi Admin untuk aktivasi.", "error");
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

function initApp() {
    document.getElementById("loginScreen").classList.add("hidden");
    document.getElementById("appWrapper").classList.remove("hidden");
    document.getElementById("userGreetName").innerText = currentUser.nama || "User";
    
    // Set UI Profil
    document.getElementById("profId").value = currentUser.userId || "Gagal Memuat ID";
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

// FUNGSI GENERATE ID USER (4 Huruf + 5 Angka)
function createUserID(nama) {
    let clean = nama.toUpperCase().replace(/\s/g, '');
    let text = clean.substring(0, 4).padEnd(4, 'X');
    let numbers = Math.floor(10000 + Math.random() * 90000);
    return text + numbers;
}

// PENDAFTARAN USER BARU
document.getElementById("registerForm").onsubmit = async (e) => {
    e.preventDefault();
    const nama = document.getElementById("regNama").value;
    const email = document.getElementById("regEmail").value;
    const pass = document.getElementById("regPassword").value;
    const generatedID = createUserID(nama);

    try {
        const cred = await auth.createUserWithEmailAndPassword(email, pass);
        
        // Simpan ke Firestore dengan status pending
        await db.collection("users").doc(cred.user.uid).set({
            nama: nama,
            email: email,
            userId: generatedID,
            role: 'reseller',
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Buat Link WA Aktivasi
        const msg = `HALO ADMIN OKTSHOP17\nSaya daftar reseller.\n\nNama: ${nama}\nID User: ${generatedID}\nEmail: ${email}\n\nMohon bantu aktivasi akun saya agar bisa mulai login. Terimakasih!`;
        
        auth.signOut(); // Langsung keluarkan
        showAuthMsg("Pendaftaran Berhasil! Akun sedang ditinjau Admin.", "success");
        
        // Buka WhatsApp
        window.open(`https://wa.me/62895345452412?text=${encodeURIComponent(msg)}`, '_blank');
        switchAuth('login');
    } catch(err) { alert("Daftar Gagal: " + err.message); }
};

// --- LOGIKA ADMIN ---
function loadAdminData() {
    // Orders + Sound
    db.collection("orders").orderBy("createdAt", "desc").onSnapshot(snap => {
        if (!loadOrders) snap.docChanges().forEach(c => { if(c.type === "added") ping.play().catch(e=>{}); });
        loadOrders = false;
        
        let totalQty=0, totalMoney=0, pendingCount=0, rows = "";
        snap.docs.forEach(doc => {
            const o = doc.data();
            if(o.status === 'Selesai') { totalQty++; totalMoney += o.total; }
            if(o.status === 'pending') {
                pendingCount++;
                rows += `<tr><td>${o.resellerName}</td><td>${o.customerName}</td><td>${o.produk}</td><td><button class="btn-gold-sm" onclick="updateStat('orders','${doc.id}')">Selesai</button></td></tr>`;
            } else {
                rows += `<tr><td>${o.resellerName}</td><td>${o.customerName}</td><td>${o.produk}</td><td>✅</td></tr>`;
            }
        });
        document.getElementById("adminOrderTable").innerHTML = rows;
        document.getElementById("badgeOrder").innerText = pendingCount;
        document.getElementById("admQty").innerText = totalQty;
        document.getElementById("admTotal").innerText = "Rp "+totalMoney.toLocaleString('id-ID');
        document.getElementById("admPoin").innerText = Math.floor(totalMoney/100).toLocaleString('id-ID');
    });

    // Aktivasi Akun
    db.collection("users").where("status", "==", "pending").onSnapshot(snap => {
        let rows = "";
        snap.docs.forEach(doc => {
            const u = doc.data();
            rows += `<tr><td><b>${u.nama}</b><br><small>${u.userId}</small></td><td>${u.email}</td><td><button onclick="activateUser('${doc.id}')" style="background:#2ecc71; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">AKTIFKAN</button></td></tr>`;
        });
        document.getElementById("adminActivationTable").innerHTML = rows;
    });

    // Redeem Poin + Sound
    db.collection("redemptions").orderBy("createdAt", "desc").onSnapshot(snap => {
        if (!loadRedeems) snap.docChanges().forEach(c => { if(c.type === "added") ping.play().catch(e=>{}); });
        loadRedeems = false;
        
        let rows = "";
        snap.docs.forEach(doc => {
            const r = doc.data();
            let action = r.status === 'proses' ? `<button onclick="updateStat('redemptions','${doc.id}')" style="background:#4A633C; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">Selesai</button>` : '✅ Berhasil';
            rows += `<tr><td><b>${r.resellerName}</b></td><td>${r.redeemName}</td><td>${r.points.toLocaleString()}</td><td>${r.wa}</td><td>${action}</td></tr>`;
        });
        document.getElementById("adminRedeemTable").innerHTML = rows;
    });

    // Retur + Complaints (Badge & Tabel)
    db.collection("returns").orderBy("createdAt", "desc").onSnapshot(s => {
        if (!loadReturns) s.docChanges().forEach(c => { if(c.type === "added") ping.play().catch(e=>{}); });
        loadReturns = false;
        document.getElementById("badgeReturn").innerText = s.docs.filter(d => d.data().status === 'proses').length;
        let rows = "";
        s.docs.forEach(doc => {
            const r = doc.data();
            rows += `<tr><td><b>${r.nama}</b><br><small>${r.hp}</small></td><td>${r.produk}<br><small>${r.alasan}</small></td><td>${r.status === 'proses' ? `<button onclick="updateStat('returns','${doc.id}')">Selesai</button>` : '✅'}</td></tr>`;
        });
        document.getElementById("adminReturnTable").innerHTML = rows;
    });

    db.collection("complaints").orderBy("createdAt", "desc").onSnapshot(s => {
        if (!loadComplaints) s.docChanges().forEach(c => { if(c.type === "added") ping.play().catch(e=>{}); });
        loadComplaints = false;
        document.getElementById("badgeComplaint").innerText = s.docs.filter(d => d.data().status === 'proses').length;
        let rows = "";
        s.docs.forEach(doc => {
            const c = doc.data();
            rows += `<tr><td><b>${c.nama}</b><br><small>${c.hp}</small></td><td>${c.pesan}</td><td>${c.status === 'proses' ? `<button onclick="updateStat('complaints','${doc.id}')">Selesai</button>` : '✅'}</td></tr>`;
        });
        document.getElementById("adminCompTable").innerHTML = rows;
    });
}

// AKTIFKAN USER (ADMIN)
async function activateUser(id) {
    if(confirm("Apakah Anda yakin ingin mengaktifkan akun reseller ini?")) {
        await db.collection("users").doc(id).update({ status: "aktif" });
        alert("Akun telah diaktifkan!");
    }
}

// --- LOGIKA RESELLER & POIN ---
function loadResellerData() {
    db.collection("orders").where("resellerId", "==", currentUser.id).onSnapshot(snapOrders => {
        db.collection("redemptions").where("resellerId", "==", currentUser.id).where("status", "==", "Selesai").onSnapshot(snapRedeems => {
            
            let qty=0, money=0, rows="";
            snapOrders.docs.forEach(d => {
                const o = d.data();
                if(o.status === 'Selesai') { qty += o.jumlah; money += o.total; }
                rows += `<tr><td>${o.customerName}</td><td>${o.produk}</td><td>Rp ${o.total.toLocaleString('id-ID')}</td><td>${o.status}</td></tr>`;
            });

            let usedPoints = 0;
            snapRedeems.docs.forEach(d => { usedPoints += d.data().points; });

            currentPointsVal = Math.floor(money / 100) - usedPoints;

            document.getElementById("resQty").innerText = qty;
            document.getElementById("resTotal").innerText = "Rp " + money.toLocaleString('id-ID');
            document.getElementById("resPoin").innerText = currentPointsVal.toLocaleString('id-ID');
            document.getElementById("displayMyPoints").innerText = currentPointsVal.toLocaleString('id-ID');
            document.getElementById("resellerOrderTable").innerHTML = rows;
        });
    });
}

// LOGIKA REDEEM MODAL
function goToRedeemStep2() {
    const val = parseInt(document.getElementById("redeemAmountSelect").value);
    if (currentPointsVal < val) {
        alert("Poin Anda tidak mencukupi untuk menukar " + val.toLocaleString() + " Poin.");
        return;
    }
    document.getElementById("redeemStep1").classList.add("hidden");
    document.getElementById("redeemStep2").classList.remove("hidden");
}

document.getElementById("formRedeemPoints").onsubmit = async (e) => {
    e.preventDefault();
    const val = parseInt(document.getElementById("redeemAmountSelect").value);
    const n = document.getElementById("redName").value;
    const w = document.getElementById("redWa").value;

    try {
        await db.collection("redemptions").add({
            resellerId: currentUser.id,
            resellerName: currentUser.nama,
            redeemName: n,
            wa: w,
            points: val,
            status: "proses",
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert("Berhasil diajukan! Admin akan memproses penukaran Anda.");
        closeRedeemModal();
    } catch(err) { alert(err.message); }
};

// SINKRONISASI KATALOG & FILTER
function syncCatalog() {
    db.collection("products").onSnapshot(s => {
        catalog = s.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Build Kategori
        const catList = [...new Set(catalog.map(p => p.kategori || "Tanpa Kategori"))];
        let options = '<option value="Semua">-- Semua Kategori --</option>';
        catList.forEach(c => { options += `<option value="${c}">${c}</option>`; });
        
        if(document.getElementById("ordCatSelect")) {
            document.getElementById("ordCatSelect").innerHTML = options;
            filterProductsByCategory();
        }
        
        if (currentUser && currentUser.role === 'admin') loadAdminCatalog();
    });
}

function filterProductsByCategory() {
    const cat = document.getElementById("ordCatSelect").value;
    let list = catalog;
    if (cat !== "Semua") { list = catalog.filter(p => (p.kategori || "Tanpa Kategori") === cat); }
    
    let prodOpts = "";
    list.forEach(p => { prodOpts += `<option value="${p.id}">${p.nama} - Rp${p.harga.toLocaleString('id-ID')}</option>`; });
    document.getElementById("ordProdSelect").innerHTML = prodOpts;
}

// KIRIM PESANAN WHATSAPP (FORMAT SESUAI GAMBAR)
document.getElementById("orderFormFinal").onsubmit = async (e) => {
    e.preventDefault();
    const cName = document.getElementById("ordCustomer").value;
    const cHp = document.getElementById("ordHp").value;
    const cPay = document.getElementById("ordPayment").value;
    const totalPay = cart.reduce((s, i) => s + i.subtotal, 0);
    const sumProds = cart.map(i => `${i.nama} (${i.qty}x)`).join(", ");

    try {
        // Save Database
        await db.collection("orders").add({
            resellerId: currentUser.id,
            resellerName: currentUser.nama,
            customerName: cName,
            customerHp: cHp,
            produk: sumProds,
            total: totalPay,
            jumlah: cart.reduce((s, i) => s + i.qty, 0),
            metode: cPay,
            status: "pending",
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Format Teks WA
        let waText = `PESANAN BARU\n`;
        waText += `Reseller: ${currentUser.nama}\n`;
        waText += `Penerima: ${cName}\n`;
        waText += `HP: ${cHp}\n`;
        waText += `Metode: ${cPay}\n\n`;
        waText += `Detail:\n`;
        cart.forEach((it, idx) => {
            waText += `  ${idx+1}. ${it.nama} (${it.qty}x) = Rp ${it.subtotal.toLocaleString('id-ID')}\n`;
        });
        waText += `\nTOTAL: Rp ${totalPay.toLocaleString('id-ID')}`;

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
    const b = document.getElementById("authMessage");
    b.innerText = t;
    b.className = type === "success" ? "bg-success" : "bg-error";
    b.classList.remove("hidden");
    setTimeout(() => b.classList.add("hidden"), 10000);
}
function showSection(id) {
    document.querySelectorAll('.app-section').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(id);
    if(target) target.classList.remove('hidden');
    if(id === 'secAdminRankings') loadRankings();
    if(id === 'secResellerDashboard') { loadResellerData(); loadResellerLeaderboard(); }
    toggleSidebar(false);
}
function toggleSidebar(f) {
    const s = document.getElementById("sidebar"), o = document.getElementById("sidebarOverlay");
    if(f===false){ s.classList.remove("active"); o.classList.remove("active"); }
    else { s.classList.toggle("active"); o.classList.toggle("active"); }
}
function logout() { auth.signOut(); }
async function updateStat(coll, id) { 
    if(confirm("Tandai laporan ini sebagai SELESAI?")) {
        await db.collection(coll).doc(id).update({ status: "Selesai" }); 
    }
}
function openOrderModal() { document.getElementById("orderModal").classList.remove("hidden"); cart = []; renderCart(); goToStep1(); }
function closeOrderModal() { document.getElementById("orderModal").classList.add("hidden"); }
function goToStep1() { document.getElementById("orderStep1").classList.remove("hidden"); document.getElementById("orderStep2").classList.add("hidden"); }
function goToStep2() { if(cart.length===0) return alert("List belanja kosong!"); document.getElementById("orderStep1").classList.add("hidden"); document.getElementById("orderStep2").classList.remove("hidden"); }

// LOGIN ACTION
document.getElementById("loginForm").onsubmit = (e) => {
    e.preventDefault();
    const em = document.getElementById("loginEmail").value;
    const ps = document.getElementById("loginPassword").value;
    auth.signInWithEmailAndPassword(em, ps).catch(err => showAuthMsg("Email/Password salah atau " + err.message, "error"));
};

// PROFILE UPDATE
document.getElementById("editProfileForm").onsubmit = async (e) => {
    e.preventDefault();
    await db.collection("users").doc(currentUser.id).update({
        nama: document.getElementById("profNama").value,
        hp: document.getElementById("profHp").value
    });
    alert("Profil Berhasil Diupdate!");
};

// CART LOGIC
function addToCart() {
    const pid = document.getElementById("ordProdSelect").value;
    const qty = parseInt(document.getElementById("ordQtyInput").value);
    const p = catalog.find(i => i.id === pid);
    if (p && qty > 0) { cart.push({ nama: p.nama, qty: qty, subtotal: p.harga * qty }); renderCart(); }
}
function renderCart() {
    let html = "", total = 0;
    cart.forEach((it, idx) => {
        total += it.subtotal;
        html += `<tr><td>${it.nama}</td><td>${it.qty}</td><td>Rp ${it.subtotal.toLocaleString('id-ID')}</td><td><button onclick="removeFromCart(${idx})" style="color:red; border:none; background:none;">X</button></td></tr>`;
    });
    document.getElementById("cartTableBody").innerHTML = html;
    document.getElementById("cartTotalText").innerText = "Total: Rp " + total.toLocaleString('id-ID');
}
function removeFromCart(i) { cart.splice(i, 1); renderCart(); }

// REDEEM MODAL UTILS
function openRedeemModal() { document.getElementById("redeemModal").classList.remove("hidden"); goToRedeemStep1(); }
function closeRedeemModal() { document.getElementById("redeemModal").classList.add("hidden"); }
function goToRedeemStep1() { document.getElementById("redeemStep1").classList.remove("hidden"); document.getElementById("redeemStep2").classList.add("hidden"); }

// KATALOG ADMIN UTILS
function loadAdminCatalog() {
    let html = "";
    catalog.forEach(p => {
        html += `<tr><td><b>${p.nama}</b></td><td>${p.kategori}</td><td>Rp ${p.harga.toLocaleString('id-ID')}</td><td><button onclick="prepareEditProduct('${p.id}')">Edit</button> <button onclick="deleteProduct('${p.id}')">Hapus</button></td></tr>`;
    });
    document.getElementById("adminCatalogTable").innerHTML = html;
}
function prepareEditProduct(id) {
    const p = catalog.find(i => i.id === id);
    if(p) {
        document.getElementById("prodId").value = p.id;
        document.getElementById("prodNama").value = p.nama;
        document.getElementById("prodHarga").value = p.harga;
        document.getElementById("prodKategori").value = p.kategori;
        document.getElementById("btnSaveProduct").innerText = "UPDATE PRODUK";
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}
async function deleteProduct(id) { if(confirm("Hapus produk?")) await db.collection("products").doc(id).delete(); }

document.getElementById("adminProductForm").onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById("prodId").value;
    const data = { 
        nama: document.getElementById("prodNama").value, 
        harga: parseInt(document.getElementById("prodHarga").value), 
        kategori: document.getElementById("prodKategori").value 
    };
    if(id) await db.collection("products").doc(id).update(data);
    else await db.collection("products").add(data);
    e.target.reset(); document.getElementById("prodId").value = ""; document.getElementById("btnSaveProduct").innerText = "SIMPAN PRODUK";
};

// RANKING & LEADERBOARD
async function loadRankings() {
    const users = await db.collection("users").where("role", "==", "reseller").get();
    const orders = await db.collection("orders").where("status", "==", "Selesai").get();
    let ranks = [];
    users.forEach(u => {
        let total = 0;
        orders.forEach(o => { if(o.data().resellerId === u.id) total += o.data().total; });
        ranks.push({ nama: u.data().nama, total: total, poin: Math.floor(total/100) });
    });
    ranks.sort((a, b) => b.total - a.total);
    let html = "";
    ranks.forEach((r, i) => { html += `<tr><td>${i+1}</td><td>${r.nama}</td><td>${r.poin}</td><td>Rp ${r.total.toLocaleString('id-ID')}</td></tr>`; });
    document.getElementById("adminRankTable").innerHTML = html;
}

async function loadResellerLeaderboard() {
    const users = await db.collection("users").where("role", "==", "reseller").get();
    const orders = await db.collection("orders").where("status", "==", "Selesai").get();
    let list = [];
    users.forEach(u => {
        let total = 0;
        orders.forEach(o => { if(o.data().resellerId === u.id) total += o.data().total; });
        list.push({ nama: u.data().nama, poin: Math.floor(total/100) });
    });
    list.sort((a, b) => b.poin - a.poin);
    let html = "";
    list.slice(0,10).forEach((it, i) => { html += `<tr><td>${i+1}</td><td>${it.nama}</td><td>${it.poin.toLocaleString('id-ID')} Poin</td></tr>`; });
    document.getElementById("resellerLeaderboardTable").innerHTML = html;
}

// LAPORAN & KELUHAN RESELLER
function loadResellerHistory() {
    db.collection("returns").where("resellerId", "==", currentUser.id).onSnapshot(s => {
        let h = ""; s.docs.forEach(doc => { const d = doc.data(); h += `<tr><td><b>${d.produk}</b></td><td>${d.nama}</td><td style="color:${d.status==='Selesai'?'green':'orange'}">${d.status}</td></tr>`; });
        document.getElementById("resellerReturnHistory").innerHTML = h;
    });
    db.collection("complaints").where("resellerId", "==", currentUser.id).onSnapshot(s => {
        let h = ""; s.docs.forEach(doc => { const d = doc.data(); h += `<tr><td>${d.pesan}</td><td>${d.nama}</td><td style="color:${d.status==='Selesai'?'green':'orange'}">${d.status}</td></tr>`; });
        document.getElementById("resellerCompHistory").innerHTML = h;
    });
}

document.getElementById("resellerReturnForm").onsubmit = async (e) => {
    e.preventDefault();
    await db.collection("returns").add({ resellerId: currentUser.id, nama: currentUser.nama, produk: document.getElementById("retProd").value, alasan: document.getElementById("retReason").value, hp: document.getElementById("retHp").value, status: "proses", createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    alert("Terkirim!"); e.target.reset();
};
document.getElementById("resellerComplaintForm").onsubmit = async (e) => {
    e.preventDefault();
    await db.collection("complaints").add({ resellerId: currentUser.id, nama: document.getElementById("compNama").value, hp: document.getElementById("compHp").value, pesan: document.getElementById("compText").value, status: "proses", createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    alert("Terkirim!"); e.target.reset();
};
