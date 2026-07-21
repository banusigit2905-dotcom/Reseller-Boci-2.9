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
let currentPointsVal = 0; // Global points tracker

const ping = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
let loadOrders = true, loadReturns = true, loadComplaints = true, loadRedeems = true;

auth.onAuthStateChanged(async (user) => {
    if (user) {
        const doc = await db.collection("users").doc(user.uid).get();
        if (doc.exists) {
            currentUser = { id: user.uid, ...doc.data() };
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
    }
}

// LOGIKA POIN & DATA RESELLER
function loadResellerData() {
    // Listen Orders
    db.collection("orders").where("resellerId", "==", currentUser.id).onSnapshot(sOrders => {
        // Listen Redeems (untuk perhitungan poin keluar)
        db.collection("redemptions").where("resellerId", "==", currentUser.id).where("status", "==", "Selesai").onSnapshot(sRedeems => {
            
            let q = 0, t = 0;
            sOrders.docs.forEach(d => {
                const o = d.data();
                if(o.status === 'Selesai') { q += (o.jumlah || 0); t += (o.total || 0); }
            });

            // Hitung poin yang sudah terpakai (Validated Redeems)
            let usedPoints = 0;
            sRedeems.docs.forEach(d => { usedPoints += (d.data().points || 0); });

            const totalEarnedPoints = Math.floor(t / 100);
            currentPointsVal = totalEarnedPoints - usedPoints;

            // Update UI Dashboard
            document.getElementById("resQty").innerText = q;
            document.getElementById("resTotal").innerText = "Rp " + t.toLocaleString('id-ID');
            document.getElementById("resPoin").innerText = currentPointsVal.toLocaleString('id-ID');
            
            // Update UI Modal Tukar Poin
            document.getElementById("displayMyPoints").innerText = currentPointsVal.toLocaleString('id-ID');

            // Render Tabel Pesanan
            document.getElementById("resellerOrderTable").innerHTML = sOrders.docs.map(d => {
                const o = d.data();
                return `<tr><td>${o.customerName}</td><td>${o.produk}</td><td>Rp ${o.total.toLocaleString('id-ID')}</td><td>${o.status}</td></tr>`;
            }).join('');
        });
    });
}

// LOGIKA ADMIN DATA
function loadAdminData() {
    // 1. Pesanan
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

    // 2. Retur
    db.collection("returns").orderBy("createdAt", "desc").onSnapshot(snap => {
        if (!loadReturns) snap.docChanges().forEach(c => { if(c.type === "added") ping.play().catch(e=>{}); });
        loadReturns = false;
        document.getElementById("badgeReturn").innerText = snap.docs.filter(d => d.data().status === 'proses').length;
        document.getElementById("adminReturnTable").innerHTML = snap.docs.map(d => {
            const r = d.data();
            return `<tr><td><b>${r.nama}</b><br><small>${r.hp}</small></td><td>${r.produk}<br><i style="font-size:10px">${r.alasan}</i></td><td>${r.status === 'proses' ? `<button onclick="updateStat('returns','${d.id}')" style="background:#C62828; color:white; border:none; padding:5px; border-radius:4px; cursor:pointer;">Selesai</button>` : '✅'}</td></tr>`;
        }).join('');
    });

    // 3. Keluhan
    db.collection("complaints").orderBy("createdAt", "desc").onSnapshot(snap => {
        if (!loadComplaints) snap.docChanges().forEach(c => { if(c.type === "added") ping.play().catch(e=>{}); });
        loadComplaints = false;
        document.getElementById("badgeComplaint").innerText = snap.docs.filter(d => d.data().status === 'proses').length;
        document.getElementById("adminCompTable").innerHTML = snap.docs.map(d => {
            const c = d.data();
            return `<tr><td><b>${c.nama}</b><br><small>${c.hp}</small></td><td>${c.pesan}</td><td>${c.status === 'proses' ? `<button onclick="updateStat('complaints','${d.id}')" style="background:#C62828; color:white; border:none; padding:5px; border-radius:4px; cursor:pointer;">Selesai</button>` : '✅'}</td></tr>`;
        }).join('');
    });

    // 4. Penukaran Poin (BARU)
    db.collection("redemptions").orderBy("createdAt", "desc").onSnapshot(snap => {
        if (!loadRedeems) snap.docChanges().forEach(c => { if(c.type === "added") ping.play().catch(e=>{}); });
        loadRedeems = false;
        document.getElementById("adminRedeemTable").innerHTML = snap.docs.map(d => {
            const r = d.data();
            return `<tr>
                <td><b>${r.resellerName}</b></td>
                <td>${r.redeemName}</td>
                <td>${r.points.toLocaleString()}</td>
                <td>${r.wa}</td>
                <td>${r.status === 'proses' ? `<button onclick="updateStat('redemptions','${d.id}')" style="background:#4A633C; color:white; border:none; padding:5px; border-radius:4px; cursor:pointer;">Selesai</button>` : '✅'}</td>
            </tr>`;
        }).join('');
    });
}

// LOGIKA MODAL TUKAR POIN
function openRedeemModal() { 
    document.getElementById("redeemModal").classList.remove("hidden"); 
    goToRedeemStep1(); 
}
function closeRedeemModal() { document.getElementById("redeemModal").classList.add("hidden"); }
function goToRedeemStep1() { document.getElementById("redeemStep1").classList.remove("hidden"); document.getElementById("redeemStep2").classList.add("hidden"); }
function goToRedeemStep2() { 
    const amount = parseInt(document.getElementById("redeemAmountSelect").value);
    if(currentPointsVal < amount) return alert("Poin Anda tidak mencukupi untuk menukar jumlah ini!");
    document.getElementById("redeemStep1").classList.add("hidden"); 
    document.getElementById("redeemStep2").classList.remove("hidden"); 
}

document.getElementById("formRedeemPoints").onsubmit = async (e) => {
    e.preventDefault();
    const amount = parseInt(document.getElementById("redeemAmountSelect").value);
    const rName = document.getElementById("redName").value;
    const rWa = document.getElementById("redWa").value;

    if(confirm(`Konfirmasi penukaran ${amount.toLocaleString()} Poin?`)) {
        try {
            await db.collection("redemptions").add({
                resellerId: currentUser.id,
                resellerName: currentUser.nama,
                redeemName: rName,
                wa: rWa,
                points: amount,
                status: "proses",
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            alert("Pengajuan Berhasil! Tunggu verifikasi Admin agar poin Anda terpotong.");
            closeRedeemModal();
        } catch(err) { alert(err.message); }
    }
};

// MANAJEMEN KATALOG & UI UTILS
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
    table.innerHTML = catalog.map(p => `<tr><td><b>${p.nama}</b></td><td>${p.kategori || '-'}</td><td>Rp ${p.harga.toLocaleString('id-ID')}</td><td><button onclick="prepareEditProduct('${p.id}')" style="color:blue; border:1px solid blue; background:none; padding:2px 5px; cursor:pointer;">Edit</button> <button onclick="deleteProduct('${p.id}')" style="color:red; border:1px solid red; background:none; padding:2px 5px; cursor:pointer;">Hapus</button></td></tr>`).join('');
}

function prepareEditProduct(id) {
    const p = catalog.find(item => item.id === id);
    if(p) {
        document.getElementById("prodId").value = p.id; document.getElementById("prodNama").value = p.nama; document.getElementById("prodHarga").value = p.harga; document.getElementById("prodKategori").value = p.kategori || "";
        document.getElementById("btnSaveProduct").innerText = "UPDATE PRODUK"; window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

async function deleteProduct(id) { if (confirm("Hapus produk?")) await db.collection("products").doc(id).delete(); }

document.getElementById("adminProductForm").onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById("prodId").value;
    const data = { nama: document.getElementById("prodNama").value, harga: parseInt(document.getElementById("prodHarga").value), kategori: document.getElementById("prodKategori").value };
    if (id) await db.collection("products").doc(id).update(data);
    else await db.collection("products").add(data);
    e.target.reset(); document.getElementById("prodId").value = ""; document.getElementById("btnSaveProduct").innerText = "SIMPAN PRODUK";
};

// ORDER & CART
function addToCart() {
    const pid = document.getElementById("ordProdSelect").value;
    const qty = parseInt(document.getElementById("ordQtyInput").value);
    const p = catalog.find(item => item.id === pid);
    if (p && qty > 0) { cart.push({ nama: p.nama, qty, subtotal: p.harga * qty }); renderCart(); }
}
function renderCart() {
    const tb = document.getElementById("cartTableBody"); let t = 0;
    tb.innerHTML = cart.map((item, index) => { t += item.subtotal; return `<tr><td>${item.nama}</td><td>${item.qty}</td><td>Rp ${item.subtotal.toLocaleString('id-ID')}</td><td><button onclick="removeFromCart(${index})" style="color:red; border:none; background:none; font-weight:bold; cursor:pointer;">X</button></td></tr>`; }).join('');
    document.getElementById("cartTotalText").innerText = "Total: Rp " + t.toLocaleString('id-ID');
}
function removeFromCart(i) { cart.splice(i, 1); renderCart(); }
function goToStep2() { if (cart.length === 0) return alert("Pilih produk!"); document.getElementById("orderStep1").classList.add("hidden"); document.getElementById("orderStep2").classList.remove("hidden"); }
function goToStep1() { document.getElementById("orderStep1").classList.remove("hidden"); document.getElementById("orderStep2").classList.add("hidden"); }

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

// UI & AUTH UTILS
function loadResellerHistory() {
    db.collection("returns").where("resellerId", "==", currentUser.id).onSnapshot(s => {
        document.getElementById("resellerReturnHistory").innerHTML = s.docs.map(doc => {
            const d = doc.data();
            return `<tr><td><b>${d.produk}</b><br><small>${d.alasan}</small></td><td>${d.nama}</td><td>${d.hp}</td><td style="color:${d.status==='Selesai'?'green':'orange'}">${d.status || 'proses'}</td></tr>`;
        }).join('');
    });
    db.collection("complaints").where("resellerId", "==", currentUser.id).onSnapshot(s => {
        document.getElementById("resellerCompHistory").innerHTML = s.docs.map(doc => {
            const d = doc.data();
            return `<tr><td>${d.pesan}</td><td>${d.nama}</td><td>${d.hp}</td><td style="color:${d.status==='Selesai'?'green':'orange'}">${d.status || 'proses'}</td></tr>`;
        }).join('');
    });
}

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
    const all = os.docs.map(d => d.data());
    let ldb = us.docs.map(u => {
        const total = all.filter(o => o.resellerId === u.id).reduce((s, o) => s + (o.total || 0), 0);
        return { nama: u.data().nama, poin: Math.floor(total / 100) };
    });
    ldb.sort((a, b) => b.poin - a.poin);
    document.getElementById("resellerLeaderboardTable").innerHTML = ldb.slice(0, 10).map((res, i) => `<tr><td>${i+1}</td><td>${res.nama}</td><td>${res.poin.toLocaleString('id-ID')} Poin</td></tr>`).join('');
}

async function updateStat(coll, id) { if(confirm("Tandai Selesai?")) await db.collection(coll).doc(id).update({ status: "Selesai" }); }

function renderSidebar() {
    const nav = document.getElementById("sidebarNav");
    let menu = '';
    if (currentUser.role === 'admin') {
        menu = `<div class="nav-item" onclick="showSection('secAdminDashboard')">📊 Dashboard Admin</div>
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
    if(id === 'secAdminRankings') loadRankings();
    if(id === 'secResellerDashboard') { loadResellerData(); loadResellerLeaderboard(); }
    toggleSidebar(false);
}

function openOrderModal() { document.getElementById("orderModal").classList.remove("hidden"); cart = []; renderCart(); goToStep1(); }
function closeOrderModal() { document.getElementById("orderModal").classList.add("hidden"); }
function toggleSidebar(f) {
    const s = document.getElementById("sidebar"), o = document.getElementById("sidebarOverlay");
    if(f===false){ s.classList.remove("active"); o.classList.remove("active"); }
    else { s.classList.toggle("active"); o.classList.toggle("active"); }
}
function logout() { auth.signOut(); }
function switchAuth(m) {
    document.getElementById("loginForm").classList.toggle("hidden", m==='register');
    document.getElementById("registerForm").classList.toggle("hidden", m==='login');
    document.getElementById("tLog").classList.toggle("active", m==='login');
    document.getElementById("tReg").classList.toggle("active", m==='register');
}
document.getElementById("loginForm").onsubmit = (e) => { e.preventDefault(); auth.signInWithEmailAndPassword(document.getElementById("loginEmail").value, document.getElementById("loginPassword").value); };
document.getElementById("registerForm").onsubmit = async (e) => {
    e.preventDefault();
    const cred = await auth.createUserWithEmailAndPassword(document.getElementById("regEmail").value, document.getElementById("regPassword").value);
    await db.collection("users").doc(cred.user.uid).set({ nama: document.getElementById("regNama").value, email: document.getElementById("regEmail").value, role: 'reseller', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
};
document.getElementById("editProfileForm").onsubmit = async (e) => { e.preventDefault(); await db.collection("users").doc(currentUser.id).update({ nama: document.getElementById("profNama").value, hp: document.getElementById("profHp").value }); alert("Profil Update!"); };
document.getElementById("resellerReturnForm").onsubmit = async (e) => { e.preventDefault(); await db.collection("returns").add({ resellerId: currentUser.id, nama: currentUser.nama, produk: document.getElementById("retProd").value, alasan: document.getElementById("retReason").value, hp: document.getElementById("retHp").value, status: "proses", createdAt: firebase.firestore.FieldValue.serverTimestamp() }); alert("Retur Dikirim!"); e.target.reset(); };
document.getElementById("resellerComplaintForm").onsubmit = async (e) => { e.preventDefault(); await db.collection("complaints").add({ resellerId: currentUser.id, nama: document.getElementById("compNama").value, hp: document.getElementById("compHp").value, pesan: document.getElementById("compText").value, status: "proses", createdAt: firebase.firestore.FieldValue.serverTimestamp() }); alert("Keluhan Dikirim!"); e.target.reset(); };
