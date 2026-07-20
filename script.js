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
    }
}

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

// PERINGKAT ADMIN
async function loadRankings() {
    try {
        const userSnap = await db.collection("users").where("role", "==", "reseller").get();
        const orderSnap = await db.collection("orders").where("status", "==", "Selesai").get();
        const allOrders = orderSnap.docs.map(d => d.data());

        let ranks = userSnap.docs.map(u => {
            const userData = u.data();
            const myOrders = allOrders.filter(o => o.resellerId === u.id);
            const totalBelanja = myOrders.reduce((sum, o) => sum + (o.total || 0), 0);
            return { nama: userData.nama, total: totalBelanja, poin: Math.floor(totalBelanja / 100) };
        });

        ranks.sort((a, b) => b.total - a.total);
        const tbody = document.getElementById("adminRankTable");
        if(tbody) {
            tbody.innerHTML = ranks.map((r, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
                const rowStyle = i === 0 ? 'background: #FFF9C4; font-weight: bold; border-left: 5px solid #FBC02D;' : '';
                return `
                <tr style="${rowStyle}">
                    <td style="text-align:center;">${i+1} ${medal}</td>
                    <td style="text-align:left;"><strong>${r.nama}</strong> ${i === 0 ? '👑' : ''}</td>
                    <td style="text-align:center; color: #C62828; font-weight: 800;">${r.poin.toLocaleString()} Poin</td>
                    <td style="text-align:right;">Rp ${r.total.toLocaleString()}</td>
                </tr>`;
            }).join('');
        }
    } catch (err) { console.error(err); }
}

// LEADERBOARD RESELLER
async function loadResellerLeaderboard() {
    try {
        const userSnap = await db.collection("users").where("role", "==", "reseller").get();
        const orderSnap = await db.collection("orders").where("status", "==", "Selesai").get();
        const allOrders = orderSnap.docs.map(d => d.data());
        
        let leaderboard = userSnap.docs.map(u => {
            const userData = u.data();
            const myOrders = allOrders.filter(o => o.resellerId === u.id);
            const totalBelanja = myOrders.reduce((sum, o) => sum + (o.total || 0), 0);
            return { id: u.id, nama: userData.nama, poin: Math.floor(totalBelanja / 100) };
        });

        leaderboard.sort((a, b) => b.poin - a.poin);
        const top10 = leaderboard.slice(0, 10);

        const tbody = document.getElementById("resellerLeaderboardTable");
        if(tbody) {
            tbody.innerHTML = top10.map((res, index) => {
                const isMe = res.id === currentUser.id;
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
                let rowStyle = '';
                if (index === 0) rowStyle = 'background: #FFF9C4; border-left: 5px solid #FBC02D; font-weight: bold;';
                else if (isMe) rowStyle = 'background: #fff3e0; font-weight: bold; border-left: 4px solid #F2A93B;';

                return `
                <tr style="${rowStyle}">
                    <td style="text-align:center;">${index + 1} ${medal}</td>
                    <td style="text-align:left;">${res.nama} ${index === 0 ? '👑' : ''} ${isMe ? '<small style="color:orange">(Saya)</small>' : ''}</td>
                    <td style="text-align:center; color: #C62828; font-weight: 800;">${res.poin.toLocaleString()} Poin</td>
                </tr>`;
            }).join('');
        }
    } catch (err) { console.log(err); }
}

// DASHBOARD DATA
function loadResellerData() {
    db.collection("orders").where("resellerId", "==", currentUser.id).onSnapshot(snap => {
        let q=0, t=0;
        document.getElementById("resellerOrderTable").innerHTML = snap.docs.map(d => {
            const o = d.data();
            if(o.status === 'Selesai') { q += (o.jumlah || 0); t += (o.total || 0); }
            return `<tr><td>${o.customerName}</td><td>${o.produk}</td><td>Rp ${o.total.toLocaleString()}</td><td>${o.status}</td></tr>`;
        }).join('');
        document.getElementById("resQty").innerText = q;
        document.getElementById("resTotal").innerText = "Rp "+t.toLocaleString();
        document.getElementById("resPoin").innerText = Math.floor(t/100).toLocaleString();
    });
}

