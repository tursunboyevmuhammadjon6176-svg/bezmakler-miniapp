const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  tg.setHeaderColor("#142442");
  tg.setBackgroundColor("#f3f5f9");
}

const initData = tg?.initData || "";
const $ = (id) => document.getElementById(id);
let allListings = [];

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}), "X-Telegram-Init-Data": initData };
  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Server bilan bog'lanishda xatolik.");
  return data;
}

function money(value) {
  return Number(value).toLocaleString("uz-UZ") + " so'm";
}

function safe(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

function renderListings() {
  const query = $("searchInput").value.trim().toLowerCase();
  const audience = $("audienceFilter").value;
  const rooms = $("roomsFilter").value;

  const filtered = allListings.filter(item => {
    const text = `${item.title} ${item.district} ${item.address}`.toLowerCase();
    const roomMatch = !rooms ||
      (rooms === "5" ? Number(item.rooms) >= 5 : String(item.rooms) === rooms);
    return text.includes(query) &&
      (!audience || item.audience === audience || item.audience === "Barchaga") &&
      roomMatch;
  });

  $("listingCount").textContent = `${filtered.length} ta e'lon`;
  $("listings").innerHTML = filtered.length ? filtered.map(item => `
    <article class="card">
      <img src="${safe(item.photo || "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600")}" alt="Kvartira rasmi">
      <div class="card-body">
        <h3>${safe(item.title)}</h3>
        <p class="location">📍 ${safe(item.district)}${item.address ? ", " + safe(item.address) : ""}</p>
        <p class="meta">🚪 ${safe(item.rooms)} xona · 👥 ${safe(item.audience)}</p>
        <p class="price">${money(item.price)}</p>
        <a class="call-btn" href="tel:${safe(item.phone)}">📞 Qo'ng'iroq qilish</a>
      </div>
    </article>
  `).join("") : `<div class="empty">Hozircha mos e'lon topilmadi.</div>`;
}

async function loadListings() {
  try {
    allListings = await api("/api/listings");
    renderListings();
  } catch (error) {
    $("listingCount").textContent = error.message;
    $("listings").innerHTML = `<div class="empty">E'lonlarni yuklab bo'lmadi. Keyinroq qayta urinib ko'ring.</div>`;
  }
}

function switchTab(tab) {
  ["list", "add", "profile"].forEach(name => {
    $(name + "Section").classList.toggle("hidden", name !== tab);
    document.querySelector(`[data-tab="${name}"]`).classList.toggle("active", name === tab);
  });
}

document.querySelectorAll(".tab").forEach(button => {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
});

$("searchInput").addEventListener("input", renderListings);
$("audienceFilter").addEventListener("change", renderListings);
$("roomsFilter").addEventListener("change", renderListings);

$("listingForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector("button[type=submit]");
  const message = $("formMessage");
  if (!initData) {
    message.textContent = "Iltimos, Mini App'ni Telegram bot ichidan oching.";
    return;
  }

  submit.disabled = true;
  submit.textContent = "YUBORILMOQDA...";
  message.textContent = "";

  try {
    const formData = new FormData(form);
    const result = await api("/api/listings", {
      method: "POST",
      body: formData
    });
    message.textContent = "✅ " + result.message;
    form.reset();
  } catch (error) {
    message.textContent = "❌ " + error.message;
  } finally {
    submit.disabled = false;
    submit.textContent = "E'LONNI ADMINGA YUBORISH";
  }
});

async function loadProfile() {
  if (!initData) {
    $("profileName").textContent = "Telegram ichidan oching";
    $("profileUsername").textContent = "";
    $("profileId").textContent = "";
    return;
  }
  try {
    const me = await api("/api/me");
    $("profileName").textContent = me.firstName || "Foydalanuvchi";
    $("profileUsername").textContent = me.username ? "@" + me.username : "Username mavjud emas";
    $("profileId").textContent = "Telegram ID: " + me.id + (me.isAdmin ? " · Admin" : "");
  } catch {
    $("profileName").textContent = "Profilni yuklab bo'lmadi";
  }
}

loadListings();
loadProfile();
