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
        showSection('secAdminDashboard');
        loadAdminData();
    } else {
        showSection('secResellerDashboard');
        loadResellerData();
    }
}

function renderSidebar() {
    const nav = document.getElementById("sidebarNav");
    let menu = '';
    if (currentUser.role === 'admin') {
        menu = `<div class="nav-item" onclick="showSection('secAdminDashboard')">Dashboard Admin</div>
                <div class="nav-item" onclick="showSection('secAdminReturn')">Returan Masuk</div>
                <div class="nav-item" onclick="showSection('secAdminComplaint')">Keluhan Masuk</div>`;
    } else {
        menu = `<div class="nav-item" onclick="showSection('secResellerDashboard')">Dashboard Reseller</div>
                <div class="nav-item" onclick="showSection('secResellerReturn')">Retur Barang</div>
                <div class="nav-item" onclick="showSection('secResellerComplaint')">Laporan Keluhan</div>`;
    }
    menu += `<div class="nav-item" onclick="showSection('secProfile')">Profil Akun</div>`;
    nav.innerHTML = menu;
}

function showSection(id) {
    document.querySelectorAll('.app-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    toggleSidebar(false);
}

function toggleSidebar(force) {
    const side = document.getElementById("sidebar");
    const over = document.getElementById("sidebarOverlay");
    if(force === false) { side.classList.remove("active"); over.classList.remove("active"); }
    else { side.classList.toggle("active"); over.classList.toggle("active"); }
}

// LOGIKA INPUT DATA (FIXED FORCE CLOSE)
async function submitData(collection, data, alertMsg) {
    try {
        await db.collection(collection).add({
            ...data,
            resellerId: currentUser.id,
            resellerName: currentUser.nama,
            status: "Proses",
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert(alertMsg);
        return true;
    } catch (e) {
        alert("Gagal mengirim data: " + e.message);
        return false;
    }
}

// RESELLER: PESANAN BARU
document.getElementById("orderForm").onsubmit = async (e) => {
    e.preventDefault();
    const prod = catalog.find(p => p.id === document.getElementById("ordProd").value);
    const qty = parseInt(document.getElementById("ordQty").value);
    const data = {
        customerName: document.getElementById("ordCustomer").value,
        produk: prod.nama,
        jumlah: qty,
        total: prod.harga * qty,
        metode: document.getElementById("ordPayment").value
    };
    if (await submitData("orders", data, "Pesanan Berhasil!")) {
        closeOrderModal();
        e.target.reset();
    }
};

// RESELLER: RETUR
document.getElementById("resellerReturnForm").onsubmit = async (e) => {
    e.preventDefault();
    const data = {
        produk: document.getElementById("retProd").value,
        alasan: document.getElementById("retReason").value,
        hp: document.getElementById("retHp").value,
        idTiket: "RET-" + Date.now().toString().slice(-5)
    };
    if (await submitData("returns", data, "Pengajuan Retur Dikirim!")) e.target.reset();
};

// RESELLER: KELUHAN
document.getElementById("resellerComplaintForm").onsubmit = async (e) => {
    e.preventDefault();
    const data = {
        isi: document.getElementById("compText").value,
        pelapor: document.getElementById("compName").value,
        hp: document.getElementById("compHp").value,
        idTiket: "COMP-" + Date.now().toString().slice(-5)
    };
    if (await submitData("complaints", data, "Keluhan Berhasil Dikirim!")) e.target.reset();
};

// ADMIN: LOAD DATA
function loadAdminData() {
    db.collection("orders").onSnapshot(s => {
        document.getElementById("adminOrderTable").innerHTML = s.docs.map(d => {
            const o = d.data();
            return `<tr><td>${o.resellerName}</td><td>${o.customerName}</td><td>${o.produk}</td><td>${o.status === 'Proses' ? `<button onclick="updateStatus('orders','${d.id}')">Selesaikan</button>` : '✅'}</td></tr>`;
        }).join('');
    });
    db.collection("returns").onSnapshot(s => {
        document.getElementById("adminReturnTable").innerHTML = s.docs.map(d => {
            const r = d.data();
            return `<tr><td>${r.idTiket}</td><td>${r.resellerName}</td><td>${r.produk}</td><td>${r.status === 'Proses' ? `<button onclick="updateStatus('returns','${d.id}')">Selesai</button>` : '✅'}</td></tr>`;
        }).join('');
    });
    db.collection("complaints").onSnapshot(s => {
        document.getElementById("adminCompTable").innerHTML = s.docs.map(d => {
            const c = d.data();
            return `<tr><td>${c.idTiket}</td><td>${c.pelapor} (${c.hp})</td><td>${c.isi}</td><td>${c.status === 'Proses' ? `<button onclick="updateStatus('complaints','${d.id}')">Selesai</button>` : '✅'}</td></tr>`;
        }).join('');
    });
}

// RESELLER: LOAD DATA
function loadResellerData() {
    db.collection("orders").where("resellerId", "==", currentUser.id).onSnapshot(s => {
        let q=0, t=0;
        document.getElementById("resellerOrderTable").innerHTML = s.docs.map(d => {
            const o = d.data();
            if(o.status === 'Selesai') { q += o.jumlah; t += o.total; }
            return `<tr><td>${o.customerName}</td><td>${o.produk}</td><td>Rp ${o.total.toLocaleString()}</td><td class="status-${o.status.toLowerCase()}">${o.status}</td></tr>`;
        }).join('');
        document.getElementById("resQty").innerText = q;
        document.getElementById("resTotal").innerText = "Rp " + t.toLocaleString();
        document.getElementById("resPoin").innerText = Math.floor(t / 1000);
    });
    db.collection("returns").where("resellerId", "==", currentUser.id).onSnapshot(s => {
        document.getElementById("resellerReturnHistory").innerHTML = s.docs.map(d => `<tr><td>${d.data().idTiket}</td><td>${d.data().produk}</td><td class="status-${d.data().status.toLowerCase()}">${d.data().status}</td></tr>`).join('');
    });
    db.collection("complaints").where("resellerId", "==", currentUser.id).onSnapshot(s => {
        document.getElementById("resellerCompHistory").innerHTML = s.docs.map(d => `<tr><td>${d.data().idTiket}</td><td>${d.data().isi.substring(0,15)}...</td><td class="status-${d.data().status.toLowerCase()}">${d.data().status}</td></tr>`).join('');
    });
}

// UPDATE STATUS (ADMIN ONLY)
async function updateStatus(coll, id) {
    if(confirm("Tandai sebagai Selesai?")) {
        await db.collection(coll).doc(id).update({ status: "Selesai" });
    }
}

// AUTH & UTILS
function syncCatalog() {
    db.collection("products").onSnapshot(s => {
        catalog = s.docs.map(d => ({ id: d.id, ...d.data() }));
        document.getElementById("ordProd").innerHTML = catalog.map(p => `<option value="${p.id}">${p.nama} - Rp${p.harga}</option>`).join('');
    });
}
function logout() { auth.signOut(); }
function switchAuth(m) {
    document.getElementById("loginForm").classList.toggle("hidden", m==='register');
    document.getElementById("registerForm").classList.toggle("hidden", m==='login');
}
function openOrderModal() { document.getElementById("orderModal").classList.remove("hidden"); }
function closeOrderModal() { document.getElementById("orderModal").classList.add("hidden"); }

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
