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
        showSection('secAdminDashboard');
        loadAdminData();
    } else {
        document.getElementById("adminNotifHeader").classList.add("hidden");
        showSection('secResellerDashboard');
        loadResellerData();
        loadResellerHistory();
    }
}

// --- LOGIKA ADMIN ---

function loadAdminData() {
    db.collection("orders").orderBy("createdAt", "desc").onSnapshot(snap => {
        let q=0, t=0, pending=0;
        document.getElementById("adminOrderTable").innerHTML = snap.docs.map(d => {
            const o = d.data();
            if(o.status === 'Selesai') { q++; t += (o.total || 0); }
            if(o.status === 'pending') pending++;
            return `<tr><td>${o.resellerName}</td><td>${o.customerName}</td><td>${o.produk}</td><td>${o.status==='pending'?`<button onclick="updateStat('orders','${d.id}')" style="background:#F2A93B; border:none; padding:5px 10px; border-radius:5px; cursor:pointer; color:white; font-weight:bold;">Selesai</button>`:'✅'}</td></tr>`;
        }).join('');
        document.getElementById("badgeOrder").innerText = pending;
        document.getElementById("admQty").innerText = q;
        document.getElementById("admTotal").innerText = "Rp "+t.toLocaleString('id-ID');
        document.getElementById("admPoin").innerText = Math.floor(t/100).toLocaleString('id-ID');
    });

    db.collection("returns").orderBy("createdAt", "desc").onSnapshot(snap => {
        const badge = snap.docs.filter(d => d.data().status === 'proses').length;
        document.getElementById("badgeReturn").innerText = badge;
        const tb = document.getElementById("adminReturnTable");
        if(tb) {
            tb.innerHTML = snap.docs.map(d => {
                const r = d.data();
                return `<tr><td><b>${r.nama}</b><br><small>${r.hp}</small></td><td>${r.produk}<br><i style="font-size:10px">${r.alasan}</i></td><td>${r.status === 'proses' ? `<button onclick="updateStat('returns','${d.id}')" style="background:#C62828; color:white; border:none; padding:5px; border-radius:4px; cursor:pointer;">Selesai</button>` : '✅'}</td></tr>`;
            }).join('');
        }
    });

    db.collection("complaints").orderBy("createdAt", "desc").onSnapshot(snap => {
        const badge = snap.docs.filter(d => d.data().status === 'proses').length;
        document.getElementById("badgeComplaint").innerText = badge;
        const tb = document.getElementById("adminCompTable");
        if(tb) {
            tb.innerHTML = snap.docs.map(d => {
                const c = d.data();
                return `<tr><td><b>${c.nama}</b><br><small>${c.hp}</small></td><td>${c.pesan}</td><td>${c.status === 'proses' ? `<button onclick="updateStat('complaints','${d.id}')" style="background:#C62828; color:white; border:none; padding:5px; border-radius:4px; cursor:pointer;">Selesai</button>` : '✅'}</td></tr>`;
            }).join('');
        }
    });
}

function loadAdminCatalog() {
    const table = document.getElementById("adminCatalogTable");
    if(!table) return;
    table.innerHTML = catalog.map(p => `
        <tr>
            <td><b>${p.nama}</b></td>
            <td>${p.kategori || '-'}</td>
            <td>Rp ${p.harga.toLocaleString('id-ID')}</td>
            <td>
                <button onclick="prepareEditProduct('${p.id}')" style="color:blue; border:1px solid blue; background:none; padding:2px 5px; border-radius:4px; cursor:pointer;">Edit</button>
                <button onclick="deleteProduct('${p.id}')" style="color:red; border:1px solid red; background:none; padding:2px 5px; border-radius:4px; cursor:pointer; margin-top:2px;">Hapus</button>
            </td>
        </tr>`).join('');
}