function loadAdminData() {
    db.collection("orders").onSnapshot(snap => {
        let q=0, t=0, pending=0;
        document.getElementById("adminOrderTable").innerHTML = snap.docs.map(d => {
            const o = d.data();
            if(o.status === 'Selesai') { q++; t += (o.total || 0); }
            if(o.status === 'pending') pending++;
            return `<tr><td>${o.resellerName}</td><td>${o.customerName}</td><td>${o.produk}</td><td>${o.status==='pending'?`<button onclick="updateStat('orders','${d.id}')" style="background:#F2A93B; border:none; padding:5px 10px; border-radius:5px; cursor:pointer;">Selesai</button>`:'✅'}</td></tr>`;
        }).join('');
        document.getElementById("badgeOrder").innerText = pending;
        document.getElementById("admQty").innerText = q;
        document.getElementById("admTotal").innerText = "Rp "+t.toLocaleString();
        document.getElementById("admPoin").innerText = Math.floor(t/100).toLocaleString();
    });
}

// TRANSAKSI
function openOrderModal() { document.getElementById("orderModal").classList.remove("hidden"); cart = []; renderCart(); goToStep1(); }
function closeOrderModal() { document.getElementById("orderModal").classList.add("hidden"); }
function addToCart() {
    const prodId = document.getElementById("ordProdSelect").value;
    const qty = parseInt(document.getElementById("ordQtyInput").value);
    const prod = catalog.find(p => p.id === prodId);
    if (prod && qty > 0) {
        cart.push({ id: prod.id, nama: prod.nama, harga: prod.harga, qty: qty, subtotal: prod.harga * qty });
        renderCart();
    }
}
function renderCart() {
    const tbody = document.getElementById("cartTableBody"); let total = 0;
    tbody.innerHTML = cart.map((item, index) => { total += item.subtotal; return `<tr><td>${item.nama}</td><td>${item.qty}</td><td>Rp ${item.subtotal.toLocaleString()}</td><td><button onclick="removeFromCart(${index})" style="color:red;border:none;background:none;cursor:pointer;">X</button></td></tr>`; }).join('');
    document.getElementById("cartTotalText").innerText = "Total: Rp " + total.toLocaleString();
}
function removeFromCart(index) { cart.splice(index, 1); renderCart(); }
function goToStep2() { if (cart.length === 0) return alert("Pilih produk dulu!"); document.getElementById("orderStep1").classList.add("hidden"); document.getElementById("orderStep2").classList.remove("hidden"); }
function goToStep1() { document.getElementById("orderStep1").classList.remove("hidden"); document.getElementById("orderStep2").classList.add("hidden"); }

