let cart = []; // Variabel penampung item sementara

// Update initApp untuk menampilkan email
function initApp() {
    document.getElementById("loginScreen").classList.add("hidden");
    document.getElementById("appWrapper").classList.remove("hidden");
    
    // Set field profil
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

// FUNGSI KERANJANG (STEP 1)
function addToCart() {
    const prodId = document.getElementById("ordProdSelect").value;
    const qty = parseInt(document.getElementById("ordQtyInput").value);
    const product = catalog.find(p => p.id === prodId);

    if (!product || qty < 1) return;

    const item = {
        id: product.id,
        nama: product.nama,
        harga: product.harga,
        qty: qty,
        subtotal: product.harga * qty
    };

    cart.push(item);
    renderCart();
}

function renderCart() {
    const container = document.getElementById("cartItems");
    let html = "";
    let grandTotal = 0;

    cart.forEach((item, index) => {
        grandTotal += item.subtotal;
        html += `
            <tr>
                <td>${item.nama}</td>
                <td>${item.qty}</td>
                <td>Rp ${item.subtotal.toLocaleString()}</td>
                <td><button onclick="removeFromCart(${index})" class="btn-danger-sm">x</button></td>
            </tr>
        `;
    });

    container.innerHTML = html;
    document.getElementById("cartGrandTotal").innerText = "Rp " + grandTotal.toLocaleString();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    renderCart();
}

// NAVIGASI MODAL
function goToStep2() {
    if (cart.length === 0) return alert("Pilih produk dulu!");
    document.getElementById("orderStep1").classList.add("hidden");
    document.getElementById("orderStep2").classList.remove("hidden");
}

function goToStep1() {
    document.getElementById("orderStep1").classList.remove("hidden");
    document.getElementById("orderStep2").classList.add("hidden");
}

function closeOrderModal() {
    document.getElementById("orderModal").classList.add("hidden");
    cart = [];
    renderCart();
    goToStep1();
}

function openOrderModal() {
    document.getElementById("orderModal").classList.remove("hidden");
    // Isi dropdown catalog
    document.getElementById("ordProdSelect").innerHTML = catalog.map(p => `<option value="${p.id}">${p.nama} - Rp${p.harga}</option>`).join('');
}

// KIRIM PESANAN (STEP 2)
document.getElementById("orderFormFinal").onsubmit = async (e) => {
    e.preventDefault();
    
    const customer = document.getElementById("ordCustomer").value;
    const hp = document.getElementById("ordHp").value;
    const payment = document.getElementById("ordPayment").value;
    const grandTotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
    const itemsString = cart.map(item => `${item.nama} (${item.qty}x)`).join(", ");
    
    try {
        // 1. Simpan ke Firebase
        await db.collection("orders").add({
            customerName: customer,
            customerHp: hp,
            produk: itemsString, // Menyimpan ringkasan produk
            jumlah: cart.reduce((sum, item) => sum + item.qty, 0),
            total: grandTotal,
            metode: payment,
            resellerId: currentUser.id,
            resellerName: currentUser.nama,
            status: "pending",
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 2. Format Pesan WhatsApp
        let waMessage = `*PESANAN BARU - OKTSHOP17*\n`;
        waMessage += `--------------------------\n`;
        waMessage += `*Reseller:* ${currentUser.nama}\n`;
        waMessage += `*Penerima:* ${customer}\n`;
        waMessage += `*No. HP:* ${hp}\n`;
        waMessage += `*Metode:* ${payment}\n\n`;
        waMessage += `*Daftar Pesanan:*\n`;
        
        cart.forEach((item, i) => {
            waMessage += `${i+1}. ${item.nama} (${item.qty}x) = Rp ${item.subtotal.toLocaleString()}\n`;
        });
        
        waMessage += `\n*TOTAL BAYAR: Rp ${grandTotal.toLocaleString()}*`;
        
        const encodedMsg = encodeURIComponent(waMessage);
        const waNumber = "62895345452412"; // Format internasional
        
        alert("Pesanan Berhasil Disimpan! Mengalihkan ke WhatsApp...");
        
        // 3. Reset & Tutup
        closeOrderModal();
        e.target.reset();

        // 4. Buka WhatsApp
        window.open(`https://wa.me/${waNumber}?text=${encodedMsg}`, '_blank');

    } catch (error) {
        alert("Gagal mengirim pesanan: " + error.message);
    }
};

// Update Sync Catalog agar update dropdown saat data produk berubah
function syncCatalog() {
    db.collection("products").onSnapshot(s => {
        catalog = s.docs.map(d => ({ id: d.id, ...d.data() }));
        // Jika sedang buka modal, update listnya
        const select = document.getElementById("ordProdSelect");
        if(select) select.innerHTML = catalog.map(p => `<option value="${p.id}">${p.nama} - Rp${p.harga}</option>`).join('');
    });
}
