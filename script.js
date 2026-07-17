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

// PROTEKSI & AUTH LISTENER
auth.onAuthStateChanged(async (user) => {
    if (user) {
        const doc = await db.collection("users").doc(user.uid).get();
        if (doc.exists) {
            currentUser = { id: user.uid, ...doc.data() };
            initApp();
        } else {
            alert("Data user tidak ditemukan di database!");
            auth.signOut();
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

function renderSidebar() {
    const nav = document.getElementById("sidebarNav");
    let menu = '';
    // Menghindari karakter aneh dengan teks langsung tanpa emoji jika perlu
    if (currentUser.role === 'admin') {
        menu = `
            <div class="nav-item active" id="n-secAdminDashboard" onclick="showSection('secAdminDashboard')">Dashboard Admin</div>
            <div class="nav-item" id="n-secAdminReturn" onclick="showSection('secAdminReturn')">Returan Masuk</div>
            <div class="nav-item" id="n-secAdminComplaint" onclick="showSection('secAdminComplaint')">Laporan Keluhan</div>
        `;
    } else {
        menu = `
            <div class="nav-item active" id="n-secResellerDashboard" onclick="showSection('secResellerDashboard')">Dashboard Reseller</div>
            <div class="nav-item" id="n-secResellerReturn" onclick="showSection('secResellerReturn')">Retur Barang</div>
            <div class="nav-item" id="n-secResellerComplaint" onclick="showSection('secResellerComplaint')">Laporan Keluhan</div>
        `;
    }
    menu += `<div class="nav-item" id="n-secProfile" onclick="showSection('secProfile')">Profil Akun</div>`;
    nav.innerHTML = menu;
}

function showSection(id) {
    document.querySelectorAll('.app-section').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(id);
    if(target) target.classList.remove('hidden');
    
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navBtn = document.getElementById('n-' + id);
    if (navBtn) {
        navBtn.classList.add('active');
        document.getElementById("sectionTitle").innerText = navBtn.innerText;
    }
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

// VALIDASI & PROSES LOGIN
document.getElementById("loginForm").onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const pass = document.getElementById("loginPassword").value;
    const btn = document.getElementById("btnLogin");

    if(!email || !pass) return alert("Harap isi email dan password!");

    btn.innerText = "MENGHUBUNGKAN...";
    btn.disabled = true;

    try {
        await auth.signInWithEmailAndPassword(email, pass);
    } catch (error) {
        btn.innerText = "MASUK KE DASHBOARD";
        btn.disabled = false;
        alert("Gagal Masuk: " + error.message);
    }
};

// VALIDASI DAFTAR
document.getElementById("registerForm").onsubmit = async (e) => {
    e.preventDefault();
    const nama = document.getElementById("regNama").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const pass = document.getElementById("regPassword").value;

    if(pass.length < 6) return alert("Password minimal 6 karakter!");

    const btn = document.getElementById("btnReg");
    btn.disabled = true;

    try {
        const cred = await auth.createUserWithEmailAndPassword(email, pass);
        await db.collection("users").doc(cred.user.uid).set({
            nama: nama, email: email, role: 'reseller', createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert("Pendaftaran Berhasil!");
    } catch (error) {
        btn.disabled = false;
        alert("Gagal Daftar: " + error.message);
    }
};

// DATA LOADING & LAINNYA
function loadResellerData() {
    db.collection("orders").where("resellerId", "==", currentUser.id).onSnapshot(snap => {
        let q = 0, t = 0, p = 0;
        const sorted = snap.docs.sort((a,b) => (b.data().createdAt?.seconds || 0) - (a.data().createdAt?.seconds || 0));
        
        document.getElementById("resellerDetailTable").innerHTML = sorted.map(doc => {
            const o = doc.data();
            if (o.status === 'selesai') {
                q += Number(o.jumlah); t += Number(o.total);
                p += Math.floor(Number(o.total) / 1000);
            }
            return `<tr><td><b>${o.produk}</b></td><td>${o.jumlah}</td><td>Rp${o.total.toLocaleString()}</td><td>${o.status}</td></tr>`;
        }).join('');
        document.getElementById("resQty").innerText = q;
        document.getElementById("resTotal").innerText = "Rp" + t.toLocaleString();
        document.getElementById("resPoin").innerText = p;
    });
}

function loadAdminData() {
    db.collection("orders").onSnapshot(snap => {
        let q = 0, t = 0, p = 0;
        document.getElementById("adminOrdersTable").innerHTML = snap.docs.map(doc => {
            const o = doc.data();
            if (o.status === 'selesai') { q += Number(o.jumlah); t += Number(o.total); p += Math.floor(Number(o.total) / 1000); }
            return `<tr><td>${o.resellerName}</td><td>${o.produk}</td><td>${o.jumlah}</td><td>${o.status === 'pending' ? `<button onclick="db.collection('orders').doc('${doc.id}').update({status:'selesai'})">Selesai</button>` : 'Selesai'}</td></tr>`;
        }).join('');
        document.getElementById("admQty").innerText = q;
        document.getElementById("admTotal").innerText = "Rp" + t.toLocaleString();
        document.getElementById("admPoin").innerText = p;
    });
}

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

// Fungsi lainnya (loadAdminReturns, loadAdminComplaints, dll) disesuaikan dengan pola di atas.
