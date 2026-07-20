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
    if(document.getElementById("profEmail")) document.getElementById("profEmail").value = currentUser.email || "";

    renderSidebar();
    syncCatalog();

    if (currentUser.role === 'admin') {
        showSection('secAdminDashboard');
        loadAdminData();
    } else {
        showSection('secResellerDashboard');
        loadResellerData();
        loadResellerLeaderboard();
        loadResellerReturns();
        loadResellerComplaints();
    }
}

function renderSidebar() {
    const nav = document.getElementById("sidebarNav");
    let menu = currentUser.role === 'admin' ? `
        <div class="nav-item" onclick="showSection('secAdminDashboard')">📊 Dashboard Admin</div>
        <div class="nav-item" onclick="showSection('secAdminRankings')">🏆 Peringkat Reseller</div>
    ` : `
        <div class="nav-item" onclick="showSection('secResellerDashboard')">📊 Dashboard Reseller</div>
        <div class="nav-item" onclick="showSection('secResellerReturn')">📦 Retur Barang</div>
        <div class="nav-item" onclick="showSection('secResellerComplaint')">📢 Laporan Keluhan</div>
    `;
    menu += `<div class="nav-item" onclick="showSection('secProfile')">👤 Profil Akun</div>`;
    nav.innerHTML = menu;
}

function showSection(id) {
    document.querySelectorAll('.app-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    toggleSidebar(false);
}

// LEADERBOARD DENGAN MEDALI & ALIGNMENT
async function loadResellerLeaderboard() {
    try {
        const userSnap = await db.collection("users").where("role", "==", "reseller").get();
        const orderSnap = await db.collection("orders").where("status", "==", "Selesai").get();
        const allOrders = orderSnap.docs.map(d => d.data());
        
        let lb = userSnap.docs.map(u => {
            const myOrders = allOrders.filter(o => o.resellerId === u.id);
            const total = myOrders.reduce((sum, o) => sum + (o.total || 0), 0);
            return { id: u.id, nama: u.data().nama, poin: Math.floor(total/100) };
        }).sort((a,b) => b.poin - a.poin).slice(0,10);

        const tbody = document.getElementById("resellerLeaderboardTable");
        if(tbody) {
            tbody.innerHTML = lb.map((res, index) => {
                let medal = index === 0 ? "🥇 " : index === 1 ? "🥈 " : index === 2 ? "🥉 " : "";
                return `
                <tr ${res.id === currentUser.id ? 'style="background:#fff3e0"' : ''}>
                    <td class="txt-center">${index + 1}</td>
                    <td><b>${medal}</b>${res.nama} ${res.id === currentUser.id ? '(Saya)' : ''}</td>
                    <td class="txt-center" style="color:#C62828; font-weight:800;">${res.poin.toLocaleString()}</td>
                </tr>`;
            }).join('');
        }
    } catch (e) { console.log(e); }
}

// SISTEM ORDER (MODAL)
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
    if(!tbody) return;
    tbody.innerHTML = cart.map((item, index) => { 
        total += item.subtotal; 
        return `<tr><td>${item.nama}</td><td>${item.qty}</td><td>Rp ${item.subtotal.toLocaleString()}</td><td><button onclick="removeFromCart(${index})" style="color:red;border:none;background:none;cursor:pointer;">X</button></td></tr>`; 
    }).join('');
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
        await db.collection("orders").add({ 
            resellerId: currentUser.id, resellerName: currentUser.nama, customerName: customer, 
            customerHp: hp, produk: ringkasan, total: totalBayar, 
            jumlah: cart.reduce((sum, i) => sum + i.qty, 0), metode: payment, 
            status: "pending", createdAt: firebase.firestore.FieldValue.serverTimestamp() 
        });
        alert("Pesanan Berhasil!"); closeOrderModal();
    } catch (err) { alert(err.message); }
};

