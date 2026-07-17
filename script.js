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

// AUTH LISTENER
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
    document.getElementById("uNama").innerText = currentUser.nama;
    document.getElementById("uEmail").innerText = currentUser.email;
    document.getElementById("uRole").innerText = currentUser.role.toUpperCase();

    renderSidebar();
    syncCatalog();

    if (currentUser.role === 'admin') {
        showSection('secAdminDashboard');
        loadAdminData();
        loadAdminReturns();
        loadAdminComplaints();
    } else {
        showSection('secResellerDashboard');
        loadResellerData();
        loadResellerReturns();
        loadResellerComplaints();
    }
}

// UI LOGIC
function renderSidebar() {
    const nav = document.getElementById("sidebarNav");
    let menu = '';
    if (currentUser.role === 'admin') {
        menu = `
            <div class="nav-item active" id="n-secAdminDashboard" onclick="showSection('secAdminDashboard')">ðŸ“Š Dashboard Admin</div>
            <div class="nav-item" id="n-secAdminReturn" onclick="showSection('secAdminReturn')">ðŸ“¥ Returan Masuk</div>
            <div class="nav-item" id="n-secAdminComplaint" onclick="showSection('secAdminComplaint')">ðŸ“¢ Laporan Keluhan</div>
        `;
    } else {
        menu = `
            <div class="nav-item active" id="n-secResellerDashboard" onclick="showSection('secResellerDashboard')">ðŸ“Š Dashboard Reseller</div>
            <div class="nav-item" id="n-secResellerReturn" onclick="showSection('secResellerReturn')">ðŸ“¦ Retur Barang</div>
            <div class="nav-item" id="n-secResellerComplaint" onclick="showSection('secResellerComplaint')">ðŸ“¢ Laporan Keluhan</div>
        `;
    }
    menu += `<div class="nav-item" id="n-secProfile" onclick="showSection('secProfile')">ðŸ‘¤ Profil Akun</div>`;
    nav.innerHTML = menu;
}

