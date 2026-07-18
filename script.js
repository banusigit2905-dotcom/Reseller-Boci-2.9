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
    
    // Set Profile Data
    document.getElementById("profNama").value = currentUser.nama || "";
    document.getElementById("profHp").value = currentUser.hp || "";
    document.getElementById("profEmail").value = currentUser.email || ""; // Email Readonly

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
        menu = `<div class="nav-item" onclick="showSection('secAdminDashboard')">📊 Dashboard Admin</div>
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

// FUNGSI ORDER DENGAN KERANJANG
function openOrderModal() {
    document.getElementById("orderModal").classList.remove("hidden");
    cart = [];
    renderCart();
    goToStep1();
}

function closeOrderModal() {
    document.getElementById("orderModal").classList.add("hidden");
}

function addToCart() {
    const prodId = document.getElementById("ordProdSelect").value;
    const qty = parseInt(document.getElementById("ordQtyInput").value);
    const prod = catalog.find(p => p.id === prodId);

    if (prod && qty > 0) {
        cart.push({
            id: prod.id,
            nama: prod.nama,
            harga: prod.harga,
            qty: qty,
            subtotal: prod.harga * qty
        });
        renderCart();
    }
}

function renderCart() {
    const tbody = document.getElementById("cartTableBody");
    let total = 0;
    tbody.innerHTML = cart.map((item, index) => {
        total += item.subtotal;
        return `<tr>
            <td>${item.nama}</td>
            <td>${item.qty}</td>
            <td>Rp ${item.subtotal.toLocaleString()}</td>
            <td><button onclick="removeFromCart(${index})" style="color:red; border:none; background:none; cursor:pointer;">X</button></td>
        </tr>`;
    }).join('');
    document.getElementById("cartTotalText").innerText = "Total: Rp " + total.toLocaleString();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    renderCart();
}

function goToStep2() {
    if (cart.length === 0) return alert("Pilih produk dulu!");
    document.getElementById("orderStep1").classList.add("hidden");
    document.getElementById("orderStep2").classList.remove("hidden");
}

function goToStep1() {
    document.getElementById("orderStep1").classList.remove("hidden");
    document.getElementById("orderStep2").classList.add("hidden");
}

// PROSES KIRIM PESANAN (FIREBASE & WA)
document.getElementById("orderFormFinal").onsubmit = async (e) => {
    e.preventDefault();
    const customer = document.getElementById("ordCustomer").value;
    const hp = document.getElementById("ordHp").value;
    const payment = document.getElementById("ordPayment").value;
    const totalBayar = cart.reduce((sum, i) => sum + i.subtotal, 0);
    const ringkasanProduk = cart.map(i => `${i.nama} (${i.qty}x)`).join(", ");

    try {
        // 1. Simpan ke Firebase
        await db.collection("orders").add({
            resellerId: currentUser.id,
            resellerName: currentUser.nama,
            customerName: customer,
            customerHp: hp,
            produk: ringkasanProduk,
            total: totalBayar,
            jumlah: cart.reduce((sum, i) => sum + i.qty, 0),
            metode: payment,
            status: "pending",
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 2. Format WA
        let pesan = `*HALO ADMIN, PESANAN BARU!*\n\n`;
        pesan += `*Reseller:* ${currentUser.nama}\n`;
        pesan += `*Penerima:* ${customer}\n`;
        pesan += `*No HP:* ${hp}\n`;
        pesan += `*Metode:* ${payment}\n\n`;
        pesan += `*Daftar Produk:*\n`;
        cart.forEach((item, index) => {
            pesan += `${index+1}. ${item.nama} (${item.qty}x) = Rp ${item.subtotal.toLocaleString()}\n`;
        });
        pesan += `\n*TOTAL: Rp ${totalBayar.toLocaleString()}*`;

        const waLink = `https://wa.me/62895345452412?text=${encodeURIComponent(pesan)}`;
        
        alert("Pesanan terkirim! Membuka WhatsApp...");
        closeOrderModal();
        window.open(waLink, '_blank');
        e.target.reset();
    } catch (err) {
        alert("Error: " + err.message);
    }
};

// --- SISANYA FUNGSI STANDAR ---
function syncCatalog() {
    db.collection("products").onSnapshot(s => {
        catalog = s.docs.map(d => ({ id: d.id, ...d.data() }));
        const select = document.getElementById("ordProdSelect");
        if(select) select.innerHTML = catalog.map(p => `<option value="${p.id}">${p.nama} - Rp${p.harga}</option>`).join('');
    });
}

function showSection(id) {
    document.querySelectorAll('.app-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    toggleSidebar(false);
}

function toggleSidebar(f) {
    const s = document.getElementById("sidebar"), o = document.getElementById("sidebarOverlay");
    if(f===false){ s.classList.remove("active"); o.classList.remove("active"); }
    else { s.classList.toggle("active"); o.classList.toggle("active"); }
}

function loadAdminData() {
    db.collection("orders").onSnapshot(snap => {
        let q=0, t=0, pending=0;
        document.getElementById("adminOrderTable").innerHTML = snap.docs.map(d => {
            const o = d.data();
            if(o.status === 'Selesai') { q += o.jumlah; t += o.total; }
            if(o.status === 'pending') { pending++; }
            return `<tr><td>${o.resellerName}</td><td>${o.customerName}</td><td>${o.produk}</td><td>${o.status==='pending'?`<button onclick="updateStat('orders','${d.id}')" class="btn-sm-gold">Selesai</button>`:'✅'}</td></tr>`;
        }).join('');
        document.getElementById("badgeOrder").innerText = pending;
        document.getElementById("admQty").innerText = q;
        document.getElementById("admTotal").innerText = "Rp "+t.toLocaleString();
    });
}

function loadResellerData() {
    db.collection("orders").where("resellerId", "==", currentUser.id).onSnapshot(snap => {
        let q=0, t=0;
        document.getElementById("resellerOrderTable").innerHTML = snap.docs.map(d => {
            const o = d.data();
            if(o.status === 'Selesai') { q += o.jumlah; t += o.total; }
            return `<tr><td>${o.customerName}</td><td>${o.produk}</td><td>Rp ${o.total.toLocaleString()}</td><td>${o.status}</td></tr>`;
        }).join('');
        document.getElementById("resQty").innerText = q;
        document.getElementById("resTotal").innerText = "Rp "+t.toLocaleString();
    });
}

async function updateStat(coll, id) {
    if(confirm("Tandai Selesai?")) await db.collection(coll).doc(id).update({ status: "Selesai" });
}

function logout() { auth.signOut(); }
function switchAuth(m) {
    document.getElementById("loginForm").classList.toggle("hidden", m==='register');
    document.getElementById("registerForm").classList.toggle("hidden", m==='login');
    document.getElementById("tLog").classList.toggle("active", m==='login');
    document.getElementById("tReg").classList.toggle("active", m==='register');
}

document.getElementById("loginForm").onsubmit = (e) => {
    e.preventDefault();
    auth.signInWithEmailAndPassword(document.getElementById("loginEmail").value, document.getElementById("loginPassword").value).catch(err => alert(err.message));
};

document.getElementById("registerForm").onsubmit = async (e) => {
    e.preventDefault();
    try {
        const cred = await auth.createUserWithEmailAndPassword(document.getElementById("regEmail").value, document.getElementById("regPassword").value);
        await db.collection("users").doc(cred.user.uid).set({
            nama: document.getElementById("regNama").value, email: document.getElementById("regEmail").value,
            role: 'reseller', createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert("Berhasil Daftar!");
    } catch(err) { alert(err.message); }
};
