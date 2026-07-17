// CONFIG FIREBASE (Gunakan punya Anda)
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
    
    // Set Data Profil
    document.getElementById("profNama").value = currentUser.nama || "";
    document.getElementById("profEmail").value = currentUser.email || "";
    document.getElementById("profHp").value = currentUser.hp || "";
    document.getElementById("uRole").innerText = currentUser.role.toUpperCase();

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

// ORDER FORM - PERBAIKAN FORCE CLOSE
document.getElementById("orderForm").onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btnSubmitOrder");
    
    try {
        btn.disabled = true;
        btn.innerText = "MEMPROSES...";

        const customerName = document.getElementById("ordCustomer").value;
        const productId = document.getElementById("ordProd").value;
        const qty = parseInt(document.getElementById("ordQty").value);
        const payment = document.getElementById("ordPayment").value;
        
        const productData = catalog.find(p => p.id === productId);
        if(!productData) throw new Error("Produk tidak valid");

        const orderData = {
            resellerId: currentUser.id,
            resellerName: currentUser.nama,
            customerName: customerName,
            produk: productData.nama,
            jumlah: qty,
            total: productData.harga * qty,
            metode: payment,
            status: "pending",
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection("orders").add(orderData);
        
        alert("Pesanan Berhasil Dikirim ke Admin!");
        closeOrderModal();
        e.target.reset();
    } catch (error) {
        console.error(error);
        alert("Gagal Checkout: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "CHECKOUT SEKARANG";
    }
};

// ADMIN DATA - MENAMPILKAN SIAPA YANG CHECKOUT
function loadAdminData() {
    db.collection("orders").onSnapshot(snap => {
        let q = 0, t = 0, p = 0;
        document.getElementById("adminOrdersTable").innerHTML = snap.docs.map(doc => {
            const o = doc.data();
            if (o.status === 'selesai') { 
                q += Number(o.jumlah); 
                t += Number(o.total); 
                p += Math.floor(Number(o.total) / 1000); 
            }
            return `<tr>
                <td><small>${o.resellerName || 'User'}</small></td>
                <td><b>${o.customerName || '-'}</b></td>
                <td>${o.produk}</td>
                <td>${o.jumlah}</td>
                <td><small>${o.metode || 'Transfer'}</small></td>
                <td>${o.status === 'pending' ? `<button onclick="updateOrderStatus('${doc.id}')" class="btn-sm-gold">Selesaikan</button>` : '✅'}</td>
            </tr>`;
        }).join('');
        document.getElementById("admQty").innerText = q;
        document.getElementById("admTotal").innerText = "Rp " + t.toLocaleString();
        document.getElementById("admPoin").innerText = p;
    });
}

// RESELLER DATA
function loadResellerData() {
    db.collection("orders").where("resellerId", "==", currentUser.id).onSnapshot(snap => {
        let q = 0, t = 0, p = 0;
        document.getElementById("resellerDetailTable").innerHTML = snap.docs.map(doc => {
            const o = doc.data();
            if (o.status === 'selesai') { 
                q += Number(o.jumlah); t += Number(o.total); p += Math.floor(Number(o.total) / 1000); 
            }
            return `<tr>
                <td>${o.customerName || '-'}</td>
                <td>${o.produk}</td>
                <td>${o.jumlah}</td>
                <td><small>${o.metode || 'Transfer'}</small></td>
                <td><span class="status status-${o.status}">${o.status}</span></td>
            </tr>`;
        }).join('');
        document.getElementById("resQty").innerText = q;
        document.getElementById("resTotal").innerText = "Rp " + t.toLocaleString();
        document.getElementById("resPoin").innerText = p;
    });
}

// EDIT PROFIL LOGIC
document.getElementById("profileEditForm").onsubmit = async (e) => {
    e.preventDefault();
    const newNama = document.getElementById("profNama").value;
    const newHp = document.getElementById("profHp").value;

    try {
        await db.collection("users").doc(currentUser.id).update({
            nama: newNama,
            hp: newHp
        });
        alert("Profil Berhasil Diperbarui!");
        // Update data lokal agar tidak perlu refresh
        currentUser.nama = newNama;
        currentUser.hp = newHp;
    } catch (err) {
        alert("Gagal Update: " + err.message);
    }
};

// FUNGSI STANDAR (Tetap Ada)
async function updateOrderStatus(id) {
    if(confirm("Selesaikan pesanan ini?")) {
        await db.collection("orders").doc(id).update({ status: 'selesai' });
    }
}
function syncCatalog() {
    db.collection("products").onSnapshot(snap => {
        catalog = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        document.getElementById("ordProd").innerHTML = catalog.map(p => `<option value="${p.id}">${p.nama} - Rp${p.harga}</option>`).join('');
    });
}
function renderSidebar() {
    const nav = document.getElementById("sidebarNav");
    let menu = '';
    if (currentUser.role === 'admin') {
        menu = `<div class="nav-item active" id="n-secAdminDashboard" onclick="showSection('secAdminDashboard')">Dashboard Admin</div>
                <div class="nav-item" id="n-secAdminReturn" onclick="showSection('secAdminReturn')">Returan Masuk</div>
                <div class="nav-item" id="n-secAdminComplaint" onclick="showSection('secAdminComplaint')">Laporan Keluhan</div>`;
    } else {
        menu = `<div class="nav-item active" id="n-secResellerDashboard" onclick="showSection('secResellerDashboard')">Dashboard Reseller</div>
                <div class="nav-item" id="n-secResellerReturn" onclick="showSection('secResellerReturn')">Retur Barang</div>
                <div class="nav-item" id="n-secResellerComplaint" onclick="showSection('secResellerComplaint')">Laporan Keluhan</div>`;
    }
    menu += `<div class="nav-item" id="n-secProfile" onclick="showSection('secProfile')">Profil Akun</div>`;
    nav.innerHTML = menu;
}
function showSection(id) {
    document.querySelectorAll('.app-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if(document.getElementById('n-'+id)) document.getElementById('n-'+id).classList.add('active');
    toggleSidebar(false);
}
function toggleSidebar(force) {
    const side = document.getElementById("sidebar");
    const over = document.getElementById("sidebarOverlay");
    if(force === false) { side.classList.remove("active"); over.classList.remove("active"); }
    else { side.classList.toggle("active"); over.classList.toggle("active"); }
}
function openOrderModal() { document.getElementById("orderModal").classList.remove("hidden"); }
function closeOrderModal() { document.getElementById("orderModal").classList.add("hidden"); }
function logout() { auth.signOut(); }
function switchAuth(m) {
    document.getElementById("loginForm").classList.toggle("hidden", m==='register');
    document.getElementById("registerForm").classList.toggle("hidden", m==='login');
    document.getElementById("tLog").classList.toggle("active", m==='login');
    document.getElementById("tReg").classList.toggle("active", m==='register');
}
document.getElementById("loginForm").onsubmit = (e) => {
    e.preventDefault();
    auth.signInWithEmailAndPassword(document.getElementById("loginEmail").value, document.getElementById("loginPassword").value).catch(a => alert(a.message));
};
document.getElementById("registerForm").onsubmit = async (e) => {
    e.preventDefault();
    try {
        const c = await auth.createUserWithEmailAndPassword(document.getElementById("regEmail").value, document.getElementById("regPassword").value);
        await db.collection("users").doc(c.user.uid).set({
            nama: document.getElementById("regNama").value, email: document.getElementById("regEmail").value,
            role: 'reseller', createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch(a) { alert(a.message); }
};