function showSection(id) {
    document.querySelectorAll('.app-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (document.getElementById('n-' + id)) document.getElementById('n-' + id).classList.add('active');
    document.getElementById("sectionTitle").innerText = document.getElementById('n-' + id).innerText;
    toggleSidebar(false);
}

function toggleSidebar(force) {
    const side = document.getElementById("sidebar");
    const over = document.getElementById("sidebarOverlay");
    if (force === false) {
        side.classList.remove("active");
        over.classList.remove("active");
    } else {
        side.classList.toggle("active");
        over.classList.toggle("active");
    }
}

// DATA LOADING (RESELLER) - FIXED POIN & TOTAL
function loadResellerData() {
    db.collection("orders").where("resellerId", "==", currentUser.id).onSnapshot(snap => {
        let q = 0, t = 0, p = 0;
        const sorted = snap.docs.sort((a,b) => (b.data().createdAt?.seconds || 0) - (a.data().createdAt?.seconds || 0));
        
        document.getElementById("resellerDetailTable").innerHTML = sorted.map(doc => {
            const o = doc.data();
            if (o.status === 'selesai') {
                q += Number(o.jumlah);
                t += Number(o.total);
                p += Math.floor(Number(o.total) / 1000);
            }
            return `<tr><td><b>${o.produk}</b></td><td>${o.jumlah}</td><td>Rp${o.total.toLocaleString()}</td><td><span class="status status-${o.status}">${o.status}</span></td></tr>`;
        }).join('');

        document.getElementById("resQty").innerText = q;
        document.getElementById("resTotal").innerText = "Rp" + t.toLocaleString();
        document.getElementById("resPoin").innerText = p;
    });
}

// DATA LOADING (ADMIN)
function loadAdminData() {
    db.collection("orders").onSnapshot(snap => {
        let q = 0, t = 0, p = 0;
        document.getElementById("adminOrdersTable").innerHTML = snap.docs.map(doc => {
            const o = doc.data();
            if (o.status === 'selesai') { q += Number(o.jumlah); t += Number(o.total); p += Math.floor(Number(o.total) / 1000); }
            return `<tr><td>${o.resellerName}</td><td>${o.produk}</td><td>${o.jumlah}</td><td>${o.status === 'pending' ? `<button onclick="db.collection('orders').doc('${doc.id}').update({status:'selesai'})" style="font-size:9px; background:green; color:#fff; border-radius:4px; padding:4px; border:none; cursor:pointer;">Selesai</button>` : 'âœ…'}</td></tr>`;
        }).join('');
        document.getElementById("admQty").innerText = q;
        document.getElementById("admTotal").innerText = "Rp" + t.toLocaleString();
        document.getElementById("admPoin").innerText = p;
    });
}

// RETUR SYSTEM
document.getElementById("returnForm").onsubmit = async (e) => {
    e.preventDefault();
    const snap = await db.collection("returns").get();
    const nextId = (snap.size + 1).toString().padStart(5, '0');
    await db.collection("returns").add({
        returnId: nextId, produk: document.getElementById("retProd").value, alasan: document.getElementById("retReason").value,
        hp: document.getElementById("retHp").value, resellerId: currentUser.id, resellerName: currentUser.nama,
        status: "Proses", createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert("Retur berhasil diajukan! No: #" + nextId); e.target.reset();
};

function loadResellerReturns() {
    db.collection("returns").where("resellerId", "==", currentUser.id).onSnapshot(snap => {
        document.getElementById("resellerReturnTable").innerHTML = snap.docs.map(doc => {
            const r = doc.data();
            return `<tr><td>#${r.returnId}</td><td>${r.produk}</td><td><span class="status status-proses">${r.status}</span></td></tr>`;
        }).join('');
    });
}

function loadAdminReturns() {
    db.collection("returns").onSnapshot(snap => {
        document.getElementById("adminReturnTable").innerHTML = snap.docs.map(doc => {
            const r = doc.data();
            return `<tr><td>#${r.returnId}</td><td>${r.resellerName}</td><td>${r.produk}</td><td>${r.status === 'Proses' ? `<button onclick="db.collection('returns').doc('${doc.id}').update({status:'Selesai'})" style="font-size:9px; background:blue; color:#fff; border:none; padding:4px; border-radius:4px; cursor:pointer;">Selesai</button>` : 'âœ…'}</td></tr>`;
        }).join('');
    });
}

// KELUHAN SYSTEM
document.getElementById("complaintForm").onsubmit = async (e) => {
    e.preventDefault();
    const snap = await db.collection("complaints").get();
    const id = (snap.size + 1).toString().padStart(5, '0');
    await db.collection("complaints").add({
        ticketId: id, content: document.getElementById("compText").value, name: document.getElementById("compName").value,
        resellerId: currentUser.id, status: "Masuk", createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert("Keluhan terkirim! No Tiket: #" + id); e.target.reset();
};

function loadResellerComplaints() {
    db.collection("complaints").where("resellerId", "==", currentUser.id).onSnapshot(snap => {
        document.getElementById("resellerCompTable").innerHTML = snap.docs.map(doc => {
            const c = doc.data();
            return `<tr><td>#${c.ticketId}</td><td>${c.content.substring(0, 20)}...</td><td><span class="status status-masuk">${c.status}</span></td></tr>`;
        }).join('');
    });
}

function loadAdminComplaints() {
    db.collection("complaints").onSnapshot(snap => {
        document.getElementById("adminCompTable").innerHTML = snap.docs.map(doc => {
            const c = doc.data();
            return `<tr><td>#${c.ticketId}</td><td>${c.name}</td><td>${c.content}</td><td><select onchange="db.collection('complaints').doc('${doc.id}').update({status:this.value})" style="font-size:10px;"><option value="">Update...</option><option value="Selesai">Selesai</option></select></td></tr>`;
        }).join('');
    });
}

// HELPER & AUTH
function syncCatalog() {
    db.collection("products").onSnapshot(snap => {
        catalog = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        document.getElementById("ordProd").innerHTML = catalog.map(p => `<option value="${p.id}">${p.nama} - Rp${p.harga}</option>`).join('');
    });
}

function switchAuth(m) {
    document.getElementById("loginForm").classList.toggle("hidden", m === 'register');
    document.getElementById("registerForm").classList.toggle("hidden", m === 'login');
    document.getElementById("tLog").classList.toggle("active", m === 'login');
    document.getElementById("tReg").classList.toggle("active", m === 'register');
}

function logout() { if (confirm("Keluar dari aplikasi?")) auth.signOut(); }
function openOrderModal() { document.getElementById("orderModal").classList.remove("hidden"); }
function closeOrderModal() { document.getElementById("orderModal").classList.add("hidden"); }

document.getElementById("loginForm").onsubmit = (e) => {
    e.preventDefault();
    auth.signInWithEmailAndPassword(document.getElementById("loginEmail").value, document.getElementById("loginPassword").value).catch(a => alert("Gagal Login: " + a.message));
};

document.getElementById("registerForm").onsubmit = async (e) => {
    e.preventDefault();
    try {
        const c = await auth.createUserWithEmailAndPassword(document.getElementById("regEmail").value, document.getElementById("regPassword").value);
        await db.collection("users").doc(c.user.uid).set({
            nama: document.getElementById("regNama").value, email: document.getElementById("regEmail").value,
            role: 'reseller', createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert("Pendaftaran Berhasil!");
    } catch (a) { alert(a.message); }
};

document.getElementById("orderForm").onsubmit = async (e) => {
    e.preventDefault();
    const pid = document.getElementById("ordProd").value;
    const prod = catalog.find(x => x.id === pid);
    const qty = parseInt(document.getElementById("ordQty").value);
    await db.collection("orders").add({
        resellerId: currentUser.id, resellerName: currentUser.nama, produk: prod.nama, jumlah: qty, total: prod.harga * qty,
        status: "pending", createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert("Pesanan terkirim!"); closeOrderModal();
};