function prepareEditProduct(id) {
    const p = catalog.find(item => item.id === id);
    if(p) {
        document.getElementById("prodId").value = p.id;
        document.getElementById("prodNama").value = p.nama;
        document.getElementById("prodHarga").value = p.harga;
        document.getElementById("prodKategori").value = p.kategori || "";
        document.getElementById("btnSaveProduct").innerText = "UPDATE PRODUK";
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

async function deleteProduct(id) {
    if (confirm("Hapus produk ini dari katalog?")) {
        try {
            await db.collection("products").doc(id).delete();
            alert("Produk dihapus!");
        } catch(e) { alert("Gagal hapus: " + e.message); }
    }
}

document.getElementById("adminProductForm").onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById("prodId").value;
    const data = { 
        nama: document.getElementById("prodNama").value, 
        harga: parseInt(document.getElementById("prodHarga").value), 
        kategori: document.getElementById("prodKategori").value 
    };
    try {
        if (id) {
            await db.collection("products").doc(id).update(data);
            alert("Produk diperbarui!");
        } else {
            await db.collection("products").add(data);
            alert("Produk ditambahkan!");
        }
        e.target.reset();
        document.getElementById("prodId").value = "";
        document.getElementById("btnSaveProduct").innerText = "SIMPAN PRODUK";
    } catch(e) { alert("Error: " + e.message); }
};

async function updateStat(coll, id) {
    if(confirm("Tandai Selesai?")) {
        try { await db.collection(coll).doc(id).update({ status: "Selesai" }); } catch(e) { console.error(e); }
    }
}

// --- LOGIKA UMUM & RESELLER ---

function renderSidebar() {
    const nav = document.getElementById("sidebarNav");
    let menu = '';
    if (currentUser.role === 'admin') {
        menu = `
            <div class="nav-item" onclick="showSection('secAdminDashboard')">📊 Dashboard Admin</div>
            <div class="nav-item" onclick="showSection('secAdminCatalog')">📦 Update Katalog</div>
            <div class="nav-item" onclick="showSection('secAdminRankings')">🏆 Peringkat Reseller</div>
            <div class="nav-item" onclick="showSection('secAdminReturn')">📥 Returan Masuk</div>
            <div class="nav-item" onclick="showSection('secAdminComplaint')">📢 Keluhan Masuk</div>`;
    } else {
        menu = `
            <div class="nav-item" onclick="showSection('secResellerDashboard')">📊 Dashboard Reseller</div>
            <div class="nav-item" onclick="showSection('secResellerReturn')">📦 Retur Barang</div>
            <div class="nav-item" onclick="showSection('secResellerComplaint')">📢 Laporan Keluhan</div>`;
    }
    menu += `<div class="nav-item" onclick="showSection('secProfile')">👤 Profil Akun</div>`;
    nav.innerHTML = menu;
}

function showSection(id) {
    document.querySelectorAll('.app-section').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(id);
    if(target) target.classList.remove('hidden');
    if(id === 'secAdminRankings') loadRankings();
    if(id === 'secAdminCatalog') loadAdminCatalog();
    if(id === 'secResellerDashboard') { loadResellerData(); loadResellerLeaderboard(); }
    toggleSidebar(false);
}

function syncCatalog() {
    db.collection("products").onSnapshot(s => {
        catalog = s.docs.map(d => ({ id: d.id, ...d.data() }));
        const catSelect = document.getElementById("ordCatSelect");
        if(catSelect) {
            const categories = [...new Set(catalog.map(p => p.kategori || "Tanpa Kategori"))];
            catSelect.innerHTML = '<option value="Semua">-- Semua Kategori --</option>' + 
                categories.map(c => `<option value="${c}">${c}</option>`).join('');
        }
        filterProductsByCategory();
        if (currentUser.role === 'admin') loadAdminCatalog();
    });
}

function filterProductsByCategory() {
    const selectedCat = document.getElementById("ordCatSelect")?.value || "Semua";
    const prodSelect = document.getElementById("ordProdSelect");
    if(!prodSelect) return;
    let filtered = catalog;
    if (selectedCat !== "Semua") { filtered = catalog.filter(p => (p.kategori || "Tanpa Kategori") === selectedCat); }
    prodSelect.innerHTML = filtered.map(p => `<option value="${p.id}">${p.nama} - Rp${p.harga.toLocaleString('id-ID')}</option>`).join('');
}

function loadResellerData() {
    db.collection("orders").where("resellerId", "==", currentUser.id).onSnapshot(snap => {
        let q=0, t=0;
        document.getElementById("resellerOrderTable").innerHTML = snap.docs.map(d => {
            const o = d.data();
            if(o.status === 'Selesai') { q += (o.jumlah || 0); t += (o.total || 0); }
            return `<tr><td>${o.customerName}</td><td>${o.produk}</td><td>Rp ${o.total.toLocaleString('id-ID')}</td><td>${o.status}</td></tr>`;
        }).join('');
        document.getElementById("resQty").innerText = q;
        document.getElementById("resTotal").innerText = "Rp "+t.toLocaleString('id-ID');
        document.getElementById("resPoin").innerText = Math.floor(t/100).toLocaleString('id-ID');
    });
}

function loadResellerHistory() {
    db.collection("returns").where("resellerId", "==", currentUser.id).onSnapshot(snap => {
        const tb = document.getElementById("resellerReturnHistory");
        if(tb) tb.innerHTML = snap.docs.map(doc => {
            const d = doc.data();
            return `<tr><td><b>${d.produk}</b><br><small>${d.alasan}</small></td><td>${d.nama}</td><td>${d.hp}</td><td style="color:${d.status==='Selesai'?'green':'orange'}">${d.status || 'proses'}</td></tr>`;
        }).join('');
    });
    db.collection("complaints").where("resellerId", "==", currentUser.id).onSnapshot(snap => {
        const tb = document.getElementById("resellerCompHistory");
        if(tb) tb.innerHTML = snap.docs.map(doc => {
            const d = doc.data();
            return `<tr><td>${d.pesan}</td><td>${d.nama}</td><td>${d.hp}</td><td style="color:${d.status==='Selesai'?'green':'orange'}">${d.status || 'proses'}</td></tr>`;
        }).join('');
    });
}

async function loadRankings() {
    const userSnap = await db.collection("users").where("role", "==", "reseller").get();
    const orderSnap = await db.collection("orders").where("status", "==", "Selesai").get();
    const allOrders = orderSnap.docs.map(d => d.data());
    let ranks = userSnap.docs.map(u => {
        const userData = u.data();
        const myOrders = allOrders.filter(o => o.resellerId === u.id);
        const total = myOrders.reduce((sum, o) => sum + (o.total || 0), 0);
        return { nama: userData.nama, total, poin: Math.floor(total / 100) };
    });
    ranks.sort((a, b) => b.total - a.total);
    const tbody = document.getElementById("adminRankTable");
    if(tbody) tbody.innerHTML = ranks.map((r, i) => `<tr><td>${i+1}</td><td>${r.nama}</td><td>${r.poin}</td><td>Rp ${r.total.toLocaleString('id-ID')}</td></tr>`).join('');
}

async function loadResellerLeaderboard() {
    const userSnap = await db.collection("users").where("role", "==", "reseller").get();
    const orderSnap = await db.collection("orders").where("status", "==", "Selesai").get();
    const allOrders = orderSnap.docs.map(d => d.data());
    let leaderboard = userSnap.docs.map(u => {
        const myOrders = allOrders.filter(o => o.resellerId === u.id);
        const total = myOrders.reduce((sum, o) => sum + (o.total || 0), 0);
        return { id: u.id, nama: u.data().nama, poin: Math.floor(total / 100) };
    });
    leaderboard.sort((a, b) => b.poin - a.poin);
    const tbody = document.getElementById("resellerLeaderboardTable");
    if(tbody) tbody.innerHTML = leaderboard.slice(0, 10).map((res, index) => `<tr><td>${index+1}</td><td>${res.nama}</td><td>${res.poin} Poin</td></tr>`).join('');
}

function openOrderModal() { document.getElementById("orderModal").classList.remove("hidden"); cart = []; renderCart(); goToStep1(); }
function closeOrderModal() { document.getElementById("orderModal").classList.add("hidden"); }
function addToCart() {
    const prodId = document.getElementById("ordProdSelect").value;
    const qty = parseInt(document.getElementById("ordQtyInput").value);
    const prod = catalog.find(p => p.id === prodId);
    if (prod && qty > 0) { cart.push({ id: prod.id, nama: prod.nama, harga: prod.harga, qty: qty, subtotal: prod.harga * qty }); renderCart(); }
}
function renderCart() {
    const tbody = document.getElementById("cartTableBody"); let total = 0;
    tbody.innerHTML = cart.map((item, index) => { total += item.subtotal; return `<tr><td>${item.nama}</td><td>${item.qty}</td><td>Rp ${item.subtotal.toLocaleString('id-ID')}</td><td><button onclick="removeFromCart(${index})" style="border:none; background:none; color:red; font-weight:bold; cursor:pointer;">X</button></td></tr>`; }).join('');
    document.getElementById("cartTotalText").innerText = "Total: Rp " + total.toLocaleString('id-ID');
}
function removeFromCart(index) { cart.splice(index, 1); renderCart(); }
function goToStep2() { if (cart.length === 0) return alert("Pilih produk!"); document.getElementById("orderStep1").classList.add("hidden"); document.getElementById("orderStep2").classList.remove("hidden"); }
function goToStep1() { document.getElementById("orderStep1").classList.remove("hidden"); document.getElementById("orderStep2").classList.add("hidden"); }

// --- LOGIKA PESAN WHATSAPP (SESUAI GAMBAR) ---
document.getElementById("orderFormFinal").onsubmit = async (e) => {
    e.preventDefault();
    const customer = document.getElementById("ordCustomer").value;
    const hp = document.getElementById("ordHp").value;
    const payment = document.getElementById("ordPayment").value;
    const totalBayar = cart.reduce((sum, i) => sum + i.subtotal, 0);
    const ringkasan = cart.map(i => `${i.nama} (${i.qty}x)`).join(", ");
    
    try {
        // Simpan database
        await db.collection("orders").add({ resellerId: currentUser.id, resellerName: currentUser.nama, customerName: customer, customerHp: hp, produk: ringkasan, total: totalBayar, jumlah: cart.reduce((sum, i) => sum + i.qty, 0), metode: payment, status: "pending", createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        
        // Buat Pesan (Format Gambar)
        let pesan = `PESANAN BARU\n`;
        pesan += `Reseller: ${currentUser.nama}\n`;
        pesan += `Penerima: ${customer}\n`;
        pesan += `HP: ${hp}\n`;
        pesan += `Metode: ${payment}\n\n`;
        pesan += `Detail:\n`;
        
        cart.forEach((item, i) => {
            pesan += `  ${i+1}. ${item.nama} (${item.qty}x) = Rp ${item.subtotal.toLocaleString('id-ID')}\n`;
        });
        
        pesan += `\nTOTAL: Rp ${totalBayar.toLocaleString('id-ID')}`;
        
        closeOrderModal(); 
        window.open(`https://wa.me/62895345452412?text=${encodeURIComponent(pesan)}`, '_blank');
    } catch(err) {
        alert("Error: " + err.message);
    }
};

document.getElementById("editProfileForm").onsubmit = async (e) => {
    e.preventDefault();
    await db.collection("users").doc(currentUser.id).update({ nama: document.getElementById("profNama").value, hp: document.getElementById("profHp").value });
    alert("Profil Update!");
};

document.getElementById("resellerReturnForm").onsubmit = async (e) => {
    e.preventDefault();
    await db.collection("returns").add({ resellerId: currentUser.id, nama: currentUser.nama, produk: document.getElementById("retProd").value, alasan: document.getElementById("retReason").value, hp: document.getElementById("retHp").value, status: "proses", createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    alert("Retur Dikirim!"); e.target.reset();
};

document.getElementById("resellerComplaintForm").onsubmit = async (e) => {
    e.preventDefault();
    await db.collection("complaints").add({ resellerId: currentUser.id, nama: document.getElementById("compNama").value, hp: document.getElementById("compHp").value, pesan: document.getElementById("compText").value, status: "proses", createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    alert("Keluhan Dikirim!"); e.target.reset();
};

function toggleSidebar(f) {
    const s = document.getElementById("sidebar"), o = document.getElementById("sidebarOverlay");
    if(f===false){ s.classList.remove("active"); o.classList.remove("active"); }
    else { s.classList.toggle("active"); o.classList.toggle("active"); }
}
function logout() { auth.signOut(); }
function switchAuth(m) {
    document.getElementById("loginForm").classList.toggle("hidden", m==='register');
    document.getElementById("registerForm").classList.toggle("hidden", m==='login');
}
document.getElementById("loginForm").onsubmit = (e) => { e.preventDefault(); auth.signInWithEmailAndPassword(document.getElementById("loginEmail").value, document.getElementById("loginPassword").value); };
document.getElementById("registerForm").onsubmit = async (e) => {
    e.preventDefault();
    const cred = await auth.createUserWithEmailAndPassword(document.getElementById("regEmail").value, document.getElementById("regPassword").value);
    await db.collection("users").doc(cred.user.uid).set({ nama: document.getElementById("regNama").value, email: document.getElementById("regEmail").value, role: 'reseller', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
};