document.getElementById("orderFormFinal").onsubmit = async (e) => {
    e.preventDefault();
    const customer = document.getElementById("ordCustomer").value, hp = document.getElementById("ordHp").value, payment = document.getElementById("ordPayment").value;
    const totalBayar = cart.reduce((sum, i) => sum + i.subtotal, 0);
    const ringkasan = cart.map(i => `${i.nama} (${i.qty}x)`).join(", ");
    try {
        await db.collection("orders").add({ resellerId: currentUser.id, resellerName: currentUser.nama, customerName: customer, customerHp: hp, produk: ringkasan, total: totalBayar, jumlah: cart.reduce((sum, i) => sum + i.qty, 0), metode: payment, status: "pending", createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        let pesan = `*PESANAN BARU*\nReseller: ${currentUser.nama}\nPenerima: ${customer}\nHP: ${hp}\nMetode: ${payment}\n\n*Detail:*\n`;
        cart.forEach((item, i) => { pesan += `${i+1}. ${item.nama} (${item.qty}x) = Rp ${item.subtotal.toLocaleString()}\n`; });
        pesan += `\n*TOTAL: Rp ${totalBayar.toLocaleString()}*`;
        alert("Pesanan Masuk!"); closeOrderModal(); window.open(`https://wa.me/62895345452412?text=${encodeURIComponent(pesan)}`, '_blank');
    } catch (err) { alert(err.message); }
};

// KATALOG ADMIN
function loadAdminCatalog() {
    const table = document.getElementById("adminCatalogTable");
    if(!table) return;
    table.innerHTML = catalog.map(p => `
        <tr><td>${p.nama}</td><td><small>${p.kategori || '-'}</small></td><td>Rp ${p.harga.toLocaleString()}</td><td><button onclick="prepareEditProduct('${p.id}')" style="color:blue; border:none; background:none;">Edit</button> | <button onclick="deleteProduct('${p.id}')" style="color:red; border:none; background:none;">Hapus</button></td></tr>`).join('');
}
const admProdForm = document.getElementById("adminProductForm");
if(admProdForm) {
    admProdForm.onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById("prodId").value;
        const data = { nama: document.getElementById("prodNama").value, harga: parseInt(document.getElementById("prodHarga").value), kategori: document.getElementById("prodKategori").value };
        try {
            if (id) { await db.collection("products").doc(id).update(data); alert("Update Berhasil!"); }
            else { await db.collection("products").add(data); alert("Produk Ditambah!"); }
            resetProdForm();
        } catch (err) { alert(err.message); }
    };
}
function prepareEditProduct(id) {
    const p = catalog.find(item => item.id === id);
    document.getElementById("prodId").value = p.id;
    document.getElementById("prodNama").value = p.nama;
    document.getElementById("prodHarga").value = p.harga;
    document.getElementById("prodKategori").value = p.kategori || "";
    document.getElementById("btnSaveProduct").innerText = "UPDATE PRODUK";
}

async function deleteProduct(id) { if (confirm("Hapus produk?")) { await db.collection("products").doc(id).delete(); alert("Dihapus!"); } }
function resetProdForm() { admProdForm.reset(); document.getElementById("prodId").value = ""; document.getElementById("btnSaveProduct").innerText = "SIMPAN PRODUK"; }

// HANDLER PROFIL, RETUR, KELUHAN
const pForm = document.getElementById("editProfileForm");
if(pForm) { pForm.onsubmit = async (e) => { e.preventDefault(); try { await db.collection("users").doc(currentUser.id).update({ nama: document.getElementById("profNama").value, hp: document.getElementById("profHp").value }); alert("Profil Update!"); } catch(err) { alert(err.message); } }; }

async function updateStat(coll, id) { if(confirm("Tandai Selesai?")) await db.collection(coll).doc(id).update({ status: "Selesai" }); }
function syncCatalog() {
    db.collection("products").onSnapshot(s => {
        catalog = s.docs.map(d => ({ id: d.id, ...d.data() }));
        const sel = document.getElementById("ordProdSelect");
        if(sel) sel.innerHTML = catalog.map(p => `<option value="${p.id}">${p.nama} - Rp${p.harga.toLocaleString()}</option>`).join('');
    });
}
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
document.getElementById("loginForm").onsubmit = (e) => { e.preventDefault(); auth.signInWithEmailAndPassword(document.getElementById("loginEmail").value, document.getElementById("loginPassword").value).catch(err => alert(err.message)); };
document.getElementById("registerForm").onsubmit = async (e) => { e.preventDefault(); try { const cred = await auth.createUserWithEmailAndPassword(document.getElementById("regEmail").value, document.getElementById("regPassword").value); await db.collection("users").doc(cred.user.uid).set({ nama: document.getElementById("regNama").value, email: document.getElementById("regEmail").value, role: 'reseller', createdAt: firebase.firestore.FieldValue.serverTimestamp() }); alert("Berhasil!"); } catch(err) { alert(err.message); } };