// RIWAYAT RETUR & KELUHAN (FIXED SORT)
function loadResellerReturns() {
    db.collection("returns").where("resellerId", "==", currentUser.id).onSnapshot(snap => {
        const tbody = document.getElementById("resellerReturnTableBody");
        if(tbody) {
            const docs = snap.docs.map(d => d.data());
            docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            tbody.innerHTML = docs.map(d => `<tr><td><span class="ticket-badge">${d.ticket}</span></td><td class="status-${d.status.toLowerCase()} txt-center">${d.status}</td></tr>`).join('');
        }
    });
}
document.getElementById("resellerReturnForm").onsubmit = async (e) => {
    e.preventDefault();
    const t = "RET-" + Math.floor(1000 + Math.random() * 9000);
    await db.collection("returns").add({ resellerId: currentUser.id, ticket: t, produk: document.getElementById("retProd").value, alasan: document.getElementById("retReason").value, hp: document.getElementById("retHp").value, status: "Proses", createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    alert("Dikirim!"); e.target.reset();
};

function loadResellerComplaints() {
    db.collection("complaints").where("resellerId", "==", currentUser.id).onSnapshot(snap => {
        const tbody = document.getElementById("resellerComplaintTableBody");
        if(tbody) {
            const docs = snap.docs.map(d => d.data());
            docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            tbody.innerHTML = docs.map(d => `<tr><td><span class="ticket-badge">${d.ticket}</span></td><td class="status-${d.status.toLowerCase()} txt-center">${d.status}</td></tr>`).join('');
        }
    });
}
document.getElementById("resellerComplaintForm").onsubmit = async (e) => {
    e.preventDefault();
    const t = "COM-" + Math.floor(1000 + Math.random() * 9000);
    await db.collection("complaints").add({ resellerId: currentUser.id, ticket: t, hp: document.getElementById("compHp").value, keluhan: document.getElementById("compText").value, status: "Proses", createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    alert("Dikirim!"); e.target.reset();
};

// UTILS
function loadResellerData() {
    db.collection("orders").where("resellerId", "==", currentUser.id).onSnapshot(snap => {
        let q=0, t=0;
        document.getElementById("resellerOrderTable").innerHTML = snap.docs.map(d => {
            const o = d.data(); if(o.status === 'Selesai') { q += (o.jumlah || 0); t += (o.total || 0); }
            return `<tr><td>${o.customerName}</td><td>${o.produk}</td><td class="txt-right">Rp ${o.total.toLocaleString()}</td><td class="txt-center">${o.status}</td></tr>`;
        }).join('');
        document.getElementById("resQty").innerText = q; document.getElementById("resTotal").innerText = "Rp "+t.toLocaleString(); document.getElementById("resPoin").innerText = Math.floor(t/100).toLocaleString();
    });
}
function syncCatalog() {
    db.collection("products").onSnapshot(s => {
        catalog = s.docs.map(d => ({ id: d.id, ...d.data() }));
        const sel = document.getElementById("ordProdSelect");
        if(sel) sel.innerHTML = catalog.map(p => `<option value="${p.id}">${p.nama} - Rp${p.harga.toLocaleString()}</option>`).join('');
    });
}
function toggleSidebar(f) { const s = document.getElementById("sidebar"), o = document.getElementById("sidebarOverlay"); if(f===false){ s.classList.remove("active"); o.classList.remove("active"); } else { s.classList.toggle("active"); o.classList.toggle("active"); } }
function logout() { auth.signOut(); }
function switchAuth(m) { document.getElementById("loginForm").classList.toggle("hidden", m==='register'); document.getElementById("registerForm").classList.toggle("hidden", m==='login'); document.getElementById("tLog").classList.toggle("active", m==='login'); document.getElementById("tReg").classList.toggle("active", m==='register'); }
document.getElementById("loginForm").onsubmit = (e) => { e.preventDefault(); auth.signInWithEmailAndPassword(document.getElementById("loginEmail").value, document.getElementById("loginPassword").value).catch(err => alert(err.message)); };
document.getElementById("registerForm").onsubmit = async (e) => { e.preventDefault(); try { const email = document.getElementById("regEmail").value; const cred = await auth.createUserWithEmailAndPassword(email, document.getElementById("regPassword").value); await db.collection("users").doc(cred.user.uid).set({ nama: document.getElementById("regNama").value, email: email, role: 'reseller', createdAt: firebase.firestore.FieldValue.serverTimestamp() }); alert("Berhasil!"); } catch(err) { alert(err.message); } };
