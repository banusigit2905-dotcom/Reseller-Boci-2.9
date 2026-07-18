// CONFIG FIREBASE
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
    document.getElementById("profNama").value = currentUser.nama || "";
    document.getElementById("profHp").value = currentUser.hp || "";

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

// LOAD DATA ADMIN & NOTIFIKASI BADGE
function loadAdminData() {
    // Pesanan & Notif Badge Order
    db.collection("orders").onSnapshot(snap => {
        let q=0, t=0, pending=0;
        document.getElementById("adminOrderTable").innerHTML = snap.docs.map(d => {
            const o = d.data();
            if(o.status === 'Selesai') { q += o.jumlah; t += o.total; }
            if(o.status === 'pending') { pending++; }
            return `<tr><td>${o.resellerName}</td><td>${o.customerName}</td><td>${o.produk}</td><td>${o.status==='pending'?`<button onclick="updateStat('orders','${d.id}')">Selesai</button>`:'✅'}</td></tr>`;
        }).join('');
        document.getElementById("badgeOrder").innerText = pending;
        document.getElementById("admQty").innerText = q;
        document.getElementById("admTotal").innerText = "Rp "+t.toLocaleString();
        document.getElementById("admPoin").innerText = Math.floor(t/1000);
    });

    // Notif Badge Retur
    db.collection("returns").onSnapshot(snap => {
        let pending = 0;
        document.getElementById("adminReturnTable").innerHTML = snap.docs.map(d => {
            const r = d.data();
            if(r.status === 'Proses') { pending++; }
            return `<tr><td>${r.resellerName}</td><td>${r.produk}</td><td>${r.alasan}</td><td>${r.status==='Proses'?`<button onclick="updateStat('returns','${d.id}')">Selesai</button>`:'✅'}</td></tr>`;
        }).join('');
        document.getElementById("badgeReturn").innerText = pending;
    });

    // Notif Badge Keluhan
    db.collection("complaints").onSnapshot(snap => {
        let pending = 0;
        document.getElementById("adminCompTable").innerHTML = snap.docs.map(d => {
            const c = d.data();
            if(c.status === 'Proses') { pending++; }
            return `<tr><td>${c.pelapor}</td><td>${c.isi}</td><td>${c.hp}</td><td>${c.status==='Proses'?`<button onclick="updateStat('complaints','${d.id}')">Selesai</button>`:'✅'}</td></tr>`;
        }).join('');
        document.getElementById("badgeComplaint").innerText = pending;
    });
}

// LOAD DATA RESELLER & STATS
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
        document.getElementById("resPoin").innerText = Math.floor(t/1000);
    });
    // Load Return & Complaint History
    db.collection("returns").where("resellerId","==",currentUser.id).onSnapshot(s => {
        document.getElementById("resellerReturnHistory").innerHTML = s.docs.map(d => `<tr><td>${d.data().idTiket}</td><td>${d.data().produk}</td><td>${d.data().status}</td></tr>`).join('');
    });
    db.collection("complaints").where("resellerId","==",currentUser.id).onSnapshot(s => {
        document.getElementById("resellerCompHistory").innerHTML = s.docs.map(d => `<tr><td>${d.data().idTiket}</td><td>${d.data().isi.substring(0,10)}...</td><td>${d.data().status}</td></tr>`).join('');
    });
}

// SISTEM INPUT
document.getElementById("orderForm").onsubmit = async (e) => {
    e.preventDefault();
    const prod = catalog.find(p => p.id === document.getElementById("ordProd").value);
    const data = {
        customerName: document.getElementById("ordCustomer").value,
        produk: prod.nama, jumlah: parseInt(document.getElementById("ordQty").value),
        total: prod.harga * parseInt(document.getElementById("ordQty").value),
        metode: document.getElementById("ordPayment").value,
        resellerId: currentUser.id, resellerName: currentUser.nama, status: "pending",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await db.collection("orders").add(data);
    alert("Pesanan Terkirim!"); closeOrderModal(); e.target.reset();
};

document.getElementById("resellerReturnForm").onsubmit = async (e) => {
    e.preventDefault();
    await db.collection("returns").add({
        produk: document.getElementById("retProd").value, alasan: document.getElementById("retReason").value,
        hp: document.getElementById("retHp").value, resellerId: currentUser.id, resellerName: currentUser.nama,
        status: "Proses", idTiket: "RET-"+Date.now().toString().slice(-4), createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert("Retur dikirim!"); e.target.reset();
};

document.getElementById("resellerComplaintForm").onsubmit = async (e) => {
    e.preventDefault();
    await db.collection("complaints").add({
        isi: document.getElementById("compText").value, pelapor: document.getElementById("compName").value,
        hp: document.getElementById("compHp").value, resellerId: currentUser.id, resellerName: currentUser.nama,
        status: "Proses", idTiket: "CP-"+Date.now().toString().slice(-4), createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert("Keluhan dikirim!"); e.target.reset();
};

// UTILS
async function updateStat(coll, id) {
    if(confirm("Tandai Selesai?")) await db.collection(coll).doc(id).update({ status: "Selesai" });
}
function showSection(id) {
    document.querySelectorAll('.app-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    toggleSidebar(false);
}
function syncCatalog() {
    db.collection("products").onSnapshot(s => {
        catalog = s.docs.map(d => ({ id: d.id, ...d.data() }));
        document.getElementById("ordProd").innerHTML = catalog.map(p => `<option value="${p.id}">${p.nama} - Rp${p.harga}</option>`).join('');
    });
}
function toggleSidebar(f) {
    const s = document.getElementById("sidebar"), o = document.getElementById("sidebarOverlay");
    if(f===false){ s.classList.remove("active"); o.classList.remove("active"); }
    else { s.classList.toggle("active"); o.classList.toggle("active"); }
}
function openOrderModal() { document.getElementById("orderModal").classList.remove("hidden"); }
function closeOrderModal() { document.getElementById("orderModal").classList.add("hidden"); }
function logout() { auth.signOut(); }
function switchAuth(m) {
    document.getElementById("loginForm").classList.toggle("hidden", m==='register');
    document.getElementById("registerForm").classList.toggle("hidden", m==='login');
}
document.getElementById("loginForm").onsubmit = (e) => {
    e.preventDefault();
    auth.signInWithEmailAndPassword(document.getElementById("loginEmail").value, document.getElementById("loginPassword").value).catch(err => alert(err.message));
};
